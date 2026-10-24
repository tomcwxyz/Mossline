"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  isRecorded, recordedCoordinates, type FundingFlow, type GraphDocument
} from "@mossline/graph-core";
import { PALETTES, SHAPE, markSize, mix, type AtlasTheme, type MarkShape } from "./palette";

type Props = {
  graph: GraphDocument;
  flows: FundingFlow[];
  theme: AtlasTheme;
  selectedId: string | null;
  onPick: (id: string | null) => void;
};
type MapType = import("maplibre-gl").Map;
type MarkerType = import("maplibre-gl").Marker;
type Feature = { type: "Feature"; geometry: { type: "Point" | "LineString"; coordinates: number[] | number[][] }; properties: Record<string, unknown> };
const collection = (features: Feature[]) => ({ type: "FeatureCollection" as const, features });
const LAND_URL = "/geo/land-10m-simplified.topo.json";
let landCache: Promise<unknown> | null = null;
async function loadLand() {
  landCache ??= Promise.all([fetch(LAND_URL).then(r => {
    if (!r.ok) throw new Error("Coastline unavailable");
    return r.json();
  }), import("topojson-client")]).then(([topology, topojson]) => {
    const t = topology as Parameters<typeof topojson.feature>[0] & { objects: { land: Parameters<typeof topojson.feature>[1] } };
    return topojson.feature(t, t.objects.land);
  });
  return landCache;
}
/** SDF marks so the Map lens uses the same shapes as the Network lens. */
function shapeImage(shape: MarkShape) {
  const size = 48, c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.beginPath();
  const m = 6, s = size - m * 2;
  if (shape === "circle") g.arc(size / 2, size / 2, s / 2, 0, Math.PI * 2);
  else if (shape === "square") g.roundRect(m + 2, m + 2, s - 4, s - 4, 5);
  else if (shape === "diamond") { g.moveTo(size / 2, m - 1); g.lineTo(size - m + 1, size / 2); g.lineTo(size / 2, size - m + 1); g.lineTo(m - 1, size / 2); }
  else { g.moveTo(size / 2, m); g.lineTo(size - m, size - m - 2); g.lineTo(m, size - m - 2); }
  g.closePath(); g.fill();
  return g.getImageData(0, 0, size, size);
}
/** A gentle great-circle-ish arc for funder → grantee, as a line string. */
function arc(a: [number, number], b: [number, number]): number[][] {
  const [x1, y1] = a, [x2, y2] = b, dx = x2 - x1, dy = y2 - y1;
  const cx = (x1 + x2) / 2 - dy * 0.22, cy = (y1 + y2) / 2 + dx * 0.22;
  return Array.from({ length: 25 }, (_, i) => {
    const t = i / 24, u = 1 - t;
    return [u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2];
  });
}

