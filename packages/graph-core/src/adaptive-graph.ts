import {parseGraphDocument,type GraphDocument,type GraphNode,type GraphEdge} from "./schema";

/** Adaptive presentation of one immutable, complete network. Every source node is
 * represented once (individually or inside a disclosed cluster); every source
 * relationship is either shown directly, summarised on an edge, or counted as
 * internal to a visible cluster. No source records are sampled or discarded.
 */
export const ADAPTIVE_GRAPH_NODE_BUDGET=260;
export const ADAPTIVE_GRAPH_EDGE_BUDGET=650;
const FANOUT=24;
export type AdaptiveGroup={id:string;label:string;size:number;children:AdaptiveItem[];members:string[]};
export type AdaptiveItem={kind:"node";id:string}|{kind:"cluster";group:AdaptiveGroup};
export type AdaptiveGraphIndex={
  source:GraphDocument;roots:AdaptiveItem[];groups:Map<string,AdaptiveGroup>;
};
export type AdaptiveGraphProjection={
  graph:GraphDocument;totalNodes:number;totalEdges:number;representedNodes:number;
  representedEdges:number;visibleNodes:number;visibleEdges:number;
  clusterCount:number;expandedIds:string[];availableGroups:{id:string;label:string;size:number}[];
};

export function buildAdaptiveGraphIndex(source:GraphDocument):AdaptiveGraphIndex{
  const used=new Set(source.nodes.map(n=>n.id));
  const groups=new Map<string,AdaptiveGroup>();
  let sequence=0;
  const nextId=()=>{
    let id="";
    do{id="mossline:summary:"+sequence++;}while(used.has(id));
    used.add(id);
    return id;
  };
  const leaf=(node:GraphNode):AdaptiveItem=>({kind:"node",id:node.id});
  const makeGroup=(label:string,nodes:GraphNode[],children:AdaptiveItem[]):AdaptiveItem=>{
    const id=nextId();
    const group={id,label,size:nodes.length,children,members:nodes.map(n=>n.id)};
    groups.set(id,group);
    return {kind:"cluster",group};
  };
  /** A stable alphabetic range tree: no node cap, each expansion <= 24 children. */
  const chunks=(nodes:GraphNode[]):AdaptiveItem[]=>{
    const ordered=[...nodes].sort((a,b)=>a.label.localeCompare(b.label)||a.id.localeCompare(b.id));
    if(ordered.length<=FANOUT)return ordered.map(leaf);
    const count=Math.min(FANOUT,Math.ceil(ordered.length/FANOUT));
    const batch=Math.ceil(ordered.length/count);
    const results:AdaptiveItem[]=[];
    for(let i=0;i<ordered.length;i+=batch){
      const slice=ordered.slice(i,i+batch);
      results.push(makeGroup(slice[0].label+" – "+slice[slice.length-1].label,
        slice,chunks(slice)));
    }
    return results;
  };
  const typeNames:Record<string,string>={
    organisation:"Organisations",project:"Projects and grants",funder:"Funders",
    person:"People",place:"Places",topic:"Topics",methodology:"Methods",
    outcome:"Outcomes",other:"Other entities"
  };
  const byType=new Map<string,GraphNode[]>();
  for(const node of source.nodes){
    const members=byType.get(node.type)??[];
    members.push(node);byType.set(node.type,members);
  }
  const roots:AdaptiveItem[]=[];
  for(const [type,nodes] of [...byType.entries()].sort(([a],[b])=>a.localeCompare(b))){
    if(nodes.length===1){roots.push(leaf(nodes[0]));continue;}
    const grantAwards=type==="project"&&nodes.every(n=>
      n.properties?.mosslineFundingGrant===true&&typeof n.properties.funderId==="string");
    const sourceById=new Map(source.nodes.map(n=>[n.id,n]));
    const byMeaning=new Map<string,GraphNode[]>();
    for(const node of nodes){
      // Source-supplied funding links give a meaningful first grouping for
      // awards; generic nodes retain their recorded region. No AI-invented
      // community or unverified relationship is introduced.
      const grouping=grantAwards?
        "Funded by "+(sourceById.get(String(node.properties?.funderId))?.label??
          String(node.properties?.funderId)):
        node.region?.trim()||"Region not recorded";
      const members=byMeaning.get(grouping)??[];
      members.push(node);byMeaning.set(grouping,members);
    }
    // Group excessive top-level categories into alphabetic ranges rather
    // than dropping any funder, region or entity from the visible hierarchy.
    const categories=[...byMeaning.entries()].sort(([a],[b])=>a.localeCompare(b));
    const children:AdaptiveItem[]=[];
    const categoryItems=categories.map(([label,members])=>
      members.length===1?leaf(members[0]):
      makeGroup(label,members,chunks(members)));
    if(categoryItems.length<=FANOUT)children.push(...categoryItems);
    else{
      const per=Math.ceil(categoryItems.length/FANOUT);
      for(let i=0;i<categoryItems.length;i+=per){
        const slice=categoryItems.slice(i,i+per);
        const subnodes=categories.slice(i,i+per).flatMap(([,members])=>members);
        children.push(makeGroup((grantAwards?"Funders ":"Regions ")+
          categories[i][0]+" – "+
          categories[Math.min(i+per,categories.length)-1][0],subnodes,slice));
      }
    }
    roots.push(makeGroup(typeNames[type]??type,nodes,children));
  }
  return {source,roots,groups};
}

