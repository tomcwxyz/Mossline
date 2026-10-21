import { z } from "zod";
import { perspectiveSchema, graphFingerprint, type SavedPerspective } from "./perspectives";
import type { GraphDocument } from "./schema";

/** URLs reference externally hosted media; imported files contain no binary uploads. */
const httpsUrl = z.url().max(2048).refine(value => {
  try { const url = new URL(value); return url.protocol === "https:" &&
    !url.username && !url.password; } catch { return false; }
}, "Use an HTTPS URL without embedded credentials");

export const libraryAssetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  url: httpsUrl,
  creator: z.string().trim().min(1).max(120),
  licence: z.enum(["CC0","CC BY","CC BY-SA","Public domain","Permission granted","Other / restricted","Unknown"]),
  attribution: z.string().trim().max(500).default(""),
  sourceUrl: httpsUrl.optional(),
}).strict();
export type LibraryAsset = z.infer<typeof libraryAssetSchema>;
export const parseAssetLibrary = (value:unknown):LibraryAsset[] => {
  const parsed = z.array(libraryAssetSchema).max(60).parse(value);
  if (new Set(parsed.map(a=>a.id)).size !== parsed.length) throw Error("Duplicate asset IDs");
  return parsed;
};

/** Strict, versioned, data-free saved-perspective transfer. No map rows or links are exported. */
export const perspectiveBundleSchema = z.object({
  format: z.literal("mossline-perspectives"),
  version: z.literal(1),
  graphKey: z.string().min(1).max(100),
  exportedAt: z.string().datetime(),
  perspectives: z.array(perspectiveSchema).min(1).max(40),
  assets: z.array(libraryAssetSchema).max(60).default([])
}).strict();
export type PerspectiveBundle = z.infer<typeof perspectiveBundleSchema>;

export function makePerspectiveBundle(graph:GraphDocument,views:SavedPerspective[],
  assets:LibraryAsset[]=[],time=new Date()):PerspectiveBundle {
  const graphKey=graphFingerprint(graph);
  if (!views.length || views.some(view=>view.graphKey!==graphKey))
    throw Error("Select at least one perspective from this exact network");
  return perspectiveBundleSchema.parse({
    format:"mossline-perspectives",version:1,graphKey,
    exportedAt:time.toISOString(),perspectives:views,assets
  });
}

/** Import does not reconcile different topologies or invent missing entity matches. */
export function readPerspectiveBundle(value:unknown,graph:GraphDocument):PerspectiveBundle {
  const bundle=perspectiveBundleSchema.parse(value);
  if (bundle.graphKey!==graphFingerprint(graph) ||
    bundle.perspectives.some(view=>view.graphKey!==bundle.graphKey))
    throw Error("These perspectives belong to a different network. Open the matching map first.");
  if (new Set(bundle.perspectives.map(x=>x.id)).size!==bundle.perspectives.length)
    throw Error("Duplicate perspective IDs in import");
  parseAssetLibrary(bundle.assets);
  const knownIds=new Set(graph.nodes.map(n=>n.id));
  for(const view of bundle.perspectives){
    if(Object.keys(view.nodeStyles??{}).some(id=>!knownIds.has(id)) ||
       Object.keys(view.positions??{}).some(id=>!knownIds.has(id)))
      throw Error("A saved view refers to entities missing from this network.");
  }
  return bundle;
}
