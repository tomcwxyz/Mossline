import type {GraphDocument,GraphNode} from "./schema";

/** Every node and every source relationship is mapped into GPU-ready geometry.
 * This is deliberately independent of the grouped adaptive projection.
 * Coordinates are computed in the background worker; no source edges are dropped.
 */
export type FullNetworkGeometry={
  ids:string[];types:Uint8Array;positions:Float32Array;segments:Float32Array;
  nodeCount:number;edgeCount:number;bounds:{minX:number;minY:number;maxX:number;maxY:number};
};
const CATEGORIES=["organisation","project","funder","person","place","topic",
  "methodology","outcome","other"] as const;
function hash(value:string):number{
  let h=2166136261;
  for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619)>>>0;
  return h>>>0;
}
export function layoutFullNetwork(graph:GraphDocument):FullNetworkGeometry{
  const count=graph.nodes.length;
  const ids=graph.nodes.map(n=>n.id);
  const map=new Map(ids.map((id,i)=>[id,i]));
  const types=new Uint8Array(count),positions=new Float32Array(count*2);
  const seeds=new Float32Array(count*2);
  const countTypes=CATEGORIES.length;
  const typePositions=new Map(CATEGORIES.map((k,i)=>[k,i]));
  for(let i=0;i<count;i++){
    const node:GraphNode=graph.nodes[i];
    const t=typePositions.get(node.type)??8;
    types[i]=t;
    const angle=(t/countTypes)*Math.PI*2-Math.PI/2;
    // Stable ring/group positions, seeded only by source identifiers.
    const radius=300;
    const h=hash(node.id),h2=hash(node.id+"#position");
    const theta=(h/4294967296)*Math.PI*2;
    const spread=Math.sqrt((h2+1)/4294967297)*170;
    const x=Math.cos(angle)*radius+Math.cos(theta)*spread;
    const y=Math.sin(angle)*radius+Math.sin(theta)*spread;
    positions[i*2]=seeds[i*2]=x;
    positions[i*2+1]=seeds[i*2+1]=y;
  }
  const pairs=new Uint32Array(graph.edges.length*2);
  for(let i=0;i<graph.edges.length;i++){
    const edge=graph.edges[i],a=map.get(edge.source),b=map.get(edge.target);
    if(a===undefined||b===undefined)throw Error("Source relationship endpoint is missing.");
    pairs[i*2]=a;pairs[i*2+1]=b;
  }
  // A constrained, deterministic neighbour relaxation highlights broad graph
  // structure while retaining category anchors. O(iterations * (N + E)).
  // No graph-size-dependent truncation of source records.
  const iterations=count>50000?8:count>15000?16:count>3000?28:45;
  const totals=new Float64Array(count*2),degrees=new Uint32Array(count);
  for(let pass=0;pass<iterations;pass++){
    totals.fill(0);degrees.fill(0);
    for(let e=0;e<graph.edges.length;e++){
      const a=pairs[2*e],b=pairs[2*e+1];if(a===b)continue;
      totals[2*a]+=positions[2*b];totals[2*a+1]+=positions[2*b+1];degrees[a]++;
      totals[2*b]+=positions[2*a];totals[2*b+1]+=positions[2*a+1];degrees[b]++;
    }
    for(let i=0;i<count;i++){
      if(!degrees[i])continue;
      const degree=degrees[i],weight=0.11;
      const k=i*2;
      const x=positions[k],y=positions[k+1];
      positions[k]=x*(1-weight-.027)+weight*(totals[k]/degree)+.027*seeds[k];
      positions[k+1]=y*(1-weight-.027)+weight*(totals[k+1]/degree)+.027*seeds[k+1];
    }
  }
  const segments=new Float32Array(graph.edges.length*4);
  for(let i=0;i<graph.edges.length;i++){
    const a=pairs[2*i]*2,b=pairs[2*i+1]*2;
    segments[4*i]=positions[a];segments[4*i+1]=positions[a+1];
    segments[4*i+2]=positions[b];segments[4*i+3]=positions[b+1];
  }
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(let i=0;i<count;i++){
    const x=positions[2*i],y=positions[2*i+1];
    minX=Math.min(minX,x);minY=Math.min(minY,y);
    maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
  }
  if(!count){minX=minY=-1;maxX=maxY=1;}
  return {ids,types,positions,segments,nodeCount:count,edgeCount:graph.edges.length,
    bounds:{minX,minY,maxX,maxY}};
}
