import { z } from "zod";
import type { GraphDocument, GraphEdge } from "./schema";

/** Corrections and confirmations stay outside imported source records. */
const annotationSchema = z.object({
  id: z.string().min(1).max(160),
  kind: z.literal("confirm-relationship"),
  proposedEdgeId: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  relationship: z.string().min(1).max(120),
  reason: z.string().trim().min(10).max(2000),
  reviewer: z.string().trim().min(2).max(120),
  createdAt: z.string().datetime({offset:true})
}).strict();
export const annotationLayerSchema = z.object({
  version: z.literal(1),
  graphKey: z.string().min(1),
  entries: z.array(annotationSchema)
}).strict();
export type AtlasAnnotation = z.infer<typeof annotationSchema>;
export type AtlasAnnotationLayer = z.infer<typeof annotationLayerSchema>;

export function emptyAnnotationLayer(graphKey:string): AtlasAnnotationLayer {
  return {version:1,graphKey,entries:[]};
}
export function parseAnnotationLayer(value:unknown, graphKey:string): AtlasAnnotationLayer {
  const result = annotationLayerSchema.safeParse(value);
  return result.success && result.data.graphKey===graphKey ? result.data : emptyAnnotationLayer(graphKey);
}
/** A reviewer must explicitly describe why a suggestion should become a claim. */
export function confirmInferredRelationship(
  graph: GraphDocument, layer: AtlasAnnotationLayer, proposedEdgeId:string,
  input:{relationship:string;reason:string;reviewer:string;now:string}
): AtlasAnnotationLayer {
  const proposal = graph.edges.find(e=>e.id===proposedEdgeId && e.inferred===true);
  if(!proposal) throw new Error("Only an existing inferred association can be confirmed.");
  if(layer.entries.some(a=>a.proposedEdgeId===proposedEdgeId))
    throw new Error("This suggestion is already confirmed.");
  const entry=annotationSchema.parse({
    id:"annotation:"+proposedEdgeId,kind:"confirm-relationship",proposedEdgeId,
    source:proposal.source,target:proposal.target,
    relationship:input.relationship,reason:input.reason,
    reviewer:input.reviewer,createdAt:input.now
  });
  if(!graph.nodes.some(n=>n.id===entry.source)||!graph.nodes.some(n=>n.id===entry.target))
    throw new Error("The proposed relationship has missing endpoints.");
  return {...layer,entries:[...layer.entries,entry]};
}
/** Return a fresh projection with receipts; never rewrite the imported graph. */
export function graphWithAnnotations(graph:GraphDocument, layer:AtlasAnnotationLayer):GraphDocument {
  const proposed = new Map(graph.edges.filter(e=>e.inferred).map(e=>[e.id,e]));
  const existing = new Set(graph.edges.map(e=>e.id));
  const approved:GraphEdge[] = [];
  const confirmed = new Set<string>();
  for (const entry of layer.entries) {
    const original = proposed.get(entry.proposedEdgeId);
    const id="reviewed:"+entry.id;
    if(!original || existing.has(id) || confirmed.has(entry.proposedEdgeId) ||
       original.source!==entry.source || original.target!==entry.target)continue;
    confirmed.add(entry.proposedEdgeId);
    approved.push({
      id,source:entry.source,target:entry.target,type:entry.relationship,
      direction:"undirected",inferred:false,
      origin:{system:"annotation",recordId:entry.id},
      description:"Reviewer-confirmed association, not independently verified.",
      properties:{reviewer:entry.reviewer,confirmedAt:entry.createdAt,reason:entry.reason,
        proposedEdgeId:entry.proposedEdgeId}
    });
  }
  return {...graph,edges:[...graph.edges.filter(e=>!confirmed.has(e.id)),...approved]};
}
