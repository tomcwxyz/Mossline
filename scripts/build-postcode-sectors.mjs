#!/usr/bin/env node
/**
 * Builds apps/web/public/geo/postcode-sectors.json: the average position of
 * the live postcodes in each postcode sector ("NE46 1") and district ("NE46"),
 * used to place records approximately from a postcode without sending the
 * postcode anywhere.
 *
 * Input: a gzipped JSON list of postcodes with coordinates derived from the
 * ONS Postcode Directory, such as data/uk-address.json.gz in the npm package
 * uk-address-lookup (rows like ["AB10 1AB", 57.14959, -2.096923, ...]).
 *
 *   node scripts/build-postcode-sectors.mjs path/to/uk-address.json.gz
 *
 * Northern Ireland (BT) postcodes are left out: their positions come from Land
 * and Property Services under terms that do not allow open redistribution.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const input = process.argv[2];
if (!input) { console.error("Usage: node scripts/build-postcode-sectors.mjs path/to/uk-address.json.gz"); process.exit(1); }
const data = JSON.parse(gunzipSync(readFileSync(input)).toString("utf8"));
const rows = data.postcodes;
if (!Array.isArray(rows)) throw new Error("Expected a 'postcodes' array");

const sum = (map, key, lat, lon) => {
  const s = map.get(key) ?? [0, 0, 0];
  s[0] += lat; s[1] += lon; s[2]++;
  map.set(key, s);
};
const sectors = new Map(), districts = new Map();
// The town and region of each sector: the most common among its postcodes'
// nearest named roads (OS Open Names). Stored once, referenced by index.
const towns = [], townIndex = new Map(), regions = data.regions ?? [];
const placeOf = new Map();
const vote = (key, town, region) => {
  const v = placeOf.get(key) ?? new Map();
  const k = town + "|" + region; v.set(k, (v.get(k) ?? 0) + 1); placeOf.set(key, v);
};
let used = 0, skipped = 0;
for (const [postcode, lat, lon, streetIds] of rows) {
  const m = /^([A-Z]{1,2}\d[A-Z\d]?) (\d)[A-Z]{2}$/.exec(postcode);
  if (!m || typeof lat !== "number" || typeof lon !== "number" || /^BT/.test(postcode)) { skipped++; continue; }
  // ONSPD marks postcodes without a grid reference with placeholder positions.
  if (lat < 49 || lat > 61 || lon < -9 || lon > 2.5) { skipped++; continue; }
  sum(sectors, m[1] + " " + m[2], lat, lon);
  sum(districts, m[1], lat, lon);
  const street = Array.isArray(streetIds) && streetIds.length ? data.streets?.[streetIds[0]] : null;
  if (street) {
    const town = data.towns[street[1]] ?? "";
    if (town && !townIndex.has(town)) { townIndex.set(town, towns.length); towns.push(town); }
    vote(m[1] + " " + m[2], town ? townIndex.get(town) : -1, street[3] ?? -1);
    vote(m[1], town ? townIndex.get(town) : -1, street[3] ?? -1);
  }
  used++;
}
const round = (n) => Math.round(n * 1000) / 1000;
const top = (key) => {
  const v = placeOf.get(key);
  if (!v) return [-1, -1];
  return [...v].sort((a, b) => b[1] - a[1])[0][0].split("|").map(Number);
};
const finish = (map) => Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b, "en-GB"))
  .map(([k, [lat, lon, n]]) => [k, [round(lat / n), round(lon / n), n, ...top(k)]]));

// Keep only the towns some sector or district is named after.
const sectorRows = finish(sectors), districtRows = finish(districts);
const keep = new Map();
for (const r of [...Object.values(sectorRows), ...Object.values(districtRows)])
  if (r[3] >= 0) { if (!keep.has(r[3])) keep.set(r[3], keep.size); r[3] = keep.get(r[3]); }
const keptTowns = [...keep.keys()].map(i => towns[i]);
const out = {
  kind: "mossline-postcode-centroids",
  version: 1,
  generated: data.generated ?? new Date().toISOString().slice(0, 10),
  about: "Average position of live postcodes per postcode sector and district in Great Britain: [latitude, longitude, postcodes counted, town index, region index]. Town and region are the most common among the sector's postcodes (OS Open Names). Approximate: a sector covers a few thousand addresses.",
  attribution: [
    "Contains OS data © Crown copyright and database right 2026",
    "Contains Royal Mail data © Royal Mail copyright and database right 2026",
    "Contains National Statistics data © Crown copyright and database right 2026",
    "Source: Office for National Statistics licensed under the Open Government Licence v.3.0",
    "Town names: OS Open Names, contains OS data © Crown copyright and database right 2026"
  ],
  excludes: "Northern Ireland (BT) postcodes",
  towns: keptTowns,
  regions,
  sectors: sectorRows,
  districts: districtRows
};
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "apps/web/public/geo/postcode-sectors.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(out));
console.log(`${used.toLocaleString("en-GB")} postcodes → ${sectors.size.toLocaleString("en-GB")} sectors, ${districts.size.toLocaleString("en-GB")} districts (${skipped.toLocaleString("en-GB")} skipped)`);
console.log("Wrote " + target);
