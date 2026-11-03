"use client";

/**
 * Pictures of the map, for printing a story. WebGL canvases (Sigma, MapLibre)
 * are only readable straight after they're drawn, so each lens registers a
 * way to copy its canvases at that moment; the rest of the drawing (washes,
 * marks, names) is SVG and HTML, laid over the copies afterwards.
 */
type Copies = Map<HTMLCanvasElement, HTMLCanvasElement>;
type Lens = { lens: string; ready: () => boolean; copyCanvases: () => Promise<Copies> };
let current: Lens | null = null;

/** While printing, cameras cut instead of moving, so each step can be pictured at once. */
export const motion = { still: false };

export function registerLens(lens: Lens) {
  current = lens;
  return () => { if (current === lens) current = null; };
}

/** Copies every canvas in a container: call it straight after the canvases are drawn. */
export function copyCanvases(root: Element): Copies {
  const copies: Copies = new Map();
  for (const c of Array.from(root.querySelectorAll("canvas"))) {
    if (!c.width || !c.height) continue;
    const copy = document.createElement("canvas");
    copy.width = c.width; copy.height = c.height;
    copy.getContext("2d")?.drawImage(c, 0, 0);
    copies.set(c, copy);
  }
  return copies;
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
/** Waits until the lens for a view is drawn and settled. */
export async function settled(lens: string, timeout = 9000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (current?.lens === lens && current.ready()) break;
    if (lens === "funding" || lens === "timeline") break;
    await wait(100);
  }
  await wait(lens === "funding" || lens === "timeline" ? 700 : 450);
}

const SVG_PROPS = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "stroke-dasharray", "stroke-linecap",
  "stroke-linejoin", "opacity", "font-family", "font-size", "font-style", "font-weight", "letter-spacing", "paint-order",
  "text-anchor", "dominant-baseline", "display", "visibility"];
/** An SVG, with its styles written in, as a picture (CSS classes and variables don't survive the trip). */
async function svgImage(svg: SVGSVGElement, w: number, h: number): Promise<HTMLImageElement | null> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const from = [svg, ...Array.from(svg.querySelectorAll("*"))], to = [clone, ...Array.from(clone.querySelectorAll("*"))];
  from.forEach((el, i) => {
    const cs = getComputedStyle(el), target = to[i] as SVGElement;
    for (const p of SVG_PROPS) target.style.setProperty(p, cs.getPropertyValue(p));
  });
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w)); clone.setAttribute("height", String(h));
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  const img = new Image();
  img.src = url;
  try { await img.decode(); return img; } catch { return null; }
}

/** The lens as one picture: background, canvases, SVG layers and names, in the order they're stacked. */
export async function pictureOf(section: HTMLElement, scale = 2): Promise<string | null> {
  const box = section.getBoundingClientRect();
  if (!box.width || !box.height) return null;
  const copies = current ? await current.copyCanvases() : new Map() as Copies;
  const out = document.createElement("canvas");
  out.width = Math.round(box.width * scale); out.height = Math.round(box.height * scale);
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);
  const paper = getComputedStyle(section.closest(".ml-canvas") ?? section).backgroundColor;
  ctx.fillStyle = paper && paper !== "rgba(0, 0, 0, 0)" ? paper : getComputedStyle(document.body).backgroundColor || "#F2F1EC";
  ctx.fillRect(0, 0, box.width, box.height);
  const layers = Array.from(section.querySelectorAll<HTMLElement | SVGSVGElement>(
    "canvas, svg.ml-wash, svg.ml-marks, .ml-area-label, .maplibregl-marker, .ml-sign, .ml-graticule-labels span"));
  for (const el of layers) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect(), x = r.left - box.left, y = r.top - box.top;
    if (r.right < box.left || r.left > box.right || r.bottom < box.top || r.top > box.bottom) continue;
    if (el instanceof HTMLCanvasElement) {
      const copy = copies.get(el);
      if (copy) ctx.drawImage(copy, x, y, r.width, r.height);
      else { try { ctx.drawImage(el, x, y, r.width, r.height); } catch { /* unreadable */ } }
    } else if (el instanceof SVGSVGElement) {
      const img = await svgImage(el, r.width, r.height);
      if (img) ctx.drawImage(img, x, y, r.width, r.height);
    } else {
      // Names and labels: their text, in their own font and colour, with a paper halo as on screen.
      ctx.globalAlpha = Number(getComputedStyle(el.closest(".ml-area-labels") ?? el).opacity) || 1;
      const lines = el.children.length ? Array.from(el.children) as HTMLElement[] : [el];
      for (const line of lines) {
        const ls = getComputedStyle(line), lr = line.getBoundingClientRect();
        if (ls.display === "none" || !line.textContent?.trim()) continue;
        ctx.font = `${ls.fontStyle} ${ls.fontWeight} ${ls.fontSize} ${ls.fontFamily}`;
        ctx.textBaseline = "middle";
        const text = ls.textTransform === "uppercase" ? line.textContent.toUpperCase() : line.textContent;
        const tx = lr.left - box.left, ty = lr.top - box.top + lr.height / 2;
        ctx.textAlign = "left";
        (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = ls.letterSpacing === "normal" ? "0px" : ls.letterSpacing;
        ctx.lineWidth = 4; ctx.strokeStyle = ctx.fillStyle = paper;
        ctx.strokeText(text, tx, ty);
        ctx.fillStyle = ls.color; ctx.fillText(text, tx, ty);
      }
      ctx.globalAlpha = 1;
    }
  }
  return out.toDataURL("image/jpeg", 0.88);
}
