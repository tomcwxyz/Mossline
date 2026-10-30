"use client";

import { forwardRef } from "react";
import type { StoryMark } from "@mossline/graph-core";
import { arrowPath, calloutPath, cleanArrowPath, cleanCalloutPath, cleanRingPath, numberAt, ringPath, seeded, type Point } from "./marginalia";

/** A story picture pinned to a record: drawn as a small postcard beside it. */
export type StoryPin = { id: string; record: string; src: string; alt: string };

/**
 * The author's marks and pinned pictures over a lens. The lens renders this
 * once, then calls placeMarks on every frame with a way to find a record on
 * screen. Anything whose records aren't drawn (filtered out, or with no
 * place on the Map lens) is hidden, never guessed.
 */
export type MarkStyle = "clean" | "hand";
export const MarkLayer = forwardRef<SVGSVGElement, { marks?: StoryMark[]; pins?: StoryPin[]; markStyle?: MarkStyle }>(function MarkLayer({ marks = [], pins = [], markStyle = "hand" }, ref) {
  if (!marks.length && !pins.length) return null;
  return <svg ref={ref} className={"ml-marks ml-marks--" + markStyle} data-style={markStyle} aria-hidden="true">
    {marks.map(m => <g key={m.id + ":" + m.targets.join(",")} data-mark={m.id} className={"ml-mark ml-mark--" + m.kind} style={{ display: "none" }}>
      <path className="ml-mark-line"/><path className="ml-mark-line"/>
      {m.kind === "number" ? <circle className="ml-mark-line" r={markStyle === "clean" ? 10.5 : 11}/> : <circle r={0}/>}
      <text className="ml-mark-text">{m.kind === "number" ? m.n : m.text ?? ""}</text>
    </g>)}
    {pins.map(p => <g key={p.id + ":" + p.record} data-pin={p.id} className="ml-pin" style={{ display: "none" }}>
      <path className="ml-mark-line ml-pin-line"/>
      <g className="ml-pin-card">
        <rect className="ml-pin-frame" x={-4} y={-4} width={PIN.w + 8} height={PIN.h + 8} rx={2}/>
        <image href={p.src} width={PIN.w} height={PIN.h} preserveAspectRatio="xMidYMid slice"/>
      </g>
    </g>)}
  </svg>;
});
const PIN = { w: 76, h: 56 };

export function placeMarks(svg: SVGSVGElement | null, marks: StoryMark[] | undefined, pins: StoryPin[] | undefined, at: (id: string) => Point | null) {
  if (!svg) return;
  const bounds = { width: svg.clientWidth || 800, height: svg.clientHeight || 600 };
  const clean = svg.dataset.style === "clean";
  for (const g of Array.from(svg.children) as SVGGElement[]) {
    if (g.dataset.pin) {
      const pin = pins?.find(p => p.id === g.dataset.pin);
      const p = pin ? at(pin.record) : null;
      if (!pin || !p) { g.style.display = "none"; continue; }
      g.style.display = "";
      // Up and to the side with room, tilted a touch, as if tucked into the page.
      const rand = seeded(pin.id);
      const right = p.x < bounds.width - PIN.w - 60, up = p.y > PIN.h + 50;
      const x = right ? p.x + 22 : p.x - 22 - PIN.w, y = up ? p.y - 26 - PIN.h : p.y + 26;
      const tilt = clean ? 0 : (rand() - 0.5) * 7;
      const [line, card] = Array.from(g.children) as [SVGPathElement, SVGGElement];
      const corner = { x: right ? x : x + PIN.w, y: up ? y + PIN.h : y };
      line.setAttribute("d", clean ? `M${p.x} ${p.y} L${corner.x} ${corner.y}` : `M${p.x} ${p.y} Q${(p.x + corner.x) / 2} ${corner.y} ${corner.x} ${corner.y}`);
      card.setAttribute("transform", `translate(${x} ${y}) rotate(${tilt.toFixed(1)} ${PIN.w / 2} ${PIN.h / 2})`);
      continue;
    }
    const mark = marks?.find(m => m.id === g.dataset.mark);
    const points = mark ? mark.targets.map(at) : [];
    if (!mark || !points.length || points.some(p => !p)) { g.style.display = "none"; continue; }
    g.style.display = "";
    const pts = points as Point[];
    const [line, extra, circle, text] = Array.from(g.children) as [SVGPathElement, SVGPathElement, SVGCircleElement, SVGTextElement];
    const place = (p: Point, anchor = "middle") => { text.setAttribute("x", String(p.x)); text.setAttribute("y", String(p.y)); text.setAttribute("text-anchor", anchor); };
    if (mark.kind === "ring") { const r = clean ? cleanRingPath(pts) : ringPath(pts, mark.id); line.setAttribute("d", r.d); extra.setAttribute("d", ""); place(r.top); }
    else if (mark.kind === "arrow") { const a = clean ? cleanArrowPath(pts[0], pts[1]) : arrowPath(pts[0], pts[1], mark.id); line.setAttribute("d", a.d); extra.setAttribute("d", a.head); place({ x: a.mid.x, y: a.mid.y - 9 }); }
    else if (mark.kind === "callout") { const c = clean ? cleanCalloutPath(pts[0], bounds) : calloutPath(pts[0], mark.id, bounds); line.setAttribute("d", c.d); extra.setAttribute("d", ""); place(c.label, c.anchor); }
    else { const n = numberAt(pts[0]); line.setAttribute("d", ""); extra.setAttribute("d", ""); circle.setAttribute("cx", String(n.x)); circle.setAttribute("cy", String(n.y)); place({ x: n.x, y: n.y + 4.5 }); }
  }
}
