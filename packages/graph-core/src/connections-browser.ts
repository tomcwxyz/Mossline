import type {GraphDocument,GraphEdge,GraphNode} from "./schema";

export type ConnectionRow={
 edge:GraphEdge;other:GraphNode;inferred:boolean;
 evidenceLabels:string[];evidenceCount:number;
};
export type ConnectionDirectory={
 totalOrganisations:number;recordedLinks:number;sharedAssociations:number;
 ranked:{node:GraphNode;links:number;recorded:number;shared:number}[];
 byId:Map<string,ConnectionRow[]>;
};
export function buildConnectionDirectory(associations:GraphDocument,
 source:GraphDocument=associations):ConnectionDirectory{
 const nodeById=new Map(associations.nodes.map(node=>[node.id,node]));
 const evidenceById=new Map(source.nodes.map(node=>[node.id,node.label]));
 const byId=new Map<string,ConnectionRow[]>(
  associations.nodes.map(node=>[node.id,[]]));
 let recordedLinks=0,sharedAssociations=0;
 for(const edge of associations.edges){
  const a=nodeById.get(edge.source),b=nodeById.get(edge.target);
  if(!a||!b)continue;
  const inferred=edge.inferred===true;
  if(inferred)sharedAssociations++;else recordedLinks++;
  const ids=edge.evidenceNodeIds??[];
  const labels=ids.map(id=>evidenceById.get(id)).filter((v):v is string=>!!v);
  const fallback=ids.length&&!labels.length?
    (edge.description?.startsWith("Both linked to: ")?
      edge.description.slice("Both linked to: ".length).split(". This is not")[0]
        .split(", ").slice(0,5):[]):[];
  const evidenceLabels=(labels.length?labels:fallback).slice(0,6);
  const push=(origin:GraphNode,other:GraphNode)=>{
   byId.get(origin.id)?.push({edge,other,inferred,evidenceLabels,
     evidenceCount:ids.length});
  };
  push(a,b);
  if(a.id!==b.id)push(b,a);
 }
 for(const rows of byId.values()){
  rows.sort((a,b)=>Number(a.inferred)-Number(b.inferred)||
    b.evidenceCount-a.evidenceCount||
    a.other.label.localeCompare(b.other.label,"en-GB"));
 }
 const ranked=associations.nodes.map(node=>{
  const rows=byId.get(node.id)??[];
  return {node,links:rows.length,recorded:rows.filter(x=>!x.inferred).length,
   shared:rows.filter(x=>x.inferred).length};
 }).sort((a,b)=>b.links-a.links||a.node.label.localeCompare(b.node.label,"en-GB"));
 return {totalOrganisations:associations.nodes.length,recordedLinks,
  sharedAssociations,ranked,byId};
}
