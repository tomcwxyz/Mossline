import { isRecorded } from "./field-atlas";
import type { GraphDocument, GraphEdge } from "./schema";

/**
 * The grammar of relationship and systems maps, as Kumu users draw them:
 * what kind each link is, which way it points, and for cause-and-effect
 * maps whether it increases (+) or decreases (−) what it points to. Loops
 * are found only along recorded, directed links; a loop's kind follows
 * from its links' signs, and is "unknown" if any sign is missing.
 */
export type Polarity = "+" | "-";
const PLUS = new Set(["+", "plus", "positive", "increase", "increases", "same", "s", "reinforcing", "more"]);
const MINUS = new Set(["-", "−", "–", "minus", "negative", "decrease", "decreases", "opposite", "o", "less"]);
/** Read a sign from source text ("+", "positive", "decreases"…); anything else is no sign. */
export function readPolarity(value: unknown): Polarity | null {
  if (typeof value === "number") return value > 0 ? "+" : value < 0 ? "-" : null;
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return PLUS.has(v) ? "+" : MINUS.has(v) ? "-" : null;
}
const POLARITY_KEYS = ["polarity", "Polarity", "effect", "Effect", "sign", "Sign"];
/** A link's sign, from its own recorded properties or a type that is only a sign. */
export function edgePolarity(edge: GraphEdge): Polarity | null {
  for (const k of POLARITY_KEYS) { const p = readPolarity(edge.properties?.[k]); if (p) return p; }
  return readPolarity(edge.type);
}

export interface ConnectionType { type: string; count: number; directed: number; signed: number }
/** The kinds of recorded link in a map, most common first. */
export function connectionTypes(graph: GraphDocument): ConnectionType[] {
  const m = new Map<string, ConnectionType>();
  for (const e of graph.edges) {
    if (!isRecorded(e)) continue;
    const t = m.get(e.type) ?? { type: e.type, count: 0, directed: 0, signed: 0 };
    t.count++;
    if ((e.direction ?? "directed") !== "undirected") t.directed++;
    if (edgePolarity(e)) t.signed++;
    m.set(e.type, t);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

export interface FeedbackLoop {
  id: string;
  nodeIds: string[];
  edgeIds: string[];
  kind: "reinforcing" | "balancing" | "unknown";
  /** Signs in order around the loop; null where the source gives none. */
  signs: (Polarity | null)[];
}

/**
 * Simple directed cycles, bounded in length and number
 * so a dense map cannot run away. Mutual links count both ways; undirected
 * and inferred links are never used.
 */
export function feedbackLoops(graph: GraphDocument, options: { maxLength?: number; max?: number } = {}): { loops: FeedbackLoop[]; truncated: boolean } {
  const maxLength = options.maxLength ?? 8, max = options.max ?? 200;
  const out = new Map<string, { to: string; edge: GraphEdge }[]>();
  for (const e of graph.edges) {
    if (!isRecorded(e) || e.source === e.target) continue;
    const dir = e.direction ?? "directed";
    if (dir === "undirected") continue;
    out.set(e.source, [...(out.get(e.source) ?? []), { to: e.target, edge: e }]);
    if (dir === "mutual") out.set(e.target, [...(out.get(e.target) ?? []), { to: e.source, edge: e }]);
  }
  const ids = [...new Set([...out.keys(), ...[...out.values()].flatMap(l => l.map(x => x.to))])].sort();
  const order = new Map(ids.map((id, i) => [id, i]));
  const loops: FeedbackLoop[] = [];
  const seen = new Set<string>();
  let truncated = false;
  // From each start node s, a depth-limited search over nodes ordered after s,
  // so each cycle is found once (from its lowest node). A step budget keeps
  // dense maps bounded; hitting it is reported, never hidden.
  let budget = 400_000;
  for (const s of ids) {
    if (truncated) break;
    const si = order.get(s)!;
    const onPath = new Set<string>([s]);
    const pathNodes: string[] = [s], pathEdges: GraphEdge[] = [];
    const walk = (v: string) => {
      for (const { to: w, edge } of out.get(v) ?? []) {
        if (truncated) return;
        if (--budget < 0) { truncated = true; return; }
        if ((order.get(w) ?? -1) < si) continue;
        if (w === s) {
          const edgeIds = [...pathEdges.map(e => e.id), edge.id];
          const key = edgeIds.join("|");
          if (seen.has(key)) continue;
          seen.add(key);
          const signs = [...pathEdges, edge].map(edgePolarity);
          const negatives = signs.filter(x => x === "-").length;
          loops.push({ id: "loop:" + key, nodeIds: [...pathNodes], edgeIds, signs,
            kind: signs.some(x => x === null) ? "unknown" : negatives % 2 === 0 ? "reinforcing" : "balancing" });
          if (loops.length >= max) { truncated = true; return; }
        } else if (!onPath.has(w) && pathNodes.length < maxLength) {
          onPath.add(w); pathNodes.push(w); pathEdges.push(edge);
          walk(w);
          onPath.delete(w); pathNodes.pop(); pathEdges.pop();
        }
      }
    };
    walk(s);
  }
  loops.sort((a, b) => a.nodeIds.length - b.nodeIds.length || a.id.localeCompare(b.id));
  return { loops, truncated };
}

/** Systems-thinking labels: R1, R2… for reinforcing, B1… for balancing, L1… where signs are missing. */
export function loopLabels(loops: FeedbackLoop[]): Map<string, string> {
  const n = { reinforcing: 0, balancing: 0, unknown: 0 };
  const letter = { reinforcing: "R", balancing: "B", unknown: "L" };
  return new Map(loops.map(l => [l.id, letter[l.kind] + (++n[l.kind])]));
}