export function projectAdaptiveGraph(index:AdaptiveGraphIndex,requestedIds:string[]=[]):
  AdaptiveGraphProjection{
  const allowed=new Set(requestedIds.filter(id=>index.groups.has(id)));
  const displayed:AdaptiveItem[]=[];
  const collect=(item:AdaptiveItem)=>{
    if(item.kind==="cluster"&&allowed.has(item.group.id)){
      for(const child of item.group.children)collect(child);
    }else displayed.push(item);
  };
  for(const root of index.roots)collect(root);
  if(displayed.length>ADAPTIVE_GRAPH_NODE_BUDGET)
    throw Error("This expansion would crowd the canvas. Collapse another group first.");
  const memberToView=new Map<string,string>();
  const clusters:AdaptiveGroup[]=[];
  const nodeById=new Map(index.source.nodes.map(n=>[n.id,n]));
  for(const item of displayed){
    if(item.kind==="node")memberToView.set(item.id,item.id);
    else{
      clusters.push(item.group);
      for(const id of item.group.members)memberToView.set(id,item.group.id);
    }
  }
  if(memberToView.size!==index.source.nodes.length)
    throw Error("Network overview failed to account for every entity.");
  const internals=new Map<string,number>();
  const aggregates=new Map<string,{from:string;to:string;direction:string;count:number;inferred:number}>();
  const originalEdges:GraphEdge[]=[];
  const clusterIds=new Set(clusters.map(cluster=>cluster.id));
  const originalIds=new Set(index.source.edges.map(e=>e.id));
  for(const edge of index.source.edges){
    let from=memberToView.get(edge.source),to=memberToView.get(edge.target);
    if(!from||!to)throw Error("Network contains a connection without a represented entity.");
    if(from===to){
      internals.set(from,(internals.get(from)??0)+1);
      continue;
    }
    const groupEdge=clusterIds.has(from)||clusterIds.has(to);
    if(!groupEdge){originalEdges.push(edge);continue;}
    const direction=edge.direction??"directed";
    if(direction==="undirected"&&from>to)[from,to]=[to,from];
    const key=JSON.stringify([from,to,direction]);
    const row=aggregates.get(key)??{from,to,direction,count:0,inferred:0};
    row.count++;
    if(edge.inferred)row.inferred++;
    aggregates.set(key,row);
  }
  const edges:GraphEdge[]=[...originalEdges];
  let serial=0;
  for(const item of aggregates.values()){
    let id="";
    do{id="mossline:summary-edge:"+serial++;}while(originalIds.has(id));
    edges.push({id,source:item.from,target:item.to,
      type:"Grouped source connections",direction:item.direction as GraphEdge["direction"],
      description:item.count+" source relationships summarised. "+
        (item.count-item.inferred)+" recorded assertions; "+item.inferred+" inferred associations.",
      properties:{mosslineAdaptiveSummary:true,connectionCount:item.count,
        recordedCount:item.count-item.inferred,inferredCount:item.inferred}});
  }
  if(edges.length>ADAPTIVE_GRAPH_EDGE_BUDGET)
    throw Error("This expansion would create too many visible connections. "+
      "Collapse another group first.");
  const nodes:GraphNode[]=displayed.map(item=>{
    if(item.kind==="node"){
      const source=nodeById.get(item.id)!;
      const internal=internals.get(item.id)??0;
      return internal?{...source,properties:{...source.properties,
        mosslineInternalConnections:internal}}:source;
    }
    const cluster=item.group;
    return {id:cluster.id,label:cluster.label+" · "+cluster.size.toLocaleString("en-GB"),
      type:"other",tags:[],description:"An expandable group of "+cluster.size+
        " source records. This is a visual summary, not a source entity.",
      properties:{mosslineAdaptiveCluster:true,mosslineMemberCount:cluster.size,
        mosslineInternalConnections:internals.get(cluster.id)??0}};
  });
  const representedEdges=originalEdges.length+
    [...aggregates.values()].reduce((sum,item)=>sum+item.count,0)+
    [...internals.values()].reduce((sum,value)=>sum+value,0);
  if(representedEdges!==index.source.edges.length)
    throw Error("Network overview failed to account for every relationship.");
  return {graph:parseGraphDocument({
    version:1,title:index.source.title,description:
      "Adaptive overview of the complete source network. Group nodes and grouped lines "+
      "are visual summaries; expand to inspect original entities and recorded links.",
    nodes,edges
  }),totalNodes:index.source.nodes.length,totalEdges:index.source.edges.length,
    representedNodes:memberToView.size,representedEdges,
    visibleNodes:nodes.length,visibleEdges:edges.length,clusterCount:clusters.length,
    expandedIds:[...allowed],
    availableGroups:clusters.map(g=>({id:g.id,label:g.label,size:g.size}))};
}
