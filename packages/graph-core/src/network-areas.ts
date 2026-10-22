import type {GraphDocument} from "./schema";
import type {FullNetworkGeometry} from "./full-network-layout";
import {TOPIC_BRIDGES} from "./funding";

export type NetworkArea={
 id:string;label:string;count:number;x:number;y:number;radius:number;
 anchorId?:string;kind:"linked"|"unlinked"|"hub"|"theme";
};
export type NetworkHub={id:string;label:string;type:string;connections:number};
export type NetworkAreaLink={sourceId:string;targetId:string;count:number};
const golden=Math.PI*(3-Math.sqrt(5));
function hash(value:string){
 let h=2166136261;
 for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619)>>>0;
 return h/4294967296;
}

type ThemeChoice={key:string;label:string;origin:"source"|"suggested"|"unlabelled"};
function normalTheme(value:string):string{
 return value.trim().replace(/\s+/g," ").slice(0,75);
}
/** Existing tags/programmes are source assertions. Phrase matches are only
 * optional navigational suggestions, never authoritative classifications.
 * Organisation/funder placements use links to source-classified grants.
 */
function thematicChoices(graph:GraphDocument,adjacent:number[][]):ThemeChoice[]{
 const choices:(ThemeChoice|null)[]=Array.from({length:graph.nodes.length},()=>null);
 const read=(i:number):ThemeChoice|null=>{
  const generic=new Set(["general","other","community","unspecified","miscellaneous"]);
  const node=graph.nodes[i],tags=node.tags.map(normalTheme).filter(Boolean).sort((a,b)=>
   Number(generic.has(a.toLowerCase()))-Number(generic.has(b.toLowerCase()))||
   b.length-a.length||a.localeCompare(b,"en-GB"));
  const own=tags[0];
  if(own)return {key:"tag:"+own.toLocaleLowerCase("en-GB"),
   label:own,origin:"source"};
  const programme=node.properties?.programme;
  if(node.properties?.mosslineFundingGrant===true&&typeof programme==="string"&&
   normalTheme(programme))return {key:"programme:"+normalTheme(programme).toLocaleLowerCase("en-GB"),
    label:"Programme: "+normalTheme(programme),origin:"source"};
  if(node.properties?.mosslineFundingGrant===true){
   const prose=(node.label+" "+(node.description??"")).toLowerCase();
   for(const rule of TOPIC_BRIDGES){
    if(rule.phrases.some(phrase=>{
     const needle=phrase.toLowerCase();
     return prose.includes(needle);
    }))return {key:"suggestion:"+rule.topic.toLowerCase(),label:"Possible: "+rule.topic,
      origin:"suggested"};
   }
  }
  return null;
 };
 for(let i=0;i<graph.nodes.length;i++){
  choices[i]=read(i);
 }
 // Source-related funders/recipients inherit a navigational primary theme from
 // recorded grant neighbours, rather than inventing a new node property.
 for(let i=0;i<graph.nodes.length;i++){
  if(choices[i])continue;
  const neighbours=adjacent[i],freq=new Map<string,{choice:ThemeChoice;n:number}>();
  for(const other of neighbours){
   if(graph.nodes[other].properties?.mosslineFundingGrant!==true)continue;
   const theme=choices[other];if(!theme)continue;
   const entry=freq.get(theme.key);
   freq.set(theme.key,{choice:theme,n:(entry?.n??0)+1});
  }
  const candidate=[...freq.values()].sort((a,b)=>b.n-a.n||
   a.choice.key.localeCompare(b.choice.key));
  if(candidate.length&&(candidate.length===1||candidate[0].n>candidate[1].n))
   choices[i]=candidate[0].choice;
 }
 return choices.map(item=>{
  const choice=item??{key:"unlabelled",label:"No theme supplied",origin:"unlabelled" as const};
  return choice;
 });
}

function labelType(type:string){return type==="organisation"?"organisations":
 type==="project"?"projects or grants":type==="funder"?"funders":
 type==="person"?"people":type==="place"?"places":type+" entities";}

/** A deterministic, bounded, source-relationship-led presentation.
 * 'Areas' are spatial navigation, not detected real-world communities.
 * No source relationship or isolated node is omitted.
 */
