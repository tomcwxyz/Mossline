// Builds the offline basemap used by the Field Atlas Map lens.
//
// Source: Natural Earth 1:10m land via the world-atlas package (public domain).
// The result is served from apps/web/public/geo so the map works without any
// hosted tile service. Run after `npm install`:
//
//   node scripts/build-basemap.mjs
//
import fs from "node:fs";
import { createRequire } from "node:module";
import { presimplify, simplify, quantile } from "topojson-simplify";
import { quantize } from "topojson-client";

const require = createRequire(import.meta.url);
// quantile(p) keeps the most significant fraction p of vertices.
const QUANTILE = Number(process.env.QUANTILE ?? 0.25);
const land = require("world-atlas/land-10m.json");
const target = new URL("../apps/web/public/geo/land-10m-simplified.topo.json", import.meta.url);

// Keep a quarter of the 1:10m vertices: coastlines stay crisp at regional zoom
// while the file stays small enough to load on a phone.
const pre = presimplify(land);
const simplified = simplify(pre, quantile(pre, QUANTILE));
// Drop the per-vertex weights added by presimplify, then re-quantise
// (delta-encoded integers keep the file compact).
for (const arc of simplified.arcs) for (const point of arc) point.length = 2;
delete simplified.transform;
const output = {
  ...quantize(simplified, 1e5),
  // Attribution travels with the data.
  metadata: { source: "Natural Earth 1:10m land via world-atlas 2.0.2", licence: "Public domain" }
};
fs.mkdirSync(new URL("./", target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(output));
console.log("Wrote", target.pathname, (fs.statSync(target).size / 1024).toFixed(0) + " KB");