export function MapLens({ graph, flows, theme, selectedId, onPick }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapType | null>(null);
  const markers = useRef<MarkerType[]>([]);
  const pick = useRef(onPick); pick.current = onPick;
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const palette = PALETTES[theme];
  const byId = useMemo(() => new Map(graph.nodes.map(n => [n.id, n])), [graph]);
  const located = useMemo(() => graph.nodes.flatMap(n => {
    const c = recordedCoordinates(n);
    return c ? [{ node: n, lon: c.lon, lat: c.lat }] : [];
  }), [graph]);
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const e of graph.edges) if (isRecorded(e)) {
      d.set(e.source, (d.get(e.source) ?? 0) + 1); d.set(e.target, (d.get(e.target) ?? 0) + 1);
    }
    return d;
  }, [graph]);
  const neighbours = useMemo(() => {
    const set = new Set<string>();
    if (!selectedId) return set;
    for (const e of graph.edges) if (isRecorded(e)) {
      if (e.source === selectedId) set.add(e.target);
      if (e.target === selectedId) set.add(e.source);
    }
    return set;
  }, [graph, selectedId]);
  const selectedNode = selectedId ? byId.get(selectedId) ?? null : null;

  const data = useMemo(() => {
    const coordsOf = (id: string) => {
      const n = byId.get(id); const c = n ? recordedCoordinates(n) : null;
      return c ? [c.lon, c.lat] as [number, number] : null;
    };
    const records = collection(located.map(({ node, lon, lat }) => {
      const focus = !selectedId || node.id === selectedId || neighbours.has(node.id);
      const base = palette.types[node.type] ?? palette.types.other;
      const size = markSize(degree.get(node.id) ?? 0, node.type);
      return { type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [lon, lat] },
        properties: { id: node.id, shape: "mark-" + SHAPE[node.type], color: focus ? base : mix(base, palette.paper, 0.6),
          iconSize: (size * 2 + 3) / 24, sort: (focus ? 1000 : 0) + (degree.get(node.id) ?? 0) } };
    }));
    const arcs: Feature[] = [], ego: Feature[] = [];
    let hiddenArcs = 0;
    if (selectedNode) {
      const origin = coordsOf(selectedNode.id);
      if (selectedNode.type === "funder") {
        const mine = flows.filter(f => f.funderId === selectedNode.id);
        const max = Math.max(1, ...mine.map(f => f.amount ?? 0));
        for (const f of mine) {
          const to = coordsOf(f.recipientId);
          if (!origin || !to) { hiddenArcs++; continue; }
          const w = f.amount ? 0.8 + 5.2 * Math.sqrt(f.amount / max) : 1.1;
          arcs.push({ type: "Feature", geometry: { type: "LineString", coordinates: arc(origin, to) }, properties: { w } });
        }
      } else if (origin) {
        for (const id of neighbours) {
          const to = coordsOf(id);
          if (to) ego.push({ type: "Feature", geometry: { type: "LineString", coordinates: [origin, to] }, properties: {} });
        }
      }
    }
    return { records, arcs: collection(arcs), ego: collection(ego), hiddenArcs };
  }, [located, selectedId, neighbours, selectedNode, flows, palette, degree, byId]);

  // Build the map once per theme; data changes update sources in place.
  useEffect(() => {
    let cancelled = false;
    let map: MapType | null = null;
    setStatus("loading");
    (async () => {
      try {
        const [ml, land] = await Promise.all([import("maplibre-gl"), loadLand()]);
        if (cancelled || !container.current) return;
        // The bundler moves MapLibre away from its worker; scripts/copy-maplibre-worker.mjs serves it here.
        ml.setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${ml.getVersion()}`);
        const ringWidth = (w: number) => ["interpolate", ["linear"], ["zoom"], 2, w * 0.18, 5, w * 0.6, 8, w];
        const rings: [number, string, number][] = [[34, palette.seaLine, .26], [31.5, palette.sea, 1], [26, palette.seaLine, .34],
          [23.5, palette.sea, 1], [18, palette.seaLine, .44], [15.5, palette.sea, 1], [10, palette.seaLine, .56], [7.5, palette.sea, 1]];
        map = new ml.Map({
          container: container.current, attributionControl: false, dragRotate: false, pitchWithRotate: false,
          renderWorldCopies: false, maxZoom: 13, minZoom: 1.5,
          style: {
            version: 8,
            sources: {
              land: { type: "geojson", data: land as never, tolerance: 0.6 },
              records: { type: "geojson", data: data.records as never },
              arcs: { type: "geojson", data: data.arcs as never },
              ego: { type: "geojson", data: data.ego as never }
            },
            layers: [
              { id: "sea", type: "background", paint: { "background-color": palette.sea } },
              ...rings.map(([w, color, opacity], i) => ({ id: "waterline-" + i, type: "line" as const, source: "land",
                layout: { "line-join": "round" as const }, paint: { "line-color": color, "line-opacity": opacity, "line-width": ringWidth(w) as never } })),
              { id: "land", type: "fill", source: "land", paint: { "fill-color": palette.paper } },
              { id: "coast", type: "line", source: "land", paint: { "line-color": palette.coast, "line-width": 0.8 } },
              { id: "ego", type: "line", source: "ego", paint: { "line-color": palette.ink, "line-width": 1.2, "line-opacity": 0.7 } },
              { id: "arcs-casing", type: "line", source: "arcs", layout: { "line-cap": "round" },
                paint: { "line-color": palette.paper, "line-opacity": 0.85, "line-width": ["+", ["get", "w"], 2.6] } },
              { id: "arcs", type: "line", source: "arcs", layout: { "line-cap": "round" },
                paint: { "line-color": palette.types.funder, "line-opacity": 0.78, "line-width": ["get", "w"] } },
              { id: "records", type: "symbol", source: "records",
                layout: { "icon-image": ["get", "shape"], "icon-size": ["get", "iconSize"], "icon-allow-overlap": true,
                  "icon-ignore-placement": true, "symbol-sort-key": ["get", "sort"] },
                paint: { "icon-color": ["get", "color"], "icon-halo-color": palette.paper, "icon-halo-width": 1.2 } },
              { id: "selected", type: "circle", source: "records", filter: ["==", ["get", "id"], "__none__"],
                paint: { "circle-radius": 13, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": palette.moss, "circle-stroke-width": 2 } }
            ]
          }
        });
        mapRef.current = map;
        for (const shape of ["circle", "square", "diamond", "triangle"] as MarkShape[])
          map.addImage("mark-" + shape, shapeImage(shape), { sdf: true, pixelRatio: 2 });
        map.addControl(new ml.AttributionControl({ compact: true,
          customAttribution: "Coastline: Natural Earth (public domain)" }), "bottom-right");
        map.addControl(new ml.ScaleControl({ unit: "metric", maxWidth: 110 }), "bottom-right");
        map.on("error", event => {
          const message = String((event as unknown as { error?: { message?: string } }).error?.message ?? "");
          if (/webgl|context/i.test(message)) { setStatus("error"); setError(message); }
        });
        map.on("click", event => {
          const hit = map?.queryRenderedFeatures(event.point, { layers: ["records"] })[0];
          pick.current(hit ? String(hit.properties?.id) : null);
        });
        map.on("mousemove", "records", () => { if (map) map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "records", () => { if (map) map.getCanvas().style.cursor = ""; });
        map.on("load", () => { if (!cancelled) { fit(false); setStatus("ready"); } });
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "Map unavailable");
      }
    })();
    return () => { cancelled = true; markers.current.forEach(m => m.remove()); markers.current = []; map?.remove(); mapRef.current = null; };
    // Rebuild only when the palette changes; data is pushed by the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  function fit(animate: boolean) {
    const map = mapRef.current;
    if (!map || !located.length) return;
    let w = 180, e = -180, s = 90, n = -90;
    for (const p of located) { w = Math.min(w, p.lon); e = Math.max(e, p.lon); s = Math.min(s, p.lat); n = Math.max(n, p.lat); }
    const box = container.current?.getBoundingClientRect();
    const narrow = (box?.width ?? 1000) < 600;
    if (w === e && s === n) { map.jumpTo({ center: [w, s], zoom: 8 }); return; }
    map.fitBounds([[w, s], [e, n]], { padding: narrow ? { top: 60, bottom: 60, left: 24, right: 24 }
      : { top: 90, bottom: 110, left: 340, right: 80 }, maxZoom: 9, duration: animate ? 450 : 0 });
  }
  // Push data changes into the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    (map.getSource("records") as { setData?: (d: unknown) => void } | undefined)?.setData?.(data.records);
    (map.getSource("arcs") as { setData?: (d: unknown) => void } | undefined)?.setData?.(data.arcs);
    (map.getSource("ego") as { setData?: (d: unknown) => void } | undefined)?.setData?.(data.ego);
    map.setFilter("selected", ["==", ["get", "id"], selectedId ?? "__none__"]);
    // MapLibre's canvas is focusable for keyboard panning; describe it there.
    map.getCanvas().setAttribute("aria-label",
      `Map: ${located.length.toLocaleString("en-GB")} records plotted from their source coordinates. Use Browse records for a list.`);
    // Labels: the selection and its neighbours, or the best-connected records.
    markers.current.forEach(m => m.remove()); markers.current = [];
    void import("maplibre-gl").then(ml => {
      if (mapRef.current !== map) return;
      const chosen = selectedId
        ? located.filter(p => p.node.id === selectedId || neighbours.has(p.node.id)).slice(0, 24)
        : [...located].sort((a, b) => (degree.get(b.node.id) ?? 0) - (degree.get(a.node.id) ?? 0)).slice(0, 8);
      // The selection first, then the best-connected, so they win any clash.
      chosen.sort((a, b) => Number(b.node.id === selectedId) - Number(a.node.id === selectedId)
        || (degree.get(b.node.id) ?? 0) - (degree.get(a.node.id) ?? 0));
      for (const p of chosen) {
        const el = document.createElement("div");
        el.className = "ml-map-label" + (p.node.id === selectedId ? " ml-map-label--selected" : "");
        el.textContent = p.node.label;
        markers.current.push(new ml.Marker({ element: el, anchor: "left", offset: [11, 0] }).setLngLat([p.lon, p.lat]).addTo(map));
      }
      declutter();
    });
  }, [data, status, selectedId, located, neighbours, degree]);
  /** Hide map labels that would overlap one already shown. */
  function declutter() {
    const map = mapRef.current;
    if (!map) return;
    const kept: [number, number, number, number][] = [];
    for (const marker of markers.current) {
      const el = marker.getElement();
      const p = map.project(marker.getLngLat());
      const w = el.offsetWidth || el.textContent!.length * 6.5, h = 16;
      const box: [number, number, number, number] = [p.x + 9, p.y - h / 2, p.x + 13 + w, p.y + h / 2];
      const clash = kept.some(b => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]));
      el.style.visibility = clash ? "hidden" : "visible";
      if (!clash) kept.push(box);
    }
  }
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    map.on("moveend", declutter);
    return () => { map.off("moveend", declutter); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  // Refit when the records in view change (filters), not on selection.
  useEffect(() => { if (status === "ready") fit(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [graph, status]);

  const zoom = (action: "in" | "out" | "fit") => {
    const map = mapRef.current;
    if (!map) return;
    if (action === "in") map.zoomIn({ duration: 220 });
    else if (action === "out") map.zoomOut({ duration: 220 });
    else fit(true);
  };
  const unplaced = graph.nodes.length - located.length;
  return <section className="ml-map" aria-label="Map of records with source coordinates">
    <div ref={container} className="ml-map-canvas"/>
    {status === "error" && <div className="ml-map-fallback" role="status">
      <strong>This device cannot draw the map.</strong>
      <p>{located.length.toLocaleString("en-GB")} records have source coordinates; Browse records lists them all.</p>
      {error && <small>{error}</small>}
    </div>}
    <div className="ml-zoom" role="group" aria-label="Zoom">
      <button type="button" aria-label="Zoom in" onClick={() => zoom("in")}><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2v10M2 7h10"/></svg></button>
      <button type="button" aria-label="Zoom out" onClick={() => zoom("out")}><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 7h10"/></svg></button>
      <button type="button" aria-label="Fit everything" onClick={() => zoom("fit")}><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1.5 5V1.5H5M9 1.5h3.5V5M12.5 9v3.5H9M5 12.5H1.5V9"/></svg></button>
    </div>
    <p className="ml-canvas-caption ml-drawing-caption" data-status={status}>
      {located.length.toLocaleString("en-GB")} plotted · {unplaced.toLocaleString("en-GB")} without coordinates
      {data.hiddenArcs > 0 && <> · {data.hiddenArcs} grants not drawn (no coordinates)</>}
    </p>
  </section>;
}
