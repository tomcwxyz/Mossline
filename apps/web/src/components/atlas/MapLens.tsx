"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  isRecorded, placedCoordinates, type FundingFlow, type GraphDocument, type GraphNode
} from "@mossline/graph-core";
import { PALETTES, SHAPE, TYPE_LABEL, mix, type AtlasTheme, type MarkShape } from "./palette";
import { OCEANS, REGIONS, SEAS, type BaseName } from "./gazetteer";

type Props = {
  graph: GraphDocument;
  flows: FundingFlow[];
  theme: AtlasTheme;
  selectedId: string | null;
  onPick: (id: string | null) => void;
  /** Records in view with no source coordinates: listed, never guessed. */
  unplaced: GraphNode[];
  onBrowse: () => void;
};
type MapType = import("maplibre-gl").Map;
type MarkerType = import("maplibre-gl").Marker;
type Geometry = { type: "Point"; coordinates: number[] } | { type: "LineString"; coordinates: number[][] } | { type: "Polygon"; coordinates: number[][][] };
type Feature = { type: "Feature"; geometry: Geometry; properties: Record<string, unknown> };
type Land = { type: "FeatureCollection"; features: { geometry: { type: string; coordinates: unknown } }[] };
const collection = (features: Feature[]) => ({ type: "FeatureCollection" as const, features });
const LAND_URL = "/geo/land-10m-simplified.topo.json";
let landCache: Promise<Land> | null = null;
async function loadLand(): Promise<Land> {
  landCache ??= Promise.all([fetch(LAND_URL).then(r => {
    if (!r.ok) throw new Error("Coastline unavailable");
    return r.json();
  }), import("topojson-client")]).then(([topology, topojson]) => {
    const t = topology as Parameters<typeof topojson.feature>[0] & { objects: { land: Parameters<typeof topojson.feature>[1] } };
    return topojson.feature(t, t.objects.land) as unknown as Land;
  });
  return landCache;
}
/** SDF marks so the Map lens uses the same shapes as the Network lens. Hollow
 *  marks are approximate places (from a postcode), never source coordinates. */
function shapeImage(shape: MarkShape, hollow = false) {
  const size = 48, c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; g.strokeStyle = "#fff"; g.lineWidth = 7; g.lineJoin = "round";
  g.beginPath();
  const m = 6, s = size - m * 2;
  if (shape === "circle") g.arc(size / 2, size / 2, s / 2, 0, Math.PI * 2);
  else if (shape === "square") g.roundRect(m + 2, m + 2, s - 4, s - 4, 5);
  else if (shape === "diamond") { g.moveTo(size / 2, m - 1); g.lineTo(size - m + 1, size / 2); g.lineTo(size / 2, size - m + 1); g.lineTo(m - 1, size / 2); }
  else { g.moveTo(size / 2, m); g.lineTo(size - m, size - m - 2); g.lineTo(m, size - m - 2); }
  g.closePath();
  if (hollow) g.stroke(); else g.fill();
  return g.getImageData(0, 0, size, size);
}
/** A gentle curved arc for funder → grantee, as a line string. */
function arc(a: [number, number], b: [number, number]): number[][] {
  const [x1, y1] = a, [x2, y2] = b, dx = x2 - x1, dy = y2 - y1;
  const cx = (x1 + x2) / 2 - dy * 0.22, cy = (y1 + y2) / 2 + dx * 0.22;
  return Array.from({ length: 25 }, (_, i) => {
    const t = i / 24, u = 1 - t;
    return [u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2];
  });
}
/** Graticule spacing for a zoom level, in degrees. */
const gratStep = (zoom: number) => zoom < 3 ? 10 : zoom < 4.5 ? 5 : zoom < 6 ? 2 : zoom < 7.5 ? 1 : zoom < 9 ? 0.5 : 0.25;
function graticule(step: number) {
  const lines: Feature[] = [];
  for (let lon = -180; lon <= 180; lon += step) lines.push({ type: "Feature", geometry: { type: "LineString", coordinates: [[lon, -84], [lon, 84]] }, properties: {} });
  for (let lat = -80; lat <= 80; lat += step) {
    const row: number[][] = [];
    for (let lon = -180; lon <= 180; lon += 10) row.push([lon, lat]);
    lines.push({ type: "Feature", geometry: { type: "LineString", coordinates: row }, properties: {} });
  }
  return collection(lines);
}
const degreeLabel = (v: number, pos: string, neg: string) => {
  const a = Math.abs(v), text = Number.isInteger(a) ? String(a) : a.toFixed(a * 4 % 2 === 0 ? 1 : 2);
  return v === 0 ? "0°" : `${text}°${v > 0 ? pos : neg}`;
};
/** Web Mercator, 0–1 on both axes. */
const merc = (lon: number, lat: number) => {
  const r = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
  return [(lon + 180) / 360, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2];
};

