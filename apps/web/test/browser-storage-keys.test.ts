import test from "node:test";
import assert from "node:assert/strict";
import {
 MAP_LIBRARY_STORAGE_KEY,LEGACY_GRAPH_STORAGE_KEY,
 PERSPECTIVES_STORAGE_KEY,ARTWORK_STORAGE_KEY,MAPPING_RECIPES_STORAGE_KEY
} from "../src/lib/browser-storage-keys.ts";

test("browser storage identifiers remain compatible with existing saved maps",()=>{
 assert.deepEqual([
   MAP_LIBRARY_STORAGE_KEY,LEGACY_GRAPH_STORAGE_KEY,
   PERSPECTIVES_STORAGE_KEY,ARTWORK_STORAGE_KEY,MAPPING_RECIPES_STORAGE_KEY
 ],[
   "mossline-local-maps-v1","mossline-demo-graph-v1",
   "mossline-perspectives-v1","mossline-artwork-library-v1",
   "mossline-mapping-recipes-v1"
 ]);
});
