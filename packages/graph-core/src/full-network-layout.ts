import type {GraphDocument,GraphNode} from "./schema";
import {arrangeNetworkAreas,type NetworkArea,type NetworkHub} from "./network-areas";

/** Every node and every source relationship is mapped into GPU-ready geometry.
 * This is deliberately independent of the grouped adaptive projection.
 * Coordinates are computed in the background worker; no source edges are dropped.
 */
export type NetworkArrangement="areas"|"types"|"themes";
export type FullNetworkGeometry={
  arrangement:NetworkArrangement;areas:NetworkArea[];hubs:NetworkHub[];
  ids:string[];labels:string[];types:Uint8Array;positions:Float32Array;segments:Float32Array;
  /** Pixel-size encoding. The two measures are deliberately independent of node type. */
  degreeSizes:Float32Array;amountSizes:Float32Array;
  amountCurrency:string|null;amountCount:number;
  /** Indices of the exact endpoints of each original source relationship. */
  endpoints:Uint32Array;
  /** 1 when this is a recorded relationship, 0 when explicitly inferred. */
  recorded:Uint8Array;
  nodeCount:number;edgeCount:number;bounds:{minX:number;minY:number;maxX:number;maxY:number};
};
const CATEGORIES=["organisation","project","funder","person","place","topic",
  "methodology","outcome","other"] as const;
function hash(value:string):number{
  let h=2166136261;
  for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619)>>>0;
  return h>>>0;
}
export function layoutFullNetwork(graph:GraphDocument,
  arrangement:NetworkArrangement="areas"):FullNetworkGeometry{
  const count=graph.nodes.length;
  const ids=graph.nodes.map(n=>n.id);
  const labels=graph.nodes.map(n=>n.label);
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
  const recorded=new Uint8Array(graph.edges.length);
  const degree=new Uint32Array(count);
  const awards=new Float64Array(count);
  const awardCurrencies=new Set<string>();
  let amountCount=0;
  for(const node of graph.nodes){
    const p=node.properties;
    if(p?.mosslineFundingGrant!==true)continue;
    const amount=p.amountAwarded,currency=p.currency;
    if(typeof amount!=="number"||!Number.isFinite(amount)||amount<=0||
      typeof currency!=="string"||!currency.trim())continue;
    amountCount++;
    awardCurrencies.add(currency.toUpperCase().trim());
    const grantIndex=map.get(node.id)!;
    awards[grantIndex]+=amount;
    const funder=typeof p.funderId==="string"?map.get(p.funderId):undefined;
    const recipient=typeof p.recipientId==="string"?map.get(p.recipientId):undefined;
    if(funder!==undefined)awards[funder]+=amount;
    if(recipient!==undefined&&recipient!==funder)awards[recipient]+=amount;
  }
  for(let i=0;i<graph.edges.length;i++){
    const edge=graph.edges[i],a=map.get(edge.source),b=map.get(edge.target);
    if(a===undefined||b===undefined)throw Error("Source relationship endpoint is missing.");
    pairs[i*2]=a;pairs[i*2+1]=b;
    recorded[i]=edge.inferred===true?0:1;
    if(recorded[i]){degree[a]++;if(a!==b)degree[b]++;}
  }
  // A constrained, deterministic neighbour relaxation highlights broad graph
  // structure while retaining category anchors. O(iterations * (N + E)).
  // No graph-size-dependent truncation of source records.
  const iterations=arrangement==="types"?
    (count>50000?8:count>15000?16:count>3000?28:45):0;
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
  // Log-scaled marks preserve the visual distinction of sparse nodes
  // without allowing one giant funder to dominate thousands of tiny grants.
  const degreeSizes=new Float32Array(count);
  const amountSizes=new Float32Array(count);
  // Linear pass: never spread unbounded user arrays into function arguments.
  let globalMaxDegree=1,maxAward=0;
  for(let i=0;i<count;i++){
    globalMaxDegree=Math.max(globalMaxDegree,degree[i]);
    maxAward=Math.max(maxAward,awards[i]);
  }
  const amountCurrency=awardCurrencies.size===1?[...awardCurrencies][0]:null;
  for(let i=0;i<count;i++){
    degreeSizes[i]=3.5+11*Math.log1p(degree[i])/Math.log1p(globalMaxDegree);
    amountSizes[i]=amountCurrency&&maxAward>0&&awards[i]>0?
      3.5+11*Math.log1p(awards[i])/Math.log1p(maxAward):3.5;
  }
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(let i=0;i<count;i++){
    const x=positions[2*i],y=positions[2*i+1];
    minX=Math.min(minX,x);minY=Math.min(minY,y);
    maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
  }
  if(!count){minX=minY=-1;maxX=maxY=1;}
  const geometry:FullNetworkGeometry={ids,labels,types,positions,segments,
    endpoints:pairs,recorded,degreeSizes,amountSizes,
    amountCurrency,amountCount:amountCurrency?amountCount:0,
    arrangement,areas:[],hubs:[],nodeCount:count,edgeCount:graph.edges.length,
    bounds:{minX,minY,maxX,maxY}};
  if(arrangement!=="types"){
    const presentation=arrangeNetworkAreas(graph,geometry,
      arrangement==="themes"?"themes":"areas");
    geometry.areas=presentation.areas;geometry.hubs=presentation.hubs;
  }
  return geometry;
}

/** The highlighted subset is derived exclusively from original recorded source
 * edges. Inferred/shared associations are deliberately not presented as facts.
 * All geometry in the original network remains available for dimmed context.
 */
export type FullNetworkFocus={
  nodeIndex:number;neighbourIndices:Uint32Array;
  nodes:Float32Array;types:Uint8Array;degreeSizes:Float32Array;amountSizes:Float32Array;lines:Float32Array;
  relationships:number;neighbours:number;
};
export function focusFullNetwork(geometry:FullNetworkGeometry,id:string|null|undefined):
  FullNetworkFocus|null {
  if(!id)return null;
  const center=geometry.ids.indexOf(id);
  if(center<0)return null;
  const nearby=new Set<number>([center]);
  const edges:number[]=[];
  for(let e=0;e<geometry.edgeCount;e++){
    if(!geometry.recorded[e])continue;
    const a=geometry.endpoints[e*2],b=geometry.endpoints[e*2+1];
    if(a===center||b===center){
      edges.push(e);
      nearby.add(a);nearby.add(b);
    }
  }
  const neighbourIndices=new Uint32Array([...nearby]);
  const nodes=new Float32Array(nearby.size*2),types=new Uint8Array(nearby.size);
  const degreeSizes=new Float32Array(nearby.size),amountSizes=new Float32Array(nearby.size);
  let i=0;
  for(const n of nearby){
    nodes[i*2]=geometry.positions[n*2];
    nodes[i*2+1]=geometry.positions[n*2+1];
    types[i]=geometry.types[n];
    degreeSizes[i]=geometry.degreeSizes[n];amountSizes[i]=geometry.amountSizes[n];i++;
  }
  const lines=new Float32Array(edges.length*4);
  edges.forEach((edge,i)=>lines.set(geometry.segments.subarray(edge*4,edge*4+4),i*4));
  return {nodeIndex:center,neighbourIndices,nodes,types,degreeSizes,amountSizes,lines,
    relationships:edges.length,neighbours:Math.max(0,nearby.size-1)};
}
