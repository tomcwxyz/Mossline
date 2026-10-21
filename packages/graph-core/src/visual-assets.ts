import type { GraphDocument, GraphNode } from "./schema";

export interface VisualAssetPack {
  id: string;
  name: string;
  description: string;
  creator: string;
  source: string;
  /** Base HTTPS URL pinned to a known asset revision. */
  baseUrl: string;
  /** Keys are SOURCE entity IDs, not arbitrary labels or graph-position indices. */
  images: Record<string,string>;
  frontPage?: {
    hero: string;
    title: string;
    introduction: string;
    guidance?: string;
    viewImages?: Record<string,string>;
  };
  basemap?: string;
}
export interface AssetPackCoverage {
  matched: number;
  eligible: number;
  unmatched: number;
  ids: string[];
}
export function sourceEntityId(node:GraphNode):string {
  return node.origin?.recordId || node.id;
}
/** Match exact source IDs only; never infer identity from name similarity. */
export function matchAssetPack(graph:GraphDocument,pack:VisualAssetPack):AssetPackCoverage {
  const ids=graph.nodes.filter(node=>
    Object.prototype.hasOwnProperty.call(pack.images,sourceEntityId(node))).map(node=>node.id);
  return {matched:ids.length,eligible:graph.nodes.length,unmatched:graph.nodes.length-ids.length,ids};
}
const safeAssetPath=(path:string):boolean=>
  /^[a-z0-9][a-z0-9/_-]*\.(?:png|jpe?g|webp)$/i.test(path)&&!path.includes("..");
export function visualAssetUrl(pack:VisualAssetPack,path:string):string|undefined {
  if(!safeAssetPath(path)||!/^https:\/\//.test(pack.baseUrl))return undefined;
  return pack.baseUrl.replace(/\/$/,"")+"/"+path;
}
/**
 * Return a presentation projection: never mutate the original source graph,
 * override an original photograph in persisted data or insert asset URLs
 * into source records. Real Kumu Sheets data is unchanged.
 */
export function applyAssetPack(graph:GraphDocument,pack:VisualAssetPack):GraphDocument {
  return {...graph,nodes:graph.nodes.map(node=>{
    const relative=pack.images[sourceEntityId(node)];
    const illustrated=relative?visualAssetUrl(pack,relative):undefined;
    return illustrated?{...node,imageUrl:illustrated}:node;
  })};
}