export function arrangeNetworkAreas(graph:GraphDocument,geometry:FullNetworkGeometry,
 mode:"areas"|"themes"="areas"):
 {areas:NetworkArea[];hubs:NetworkHub[];
  nodeArea:Uint16Array;areaLinks:NetworkAreaLink[]}{
 const n=geometry.nodeCount;
 if(!n)return {areas:[],hubs:[],nodeArea:new Uint16Array(0),areaLinks:[]};
 const adjacent:number[][]=Array.from({length:n},()=>[]);
 const degree=new Uint32Array(n);
 for(let i=0;i<geometry.edgeCount;i++){
  if(!geometry.recorded[i])continue;
  const a=geometry.endpoints[2*i],b=geometry.endpoints[2*i+1];
  if(a===b)continue;
  adjacent[a].push(b);adjacent[b].push(a);degree[a]++;degree[b]++;
 }
 const ranked=Array.from({length:n},(_,i)=>i).filter(i=>degree[i]>=3)
  .sort((a,b)=>degree[b]-degree[a]||
    graph.nodes[a].id.localeCompare(graph.nodes[b].id));
 // Keep a short, navigable set of anchor hubs, rather than making each
 // recipient or funder a separate tiny island.
 const seeds=mode==="themes"?[]:
  ranked.slice(0,Math.min(12,Math.max(4,Math.round(Math.sqrt(n)/6))));
 const assignment=new Int32Array(n).fill(-1),queue:number[]=[];
 const groups:{key:string;label:string;indices:number[];anchor?:number;
   kind:NetworkArea["kind"]}[]=seeds.map((node,i)=>({
  key:"hub:"+graph.nodes[node].id,label:"Around "+graph.nodes[node].label,
  indices:[],anchor:node,kind:"hub"
 }));
 if(mode==="themes"){
  const themes=thematicChoices(graph,adjacent);
  const freq=new Map<string,number>();
  for(const theme of themes)freq.set(theme.key,(freq.get(theme.key)??0)+1);
  const top=new Set([...freq].filter(([key])=>key!=="unlabelled")
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
    .slice(0,14).map(([key])=>key));
  const groupForKey=new Map<string,number>();
  themes.forEach((theme,i)=>{
   const key=theme.key==="unlabelled"?"unlabelled":
     top.has(theme.key)?theme.key:"other-themes";
   let group=groupForKey.get(key);
   if(group===undefined){
    group=groups.length;groupForKey.set(key,group);
    groups.push({key:"theme:"+key,
     label:key==="other-themes"?"Other labelled themes":
       key==="unlabelled"?"No theme supplied":theme.label,
     kind:"theme",indices:[]});
   }
   assignment[i]=group;
  });
 }
 for(let i=0;i<seeds.length;i++){assignment[seeds[i]]=i;queue.push(seeds[i]);}
 // Multi-source breadth-first expansion ensures each assigned area is
 // connected by recorded source edges to its anchor. Ties favour bigger hubs.
 for(let head=0;head<queue.length;head++){
  const current=queue[head],owner=assignment[current];
  for(const next of adjacent[current]){
   if(assignment[next]!==-1)continue;
   assignment[next]=owner;queue.push(next);
  }
 }
 const remaining=new Map<string,number>();
 for(let i=0;i<n;i++){
  if(assignment[i]<0){
   const type=graph.nodes[i].type;
   const category=degree[i]?"linked":"unlinked";
   const key=type+":"+category;
   let index=remaining.get(key);
   if(index===undefined){
    index=groups.length;remaining.set(key,index);
    groups.push({key,label:(category==="unlinked"?"Unlinked ":"Other connected ")+
      labelType(type),indices:[],kind:category});
   }
   assignment[i]=index;
  }
  groups[assignment[i]].indices.push(i);
 }
 const visible=groups.filter(g=>g.indices.length>0)
  .sort((a,b)=>b.indices.length-a.indices.length||a.key.localeCompare(b.key));
 const center:{x:number;y:number;radius:number}[]=[];
 for(let i=0;i<visible.length;i++){
  const group=visible[i];
  const radius=Math.min(440,Math.max(54,23+10.5*Math.sqrt(group.indices.length)));
  let x=0,y=0;
  if(i>0){
   for(let attempt=1;attempt<=12000;attempt++){
    const angle=attempt*golden;
    const distance=55*Math.sqrt(attempt);
    x=Math.cos(angle)*distance;y=Math.sin(angle)*distance;
    if(center.every(c=>Math.hypot(c.x-x,c.y-y)>c.radius+radius+48))break;
   }
  }
  center.push({x,y,radius});
 }
 // The identifiers below are a visual atlas index, never source graph facts.
 // Cross-area ribbons count only recorded relationships (parallel edges count).
 const areaByKey=new Map(visible.map((group,i)=>[group.key,i]));
 const nodeArea=new Uint16Array(n);
 for(let i=0;i<n;i++){
  const group=groups[assignment[i]];
  nodeArea[i]=areaByKey.get(group.key)??0;
 }
 const bridges=new Map<string,{from:number;to:number;count:number}>();
 for(let e=0;e<geometry.edgeCount;e++){
  if(!geometry.recorded[e])continue;
  const a=nodeArea[geometry.endpoints[e*2]],b=nodeArea[geometry.endpoints[e*2+1]];
  if(a===b)continue;
  const from=Math.min(a,b),to=Math.max(a,b),key=from+":"+to;
  const entry=bridges.get(key);
  if(entry)entry.count++;else bridges.set(key,{from,to,count:1});
 }
 const areaLinks=[...bridges.values()].map(link=>({
   sourceId:visible[link.from].key,targetId:visible[link.to].key,
   count:link.count
 })).sort((a,b)=>b.count-a.count||
   a.sourceId.localeCompare(b.sourceId)||a.targetId.localeCompare(b.targetId));
 const seedPos=new Float32Array(n*2);
 const labelAreas:NetworkArea[]=[];
 for(let a=0;a<visible.length;a++){
  const group=visible[a],c=center[a];
  labelAreas.push({id:group.key,label:group.label,count:group.indices.length,
    x:c.x,y:c.y,radius:c.radius,
    ...(group.anchor!==undefined?{anchorId:graph.nodes[group.anchor].id}:{}),
    kind:group.kind});
  for(const i of group.indices){
   const id=graph.nodes[i].id;
   const central=group.anchor===i;
   const radius=central?0:Math.sqrt(hash(id+"@radial"))*(c.radius-20);
   const theta=2*Math.PI*hash(id+"@angle");
   seedPos[2*i]=geometry.positions[2*i]=c.x+radius*Math.cos(theta);
   seedPos[2*i+1]=geometry.positions[2*i+1]=c.y+radius*Math.sin(theta);
  }
 }
 // A small, anchored neighbour relaxation gives islands shape without
 // collapsing them into the original dense hairball.
 const sums=new Float64Array(n*2),counts=new Uint32Array(n);
 const iters=n>40000?4:n>15000?6:10;
 for(let pass=0;pass<iters;pass++){
  sums.fill(0);counts.fill(0);
  for(let e=0;e<geometry.edgeCount;e++){
   if(!geometry.recorded[e])continue;
   const a=geometry.endpoints[2*e],b=geometry.endpoints[2*e+1];
   if(a===b||assignment[a]!==assignment[b])continue;
   sums[2*a]+=geometry.positions[2*b];sums[2*a+1]+=geometry.positions[2*b+1];
   sums[2*b]+=geometry.positions[2*a];sums[2*b+1]+=geometry.positions[2*a+1];
   counts[a]++;counts[b]++;
  }
  for(let i=0;i<n;i++){
   if(!counts[i]||(mode==="areas"&&seeds.includes(i)))continue;
   const k=2*i;
   geometry.positions[k]=.77*geometry.positions[k]+
     .14*(sums[k]/counts[i])+.09*seedPos[k];
   geometry.positions[k+1]=.77*geometry.positions[k+1]+
     .14*(sums[k+1]/counts[i])+.09*seedPos[k+1];
  }
 }
 // Rebuild line geometry from the same original endpoint indices.
 for(let e=0;e<geometry.edgeCount;e++){
  const a=geometry.endpoints[e*2]*2,b=geometry.endpoints[e*2+1]*2;
  geometry.segments[4*e]=geometry.positions[a];
  geometry.segments[4*e+1]=geometry.positions[a+1];
  geometry.segments[4*e+2]=geometry.positions[b];
  geometry.segments[4*e+3]=geometry.positions[b+1];
 }
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(let i=0;i<n;i++){
  const x=geometry.positions[2*i],y=geometry.positions[2*i+1];
  minX=Math.min(minX,x);minY=Math.min(minY,y);
  maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
 }
 geometry.bounds={minX,minY,maxX,maxY};
 return {
  areas:labelAreas,nodeArea,areaLinks,
  hubs:ranked.slice(0,8).map(i=>({id:graph.nodes[i].id,
   label:graph.nodes[i].label,type:graph.nodes[i].type,connections:degree[i]}))
 };
}