export function MapLens({ graph, flows, theme, selectedId, onPick, unplaced, onBrowse }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapType | null>(null);
  const baseMarkers = useRef<{ marker: MarkerType; min: number; max: number; rank: number }[]>([]);
  const focusMarkers = useRef<MarkerType[]>([]);
  const hoverMarker = useRef<MarkerType | null>(null);
  const gratLabels = useRef<HTMLDivElement>(null);
  const insetRect = useRef<SVGRectElement>(null);
  const pick = useRef(onPick); pick.current = onPick;
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [land, setLand] = useState<Land | null>(null);
  const [mode, setMode] = useState<"points" | "hexagons">("points");
  const [view, setView] = useState({ inView: 0, grantsInView: 0 });
  const [narrow, setNarrow] = useState(false);
  const [unplacedOpen, setUnplacedOpen] = useState(true);
  const palette = PALETTES[theme];
  const byId = useMemo(() => new Map(graph.nodes.map(n => [n.id, n])), [graph]);
  const located = useMemo(() => graph.nodes.flatMap(n => {
    const c = placedCoordinates(n);
    return c ? [{ node: n, lon: c.lon, lat: c.lat, approximate: c.approximate }] : [];
  }), [graph]);
  const approximate = useMemo(() => located.filter(p => p.approximate).length, [located]);
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
  const myGrants = useMemo(() => selectedNode?.type === "funder" ? flows.filter(f => f.funderId === selectedNode.id) : [],
    [flows, selectedNode]);

  useEffect(() => {
    const measure = () => {
      const small = (container.current?.clientWidth ?? 1000) < 700;
      setNarrow(small);
      if (small) setUnplacedOpen(false);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const data = useMemo(() => {
    const coordsOf = (id: string) => {
      const n = byId.get(id); const c = n ? placedCoordinates(n) : null;
      return c ? [c.lon, c.lat] as [number, number] : null;
    };
    const focusSet = selectedId ? new Set([selectedId, ...neighbours, ...myGrants.map(f => f.recipientId)]) : null;
    const records = collection(located.map(({ node, lon, lat, approximate: approx }) => {
      const focus = !!focusSet?.has(node.id);
      const base = palette.types[node.type] ?? palette.types.other;
      const d = Math.sqrt(degree.get(node.id) ?? 0);
      // Resting marks are small and pale, like pencil on survey paper; the
      // selection and what it touches come forward in full colour.
      const px = (node.id === selectedId ? 17 : focus ? Math.min(15, 8 + d * 1.1) : focusSet ? Math.min(8, 5 + d * 0.5) : Math.min(11, 5.5 + d * 0.9)) +
        (approx ? 2 : 0);
      // Hollow marks carry little ink, so they stay a step stronger at rest.
      const color = node.id === selectedId || focus ? base : mix(base, palette.paper, focusSet ? (approx ? 0.45 : 0.66) : (approx ? 0.12 : 0.42));
      return { type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [lon, lat] },
        properties: { id: node.id, kind: node.type === "place" ? "place" : "record", focus: focus || node.id === selectedId,
          shape: "mark-" + SHAPE[node.type] + (approx ? "-hollow" : ""), color, iconSize: px / 18, approx,
          sort: (focus ? 1000 : 0) + (degree.get(node.id) ?? 0) } };
    }));
    const arcs: Feature[] = [], ego: Feature[] = [];
    let hiddenArcs = 0;
    if (selectedNode) {
      const origin = coordsOf(selectedNode.id);
      if (selectedNode.type === "funder") {
        const max = Math.max(1, ...myGrants.map(f => f.amount ?? 0));
        for (const f of myGrants) {
          const to = coordsOf(f.recipientId);
          if (!origin || !to) { hiddenArcs++; continue; }
          const w = f.amount ? 0.7 + 3 * Math.sqrt(f.amount / max) : 1;
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
  }, [located, selectedId, neighbours, selectedNode, myGrants, palette, degree, byId]);

  // ---- Build the map once per theme; data changes update sources in place --
  useEffect(() => {
    let cancelled = false;
    let map: MapType | null = null;
    let frame = 0;
    setStatus("loading");
    (async () => {
      try {
        const [ml, landData] = await Promise.all([import("maplibre-gl"), loadLand()]);
        if (cancelled || !container.current) return;
        setLand(landData);
        // The bundler moves MapLibre away from its worker; scripts/copy-maplibre-worker.mjs serves it here.
        ml.setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${ml.getVersion()}`);
        const ringWidth = (w: number) => ["interpolate", ["linear"], ["zoom"], 2, w * 0.18, 5, w * 0.6, 8, w];
        const rings: [number, string, number][] = [[34, palette.seaLine, .26], [31.5, palette.sea, 1], [26, palette.seaLine, .34],
          [23.5, palette.sea, 1], [18, palette.seaLine, .44], [15.5, palette.sea, 1], [10, palette.seaLine, .56], [7.5, palette.sea, 1]];
        let step = 5;
        map = new ml.Map({
          container: container.current, attributionControl: false, dragRotate: false, pitchWithRotate: false,
          renderWorldCopies: false, maxZoom: 13, minZoom: 1.5,
          style: {
            version: 8,
            sources: {
              land: { type: "geojson", data: landData as never, tolerance: 0.6 },
              graticule: { type: "geojson", data: graticule(step) as never },
              hexes: { type: "geojson", data: collection([]) as never },
              records: { type: "geojson", data: data.records as never },
              arcs: { type: "geojson", data: data.arcs as never },
              ego: { type: "geojson", data: data.ego as never }
            },
            layers: [
              { id: "sea", type: "background", paint: { "background-color": palette.sea } },
              ...rings.map(([w, color, opacity], i) => ({ id: "waterline-" + i, type: "line" as const, source: "land",
                layout: { "line-join": "round" as const }, paint: { "line-color": color, "line-opacity": opacity, "line-width": ringWidth(w) as never } })),
              { id: "land", type: "fill", source: "land", paint: { "fill-color": palette.paper } },
              { id: "graticule", type: "line", source: "graticule",
                paint: { "line-color": palette.coast, "line-opacity": theme === "night" ? 0.22 : 0.16, "line-width": 0.7 } },
              { id: "coast", type: "line", source: "land", paint: { "line-color": palette.coast, "line-width": 0.9 } },
              { id: "hexes", type: "fill", source: "hexes",
                paint: { "fill-color": ["interpolate", ["linear"], ["get", "t"], 0, mix(palette.wash, palette.paper, 0.78), 1, palette.moss],
                  "fill-opacity": 0.82, "fill-outline-color": palette.paper } },
              { id: "ego", type: "line", source: "ego", paint: { "line-color": palette.ink, "line-width": 1.2, "line-opacity": 0.75 } },
              { id: "arcs-casing", type: "line", source: "arcs", layout: { "line-cap": "round" },
                paint: { "line-color": palette.paper, "line-opacity": 0.9, "line-width": ["+", ["get", "w"], 2.4] } },
              { id: "arcs", type: "line", source: "arcs", layout: { "line-cap": "round" },
                paint: { "line-color": palette.types.funder, "line-opacity": 0.8, "line-width": ["get", "w"] } },
              { id: "records", type: "symbol", source: "records", filter: ["!=", ["get", "kind"], "place"],
                layout: { "icon-image": ["get", "shape"], "icon-size": ["get", "iconSize"], "icon-allow-overlap": true,
                  "icon-ignore-placement": true, "symbol-sort-key": ["get", "sort"] },
                paint: { "icon-color": ["get", "color"], "icon-halo-color": palette.paper, "icon-halo-width": 0.8 } },
              // Place records are drawn the way a map draws a town: a dot and a name.
              { id: "places", type: "circle", source: "records", filter: ["==", ["get", "kind"], "place"],
                paint: { "circle-radius": ["case", ["get", "focus"], 4.2, 3], "circle-color": palette.ink,
                  "circle-stroke-color": palette.paper, "circle-stroke-width": 1 } },
              { id: "selected", type: "circle", source: "records", filter: ["==", ["get", "id"], "__none__"],
                paint: { "circle-radius": 16, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": palette.moss, "circle-stroke-width": 2 } }
            ]
          }
        });
        mapRef.current = map;
        for (const shape of ["circle", "square", "diamond", "triangle"] as MarkShape[]) {
          map.addImage("mark-" + shape, shapeImage(shape), { sdf: true, pixelRatio: 2 });
          map.addImage("mark-" + shape + "-hollow", shapeImage(shape, true), { sdf: true, pixelRatio: 2 });
        }
        map.addControl(new ml.AttributionControl({ compact: true,
          customAttribution: "Coastline: Natural Earth (public domain)" + (approximateRef.current
            ? " · Approximate places: ONS Postcode Directory (OGL v3); contains OS data © Crown copyright and database right 2026; contains Royal Mail data © Royal Mail copyright and database right 2026" : "") }), "bottom-right");
        map.addControl(new ml.ScaleControl({ unit: "metric", maxWidth: 110 }), "bottom-right");
        map.on("error", event => {
          const message = String((event as unknown as { error?: { message?: string } }).error?.message ?? "");
          if (/webgl|context/i.test(message)) { setStatus("error"); setError(message); }
        });
        map.on("click", event => {
          const hit = map?.queryRenderedFeatures(event.point, { layers: ["records", "places"] })[0];
          pick.current(hit ? String(hit.properties?.id) : null);
        });
        // Hover names a record without committing to it.
        map.on("mousemove", event => {
          if (!map) return;
          const hit = map.queryRenderedFeatures(event.point, { layers: ["records"] })[0];
          map.getCanvas().style.cursor = hit ? "pointer" : "";
          const id = hit ? String(hit.properties?.id) : null;
          const node = id ? byIdRef.current.get(id) : null;
          if (!node || id === selectedRef.current) { hoverMarker.current?.remove(); hoverMarker.current = null; return; }
          const el = hoverMarker.current?.getElement() ?? document.createElement("div");
          el.className = "ml-map-hover"; el.textContent = node.label;
          const coords = (hit!.geometry as unknown as { coordinates: [number, number] }).coordinates;
          if (!hoverMarker.current) hoverMarker.current = new ml.Marker({ element: el, anchor: "left", offset: [10, 0] }).setLngLat(coords).addTo(map);
          else hoverMarker.current.setLngLat(coords);
        });
        map.on("mouseout", () => { hoverMarker.current?.remove(); hoverMarker.current = null; });
        map.on("move", () => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => { placeGraticuleLabels(); placeInsetRect(); });
        });
        map.on("zoomend", () => {
          const next = gratStep(map!.getZoom());
          if (next !== step) { step = next; (map!.getSource("graticule") as { setData?: (d: unknown) => void })?.setData?.(graticule(step)); }
        });
        map.on("moveend", () => { declutter(); measureView(); if (modeRef.current === "hexagons") drawHexes(); });
        map.on("load", () => {
          if (cancelled) return;
          // Compact attribution starts open; on a phone keep it to its (i) button.
          if ((container.current?.clientWidth ?? 1000) < 700)
            container.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
          fit(false); setStatus("ready");
        });
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "Map unavailable");
      }
    })();
    return () => {
      cancelled = true; cancelAnimationFrame(frame);
      [...baseMarkers.current.map(b => b.marker), ...focusMarkers.current].forEach(m => m.remove());
      baseMarkers.current = []; focusMarkers.current = []; hoverMarker.current?.remove(); hoverMarker.current = null;
      map?.remove(); mapRef.current = null;
    };
    // Rebuild only when the palette changes; data is pushed by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
  // Event handlers registered once read the latest values through refs.
  const byIdRef = useRef(byId); byIdRef.current = byId;
  const selectedRef = useRef(selectedId); selectedRef.current = selectedId;
  const modeRef = useRef(mode); modeRef.current = mode;
  const locatedRef = useRef(located); locatedRef.current = located;
  const approximateRef = useRef(approximate); approximateRef.current = approximate;
  const grantsRef = useRef(myGrants); grantsRef.current = myGrants;

  function fit(animate: boolean) {
    const map = mapRef.current;
    if (!map || !located.length) return;
    let w = 180, e = -180, s = 90, n = -90;
    for (const p of located) { w = Math.min(w, p.lon); e = Math.max(e, p.lon); s = Math.min(s, p.lat); n = Math.max(n, p.lat); }
    const small = (container.current?.clientWidth ?? 1000) < 700;
    if (w === e && s === n) { map.jumpTo({ center: [w, s], zoom: 8 }); return; }
    map.fitBounds([[w, s], [e, n]], { padding: small ? { top: 70, bottom: 60, left: 24, right: 70 }
      : { top: 80, bottom: 70, left: 330, right: 90 }, maxZoom: 9, duration: animate ? 450 : 0 });
  }

  // ---- Names: places from the records, seas and uplands from the gazetteer --
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    let alive = true;
    void import("maplibre-gl").then(ml => {
      if (!alive || mapRef.current !== map) return;
      baseMarkers.current.forEach(b => b.marker.remove());
      baseMarkers.current = [];
      const add = (el: HTMLElement, lngLat: [number, number], min: number, max: number, rank: number, anchor: "left" | "center") =>
        baseMarkers.current.push({ marker: new ml.Marker({ element: el, anchor, offset: anchor === "left" ? [6, 0] : [0, 0] })
          .setLngLat(lngLat).addTo(map), min, max, rank });
      const places = located.filter(p => p.node.type === "place")
        .sort((a, b) => (degree.get(b.node.id) ?? 0) - (degree.get(a.node.id) ?? 0)).slice(0, 120);
      places.forEach((p, i) => {
        const el = document.createElement("button");
        el.type = "button"; el.className = "ml-map-place"; el.textContent = p.node.label;
        el.addEventListener("click", event => { event.stopPropagation(); pick.current(p.node.id); });
        add(el, [p.lon, p.lat], 0, 24, 100 - i * 0.01, "left");
      });
      const named = (list: BaseName[], cls: string, rank: number) => list.forEach(([name, lon, lat, min, max]) => {
        const el = document.createElement("div");
        el.className = cls; el.textContent = name; el.setAttribute("aria-hidden", "true");
        add(el, [lon, lat], min, max, rank, "center");
      });
      named(REGIONS, "ml-map-region", 40); named(SEAS, "ml-map-sea", 30); named(OCEANS, "ml-map-sea ml-map-ocean", 20);
      declutter();
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, located, degree]);

  // ---- Push data and the selection into the map ---------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    (map.getSource("records") as { setData?: (d: unknown) => void } | undefined)?.setData?.(data.records);
    (map.getSource("arcs") as { setData?: (d: unknown) => void } | undefined)?.setData?.(data.arcs);
    (map.getSource("ego") as { setData?: (d: unknown) => void } | undefined)?.setData?.(data.ego);
    map.setFilter("selected", ["==", ["get", "id"], selectedId ?? "__none__"]);
    // In hexagon mode only the selection and what it touches stay as marks.
    map.setFilter("records", mode === "hexagons"
      ? ["all", ["!=", ["get", "kind"], "place"], ["==", ["get", "focus"], true]] : ["!=", ["get", "kind"], "place"]);
    map.setLayoutProperty("hexes", "visibility", mode === "hexagons" ? "visible" : "none");
    if (mode === "hexagons") drawHexes();
    // MapLibre's canvas is focusable for keyboard panning; describe it there.
    map.getCanvas().setAttribute("aria-label",
      `Map: ${(located.length - approximate).toLocaleString("en-GB")} records plotted from their source coordinates` +
      (approximate ? `, ${approximate.toLocaleString("en-GB")} approximately from a postcode` : "") + ". Use Browse records for a list.");
    // The selected record gets a name card, as a map would label a feature.
    focusMarkers.current.forEach(m => m.remove()); focusMarkers.current = [];
    const sel = selectedNode ? located.find(p => p.node.id === selectedNode.id) : null;
    void import("maplibre-gl").then(ml => {
      if (mapRef.current !== map) return;
      if (sel) {
        const el = document.createElement("div");
        el.className = "ml-map-callout";
        const name = document.createElement("strong"); name.textContent = sel.node.label;
        const sub = document.createElement("small");
        const where = sel.node.region ?? "";
        sub.textContent = sel.node.type === "funder"
          ? [`${myGrants.length.toLocaleString("en-GB")} grant${myGrants.length === 1 ? "" : "s"}`, where].filter(Boolean).join(" · ")
          : [TYPE_LABEL[sel.node.type], where, sel.approximate ? "approximate place" : ""].filter(Boolean).join(" · ");
        el.append(name, sub);
        focusMarkers.current.push(new ml.Marker({ element: el, anchor: "left", offset: [20, 0] }).setLngLat([sel.lon, sel.lat]).addTo(map));
      }
      declutter(); measureView();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, status, selectedId, located, mode, myGrants]);

  /** Hide names that would overlap one already shown; the selection's card
   *  wins, then places, then uplands, then seas. Names outside their zoom
   *  range are hidden. */
  function declutter() {
    const map = mapRef.current, box = container.current?.getBoundingClientRect();
    if (!map || !box) return;
    const zoom = map.getZoom();
    const kept: DOMRect[] = [];
    const clash = (r: DOMRect) => kept.some(k => !(r.right < k.left - 2 || r.left > k.right + 2 || r.bottom < k.top - 1 || r.top > k.bottom + 1));
    for (const m of focusMarkers.current) kept.push(m.getElement().getBoundingClientRect());
    for (const b of [...baseMarkers.current].sort((x, y) => y.rank - x.rank)) {
      const el = b.marker.getElement();
      if (zoom < b.min || zoom > b.max) { el.style.visibility = "hidden"; continue; }
      el.style.visibility = "visible";
      const r = el.getBoundingClientRect();
      const off = r.right < box.left || r.left > box.right || r.bottom < box.top || r.top > box.bottom;
      if (off) continue;
      if (clash(r)) { el.style.visibility = "hidden"; continue; }
      kept.push(r);
    }
  }
  /** What the view leaves out, so the map never implies it shows everything. */
  function measureView() {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    const inside = (lon: number, lat: number) => b.contains([lon, lat]);
    const where = new Map(locatedRef.current.map(p => [p.node.id, p]));
    setView({
      inView: locatedRef.current.filter(p => inside(p.lon, p.lat)).length,
      grantsInView: grantsRef.current.filter(f => { const p = where.get(f.recipientId); return p && inside(p.lon, p.lat); }).length
    });
  }
  function placeGraticuleLabels() {
    const map = mapRef.current, layer = gratLabels.current;
    if (!map || !layer) return;
    const step = gratStep(map.getZoom()), b = map.getBounds();
    const w = layer.clientWidth, h = layer.clientHeight;
    const out: string[] = [];
    for (let lat = Math.ceil(b.getSouth() / step) * step; lat <= b.getNorth(); lat += step) {
      const y = map.project([b.getWest(), lat]).y;
      if (y > 70 && y < h - 70) out.push(`<span style="left:8px;top:${Math.round(y) - 15}px">${degreeLabel(+lat.toFixed(2), "N", "S")}</span>`);
    }
    for (let lon = Math.ceil(b.getWest() / step) * step; lon <= b.getEast(); lon += step) {
      const x = map.project([lon, b.getSouth()]).x;
      if (x > 60 && x < w - 60) out.push(`<span style="left:${Math.round(x) + 4}px;bottom:6px">${degreeLabel(+lon.toFixed(2), "E", "W")}</span>`);
    }
    layer.innerHTML = out.join("");
  }
  function drawHexes() {
    const map = mapRef.current;
    if (!map) return;
    const R = (container.current?.clientWidth ?? 1000) < 700 ? 15 : 20;
    const w = map.getCanvas().clientWidth, h = map.getCanvas().clientHeight;
    const bins = new Map<string, { q: number; r: number; n: number }>();
    for (const p of locatedRef.current) {
      if (p.node.type === "place") continue;
      const { x, y } = map.project([p.lon, p.lat]);
      if (x < -R || y < -R || x > w + R || y > h + R) continue;
      // Pixel → axial hex coordinates (pointy-top), then cube rounding.
      const qf = (Math.sqrt(3) / 3 * x - y / 3) / R, rf = (2 / 3 * y) / R, sf = -qf - rf;
      let q = Math.round(qf), r = Math.round(rf); const s = Math.round(sf);
      const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
      if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
      const key = q + ":" + r, bin = bins.get(key);
      if (bin) bin.n++; else bins.set(key, { q, r, n: 1 });
    }
    const max = Math.max(1, ...[...bins.values()].map(b => b.n));
    const hexes: Feature[] = [...bins.values()].map(({ q, r, n }) => {
      const cx = R * Math.sqrt(3) * (q + r / 2), cy = R * 1.5 * r;
      const ring = Array.from({ length: 7 }, (_, i) => {
        const a = Math.PI / 180 * (60 * (i % 6) - 30), pt = map.unproject([cx + R * 0.94 * Math.cos(a), cy + R * 0.94 * Math.sin(a)]);
        return [pt.lng, pt.lat];
      });
      return { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: { n, t: Math.sqrt(n / max) } };
    });
    (map.getSource("hexes") as { setData?: (d: unknown) => void } | undefined)?.setData?.(collection(hexes));
  }

  // ---- Inset locator: the data's wider region, with the current view ------
  const inset = useMemo(() => {
    if (!located.length || !land) return null;
    let w = 180, e = -180, s = 90, n = -90;
    for (const p of located) { w = Math.min(w, p.lon); e = Math.max(e, p.lon); s = Math.min(s, p.lat); n = Math.max(n, p.lat); }
    const span = Math.max(e - w, (n - s) * 1.6, 8) * 2.4;
    const cx = (w + e) / 2, cy = (s + n) / 2;
    const [x0, y0] = merc(cx - span / 2, Math.min(84, cy + span / 3.2)), [x1, y1] = merc(cx + span / 2, Math.max(-84, cy - span / 3.2));
    const S = 150, W = x1 - x0, H = y1 - y0, k = S / Math.max(W, H);
    const width = W * k, height = H * k;
    const toPx = (lon: number, lat: number) => { const [x, y] = merc(lon, lat); return [(x - x0) * k, (y - y0) * k]; };
    const parts: string[] = [];
    const rings = (g: { type: string; coordinates: unknown }) =>
      (g.type === "Polygon" ? [g.coordinates as number[][][]] : g.type === "MultiPolygon" ? g.coordinates as number[][][][] : []).flat();
    for (const f of land.features) for (const ring of rings(f.geometry)) {
      let inBox = false;
      for (const [lon, lat] of ring) if (lon > cx - span && lon < cx + span && lat > cy - span && lat < cy + span) { inBox = true; break; }
      if (!inBox) continue;
      let d = "", last: number[] | null = null;
      for (const [lon, lat] of ring) {
        const p = toPx(lon, lat);
        if (last && Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) < 0.9) continue;
        d += (d ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); last = p;
      }
      if (d) parts.push(d + "Z");
    }
    return { path: parts.join(""), width, height, toPx };
  }, [located, land]);
  const insetRef = useRef(inset); insetRef.current = inset;
  function placeInsetRect() {
    const map = mapRef.current, rect = insetRect.current, inset = insetRef.current;
    if (!map || !rect || !inset) return;
    const b = map.getBounds();
    const [ax, ay] = inset.toPx(b.getWest(), b.getNorth()), [bx, by] = inset.toPx(b.getEast(), b.getSouth());
    const x = Math.max(-2, ax), y = Math.max(-2, ay);
    rect.setAttribute("x", String(x)); rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(Math.max(3, Math.min(inset.width + 2, bx) - x)));
    rect.setAttribute("height", String(Math.max(3, Math.min(inset.height + 2, by) - y)));
  }
  useEffect(() => { placeInsetRect(); placeGraticuleLabels(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [inset, status]);

  // Selecting a record brings it and what it touches into view, closer in
  // when they sit together (a funder's grantees, an organisation's partners).
  const framed = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    // Reframe when the selection changes, or when filters change what it touches.
    const key = `${selectedId}|${located.length}|${myGrants.length}`;
    if (!map || status !== "ready" || !selectedId || framed.current === key) return;
    framed.current = key;
    const ids = new Set([selectedId, ...neighbours, ...myGrants.map(f => f.recipientId)]);
    const pts = located.filter(p => ids.has(p.node.id));
    if (!pts.length) return;
    let w = 180, e = -180, s = 90, n = -90;
    for (const p of pts) { w = Math.min(w, p.lon); e = Math.max(e, p.lon); s = Math.min(s, p.lat); n = Math.max(n, p.lat); }
    const small = (container.current?.clientWidth ?? 1000) < 700;
    const pad = small ? { top: 80, bottom: 70, left: 30, right: 80 } : { top: 90, bottom: 80, left: 340, right: 240 };
    if (w === e && s === n) { map.easeTo({ center: [w, s], zoom: Math.max(map.getZoom(), 7), duration: 600 }); return; }
    map.fitBounds([[w, s], [e, n]], { padding: pad, maxZoom: 8.5, duration: 600 });
  }, [selectedId, status, located, neighbours, myGrants]);
  useEffect(() => { if (!selectedId) framed.current = null; }, [selectedId]);
  // Refit when the records in view change (filters), not on selection.
  // With a selection on the map, keep framing the selection instead.
  useEffect(() => {
    if (status !== "ready") return;
    if (selectedRef.current && located.some(p => p.node.id === selectedRef.current)) return;
    fit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, status]);

  const zoom = (action: "in" | "out" | "fit") => {
    const map = mapRef.current;
    if (!map) return;
    if (action === "in") map.zoomIn({ duration: 220 });
    else if (action === "out") map.zoomOut({ duration: 220 });
    else fit(true);
  };
  const outside = located.length - view.inView;
  const grantsOutside = myGrants.length - view.grantsInView;
  return <section className="ml-map" aria-label="Map of records with source coordinates">
    <div ref={container} className="ml-map-canvas"/>
    <div ref={gratLabels} className="ml-graticule-labels" aria-hidden="true"/>
    {status === "error" && <div className="ml-map-fallback" role="status">
      <strong>This device cannot draw the map.</strong>
      <p>{located.length.toLocaleString("en-GB")} records have a place; Browse records lists them all.</p>
      {error && <small>{error}</small>}
    </div>}
    {inset && !narrow && <svg className="ml-map-inset" viewBox={`0 0 ${inset.width} ${inset.height}`} aria-hidden="true">
      <rect className="ml-map-inset-sea" x="0" y="0" width={inset.width} height={inset.height}/>
      <path className="ml-map-inset-land" d={inset.path}/>
      <rect ref={insetRect} className="ml-map-inset-view" x="0" y="0" width="0" height="0"/>
    </svg>}
    <div className="ml-zoom" role="group" aria-label="Zoom">
      <button type="button" aria-label="Zoom in" onClick={() => zoom("in")}><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2v10M2 7h10"/></svg></button>
      <button type="button" aria-label="Zoom out" onClick={() => zoom("out")}><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 7h10"/></svg></button>
      <button type="button" aria-label="Fit everything" onClick={() => zoom("fit")}><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1.5 5V1.5H5M9 1.5h3.5V5M12.5 9v3.5H9M5 12.5H1.5V9"/></svg></button>
    </div>
    <div className="ml-map-cards">
      {!narrow && <section className="ml-overlay-card ml-map-show" aria-label="Show places as">
        <h3>Show places as</h3>
        <div className="ml-segmented" role="group" aria-label="Show places as">
          <button type="button" aria-pressed={mode === "points"} onClick={() => setMode("points")}>Points</button>
          <button type="button" aria-pressed={mode === "hexagons"} onClick={() => setMode("hexagons")}>Hexagons</button>
        </div>
        {mode === "hexagons" && <p>Darker hexagons hold more records. Places are counted where your source puts them.</p>}
        {selectedNode?.type === "funder" && myGrants.length > 0 && <p className="ml-map-arcnote"><span className="ml-key-arc"/>
          Arcs are recorded grants, wider for more money.</p>}
        {approximate > 0 && <p className="ml-map-arcnote"><span className="ml-key-hollow" aria-hidden="true"/>
          Hollow marks are approximate: placed from a postcode, not from source coordinates.</p>}
      </section>}
      {unplaced.length > 0 && <section className={"ml-overlay-card ml-unplaced" + (unplacedOpen ? "" : " is-closed")} aria-label="Records without coordinates">
        <button type="button" className="ml-unplaced-head" aria-expanded={unplacedOpen} onClick={() => setUnplacedOpen(v => !v)}>
          <strong>{unplaced.length.toLocaleString("en-GB")} record{unplaced.length === 1 ? " has" : "s have"} no location</strong>
          <span aria-hidden="true">{unplacedOpen ? "–" : "+"}</span>
        </button>
        {unplacedOpen && <>
          <p>Kept here in the margin rather than guessed from a name or region. A postcode or coordinates in your data would place them.</p>
          <ul>{unplaced.slice(0, 3).map(n => <li key={n.id}><button type="button" onClick={() => pick.current(n.id)}>{n.label}</button></li>)}
            {unplaced.length > 3 && <li><button type="button" onClick={onBrowse}>+{(unplaced.length - 3).toLocaleString("en-GB")} in Browse</button></li>}</ul>
        </>}
      </section>}
    </div>
    <p className="ml-canvas-caption ml-drawing-caption ml-map-pill" data-status={status}>
      {selectedNode?.type === "funder" && myGrants.length > 0 && grantsOutside > 0
        ? <>{grantsOutside.toLocaleString("en-GB")} more grant{grantsOutside === 1 ? " is" : "s are"} outside this view or unplaced</>
        : <>{located.length.toLocaleString("en-GB")} plotted{approximate > 0 && <> ({approximate.toLocaleString("en-GB")} approximate)</>} · {unplaced.length.toLocaleString("en-GB")} without a place
          {status === "ready" && outside > 0 && <> · {outside.toLocaleString("en-GB")} outside this view</>}</>}
    </p>
  </section>;
}
