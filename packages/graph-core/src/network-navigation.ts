import type {GraphDocument,GraphEdge,GraphNode} from "./schema";
import {projectAdaptiveGraph,type AdaptiveGraphIndex,
  type AdaptiveItem,type AdaptiveGraphProjection} from "./adaptive-graph";

/** Queries the canonical graph, never the rendered/aggregated projection. */
export type NetworkNavigationIndex={
  graph:GraphDocument;
  nodes:Map<string,GraphNode>;
  incident:Map<string,GraphEdge[]>;
  ordered:GraphNode[];
};
export type NetworkMatch={id:string;label:string;type:GraphNode["type"];region?:string};
export type NetworkSearch={query:string;total:number;items:NetworkMatch[]};
export type NetworkConnection={edge:GraphEdge;other:NetworkMatch};
export type NetworkInspection={
  node:GraphNode;totalRelationships:number;distinctNeighbours:number;
  matchingRelationships:number;page:number;pages:number;
  connections:NetworkConnection[];
};
export type NetworkReveal={
  projection:AdaptiveGraphProjection;expandedIds:string[];
  collapsedOtherGroups:boolean;
};

const normalise=(value:string)=>value.trim().toLocaleLowerCase("en-GB");
const display=(n:GraphNode):NetworkMatch=>({
  id:n.id,label:n.label,type:n.type,...(n.region?{region:n.region}:{})
});

export function buildNetworkNavigation(graph:GraphDocument):NetworkNavigationIndex{
  const nodes=new Map(graph.nodes.map(node=>[node.id,node]));
  const incident=new Map(graph.nodes.map(n=>[n.id,[] as GraphEdge[]]));
  for(const edge of graph.edges){
    incident.get(edge.source)?.push(edge);
    if(edge.target!==edge.source)incident.get(edge.target)?.push(edge);
  }
  const compare=(a:GraphEdge,b:GraphEdge,id:string)=>{
    const other=(e:GraphEdge)=>nodes.get(e.source===id?e.target:e.source)?.label??"";
    return other(a).localeCompare(other(b))||
      a.type.localeCompare(b.type)||a.id.localeCompare(b.id);
  };
  for(const [id,edges] of incident)edges.sort((a,b)=>compare(a,b,id));
  return {graph,nodes,incident,ordered:[...graph.nodes].sort((a,b)=>
    a.label.localeCompare(b.label)||a.id.localeCompare(b.id))};
}

/** All source entities are searched. Only the result list is display-bounded. */
export function searchNetwork(index:NetworkNavigationIndex,input:string,limit=20):NetworkSearch{
  const query=normalise(input).slice(0,200);
  if(!query)return {query,total:0,items:[]};
  const results=index.ordered.filter(n=>
    [n.label,n.description??"",n.region??"",n.type,...n.tags]
      .some(part=>normalise(part).includes(query)));
  // Show name matches first without inventing relevance scores.
  results.sort((a,b)=>{
    const rank=(n:GraphNode)=>normalise(n.label).startsWith(query)?0:
      normalise(n.label).includes(query)?1:2;
    return rank(a)-rank(b)||a.label.localeCompare(b.label)||a.id.localeCompare(b.id);
  });
  return {query,total:results.length,
    items:results.slice(0,Math.max(1,Math.min(30,Math.floor(limit)))).map(display)};
}

export function inspectNetworkNode(index:NetworkNavigationIndex,id:string,
  opts:{query?:string;page?:number;pageSize?:number}={}):NetworkInspection{
  const node=index.nodes.get(id);
  if(!node)throw Error("This entity is not present in the source network.");
  const edges=index.incident.get(id)??[];
  const term=normalise(opts.query??"").slice(0,200);
  const match=term?edges.filter(e=>{
    const other=index.nodes.get(e.source===id?e.target:e.source);
    return [e.type,e.description??"",other?.label??"",other?.type??"",other?.region??""]
      .some(value=>normalise(value).includes(term));
  }):edges;
  const pageSize=Math.max(1,Math.min(50,Number.isFinite(opts.pageSize)?
    Math.floor(opts.pageSize!):20));
  const pages=Math.max(1,Math.ceil(match.length/pageSize));
  const page=Math.max(1,Math.min(pages,Number.isFinite(opts.page)?
    Math.floor(opts.page!):1));
  const connections=match.slice((page-1)*pageSize,page*pageSize).map(edge=>{
    const other=index.nodes.get(edge.source===id?edge.target:edge.source);
    if(!other)throw Error("A source connection has a missing endpoint.");
    return {edge,other:display(other)};
  });
  return {node,totalRelationships:edges.length,
    distinctNeighbours:new Set(edges.map(e=>e.source===id?e.target:e.source)).size,
    matchingRelationships:match.length,page,pages,connections};
}

function contains(item:AdaptiveItem,id:string):boolean{
  return item.kind==="node"?item.id===id:item.group.members.includes(id);
}
function trail(items:AdaptiveItem[],id:string):string[]|null{
  for(const item of items){
    if(!contains(item,id))continue;
    if(item.kind==="node")return [];
    const deeper=trail(item.group.children,id);
    return deeper?[item.group.id,...deeper]:null;
  }
  return null;
}

/** Reveal a real node through the group hierarchy, retaining other open groups
 * when possible. If the display budget would be exceeded, collapse unrelated
 * branches before giving up, but never silently drop an entity or relationship.
 */
export function revealNetworkNode(index:AdaptiveGraphIndex,
  expandedIds:string[],nodeId:string):NetworkReveal{
  if(!index.source.nodes.some(n=>n.id===nodeId))
    throw Error("This entity is not present in the complete network.");
  const needed=trail(index.roots,nodeId);
  if(!needed)throw Error("Could not locate this entity in the group hierarchy.");
  const union=[...new Set([...expandedIds,...needed])];
  try{
    const projection=projectAdaptiveGraph(index,union);
    return {projection,expandedIds:union,collapsedOtherGroups:false};
  }catch(error){
    // Try just the ancestry of the selected source node.
    try{
      const projection=projectAdaptiveGraph(index,needed);
      return {projection,expandedIds:needed,collapsedOtherGroups:true};
    }catch{
      throw Error("This part of the network is too dense to reveal at the current "+
        "detail budget. You can still inspect every recorded connection.");
    }
  }
}
