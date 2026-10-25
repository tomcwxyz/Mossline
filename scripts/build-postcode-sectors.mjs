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
let used = 0, skipped = 0;
for (const [postcode, lat, lon] of rows) {
  const m = /^([A-Z]{1,2}\d[A-Z\d]?) (\d)[A-Z]{2}$/.exec(postcode);
  if (!m || typeof lat !== "number" || typeof lon !== "number" || /^BT/.test(postcode)) { skipped++; continue; }
  // ONSPD marks postcodes without a grid reference with placeholder positions.
  if (lat < 49 || lat > 61 || lon < -9 || lon > 2.5) { skipped++; continue; }
  sum(sectors, m[1] + " " + m[2], lat, lon);
  sum(districts, m[1], lat, lon);
  used++;
}
const round = (n) => Math.round(n * 1000) / 1000;
const finish = (map) => Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b, "en-GB"))
  .map(([k, [lat, lon, n]]) => [k, [round(lat / n), round(lon / n), n]]));

const out = {
  kind: "mossline-postcode-centroids",
  version: 1,
  generated: data.generated ?? new Date().toISOString().slice(0, 10),
  about: "Average position of live postcodes per postcode sector and district in Great Britain. [latitude, longitude, postcodes counted]. Approximate: a sector covers a few thousand addresses.",
  attribution: [
    "Contains OS data © Crown copyright and database right 2026",
    "Contains Royal Mail data © Royal Mail copyright and database right 2026",
    "Contains National Statistics data © Crown copyright and database right 2026",
    "Source: Office for National Statistics licensed under the Open Government Licence v.3.0"
  ],
  excludes: "Northern Ireland (BT) postcodes",
  sectors: finish(sectors),
  districts: finish(districts)
};
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "apps/web/public/geo/postcode-sectors.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(out));
console.log(`${used.toLocaleString("en-GB")} postcodes → ${sectors.size.toLocaleString("en-GB")} sectors, ${districts.size.toLocaleString("en-GB")} districts (${skipped.toLocaleString("en-GB")} skipped)`);
console.log("Wrote " + target);
