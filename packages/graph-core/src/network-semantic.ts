import type {GraphDocument,GraphNode,GraphEdge} from "./schema";
import {cosineSimilarity} from "./semantic-discovery";

/** Generic source-only retrieval documents. No raw custom properties, grant amounts,
 * contact details or relationship inference are sent to a model.
 * There is no arbitrary first-N sample: every eligible source node is considered.
 */
export type NetworkSemanticDocument={
  id:string;label:string;type:GraphNode["type"];text:string;
  sourceUrl?:string;
};
export type NetworkSemanticPreparation={
  documents:NetworkSemanticDocument[];
  totalNodes:number;excludedPrivate:number;
};
function clean(s:string):string{return s.replace(/\s+/g," ").trim();}
function isPrivate(node:GraphNode):boolean{
  const p=node.properties??{};
  const norm=(v:unknown)=>typeof v==="string"?v.trim().toLowerCase():v;
  // Treat explicit restrictions as authoritative regardless of their casing
  // or common CSV boolean representations.
  if([p.private,p.isPrivate,p.Private].some(v=>[true,"true","yes","1"].includes(norm(v) as string|boolean)))
    return true;
  if([p.public,p.isPublic,p.Public].some(v=>[false,"false","no","0"].includes(norm(v) as string|boolean)))
    return true;
  return [p.visibility,p.Visibility,p.access,p.Access].some(v=>
    ["private","restricted","confidential","non-public"].includes(String(norm(v))));
}

export function prepareNetworkSemanticDocuments(graph:GraphDocument):NetworkSemanticPreparation{
  const docs:NetworkSemanticDocument[]=[];
  let excludedPrivate=0;
  for(const node of graph.nodes){
    if(isPrivate(node)){excludedPrivate++;continue;}
    const text=clean([
      "Entity: "+node.label,"Category: "+node.type,
      node.description?"Description: "+node.description:"",
      node.tags.length?"Source topics: "+node.tags.join("; "):"",
      node.region?"Region: "+node.region:""
    ].filter(Boolean).join(". ")).slice(0,850);
    if(!text)continue;
    docs.push({id:node.id,label:node.label,type:node.type,
      text,...(node.sourceUrl?{sourceUrl:node.sourceUrl}:{})});
  }
  return {documents:docs,totalNodes:graph.nodes.length,excludedPrivate};
}
export type SemanticHit={id:string;label:string;type:GraphNode["type"];
  score:number;text:string;sourceUrl?:string};
/** Scores rank text resemblance. They are not probabilities or proven network links. */
export function rankNetworkSemanticHits(documents:NetworkSemanticDocument[],
  vectors:number[][],query:number[],limit=8):SemanticHit[]{
  if(documents.length!==vectors.length)throw Error("Embedding count differs from source documents");
  if(!query.length||!query.every(Number.isFinite))throw Error("Invalid query embedding");
  const hits:SemanticHit[]=[];
  for(let i=0;i<documents.length;i++){
    if(vectors[i].length!==query.length)throw Error("Embedding model dimensions changed");
    const score=cosineSimilarity(vectors[i],query);
    if(!Number.isFinite(score))continue;
    hits.push({...documents[i],score:Number(score.toFixed(4))});
  }
  return hits.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id))
    .slice(0,Math.max(1,Math.min(12,limit)));
}
export type NetworkEvidenceRelation={id:string;source:string;target:string;
  type:string;inferred:boolean;description?:string;sourceUrl?:string};
/** Only original source edges linking retrieved node IDs are given to the LLM.
 * Inferred associations remain explicitly flagged; no edges are fabricated.
 */
export function sourceRelationsAmong(graph:GraphDocument,ids:string[],
  limit=24):NetworkEvidenceRelation[]{
  const selected=new Set(ids);
  return graph.edges.filter(e=>selected.has(e.source)&&selected.has(e.target))
    .slice(0,Math.max(0,limit)).map((edge:GraphEdge)=>({
      id:edge.id,source:edge.source,target:edge.target,type:edge.type,
      inferred:edge.inferred===true,
      ...(edge.description?{description:edge.description.slice(0,250)}:{}),
      ...(edge.sourceUrl?{sourceUrl:edge.sourceUrl}:{})
    }));
}
