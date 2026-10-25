/// <reference lib="webworker" />
/** Network lens layout. Runs off the main thread and only sees recorded
 *  connectivity: pencil suggestions never move a record.
 *
 *  1. Louvain finds densely linked groups (a navigation aid, never a claim).
 *  2. Groups are seeded on a sunflower so related records start together.
 *  3. ForceAtlas2 (LinLog) relaxes the layout so linked records sit close.
 *     Links inside a group pull harder than links between groups, so groups
 *     read as separate areas; every pull is still a recorded link.
 *  Records with no recorded links are placed by the main thread, not here. */
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import louvain from "graphology-communities-louvain";

type Message = { kind: "layout"; nodes: string[]; edges: [string, string][] };
type Reply = { kind: "positions"; positions: [string, number, number, number][] } | { kind: "error"; message: string };

/** LinLog pulls single-link records onto their hub. A short relaxation keeps
 *  a minimum gap between marks (about 1/65 of the drawing) so each stays
 *  pickable; it moves records apart, never towards anything. */
function spread(positions: Record<string, { x: number; y: number }>, rounds = 40, share = 65) {
  const pts = Object.values(positions);
  if (pts.length < 2) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const gap = Math.max(maxX - minX, maxY - minY, 1) / share;
  for (let round = 0; round < rounds; round++) {
    // Numeric cell keys: string keys made this pass slow on large maps.
    const grid = new Map<number, number[]>();
    const cellKey = (cx: number, cy: number) => (cx + 32768) * 65536 + (cy + 32768);
    pts.forEach((p, i) => {
      const k = cellKey(Math.floor(p.x / gap), Math.floor(p.y / gap));
      const cell = grid.get(k); if (cell) cell.push(i); else grid.set(k, [i]);
    });
    let moved = false;
    pts.forEach((p, i) => {
      const cx = Math.floor(p.x / gap), cy = Math.floor(p.y / gap);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const j of grid.get(cellKey(cx + dx, cy + dy)) ?? []) {
          if (j <= i) continue;
          const q = pts[j];
          const ex = q.x - p.x, ey = q.y - p.y, d = Math.hypot(ex, ey);
          if (d >= gap) continue;
          const a = (i * 2.399963) % (Math.PI * 2);
          const ux = d > 1e-9 ? ex / d : Math.cos(a), uy = d > 1e-9 ? ey / d : Math.sin(a);
          const m = (gap - d) / 2;
          p.x -= ux * m; p.y -= uy * m; q.x += ux * m; q.y += uy * m;
          moved = true;
        }
      }
    });
    if (!moved) break;
  }
}

const post = (reply: Reply) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(reply);

self.onmessage = (event: MessageEvent<Message>) => {
  const msg = event.data;
  if (msg.kind !== "layout") return;
  try {
    const graph = new Graph({ type: "undirected", multi: false, allowSelfLoops: false });
    for (const id of msg.nodes) graph.addNode(id);
    for (const [source, target] of msg.edges)
      if (source !== target && graph.hasNode(source) && graph.hasNode(target)) graph.mergeEdge(source, target);
    graph.forEachNode(id => { if (graph.degree(id) === 0) graph.dropNode(id); });
    if (graph.order === 0) { post({ kind: "positions", positions: [] }); return; }

    // A small map (a systems map, a theory of change) is one drawing, not areas:
    // every link pulls equally and records keep room for their names.
    const small = graph.order <= 80;
    const community = graph.size > 0 ? louvain(graph, { resolution: 1.1, randomWalk: false }) : {};
    graph.forEachEdge((edge, _attrs, source, target) =>
      graph.setEdgeAttribute(edge, "weight", small || community[source] === community[target] ? 1 : 0.12));
    // Seed: each community gets a centre on a sunflower, sized by membership.
    const members = new Map<number, string[]>();
    graph.forEachNode(id => {
      const c = community[id] ?? 0;
      members.set(c, [...(members.get(c) ?? []), id]);
    });
    const ordered = [...members].sort((a, b) => b[1].length - a[1].length);
    ordered.forEach(([, ids], i) => {
      const angle = i * 2.399963;
      const ring = Math.sqrt(i) * 140;
      const cx = Math.cos(angle) * ring, cy = Math.sin(angle) * ring;
      ids.forEach((id, j) => {
        const a = j * 2.399963, r = Math.sqrt(j) * 4;
        graph.setNodeAttribute(id, "x", cx + Math.cos(a) * r);
        graph.setNodeAttribute(id, "y", cy + Math.sin(a) * r);
      });
    });
    const n = graph.order;
    const positions = small ? forceAtlas2(graph, {
      iterations: 600, getEdgeWeight: "weight",
      settings: { linLogMode: false, gravity: 1, scalingRatio: 12, slowDown: 1.5, edgeWeightInfluence: 1, strongGravityMode: true,
        barnesHutOptimize: false, adjustSizes: false, outboundAttractionDistribution: false }
    }) : forceAtlas2(graph, {
      // Groups are seeded apart, so large maps settle in fewer, coarser steps.
      iterations: n > 8000 ? 60 : n > 3000 ? 100 : n > 800 ? 220 : 320,
      getEdgeWeight: "weight",
      settings: {
        linLogMode: true, gravity: 0.6, scalingRatio: 4, slowDown: 2, edgeWeightInfluence: 1,
        barnesHutOptimize: n > 500, barnesHutTheta: n > 3000 ? 1 : 0.7, strongGravityMode: false,
        adjustSizes: false, outboundAttractionDistribution: false
      }
    });
    spread(positions, small ? 80 : 40, small ? 9 : 65);
    post({ kind: "positions", positions: Object.entries(positions).map(([id, p]) =>
      [id, p.x, p.y, community[id] ?? 0]) });
  } catch (e) {
    post({ kind: "error", message: e instanceof Error ? e.message : "Layout failed" });
  }
};
