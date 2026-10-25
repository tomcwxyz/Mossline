import { contourDensity } from "d3-contour";
import { hierarchy, pack } from "d3-hierarchy";
import type { GraphNode } from "@mossline/graph-core";

/** Wash: drawn by Mossline to help navigation. Nothing here is a claim. */
export interface AtlasArea {
  id: string; label: string; count: number; x: number; y: number;
  /** Spread of the area in graph units; its name sits on the upper edge. */
  r?: number;
  kind: "tag" | "hub" | "unlinked";
}
export type Positions = Map<string, { x: number; y: number }>;

export function bounds(positions: Positions) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of positions.values()) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}

/** Records without recorded links sit in a small block beside the network,
 *  so they stay visible without implying any connection. */
export function placeUnlinked(ids: string[], positions: Positions, below = false): AtlasArea | null {
  if (!ids.length) return null;
  const b = positions.size ? bounds(positions) : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const span = Math.max(b.maxX - b.minX, b.maxY - b.minY, 40);
  const gap = Math.max(span * 0.025, 2);
  const cols = Math.max(1, Math.ceil(Math.sqrt(ids.length * (below ? 2.5 : 0.6))));
  // Beside the network on a wide canvas; underneath it on a tall (phone) one.
  // Sigma draws graph y upwards, so "underneath" is below the minimum y.
  const rows = Math.ceil(ids.length / cols);
  const x0 = !positions.size ? 0 : below ? (b.minX + b.maxX) / 2 - (cols - 1) * gap / 2 : b.maxX + span * 0.12;
  const y0 = !positions.size ? 0 : below ? b.minY - span * 0.1 - (rows - 1) * gap : b.minY + span * 0.05;
  ids.forEach((id, i) => positions.set(id, { x: x0 + (i % cols) * gap, y: y0 + Math.floor(i / cols) * gap }));
  return { id: "unlinked", label: "No recorded links", count: ids.length,
    x: x0 + (cols - 1) * gap / 2, y: y0 - gap * 1.6, kind: "unlinked" };
}

/** Name densely linked groups by their most common source tag; where no tag
 *  dominates, by their best-connected record ("Around …"). */
export function areasFromCommunities(nodes: GraphNode[], positions: Positions,
  community: Map<string, number>, degree: Map<string, number>): AtlasArea[] {
  const groups = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    const c = community.get(n.id);
    if (c === undefined || !positions.has(n.id)) continue;
    groups.set(c, [...(groups.get(c) ?? []), n]);
  }
  const minSize = Math.max(5, Math.round(nodes.length * 0.02));
  const areas: AtlasArea[] = [];
  const used = new Set<string>();
  const median = (v: number[]) => v[Math.floor(v.length / 2)];
  // Largest groups choose first; a tag names only one area, so later groups
  // take their next qualifying tag or fall back to their best-connected record.
  for (const [c, members] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    if (members.length < minSize) continue;
    const tags = new Map<string, number>();
    for (const m of members) for (const t of new Set(m.tags)) tags.set(t, (tags.get(t) ?? 0) + 1);
    const ranked = [...tags].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const tag = ranked.find(([t, n]) => !used.has(t) && n >= Math.max(3, members.length * 0.35))?.[0];
    const hub = [...members].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))[0];
    const label = tag ?? "Around " + hub.label;
    if (used.has(label)) continue;
    used.add(label);
    const xs = members.map(m => positions.get(m.id)!.x).sort((a, b) => a - b);
    const ys = members.map(m => positions.get(m.id)!.y).sort((a, b) => a - b);
    const cx = median(xs), cy = median(ys);
    const spread = members.map(m => Math.hypot(positions.get(m.id)!.x - cx, positions.get(m.id)!.y - cy)).sort((a, b) => a - b);
    const r = spread[Math.floor(spread.length * 0.7)] ?? 0;
    areas.push({ id: "c" + c, label, count: members.length, x: cx, y: cy, r, kind: tag ? "tag" : "hub" });
  }
  return areas.slice(0, 10);
}

/** Themes lens: one area per source tag (each record placed in its most
 *  widely shared tag), packed by size. Tags are source labels, not inference. */
export function themeLayout(nodes: GraphNode[]): { positions: Positions; areas: AtlasArea[] } {
  const tagCounts = new Map<string, number>();
  for (const n of nodes) for (const t of new Set(n.tags)) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const NONE = "No source tag";
  const primary = (n: GraphNode) => n.tags.length
    ? [...new Set(n.tags)].sort((a, b) => (tagCounts.get(b) ?? 0) - (tagCounts.get(a) ?? 0) || a.localeCompare(b))[0]
    : NONE;
  const groups = new Map<string, GraphNode[]>();
  for (const n of nodes) { const key = primary(n); groups.set(key, [...(groups.get(key) ?? []), n]); }
  const spacing = 6;
  const root = hierarchy<{ name: string; value?: number; children?: { name: string; value: number }[] }>({
    name: "root",
    children: [...groups].map(([name, members]) => ({ name, value: members.length }))
  }).sum(d => d.value ?? 0);
  // Radius per group follows its sunflower; pack leaves enough room between groups.
  const size = Math.sqrt(nodes.length) * spacing * 3.4 + 200;
  const packed = pack<typeof root.data>().size([size, size]).padding(spacing * 6)
    .radius(d => Math.sqrt(d.value ?? 1) * spacing * 1.25 + spacing * 2)(root);
  const positions: Positions = new Map();
  const areas: AtlasArea[] = [];
  for (const leaf of packed.leaves()) {
    const members = [...(groups.get(leaf.data.name) ?? [])].sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label));
    members.forEach((n, j) => {
      const a = j * 2.399963, r = Math.sqrt(j + 0.5) * spacing;
      positions.set(n.id, { x: leaf.x + Math.cos(a) * r, y: leaf.y + Math.sin(a) * r });
    });
    areas.push({ id: "tag:" + leaf.data.name, label: leaf.data.name, count: members.length,
      x: leaf.x, y: leaf.y - leaf.r - spacing * 1.2, kind: leaf.data.name === NONE ? "unlinked" : "tag" });
  }
  return { positions, areas: areas.sort((a, b) => b.count - a.count) };
}

/** Kernel density contours of mark positions, in graph coordinates. */
export function terrain(positions: Positions, levels = 10): { d: string; level: number }[] {
  if (positions.size < 4) return [];
  const b = bounds(positions);
  const spanX = Math.max(b.maxX - b.minX, 1e-6), spanY = Math.max(b.maxY - b.minY, 1e-6);
  const G = 420, pad = 40;
  const points = [...positions.values()].map(p => [
    pad + (p.x - b.minX) / spanX * (G - 2 * pad), pad + (p.y - b.minY) / spanY * (G - 2 * pad)] as [number, number]);
  const bandwidth = Math.max(5, Math.min(14, (G / Math.sqrt(points.length)) * 1.1));
  const contours = contourDensity<[number, number]>().x(p => p[0]).y(p => p[1])
    .size([G, G]).bandwidth(bandwidth).thresholds(levels)(points);
  const toX = (x: number) => b.minX + (x - pad) / (G - 2 * pad) * spanX;
  const toY = (y: number) => b.minY + (y - pad) / (G - 2 * pad) * spanY;
  const r = (v: number) => Math.round(v * 100) / 100;
  return contours.slice(1).map((c, i) => ({
    level: i + 1,
    d: c.coordinates.map(polygon => polygon.map(ring =>
      "M" + ring.map(([x, y]) => r(toX(x)) + " " + r(toY(y))).join("L") + "Z").join("")).join("")
  }));
}
