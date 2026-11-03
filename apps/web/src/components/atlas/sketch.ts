"use client";

import { useEffect, useState } from "react";
import { seeded } from "./marginalia";
import type { AtlasTheme } from "./palette";

/**
 * The Sketched drawing style: a trial, in the Themes lens first
 * (docs/design/HAND_DRAWN.md). Style never changes meaning: ink, pencil and
 * wash keep theirs; only the hand changes. Remembered on this device.
 */
export type AtlasStyle = "clean" | "sketched";
const KEY = "mossline:atlas-style";
const EVENT = "mossline:style";
function readStyle(): AtlasStyle {
  try { return window.localStorage.getItem(KEY) === "sketched" ? "sketched" : "clean"; } catch { return "clean"; }
}
export function useAtlasStyle(): [AtlasStyle, (style: AtlasStyle) => void] {
  const [style, setStyle] = useState<AtlasStyle>("clean");
  useEffect(() => {
    setStyle(readStyle());
    const on = (e: Event) => setStyle((e as CustomEvent<AtlasStyle>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return [style, (next: AtlasStyle) => {
    try { window.localStorage.setItem(KEY, next); } catch { /* storage blocked */ }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }];
}

/** The handwriting face for labels (Kalam, SIL Open Font Licence, served locally). */
export const SKETCH_FONT = "Kalam";

/**
 * Watercolour pigments for the wash. They tell areas apart, as the wash
 * always has; they mean nothing more. Muted, so names and marks stay readable.
 */
export const PIGMENTS: Record<AtlasTheme, string[]> = {
  day: ["#7C9A5E", "#B98B4E", "#6F8FA6", "#B97A72", "#C3A548", "#8A7FA0", "#5E9488", "#A08560"],
  night: ["#A9C98A", "#E0B27A", "#9DB9CF", "#E0A49B", "#E3CB7A", "#B9AFD0", "#8FC4B7", "#CDB48D"]
};

/**
 * A wobbly, closed outline around a circle: the edge of a wash laid down by
 * hand. Seeded from the area's ID, so it's the same every time it's drawn.
 */
export function blobPath(x: number, y: number, r: number, seed: string, wobble = 0.09): string {
  const rand = seeded(seed);
  const n = 18, phase = rand() * Math.PI * 2;
  // A few slow bulges plus a little noise, so it isn't a perfect circle.
  const lobes = [1 + Math.floor(rand() * 2), 3 + Math.floor(rand() * 2)].map(k => ({ k, a: (rand() - 0.3) * wobble, p: rand() * 6.28 }));
  const pts = Array.from({ length: n }, (_, i) => {
    const t = phase + (i / n) * Math.PI * 2;
    const k = 1 + lobes.reduce((s, l) => s + l.a * Math.sin(l.k * t + l.p), 0) + (rand() - 0.5) * wobble * 0.6;
    return { x: x + Math.cos(t) * r * k, y: y + Math.sin(t) * r * k };
  });
  const f = (v: number) => Math.round(v * 100) / 100;
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    d += i === 0 ? `M${f(m.x)} ${f(m.y)}` : ` Q${f(a.x)} ${f(a.y)} ${f(m.x)} ${f(m.y)}`;
  }
  const a = pts[0];
  const first = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  return d + ` Q${f(a.x)} ${f(a.y)} ${f(first.x)} ${f(first.y)}Z`;
}
