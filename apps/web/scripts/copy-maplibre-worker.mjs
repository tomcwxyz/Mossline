// MapLibre finds its worker next to its own module (import.meta.url). Next's
// bundler moves the module, so the worker is served from public/vendor instead
// and MapLens points MapLibre at it with setWorkerUrl. Runs before dev and build.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("maplibre-gl/package.json");
const { version } = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const source = path.join(path.dirname(pkgPath), "dist", "maplibre-gl-worker.mjs");
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "vendor");
const target = path.join(outDir, "maplibre-gl-worker.mjs");
fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(source, target);
console.log(`maplibre-gl ${version} worker copied to public/vendor`);
