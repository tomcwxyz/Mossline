/**
 * The author's marks on a story map, drawn as if by hand: a loose pencil ring,
 * a leader line to a note, a curved arrow, a circled number. Geometry only:
 * screen points in, SVG path data out. The wobble comes from a seed made from
 * the mark's ID, so a mark looks the same every time and doesn't shimmer as
 * the map moves.
 */
export type Point = { x: number; y: number };

export function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}
const f = (n: number) => Math.round(n * 10) / 10;

/** A loose loop around some points, going round a little more than once, as a hand does. */
export function ringPath(points: Point[], seed: string): { d: string; top: Point } {
  const rand = seeded(seed);
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  const spread = Math.max(0, ...points.map(p => Math.hypot(p.x - cx, p.y - cy)));
  const rx = spread + 24 + rand() * 6, ry = Math.max(22, spread * 0.82 + 20 + rand() * 6);
  const start = rand() * Math.PI * 2, turn = Math.PI * 2 * (1.08 + rand() * 0.07), steps = 28;
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = start + (turn * i) / steps;
    const wobble = 1 + (rand() - 0.5) * 0.06 + (i / steps) * 0.05;
    pts.push({ x: cx + Math.cos(t) * rx * wobble, y: cy + Math.sin(t) * ry * wobble });
  }
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q${f(pts[i].x)} ${f(pts[i].y)} ${f(mx)} ${f(my)}`;
  }
  return { d, top: { x: cx, y: cy - ry - 8 } };
}

/** A gently curved arrow from one record to another, stopping short of both. */
export function arrowPath(a: Point, b: Point, seed: string): { d: string; head: string; mid: Point } {
  const rand = seeded(seed);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
  const gap = Math.min(16, len / 4);
  const s = { x: a.x + ux * gap, y: a.y + uy * gap }, e = { x: b.x - ux * gap, y: b.y - uy * gap };
  const bend = (0.14 + rand() * 0.08) * len * (rand() > 0.5 ? 1 : -1);
  const c = { x: (s.x + e.x) / 2 - uy * bend, y: (s.y + e.y) / 2 + ux * bend };
  // Arrowhead along the curve's direction at its end.
  const tx = e.x - c.x, ty = e.y - c.y, tl = Math.hypot(tx, ty) || 1;
  const hx = tx / tl, hy = ty / tl, size = 10;
  const left = { x: e.x - hx * size - hy * size * 0.55, y: e.y - hy * size + hx * size * 0.55 };
  const right = { x: e.x - hx * size + hy * size * 0.55, y: e.y - hy * size - hx * size * 0.55 };
  return {
    d: `M${f(s.x)} ${f(s.y)} Q${f(c.x)} ${f(c.y)} ${f(e.x)} ${f(e.y)}`,
    head: `M${f(left.x)} ${f(left.y)} L${f(e.x)} ${f(e.y)} L${f(right.x)} ${f(right.y)}`,
    mid: { x: 0.25 * s.x + 0.5 * c.x + 0.25 * e.x, y: 0.25 * s.y + 0.5 * c.y + 0.25 * e.y }
  };
}

/** A note set off from a record, up and to the side with room, with a curved leader line back to it. */
export function calloutPath(p: Point, seed: string, bounds: { width: number; height: number }): { d: string; label: Point; anchor: "start" | "end" } {
  const rand = seeded(seed);
  const right = p.x < bounds.width - 220, up = p.y > 110;
  const dx = (64 + rand() * 18) * (right ? 1 : -1), dy = (52 + rand() * 14) * (up ? -1 : 1);
  const label = { x: p.x + dx, y: p.y + dy };
  const from = { x: p.x + Math.sign(dx) * 9, y: p.y + Math.sign(dy) * 9 };
  const c = { x: from.x + dx * 0.15, y: label.y };
  return { d: `M${f(from.x)} ${f(from.y)} Q${f(c.x)} ${f(c.y)} ${f(label.x - Math.sign(dx) * 4)} ${f(label.y)}`,
    label: { x: label.x + Math.sign(dx) * 2, y: label.y + 4 }, anchor: right ? "start" : "end" };
}

/** Where a circled number sits: just above and left of its record. */
export const numberAt = (p: Point): Point => ({ x: p.x - 17, y: p.y - 17 });

// ---- Clean marks: the same anchors, drawn precisely ----------------------------------

/** A smooth ellipse around some points, with even room all round. */
export function cleanRingPath(points: Point[]): { d: string; top: Point } {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  let rx = Math.max(...points.map(p => Math.abs(p.x - cx))) * 1.12 + 22;
  let ry = Math.max(...points.map(p => Math.abs(p.y - cy))) * 1.12 + 20;
  // Never a sliver: records in a line still get a ring you can see round them.
  rx = Math.max(rx, ry * 0.6); ry = Math.max(ry, rx * 0.6);
  return { d: `M${f(cx - rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}Z`,
    top: { x: cx, y: cy - ry - 9 } };
}
/** A straight arrow, stopping short of both records. */
export function cleanArrowPath(a: Point, b: Point): { d: string; head: string; mid: Point } {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len, gap = Math.min(15, len / 4), size = 9;
  const s = { x: a.x + ux * gap, y: a.y + uy * gap }, e = { x: b.x - ux * gap, y: b.y - uy * gap };
  const left = { x: e.x - ux * size - uy * size * 0.6, y: e.y - uy * size + ux * size * 0.6 };
  const right = { x: e.x - ux * size + uy * size * 0.6, y: e.y - uy * size - ux * size * 0.6 };
  return { d: `M${f(s.x)} ${f(s.y)} L${f(e.x - ux * size * 0.6)} ${f(e.y - uy * size * 0.6)}`,
    head: `M${f(left.x)} ${f(left.y)} L${f(e.x)} ${f(e.y)} L${f(right.x)} ${f(right.y)}Z`,
    mid: { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 } };
}
/** A note set off from a record: a straight leader with a short elbow, the label at its end. */
export function cleanCalloutPath(p: Point, bounds: { width: number; height: number }): { d: string; label: Point; anchor: "start" | "end" } {
  const right = p.x < bounds.width - 220, up = p.y > 110;
  const dx = right ? 1 : -1, dy = up ? -1 : 1;
  const knee = { x: p.x + dx * 46, y: p.y + dy * 46 }, end = { x: knee.x + dx * 18, y: knee.y };
  return { d: `M${f(p.x + dx * 7)} ${f(p.y + dy * 7)} L${f(knee.x)} ${f(knee.y)} L${f(end.x)} ${f(end.y)}`,
    label: { x: end.x + dx * 6, y: end.y + 4.5 }, anchor: right ? "start" : "end" };
}
