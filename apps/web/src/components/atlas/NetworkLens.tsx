"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { edgePolarity, isRecorded, type GraphDocument, type GraphEdge, type GraphNode, type StoryMark } from "@mossline/graph-core";
import type { Point } from "./marginalia";
import { MarkLayer, placeMarks, type MarkStyle, type StoryPin } from "./MarkLayer";
import { copyCanvases, motion, registerLens } from "./snapshot";
import { PIGMENTS, SKETCH_FONT, blobPath } from "./sketch";
import { PALETTES, SHAPE, markSize, mix, type AtlasTheme } from "./palette";
import { areasFromCommunities, placeUnlinked, terrain, themeLayout, type AtlasArea, type Positions } from "./layout";

export interface AtlasRoute { nodeIds: string[]; edgeIds: string[] }
type Props = {
  graph: GraphDocument;
  mode: "network" | "themes";
  theme: AtlasTheme;
  selectedId: string | null;
  route: AtlasRoute | null;
  onPick: (id: string | null) => void;
  onUnavailable: () => void;
  /** Themes: the group of each record, and whether the grouping is a suggestion. */
  groupOf?: Map<string, string>;
  groupKey?: string;
  groupName?: string;
  suggested?: boolean;
  /** Records not drawn here (grants drawn as links) and the record that stands for them. */
  alias?: Map<string, string>;
  /** Colour of a recorded link (by kind or by sign), or null for plain ink; linkKey changes when the rule does. */
  linkColour?: (edge: GraphEdge) => string | null;
  linkKey?: string;
  /** A story step: the author's marks, and the records to bring into view (zooming in if need be). */
  marks?: StoryMark[];
  /** Story pictures pinned to records. */
  pins?: StoryPin[];
  /** How the story's marks are drawn. */
  markStyle?: MarkStyle;
  frame?: string[];
  /** Changes when the space around the map changes (presenting, say), so the step is framed again. */
  frameKey?: string;
  /** The Sketched style (a trial): watercolour washes and handwritten names. Themes only, for now. */
  sketch?: boolean;
};
/** People who ask for less motion get cuts instead of camera moves. */
const reducedMotion = () => motion.still || (typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
type SigmaType = import("sigma").default;
/** Home framing: a little zoomed out so chips, key and caption do not cover
 *  records. Themes also leaves room for the tag list on the left. */
const FRAMES = { network: { x: 0.5, y: 0.495, ratio: 1.22, angle: 0 }, themes: { x: 0.43, y: 0.5, ratio: 1.34, angle: 0 } };
type GraphType = import("graphology").default;
type LayoutResult = { positions: Positions; areas: AtlasArea[]; washed: Positions; community: Map<string, number> };
/** Recent layouts, so returning to a lens or switching Night/Day keeps records where they were. */
const LAYOUTS = new Map<string, LayoutResult>();

/** The Network and Themes lenses. Sigma draws the records; an SVG wash and
 *  HTML area names sit underneath and above it, following the camera. */
export function NetworkLens({ graph, mode, theme, selectedId: chosenId, route, onPick, onUnavailable, groupOf, groupKey = "", groupName = "Source tags", suggested = false, alias, linkColour, linkKey = "", marks, pins, markStyle, frame, frameKey, sketch = false }: Props) {
  const sketched = sketch && mode === "themes";
  const filterId = "ml-wc-" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const selectedId = chosenId && alias?.has(chosenId) ? alias.get(chosenId)! : chosenId;
  const stage = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const washGroup = useRef<SVGGElement>(null);
  const areaLayer = useRef<HTMLDivElement>(null);
  /** "+" and "−" badges on the links in focus: signs drawn as HTML so they stay legible. */
  const signLayer = useRef<HTMLDivElement>(null);
  /** The author's marks, redrawn as the camera moves. */
  const markLayer = useRef<SVGSVGElement>(null);
  /** Which mode the current drawing was built for. */
  const builtFor = useRef<string | null>(null);
  const marksRef = useRef(marks); marksRef.current = marks;
  const pinsRef = useRef(pins); pinsRef.current = pins;
  const aliasRef = useRef(alias); aliasRef.current = alias;
  const sigmaRef = useRef<SigmaType | null>(null);
  const graphRef = useRef<GraphType | null>(null);
  const pick = useRef(onPick); pick.current = onPick;
  const unavailable = useRef(onUnavailable); unavailable.current = onUnavailable;
  const focus = useRef<{ selected: string | null; neighbours: Set<string>; pencil: Set<string>;
    route: AtlasRoute | null; routeNodes: Set<string>; routeEdges: Set<string>; labelled: Set<string> }>({
    selected: null, neighbours: new Set(), pencil: new Set(), route: null, routeNodes: new Set(), routeEdges: new Set(),
    labelled: new Set() });
  const [status, setStatus] = useState<"preparing" | "laying-out" | "ready" | "error">("preparing");
  // Bumped after every rebuild: a cached layout can go from "ready" to "ready"
  // inside one React batch, so status alone cannot signal a new drawing.
  const [built, setBuilt] = useState(0);
  const [wash, setWash] = useState<{ d: string; level: number }[]>([]);
  const [areas, setAreas] = useState<AtlasArea[]>([]);
  const palette = PALETTES[theme];
  const recorded = useMemo(() => graph.edges.filter(isRecorded).length, [graph]);
  const degree = useMemo(() => {
    const d = new Map(graph.nodes.map(n => [n.id, 0]));
    for (const e of graph.edges) if (isRecorded(e)) {
      if (d.has(e.source)) d.set(e.source, d.get(e.source)! + 1);
      if (d.has(e.target)) d.set(e.target, d.get(e.target)! + 1);
    }
    return d;
  }, [graph]);

  // Keep the overlay (wash and area names) registered to Sigma's camera.
  const syncOverlay = () => {
    const renderer = sigmaRef.current;
    if (!renderer) return;
    const o = renderer.graphToViewport({ x: 0, y: 0 });
    const ax = renderer.graphToViewport({ x: 1, y: 0 });
    const ay = renderer.graphToViewport({ x: 0, y: 1 });
    washGroup.current?.setAttribute("transform",
      `matrix(${ax.x - o.x} ${ax.y - o.y} ${ay.x - o.x} ${ay.y - o.y} ${o.x} ${o.y})`);
    const signs = signLayer.current, data = graphRef.current;
    if (signs && data) for (const el of Array.from(signs.children) as HTMLElement[]) {
      const id = el.dataset.edge!;
      if (!data.hasEdge(id)) continue;
      const [s, t] = data.extremities(id);
      const a = renderer.getNodeDisplayData(s), b = renderer.getNodeDisplayData(t);
      if (!a || !b) continue;
      const pa = renderer.framedGraphToViewport(a), pb = renderer.framedGraphToViewport(b);
      el.style.transform = `translate(${Math.round((pa.x + pb.x) / 2 - 9)}px, ${Math.round((pa.y + pb.y) / 2 - 9)}px)`;
    }
    drawMarks();
    const layer = areaLayer.current;
    if (!layer) return;
    const ratio = renderer.getCamera().ratio;
    // Area names fade when zoomed in, and step back while a record or route is in focus.
    const quiet = focus.current.selected || focus.current.route ? 0.3 : 1;
    layer.style.opacity = String((ratio < 0.28 ? 0 : ratio < 0.5 ? 0.55 : 1) * quiet);
    const placed: [number, number, number, number][] = [];
    for (const el of Array.from(layer.children) as HTMLElement[]) {
      const x = Number(el.dataset.x), y = Number(el.dataset.y), r = Number(el.dataset.r || 0);
      const centre = renderer.graphToViewport({ x, y });
      const rim = renderer.graphToViewport({ x, y: y + r });
      const lift = Math.hypot(rim.x - centre.x, rim.y - centre.y);
      const w = el.offsetWidth || 120, h = el.offsetHeight || 30;
      const p = { x: centre.x, y: centre.y - lift - (r ? h * 0.2 : 0) };
      const box: [number, number, number, number] = [p.x - w / 2, p.y - h / 2, p.x + w / 2, p.y + h / 2];
      const clash = placed.some(b => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]));
      el.style.transform = `translate(${Math.round(p.x - w / 2)}px, ${Math.round(p.y - h / 2)}px)`;
      el.style.visibility = clash ? "hidden" : "visible";
      if (!clash) placed.push(box);
    }
  };

  // Filters hand over a new graph object even when the records are the same;
  // rebuild (and lay out again) only when the records and links really change.
  const signature = useMemo(() => {
    let h = 2166136261;
    const add = (text: string) => { for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } };
    for (const n of graph.nodes) { add(n.id); add(n.type); add(n.label); }
    for (const e of graph.edges) { add(e.id); add(e.inferred ? "~" : "|"); }
    return `${graph.nodes.length}:${graph.edges.length}:${h >>> 0}`;
  }, [graph]);

  useEffect(() => {
    let cancelled = false;
    let renderer: SigmaType | null = null;
    let worker: Worker | null = null;
    setStatus("preparing"); setWash([]); setAreas([]);
    const box = container.current;
    // Marks are sized in screen pixels; a phone-width canvas gets smaller ones.
    const narrow = (box?.clientWidth ?? 1000) < 600;
    const tall = (box?.clientHeight ?? 0) > (box?.clientWidth ?? 1);
    const cacheKey = [signature, mode, mode === "themes" ? groupKey : "", narrow, tall].join("|");

    // 1. Layout first, off the main thread, while the renderer code loads. Sigma
    //    is only created once positions are final, so a large map is drawn once.
    const layout: Promise<LayoutResult> = LAYOUTS.has(cacheKey) ? Promise.resolve(LAYOUTS.get(cacheKey)!)
      : mode === "themes" ? Promise.resolve((() => { const t = themeLayout(graph.nodes, groupOf, suggested);
        return { positions: t.positions, areas: t.areas, washed: t.positions, community: new Map<string, number>() }; })())
      : new Promise<LayoutResult>(resolve => {
        const linked = graph.nodes.filter(n => (degree.get(n.id) ?? 0) > 0);
        const unlinked = graph.nodes.filter(n => (degree.get(n.id) ?? 0) === 0).map(n => n.id);
        const complete = (positions: Positions, community: Map<string, number>) => {
          const found = areasFromCommunities(linked, positions, community, degree);
          // The wash follows linked records only; the unlinked block is not an area of activity.
          const washed = new Map(positions);
          const block = placeUnlinked(unlinked, positions, tall);
          // A phone has room for the larger areas' names only.
          const named = linked.length <= 80 ? [] : narrow ? found.slice(0, 6) : found;
          resolve({ positions, areas: block ? [...named, block] : named, washed, community });
        };
        if (cancelled) return;
        setStatus("laying-out");
        try {
          worker = new Worker(new URL("../../workers/atlas-layout.worker.ts", import.meta.url), { type: "module" });
          worker.onmessage = (event: MessageEvent<{ kind: string; positions?: [string, number, number, number][] }>) => {
            const positions: Positions = new Map(), community = new Map<string, number>();
            for (const [id, x, y, c] of event.data.kind === "positions" ? event.data.positions ?? [] : []) {
              if (Number.isFinite(x) && Number.isFinite(y)) { positions.set(id, { x, y }); community.set(id, c); }
            }
            complete(positions, community);
          };
          worker.onerror = () => complete(new Map(), new Map());
          worker.postMessage({ kind: "layout", nodes: linked.map(n => n.id),
            edges: graph.edges.filter(isRecorded).map(e => [e.source, e.target]) });
        } catch {
          complete(new Map(), new Map());
        }
      });

    (async () => {
      try {
        const [[{ default: Sigma, DEFAULT_STYLES }, { default: Graph },
          { layerDashed, sdfCircle, sdfSquare, sdfDiamond, sdfTriangle, pathCurved, pathLine, extremityArrow }], placed] = await Promise.all([
          Promise.all([import("sigma"), import("graphology"), import("sigma/rendering")]), layout]);
        try { await document.fonts.load(sketched ? '400 13px "' + SKETCH_FONT + '"' : '500 12px "IBM Plex Sans"'); } catch { /* fall back to system font */ }
        if (cancelled || !container.current) return;
        LAYOUTS.set(cacheKey, placed);
        if (LAYOUTS.size > 6) LAYOUTS.delete(LAYOUTS.keys().next().value!);

        // 2. Build the drawing at its final positions. A record the layout could
        //    not place (worker unavailable) falls back to a plain sunflower.
        const data = new Graph({ type: "mixed", multi: true, allowSelfLoops: true });
        // A small map is drawn larger, with every name shown.
        const small = graph.nodes.length <= 80;
        const scale = (narrow ? 0.7 : 1) * (small ? 1.9 : 1);
        graph.nodes.forEach((n, i) => {
          const a = i * 2.399963, r = Math.sqrt(i) * 4, p = placed.positions.get(n.id);
          data.addNode(n.id, {
            x: p?.x ?? Math.cos(a) * r, y: p?.y ?? Math.sin(a) * r, label: n.label,
            size: markSize(degree.get(n.id) ?? 0, n.type) * scale, color: palette.types[n.type] ?? palette.types.other,
            baseColor: palette.types[n.type] ?? palette.types.other, nodeShape: SHAPE[n.type], nodeType: n.type
          });
        });
        const community = placed.community;
        for (const e of graph.edges) {
          if (!data.hasNode(e.source) || !data.hasNode(e.target)) continue;
          const pencil = e.inferred === true;
          // Links between areas are still ink, drawn quieter so each area stays legible.
          const bridge = !small && !pencil && community.size > 0 && community.get(e.source) !== community.get(e.target);
          const dir = e.direction ?? "directed";
          const typed = !pencil ? linkColour?.(e) ?? null : null;
          const sign = !pencil ? edgePolarity(e) : null;
          data.addEdgeWithKey(e.id, e.source, e.target, {
            // Sigma's dashed layer draws nothing when the gap is zero, so a
            // recorded line is one very long dash with a token gap.
            size: (pencil ? 1.2 : typed ? 1.1 : 0.8) * (small ? 1.6 : 1),
            color: pencil ? palette.pencil : typed ? mix(typed, palette.paper, bridge ? 0.55 : small ? 0.1 : 0.25) : bridge ? palette.inkFaint : small ? palette.ink : palette.inkSoft,
            typed, inferred: pencil, sign: sign === "-" ? "−" : sign ?? "",
            // Arrows show which way a recorded link points; a mutual link points both ways.
            head: !pencil && dir !== "undirected" ? "arrow" : "none", tail: !pencil && dir === "mutual" ? "arrow" : "none",
            dashSize: pencil ? 2 : 1e6, gapSize: pencil ? 4 : 0.5
          });
        }
        graphRef.current = data;
        const isDark = theme === "night";
        renderer = new Sigma(data, container.current, {
          primitives: {
            nodes: {
              shapes: [sdfCircle(), sdfSquare({ cornerRadius: 0.18 }), sdfDiamond(), sdfTriangle()],
              label: { font: sketched ? { family: SKETCH_FONT, weight: "400" } : { family: "IBM Plex Sans", weight: "500" }, color: palette.label, margin: 4 }
            },
            edges: {
              // Curves read better, but cost more to draw; large maps get straight lines.
              paths: [graph.edges.length > 3000 ? pathLine() : pathCurved({ curvature: 0.12 })],
              extremities: [extremityArrow(small ? { lengthRatio: 8, widthRatio: 7, margin: 1 } : { lengthRatio: 5, widthRatio: 4.5, margin: 1 })],
              layers: [layerDashed({ dashSize: { attribute: "dashSize" }, gapSize: { attribute: "gapSize" }, cap: "round", align: 0, solidExtremities: true })]
            }
          },
          styles: {
            edges: [DEFAULT_STYLES.edges, { head: { attribute: "head" }, tail: { attribute: "tail" } }],
            nodes: [DEFAULT_STYLES.nodes, {
              shape: { attribute: "nodeShape" }, labelColor: palette.label, labelSize: sketched ? 15 : 12,
              labelFont: sketched ? SKETCH_FONT : "IBM Plex Sans",
              labelBackgroundColor: palette.labelPlate, labelBackgroundPadding: 2,
              backdropColor: isDark ? "#1A2822" : "#FFFFFF", backdropShadowColor: "rgba(0,0,0,0.25)"
            }]
          },
          nodeReducer: (id, display) => {
            const f = focus.current;
            const base = data.getNodeAttribute(id, "baseColor") as string;
            if (f.route) {
              if (f.routeNodes.has(id)) return { ...display, color: base, highlighted: true, zIndex: 2,
                labelVisibility: f.labelled.has(id) ? "visible" : "hidden" };
              return { ...display, color: mix(base, palette.paper, 0.72), labelVisibility: "hidden" };
            }
            if (f.selected) {
              if (id === f.selected) return { ...display, color: base, highlighted: true, labelVisibility: "visible",
                size: display.size + 2, zIndex: 3 };
              if (f.neighbours.has(id)) return { ...display, color: base, zIndex: 2,
                labelVisibility: f.labelled.has(id) ? "visible" : "hidden" };
              // Suggestions stay quiet and unlabelled: they are not facts.
              if (f.pencil.has(id)) return { ...display, color: mix(base, palette.paper, 0.5), zIndex: 1, labelVisibility: "hidden" };
              return { ...display, color: mix(base, palette.paper, 0.72), labelVisibility: "hidden" };
            }
            return display;
          },
          edgeReducer: (id, display) => {
            const f = focus.current;
            const attrs = data.getEdgeAttributes(id);
            const inferred = attrs.inferred === true;
            // Dash sizes are read from display data, so they travel with every result.
            const out = { ...display, dashSize: attrs.dashSize, gapSize: attrs.gapSize, head: attrs.head, tail: attrs.tail };
            if (f.route) {
              // A route or loop names each link's sign (+ more leads to more, − more leads to less).
              return f.routeEdges.has(id)
                ? { ...out, color: attrs.typed ?? palette.moss, size: 3.6, visibility: "visible", zIndex: 3 }
                : { ...out, visibility: "hidden" };
            }
            if (f.selected) {
              const [s, t] = data.extremities(id);
              if (s !== f.selected && t !== f.selected) return { ...out, visibility: "hidden" };
              return inferred
                ? { ...out, color: palette.pencilSoft, size: 1, visibility: "visible" }
                : { ...out, color: attrs.typed ?? palette.ink, size: 2, visibility: "visible", zIndex: 2 };
            }
            return inferred || mode === "themes" ? { ...out, visibility: "hidden" } : out;
          },
          settings: {
            itemSizesReference: "screen", renderEdgeLabels: false, labelDensity: small ? 4 : 0.4, labelGridCellSize: small ? 40 : 130,
            labelRenderedSizeThreshold: small ? 0 : narrow ? 8 : 6,
            hideEdgesOnMove: graph.edges.length > 4000, hideLabelsOnMove: false,
            minCameraRatio: 0.02, maxCameraRatio: 6, stagePadding: 40, zoomDuration: 220,
            // The canvas can be briefly hidden (a story card opening, a phone turning); skip drawing rather than throw.
            allowInvalidContainer: true
          }
        });
        sigmaRef.current = renderer;
        renderer.getCamera().setState(home());
        renderer.on("clickNode", ({ node }) => pick.current(node));
        renderer.on("clickStage", () => pick.current(null));
        renderer.on("enterNode", () => { if (container.current) container.current.style.cursor = "pointer"; });
        renderer.on("leaveNode", () => { if (container.current) container.current.style.cursor = ""; });
        renderer.on("afterRender", syncOverlay);
        let replan: number | undefined;
        renderer.getCamera().on("updated", () => {
          window.clearTimeout(replan);
          replan = window.setTimeout(() => { if (focus.current.selected || focus.current.route) planLabels(); }, 140);
        });
        // The first frame is drawn with nothing in focus; the focus effect applies any selection.
        focus.current = { selected: null, neighbours: new Set(), pencil: new Set(), route: null,
          routeNodes: new Set(), routeEdges: new Set(), labelled: new Set() };
        lastFocus.current = "|";
        // Sketched areas are washes of their own, so the contours step aside.
        setWash(graph.nodes.length <= 80 || sketched ? [] : terrain(placed.washed));
        setAreas(placed.areas);
        builtFor.current = mode;
        setStatus("ready");
        setBuilt(v => v + 1);
      } catch {
        if (cancelled) return;
        setStatus("error");
        unavailable.current();
      }
    })();
    return () => {
      cancelled = true; worker?.terminate(); renderer?.kill();
      sigmaRef.current = null; graphRef.current = null;
    };
    // The renderer is rebuilt when the records, lens mode or palette change;
    // a palette change reuses the cached layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, mode, theme, groupKey, linkKey, sketched]);

  /** Selection and route labels are always shown, but never on top of each
   *  other: the selected record first, then the best-connected neighbours. */
  function planLabels() {
    const renderer = sigmaRef.current, f = focus.current;
    if (!renderer) return;
    const candidates = f.route ? [...f.routeNodes]
      : f.selected ? [f.selected, ...[...f.neighbours].sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0))] : [];
    const kept: [number, number, number, number][] = [];
    const labelled = new Set<string>();
    for (const id of candidates) {
      const d = renderer.getNodeDisplayData(id);
      if (!d) continue;
      const p = renderer.framedGraphToViewport(d);
      const label = String(renderer.getGraph().getNodeAttribute(id, "label") ?? "");
      const box: [number, number, number, number] = [p.x - 6, p.y - 10, p.x + 14 + label.length * 6.6, p.y + 10];
      if (id !== f.selected && !f.route && kept.some(b => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
      kept.push(box);
      labelled.add(id);
      if (labelled.size >= 32) break;
    }
    f.labelled = labelled;
    const signs = signLayer.current, data = graphRef.current;
    if (signs && data) {
      const ids = f.route ? [...f.routeEdges] : f.selected && data.hasNode(f.selected) ? data.edges(f.selected) : [];
      signs.replaceChildren(...ids.filter(id => data.hasEdge(id) && data.getEdgeAttribute(id, "sign")).map(id => {
        const el = document.createElement("span");
        const sign = data.getEdgeAttribute(id, "sign") as string;
        el.className = "ml-sign ml-sign--" + (sign === "+" ? "plus" : "minus") + " ml-sign--map";
        el.textContent = sign; el.dataset.edge = id;
        el.title = sign === "+" ? "More leads to more" : "More leads to less";
        return el;
      }));
    }
    renderer.refresh();
  }
  function applyFocus() {
    const data = graphRef.current;
    const neighbours = new Set<string>(), pencil = new Set<string>();
    if (selectedId && data?.hasNode(selectedId)) {
      for (const e of graph.edges) {
        if (e.source !== selectedId && e.target !== selectedId) continue;
        const other = e.source === selectedId ? e.target : e.source;
        (e.inferred ? pencil : neighbours).add(other);
      }
    }
    const selected = selectedId && data?.hasNode(selectedId) ? selectedId : null;
    const active = route && route.nodeIds.length ? route : null;
    // Nothing in focus before or after: the drawing is already right, so skip a full refresh.
    const key = (selected ?? "") + "|" + (active?.edgeIds.join(",") ?? "");
    if (key === "|" && lastFocus.current === "|") return;
    lastFocus.current = key;
    focus.current = {
      selected, neighbours, pencil, route: active,
      routeNodes: new Set(active?.nodeIds ?? []), routeEdges: new Set(active?.edgeIds ?? []), labelled: new Set()
    };
    planLabels(); // refreshes the renderer once with the new focus
  }
  /** Places each of the author's marks against the records it's anchored to; marks whose records aren't drawn are hidden. */
  function drawMarks() {
    const renderer = sigmaRef.current;
    if (!renderer) return;
    placeMarks(markLayer.current, marksRef.current, pinsRef.current, id => {
      const d = renderer.getNodeDisplayData(aliasRef.current?.get(id) ?? id);
      return d && !(d as { hidden?: boolean }).hidden ? renderer.framedGraphToViewport(d) as Point : null;
    });
  }
  /** Home view; a phone-width canvas has no side cards, so it can sit closer. */
  const home = () => {
    const f = FRAMES[mode];
    const w = container.current?.clientWidth ?? 1000;
    if (w < 600) return { ...f, x: 0.5, ratio: f.ratio * 0.9 };
    // A small map sits clear of the cards on the left (loops, groups).
    return graph.nodes.length <= 80 && mode === "network" ? { ...f, x: 0.4, ratio: 1.3 } : f;
  };
  const hadRoute = useRef(false);
  const lastFocus = useRef("");
  useEffect(() => {
    applyFocus();
    const renderer = sigmaRef.current, data = graphRef.current;
    // Closing a route returns to the home view it was framed from.
    const routed = Boolean(route?.nodeIds.length);
    if (hadRoute.current && !routed && !selectedId && !frame && renderer) void renderer.getCamera().animate(home(), { duration: 350 });
    hadRoute.current = routed;
    const framed = (frame ?? []).map(id => alias?.get(id) ?? id).filter(id => data?.hasNode(id));
    const target = route?.nodeIds.length ? route.nodeIds : [...new Set([...framed, ...(selectedId ? [selectedId] : [])])];
    // A story step with nothing to point at shows the whole map.
    if (frame && !target.length && renderer && status === "ready") {
      if (reducedMotion()) renderer.getCamera().setState(home()); else void renderer.getCamera().animate(home(), { duration: 600 });
      return;
    }
    if (!renderer || !data || !target.length || status !== "ready") return;
    const rect = container.current?.getBoundingClientRect();
    if (!rect) return;
    // Free area: clear of the chips, key and caption, and of the route panel
    // on wide screens, where it sits over the left of the canvas.
    const dock = route?.nodeIds.length && rect.width > 860 ? 480 : 0;
    const free = { left: dock + 40, right: rect.width - 70, top: 70, bottom: rect.height - (rect.width > 860 ? 100 : 40) };
    // A story card over the map: beside it on wide screens, above it on narrow ones.
    const card = container.current?.closest(".ml-canvas")?.querySelector(".ml-story-card")?.getBoundingClientRect();
    if (card) {
      if (rect.width > 860) free.left = Math.max(free.left, card.right - rect.left + 30);
      else free.bottom = Math.min(free.bottom, card.top - rect.top - 16);
    }
    const points = target.map(id => renderer.getNodeDisplayData(id)).filter(Boolean)
      .map(d => renderer.framedGraphToViewport(d as { x: number; y: number }));
    if (!points.length) return;
    const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
    const inside = minX >= free.left && maxX <= free.right && minY >= free.top && maxY <= free.bottom;
    if (inside && !frame) return;
    // Exploring: zoom out just enough to fit (never in). In a story, frame the step's records snugly, in or out.
    const cam = renderer.getCamera(), state = cam.getState();
    const fit = Math.max((maxX - minX + (frame ? 160 : 0)) / Math.max(free.right - free.left, 1),
      (maxY - minY + (frame ? 140 : 0)) / Math.max(free.bottom - free.top, 1));
    const ratio = frame ? Math.min(Math.max(state.ratio * fit, target.length === 1 ? Math.min(state.ratio, 0.5) : 0.12), 4)
      : Math.min(state.ratio * Math.max(fit, 1), 4);
    const centre = renderer.viewportToFramedGraph({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
    const middle = renderer.viewportToFramedGraph({ x: rect.width / 2, y: rect.height / 2 });
    const aim = renderer.viewportToFramedGraph({ x: (free.left + free.right) / 2, y: (free.top + free.bottom) / 2 });
    const k = ratio / state.ratio;
    // Where the group's centre would sit after zooming about the current view centre.
    const gx = middle.x + (centre.x - middle.x), gy = middle.y + (centre.y - middle.y);
    const next = { x: gx - (aim.x - middle.x) * k, y: gy - (aim.y - middle.y) * k, ratio };
    if (reducedMotion()) cam.setState(next); else void cam.animate(next, { duration: frame ? 700 : 450 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, route, status, built, frame?.join("|"), frameKey]);
  // New marks: draw them straight away, then on every camera move.
  useEffect(() => { drawMarks(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [marks, pins, markStyle, built]);
  // Printing a story pictures this lens: its canvases are copied straight after Sigma draws them.
  const statusRef = useRef(status); statusRef.current = status;
  // Ready means drawn for this mode (a mode change rebuilds the drawing). While printing, cameras cut, so it's also still.
  useEffect(() => registerLens({ lens: mode, ready: () => statusRef.current === "ready" && builtFor.current === mode,
    copyCanvases: () => new Promise(resolve => {
      const renderer = sigmaRef.current, box = container.current;
      if (!renderer || !box) { resolve(new Map()); return; }
      const once = () => { renderer.off("afterRender", once); resolve(copyCanvases(box)); };
      renderer.on("afterRender", once);
      renderer.refresh();
    }) }), [mode]);
  // Area names are placed on Sigma's render; place them as soon as they arrive.
  useEffect(() => { syncOverlay(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [areas, built]);

  const camera = (action: "in" | "out" | "fit") => {
    const c = sigmaRef.current?.getCamera();
    if (!c) return;
    if (action === "in") void c.zoomIn({ duration: 220 });
    else if (action === "out") void c.zoomOut({ duration: 220 });
    else void c.animate(home(), { duration: 350 });
  };
  const suggestions = graph.edges.length - recorded;
  return <section ref={stage} className={"ml-network ml-network--" + mode + (sketched ? " is-sketched" : "")}
    aria-label={mode === "themes" ? "Records grouped by " + (suggested ? "suggested topics" : groupName.toLowerCase()) : "Complete Sigma network"}>
    <svg className="ml-wash" aria-hidden="true">
      {sketched && <defs>
        {/* Watercolour: the edge of each wash is pushed about by paper-like noise; the rim pools darker. */}
        <filter id={filterId} x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves={3} seed={7} result="grain"/>
          <feDisplacementMap in="SourceGraphic" in2="grain" scale={5} xChannelSelector="R" yChannelSelector="G"/>
        </filter>
        <filter id={filterId + "r"} x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves={3} seed={7} result="grain"/>
          <feDisplacementMap in="SourceGraphic" in2="grain" scale={5} xChannelSelector="R" yChannelSelector="G" result="moved"/>
          <feGaussianBlur in="moved" stdDeviation={0.9}/>
        </filter>
      </defs>}
      <g ref={washGroup}>
        {sketched && areas.filter(a => a.r).map((a, i) => {
          const pigment = PIGMENTS[theme][i % PIGMENTS[theme].length], r = a.r! * 1.04;
          const night = theme === "night";
          return <g key={a.id} className="ml-watercolour">
            <path d={blobPath(a.x, a.y, r, a.id)} filter={`url(#${filterId})`} style={{ fill: pigment, fillOpacity: night ? 0.15 : 0.13 }}/>
            <path d={blobPath(a.x + r * 0.05, a.y - r * 0.04, r * 0.82, a.id + "+")} filter={`url(#${filterId})`}
              style={{ fill: pigment, fillOpacity: night ? 0.09 : 0.08 }}/>
            <path d={blobPath(a.x, a.y, r, a.id)} filter={`url(#${filterId}r)`}
              style={{ fill: "none", stroke: pigment, strokeOpacity: night ? 0.35 : 0.42, strokeWidth: Math.max(0.6, r * 0.035) }}/>
          </g>;
        })}
        {wash.map(c => <path key={c.level} d={c.d} vectorEffect="non-scaling-stroke"
          style={{ fill: palette.wash, fillOpacity: theme === "night" ? 0.05 : 0.045,
            stroke: palette.washLine, strokeOpacity: c.level === 1 ? 0.5 : 0.12 + 0.2 * c.level / Math.max(1, wash.length),
            strokeWidth: c.level === 1 ? 1.1 : c.level % 4 === 0 ? 0.8 : 0.5 }}/>)}
      </g>
    </svg>
    <div ref={container} className="ml-sigma-viewport" role="img"
      aria-label={`${graph.nodes.length.toLocaleString("en-GB")} records and ${recorded.toLocaleString("en-GB")} recorded links. Use Browse records for a list.`}/>
    <div ref={signLayer} className="ml-sign-layer" aria-hidden="true"/>
    <MarkLayer ref={markLayer} marks={marks} pins={pins} markStyle={markStyle}/>
    <div ref={areaLayer} className="ml-area-labels" aria-hidden="true">
      {areas.map(a => <div key={a.id} className={"ml-area-label ml-area-label--" + a.kind} data-x={a.x} data-y={a.y} data-r={a.r ?? 0}>
        <span>{a.label}</span><small>{a.count.toLocaleString("en-GB")} records{a.kind === "suggested" ? " · suggested" : ""}</small>
      </div>)}
    </div>
    <div className="ml-zoom" role="group" aria-label="Zoom">
      <button type="button" aria-label="Zoom in" onClick={() => camera("in")}><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2v10M2 7h10"/></svg></button>
      <button type="button" aria-label="Zoom out" onClick={() => camera("out")}><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 7h10"/></svg></button>
      <button type="button" aria-label="Fit everything" onClick={() => camera("fit")}><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1.5 5V1.5H5M9 1.5h3.5V5M12.5 9v3.5H9M5 12.5H1.5V9"/></svg></button>
    </div>
    {(status === "preparing" || status === "laying-out") && <p className="ml-arranging" role="status">
      Arranging {graph.nodes.length.toLocaleString("en-GB")} records by their recorded links…</p>}
    <p className="ml-canvas-caption" data-status={status}>
      {status === "laying-out" ? "Arranging by recorded links… · " : ""}
      {graph.nodes.length.toLocaleString("en-GB")} records · {recorded.toLocaleString("en-GB")} recorded links
      {mode === "network" && <> · {suggestions.toLocaleString("en-GB")} suggestions</>}
      {status === "error" && " · This device cannot draw the network; Browse records lists everything."}
    </p>
  </section>;
}
export type { GraphNode };
