import { readAtlasLocation } from "./geography";
import type { GraphDocument, GraphEdge, GraphNode, NodeType } from "./schema";

/** The canonical graph is immutable; the atlas is a read-only projection. */
export type AtlasLens = "network" | "map" | "themes" | "funding" | "timeline";
export interface AtlasFilters {
  query?: string;
  types?: NodeType[];
  theme?: string;
  region?: string;
  fromYear?: number;
  toYear?: number;
  funderId?: string;
}
export interface AtlasProjection {
  graph: GraphDocument;
  totalNodes: number;
  totalEdges: number;
  recordedCount: number;
  inferredCount: number;
  hiddenNodes: number;
  hiddenEdges: number;
}

/** Never use an inferred edge in any statistic or route. */
export const isRecorded = (edge: GraphEdge): boolean => edge.inferred !== true;
export function recordedDegree(graph: GraphDocument, id: string): number {
  return graph.edges.reduce((n, edge) =>
    n + (isRecorded(edge) && (edge.source === id || edge.target === id) ? 1 : 0), 0);
}

const first = (source: Record<string, unknown> | undefined, keys: string[]): unknown => {
  if (!source) return undefined;
  for (const key of keys) {
    const hit = Object.entries(source).find(([name]) => name.toLowerCase().replace(/[^a-z]/g, "") ===
      key.toLowerCase().replace(/[^a-z]/g, ""));
    if (hit && hit[1] !== null && hit[1] !== "") return hit[1];
  }
  return undefined;
};
function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}
/** Only explicit coordinates in source data count as located; never geocode names. */
export function recordedCoordinates(node: GraphNode): {lat:number; lon:number} | null {
  const coordinate = readAtlasLocation(node);
  return coordinate ? {lat:coordinate.latitude,lon:coordinate.longitude} : null;
}

export function recordedYear(edge: GraphEdge): number | null {
  const value = first(edge.properties, ["awardDate", "dateAwarded", "date", "year", "startDate", "fundingDate"]);
  if (typeof value === "number" && Number.isInteger(value) && value >= 1800 && value <= 2200) return value;
  if (typeof value !== "string") return null;
  const match = value.match(/(?:^|\D)(18\d{2}|19\d{2}|20\d{2}|21\d{2})(?:\D|$)/);
  return match ? Number(match[1]) : null;
}
export function evidenceReceipt(edge: GraphEdge): string {
  if (edge.inferred) return "Inferred association · not a source record";
  if (edge.origin) {
    return [edge.origin.fileName ?? edge.origin.system,
      edge.origin.recordNumber ? "#" + edge.origin.recordNumber : edge.origin.recordId].join(" · ");
  }
  return edge.sourceUrl ? "Recorded link · source available" : "Recorded link · source reference unavailable";
}

function connectedToFunder(graph: GraphDocument, funderId: string): Set<string> {
  const recorded = graph.edges.filter(isRecorded);
  const ids = new Set([funderId]);
  // Funder -> grant/project -> grantee is evidence of a funding route,
  // NOT proof that two grantees collaborate.
  for (const edge of recorded) {
    if (edge.source === funderId) ids.add(edge.target);
    if (edge.target === funderId) ids.add(edge.source);
  }
  const intermediaries = [...ids].filter(id => graph.nodes.some(n => n.id === id && n.type === "project"));
  for (const edge of recorded) if (intermediaries.includes(edge.source) ||
      intermediaries.includes(edge.target)) {
    ids.add(edge.source); ids.add(edge.target);
  }
  return ids;
}

/** Filter the same source records across every lens; do not materialise claims. */
export function projectAtlas(graph: GraphDocument, filters: AtlasFilters): AtlasProjection {
  const q = (filters.query ?? "").trim().toLocaleLowerCase();
  const funderIds = filters.funderId ? connectedToFunder(graph, filters.funderId) : null;
  const matching = new Set(graph.nodes.filter(n =>
    (!filters.types?.length || filters.types.includes(n.type)) &&
    (!q || [n.label,n.description ?? "",n.region ?? "",...n.tags].some(s=>s.toLocaleLowerCase().includes(q))) &&
    (!filters.region || n.region === filters.region) &&
    (!filters.theme || n.tags.some(t=>t.toLocaleLowerCase() === filters.theme!.toLocaleLowerCase())) &&
    (!funderIds || funderIds.has(n.id))
  ).map(n=>n.id));
  const allEdges = graph.edges.filter(edge=> matching.has(edge.source) && matching.has(edge.target));
  const edges = allEdges.filter(edge=>{
    const year = recordedYear(edge);
    if (filters.fromYear === undefined && filters.toYear === undefined) return true;
    // Undated edges are excluded by an explicit date filter, and counted as hidden.
    return year !== null &&
      (filters.fromYear === undefined || year >= filters.fromYear) &&
      (filters.toYear === undefined || year <= filters.toYear);
  });
  // Time filter controls qualifying relationships, retaining endpoints of those
  // relationships; no silent inference about node lifetime.
  const filteredNodeIds = filters.fromYear === undefined && filters.toYear === undefined ?
    matching : new Set(edges.flatMap(e=>[e.source,e.target]));
  const nodes = graph.nodes.filter(n=>filteredNodeIds.has(n.id));
  return {graph:{...graph,nodes,edges},
    totalNodes:graph.nodes.length,totalEdges:graph.edges.length,
    recordedCount:edges.filter(isRecorded).length,
    inferredCount:edges.filter(e=>!isRecorded(e)).length,
    hiddenNodes:graph.nodes.length-nodes.length,
    hiddenEdges:graph.edges.length-edges.length};
}
export interface AtlasYearCount {year:number|null; count:number}
export function recordedTimeline(graph: GraphDocument): AtlasYearCount[] {
  const counts = new Map<number|null,number>();
  for (const edge of graph.edges) if (isRecorded(edge)) {
    const year = recordedYear(edge);
    counts.set(year,(counts.get(year)??0)+1);
  }
  return [...counts].map(([year,count])=>({year,count}))
    .sort((a,b)=>(a.year??9999)-(b.year??9999));
}
export function atlasFundingOverlap(graph: GraphDocument): {
  funderId:string;recipientCount:number;grantLinks:number;
}[] {
  const types = new Map(graph.nodes.map(n=>[n.id,n.type]));
  const counts = new Map<string,{recipients:Set<string>;links:number}>();
  for (const edge of graph.edges) {
    if (!isRecorded(edge)) continue;
    const funderId = types.get(edge.source)==="funder" ? edge.source :
      types.get(edge.target)==="funder" ? edge.target : null;
    if (!funderId) continue;
    const recipientId = edge.source===funderId?edge.target:edge.source;
    const item=counts.get(funderId)??{recipients:new Set<string>(),links:0};
    item.recipients.add(recipientId);item.links++;
    counts.set(funderId,item);
  }
  return [...counts].map(([funderId,item])=>({
    funderId,recipientCount:item.recipients.size,grantLinks:item.links
  })).sort((a,b)=>b.grantLinks-a.grantLinks);
}
