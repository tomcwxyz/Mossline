"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {WholeGraphExplorer} from "./WholeGraphExplorer";
import {FollowConnection} from "./FollowConnection";
import {
  atlasFundingOverlap, confirmInferredRelationship, emptyAnnotationLayer,
  evidenceReceipt, graphFingerprint, graphWithAnnotations, isRecorded,
  parseAnnotationLayer, projectAtlas, recordedCoordinates, recordedDegree,
  recordedTimeline, type AtlasAnnotationLayer, type AtlasFilters,
  type AtlasLens, type GraphDocument, type GraphEdge, type GraphNode, type NodeType
} from "@mossline/graph-core";

const LENSES: {id:AtlasLens;label:string;help:string}[] = [
  {id:"network",label:"Network",help:"Position follows recorded relationships"},
  {id:"map",label:"Map",help:"Position follows source coordinates"},
  {id:"themes",label:"Themes",help:"Groups follow source tags, not inferred meanings"},
  {id:"funding",label:"Funding",help:"Recorded funding links, not implied collaboration"},
  {id:"timeline",label:"Timeline",help:"Dates on recorded source relationships"}
];
const TYPE_NAMES: Record<NodeType,string> = {
  organisation:"Organisations",project:"Projects",funder:"Funders",person:"People",
  place:"Places",topic:"Topics",methodology:"Methods",outcome:"Outcomes",other:"Other"
};
const MAX_DRAWN=350;
const W=1000,H=630;
type Point={x:number;y:number};
const radius=(degree:number,type:NodeType)=>Math.min(15,3.5+1.2*Math.sqrt(degree)+(type==="funder"?1.5:0));
function marker(node:GraphNode,x:number,y:number,r:number,selected:boolean){
  const stroke=selected?"var(--ml-moss)":"var(--ml-paper)";
  const cls="ml-marker ml-"+node.type;
  const props={className:cls,stroke,strokeWidth:selected?3:1.3};
  if(node.type==="funder") return <path {...props} d={`M ${x} ${y-r*1.22} L ${x+r*1.22} ${y} L ${x} ${y+r*1.22} L ${x-r*1.22} ${y} Z`}/>;
  if(node.type==="project") return <rect {...props} x={x-r} y={y-r} width={r*2} height={r*2} rx={Math.max(2,r*.27)}/>;
  if(node.type==="place") return <path {...props} d={`M ${x} ${y-r*1.25} L ${x+r*1.13} ${y+r} L ${x-r*1.13} ${y+r} Z`}/>;
  if(node.type==="person") return <circle {...props} fill="var(--ml-paper)" cx={x} cy={y} r={r} strokeWidth={3.4}/>;
  return <circle {...props} cx={x} cy={y} r={r}/>;
}
function networkPositions(nodes:GraphNode[],edges:GraphEdge[]):Map<string,Point>{
  // Deterministic spring relaxation. Positions are determined by the recorded
  // topology, never hashes pretending to be data coordinates.
  const positions=new Map<string,Point>();
  const ordered=[...nodes].sort((a,b)=>a.id.localeCompare(b.id));
  ordered.forEach((n,i)=>{const angle=2*Math.PI*i/Math.max(1,ordered.length);
    const r=80+Math.sqrt(i/Math.max(1,ordered.length))*200;
    positions.set(n.id,{x:W/2+Math.cos(angle)*r,y:H/2+Math.sin(angle)*r});});
  const lines=edges.filter(isRecorded).filter(e=>positions.has(e.source)&&positions.has(e.target));
  // A modest cap avoids blocking mobile devices while the worker renderer is migrated.
  for(let step=0;step<58 && ordered.length>1;step++){
    const dx=new Float64Array(ordered.length),dy=new Float64Array(ordered.length);
    for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length;j++){
      const a=positions.get(ordered[i].id)!,b=positions.get(ordered[j].id)!;
      let vx=a.x-b.x,vy=a.y-b.y;
      const dist2=Math.max(18,vx*vx+vy*vy);
      const rep=3500/dist2;
      const inv=1/Math.sqrt(dist2);
      dx[i]+=vx*inv*rep;dy[i]+=vy*inv*rep;
      dx[j]-=vx*inv*rep;dy[j]-=vy*inv*rep;
    }
    const index=new Map(ordered.map((n,i)=>[n.id,i]));
    for(const edge of lines){
      const i=index.get(edge.source)!,j=index.get(edge.target)!;
      const a=positions.get(edge.source)!,b=positions.get(edge.target)!;
      const vx=b.x-a.x,vy=b.y-a.y,dist=Math.max(1,Math.hypot(vx,vy));
      const pull=(dist-75)*.006;
      dx[i]+=vx/dist*pull;dy[i]+=vy/dist*pull;
      dx[j]-=vx/dist*pull;dy[j]-=vy/dist*pull;
    }
    ordered.forEach((n,i)=>{const p=positions.get(n.id)!;
      p.x=Math.min(W-36,Math.max(36,p.x+Math.max(-7,Math.min(7,dx[i]))+(W/2-p.x)*.004));
      p.y=Math.min(H-36,Math.max(36,p.y+Math.max(-7,Math.min(7,dy[i]))+(H/2-p.y)*.004));
    });
  }
  return positions;
}
function mapPosition(lat:number,lon:number):Point {
  const safe=Math.max(-85,Math.min(85,lat))*Math.PI/180;
  const merc=(1-Math.log(Math.tan(safe)+1/Math.cos(safe))/Math.PI)/2;
  return {x:36+(lon+180)/360*(W-72),y:22+merc*(H-44)};
}
function GraphDrawing({graph,lens,selectedId,onPick}:{
  graph:GraphDocument;lens:"network"|"map"|"themes";
  selectedId:string|null;onPick:(id:string)=>void;
}){
  const degrees=useMemo(()=>{
    const counts=new Map(graph.nodes.map(n=>[n.id,0]));
    for(const edge of graph.edges)if(isRecorded(edge)){
      if(counts.has(edge.source))counts.set(edge.source,counts.get(edge.source)!+1);
      if(counts.has(edge.target))counts.set(edge.target,counts.get(edge.target)!+1);
    }
    return counts;
  },[graph]);
  const displayed=useMemo(()=>{
    const sorted=[...graph.nodes].sort((a,b)=>
      Number(b.id===selectedId)-Number(a.id===selectedId) ||
      (degrees.get(b.id)??0)-(degrees.get(a.id)??0) || a.label.localeCompare(b.label));
    return sorted.slice(0,MAX_DRAWN);
  },[graph,selectedId,degrees]);
  const drawnIds=useMemo(()=>new Set(displayed.map(n=>n.id)),[displayed]);
  const located=useMemo(()=>displayed.filter(n=>recordedCoordinates(n)!==null),[displayed]);
  const unplacedCount=graph.nodes.filter(n=>recordedCoordinates(n)===null).length;
  const positions=useMemo(()=>{
    if(lens==="network")return networkPositions(displayed,graph.edges);
    if(lens==="map")return new Map(located.map(n=>{const p=recordedCoordinates(n)!;
      return [n.id,mapPosition(p.lat,p.lon)] as const;}));
    const result=new Map<string,Point>();
    // Themes without embeddings are displayed honestly as source-tag groups.
    const groups=new Map<string,GraphNode[]>();
    for(const node of displayed){
      const key=node.tags[0]||"No source tag";
      groups.set(key,[...(groups.get(key)??[]),node]);
    }
    [...groups].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([_,group],i)=>{
      const cols=Math.max(1,Math.ceil(Math.sqrt(groups.size)));
      const gx=(i%cols+.5)*W/cols,gy=(Math.floor(i/cols)+.5)*H/Math.ceil(groups.size/cols);
      group.forEach((node,j)=>{const a=j*2.39996323;const r=12+13*Math.sqrt(j);
        result.set(node.id,{x:Math.max(23,Math.min(W-23,gx+Math.cos(a)*r)),
          y:Math.max(23,Math.min(H-23,gy+Math.sin(a)*r))});});
    });
    return result;
  },[graph.edges,displayed,located,lens]);
  const visibleEdges=graph.edges.filter(e=>drawnIds.has(e.source)&&drawnIds.has(e.target)
    &&positions.has(e.source)&&positions.has(e.target));
  const neighbours=new Set<string>(selectedId?[selectedId]:[]);
  for(const e of graph.edges)if(isRecorded(e)){
    if(e.source===selectedId)neighbours.add(e.target);
    if(e.target===selectedId)neighbours.add(e.source);
  }
  const labels=new Set([...displayed].sort((a,b)=>(degrees.get(b.id)??0)-(degrees.get(a.id)??0))
    .slice(0,11).map(n=>n.id));
  if(selectedId) labels.add(selectedId);
  const taggedGroups=lens==="themes"?[...new Set(displayed.map(n=>n.tags[0]||"No source tag"))]:[];
  return <div className="ml-drawing-wrap">
    <svg className="ml-drawing" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={lens==="map"?"World coordinate plot of records with source locations":
        lens==="themes"?"Records grouped by their source tags":"Network of recorded and inferred relationships"}>
      {lens==="map" && <>
        {[0,1,2,3,4,5,6].map(i=><line key={"v"+i} className="ml-graticule"
          x1={36+i*(W-72)/6} x2={36+i*(W-72)/6} y1={22} y2={H-22}/>)}
        {[0,1,2,3,4].map(i=><line key={"h"+i} className="ml-graticule"
          x1={36} x2={W-36} y1={22+i*(H-44)/4} y2={22+i*(H-44)/4}/>)}
        <text x="50" y="46" className="ml-survey-label">SOURCE COORDINATES · WORLD</text>
      </>}
      {lens==="themes"&&taggedGroups.length>0&&<text x="32" y="42" className="ml-survey-label">
        GROUPED BY RECORDED TAGS · NOT MODEL-INFERRED THEMES
      </text>}
      {lens!=="themes"&&visibleEdges.map(e=>{
        const a=positions.get(e.source)!,b=positions.get(e.target)!;
        const selected=e.source===selectedId||e.target===selectedId;
        return <path key={e.id} className={`ml-edge ${e.inferred?"ml-pencil":"ml-ink"}`+
          (selected?" ml-emphasis":selectedId?" ml-dim":"")}
          d={`M ${a.x} ${a.y} Q ${(a.x+b.x)/2+(b.y-a.y)*.08} ${(a.y+b.y)/2-(b.x-a.x)*.08} ${b.x} ${b.y}`}>
          <title>{e.type} · {e.inferred?"Inferred, not confirmed":evidenceReceipt(e)}</title>
        </path>;
      })}
      {[...positions].map(([id,p])=>{
        const n=displayed.find(node=>node.id===id)!;
        const selected=id===selectedId,dim=!!selectedId&&!neighbours.has(id);
        const name=labels.has(id) || (selectedId && neighbours.has(id) && displayed.length<90);
        return <g key={id} className={"ml-point"+(dim?" ml-dim":"")}
          role="button" tabIndex={0} aria-label={n.label+", "+n.type}
          onClick={()=>onPick(id)} onKeyDown={(e:KeyboardEvent<SVGGElement>)=>{
            if(e.key==="Enter"||e.key===" "){e.preventDefault();onPick(id);}
          }}>
          {selected&&<circle cx={p.x} cy={p.y} r={radius(degrees.get(id)??0,n.type)+8}
            className="ml-selection-ring"/>}
          {marker(n,p.x,p.y,radius(degrees.get(id)??0,n.type),selected)}
          {name&&<text x={p.x+12} y={p.y-11} className="ml-node-label">{n.label.slice(0,34)}</text>}
          <title>{n.label} · {degrees.get(id)??0} recorded links</title>
        </g>;
      })}
    </svg>
    <div className="ml-drawing-caption">
      {lens==="map"?`${graph.nodes.length-unplacedCount} placed · ${unplacedCount} without coordinates`:
        `${displayed.length.toLocaleString("en-GB")} of ${graph.nodes.length.toLocaleString("en-GB")} records drawn`}
      {displayed.length<graph.nodes.length&&" · Remaining records available in Browse"}
      {lens==="map"&&" · Coordinate plot; basemap upgrade in progress"}
    </div>
  </div>;
}
function RecordPanel({source,graph,node,onPick,onFollow,onConfirm}:{
  source:GraphDocument;graph:GraphDocument;node:GraphNode|null;
  onPick:(id:string)=>void;onFollow:(id:string)=>void;
  onConfirm:(edge:GraphEdge,input:{reviewer:string;reason:string;relationship:string})=>void;
}){
  const [candidate,setCandidate]=useState<string|null>(null);
  const [reviewer,setReviewer]=useState("");
  const [reason,setReason]=useState("");
  const [relationship,setRelationship]=useState("partnership");
  const links=useMemo(()=>node?graph.edges.filter(e=>e.source===node.id||e.target===node.id):[],[graph,node]);
  if(!node)return <div className="ml-empty-panel">
    <p className="ml-eyebrow">An atlas of relationships</p>
    <h2>Follow a thread.</h2>
    <p>Choose any record to see the relationships behind it, where they came from, and what is only a suggestion.</p>
    <p>Every solid connection represents a recorded relationship. A dotted connection is a possibility, not a fact.</p>
  </div>;
  const inferred=links.filter(e=>!isRecorded(e)),recorded=links.filter(isRecorded);
  return <div className="ml-record-panel">
    <p className="ml-eyebrow"><span className={`ml-type-symbol ml-${node.type}`}/> {node.type}</p>
    <h2>{node.label}</h2>
    {node.region&&<p className="ml-region">{node.region}</p>}
    <p className="ml-description">{node.description||"No description recorded in the source."}</p>
    {node.tags.length>0&&<div className="ml-tag-list">{node.tags.map(t=><span key={t}>{t}</span>)}</div>}
    <button type="button" className="ml-follow-trigger" onClick={()=>onFollow(node.id)}>
      Follow a recorded connection →
    </button>
    <div className="ml-stat-row">
      <div><strong>{recorded.length}</strong><span>Recorded links</span></div>
      <div className="ml-pencilled"><strong>{inferred.length}</strong><span>Associations</span></div>
    </div>
    <h3>Recorded · {recorded.length}</h3>
    {recorded.length===0&&<p className="ml-small">No direct source-recorded links in the current filter.</p>}
    <div className="ml-record-links">{recorded.slice(0,70).map(e=>{
      const other=source.nodes.find(n=>n.id===(e.source===node.id?e.target:e.source));
      return <div className="ml-record-link" key={e.id}>
        <button type="button" onClick={()=>onPick(other?.id??node.id)}>
          <strong>{other?.label??"Unknown record"}</strong><span>{e.type}</span>
        </button>
        <small>{evidenceReceipt(e)}</small>
        {e.sourceUrl&&<a target="_blank" rel="noreferrer" href={e.sourceUrl}>Source ↗</a>}
      </div>;
    })}</div>
    {recorded.length>70&&<p className="ml-small">{recorded.length-70} more recorded links. Refine Browse to examine more records.</p>}
    {inferred.length>0&&<section className="ml-associations">
      <h3>Pencil · {inferred.length} unconfirmed</h3>
      <p>Shared funders or other associations do not establish collaboration.</p>
      {inferred.slice(0,12).map(e=><div key={e.id} className="ml-association-item">
        <button type="button" onClick={()=>onPick(e.source===node.id?e.target:e.source)}>
          {source.nodes.find(n=>n.id===(e.source===node.id?e.target:e.source))?.label??"Related record"} ↗
        </button>
        <p>{e.description??e.type}</p>
        {candidate===e.id?<form onSubmit={(event:FormEvent)=>{
          event.preventDefault();
          onConfirm(e,{reviewer,reason,relationship});
          setCandidate(null);setReason("");
        }}>
          <label>Relationship type<input required maxLength={120} value={relationship}
            onChange={event=>setRelationship(event.target.value)}/></label>
          <label>Reviewed by<input required minLength={2} value={reviewer}
            onChange={event=>setReviewer(event.target.value)}/></label>
          <label>Evidence and reason<textarea required minLength={10} value={reason}
            onChange={event=>setReason(event.target.value)}/></label>
          <p>This creates an auditable annotation; the imported source remains unchanged.</p>
          <button type="submit">Confirm relationship</button>
          <button type="button" onClick={()=>setCandidate(null)}>Cancel</button>
        </form>:<button type="button" className="ml-inline-button" onClick={()=>setCandidate(e.id)}>
          Confirm with evidence…
        </button>}
      </div>)}
      {inferred.length>12&&<p className="ml-small">{inferred.length-12} additional associations not shown here.</p>}
    </section>}
    <details className="ml-source-detail"><summary>Open source record</summary>
      <p>{node.origin? `${node.origin.system} · ${node.origin.recordId}`:
        "No source row reference supplied"}</p>
      {node.sourceUrl&&<a href={node.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a>}
      {node.properties&&<pre>{JSON.stringify(node.properties,null,2)}</pre>}
    </details>
  </div>;
}
function Bars({items,onClick}:{
 items:{id:string;name:string;value:number;secondary?:string}[];onClick?:(id:string)=>void;
}){
 const max=Math.max(1,...items.map(item=>item.value));
 return <div className="ml-bars">{items.map(item=><button key={item.id} type="button"
   className="ml-bar-row" onClick={()=>onClick?.(item.id)} disabled={!onClick}>
   <span className="ml-bar-heading"><strong>{item.name}</strong><span>{item.value.toLocaleString("en-GB")}{item.secondary&&" · "+item.secondary}</span></span>
   <span className="ml-bar-track"><span style={{width:(item.value/max*100)+"%"}}/></span>
 </button>)}</div>;
}
export function FieldAtlasWorkspace({graph:imported,onBack,onImport,onAdvanced,example}:{
  graph:GraphDocument;onBack:()=>void;onImport:()=>void;onAdvanced:()=>void;example?:boolean;
}){
  const graphKey=useMemo(()=>graphFingerprint(imported),[imported]);
  const [annotations,setAnnotations]=useState<AtlasAnnotationLayer>(()=>emptyAnnotationLayer(graphKey));
  const storageKey="mossline:atlas-annotations:v1:"+graphKey;
  const [annotationsReady,setAnnotationsReady]=useState(false);
  useEffect(()=>{
    try{const stored=window.localStorage.getItem(storageKey);
      setAnnotations(stored?parseAnnotationLayer(JSON.parse(stored),graphKey):emptyAnnotationLayer(graphKey));
    }catch{setAnnotations(emptyAnnotationLayer(graphKey));}
    setAnnotationsReady(true);
  },[storageKey,graphKey]);
  useEffect(()=>{
    if(!annotationsReady||annotations.graphKey!==graphKey)return;
    try{window.localStorage.setItem(storageKey,JSON.stringify(annotations));}catch{}
  },[annotations,annotationsReady,graphKey,storageKey]);
  const graph=useMemo(()=>graphWithAnnotations(imported,annotations.graphKey===graphKey?
    annotations:emptyAnnotationLayer(graphKey)),[imported,annotations,graphKey]);
  const [lens,setLens]=useState<AtlasLens>("network");
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [search,setSearch]=useState("");
  const [theme,setTheme]=useState("");
  const [region,setRegion]=useState("");
  const [funderId,setFunderId]=useState("");
  const [year,setYear]=useState<number|null>(null);
  const [type,setType]=useState<NodeType|null>(null);
  const [browse,setBrowse]=useState(false);
  const [routeFromId,setRouteFromId]=useState<string|null>(null);
  const [browseLimit,setBrowseLimit]=useState(100);
  const [filtersExpanded,setFiltersExpanded]=useState(false);
  const [notice,setNotice]=useState("");
  const [urlReady,setUrlReady]=useState(false);
  const searchRef=useRef<HTMLInputElement>(null);
  const [night,setNight]=useState(false);
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const requested=params.get("lens");
    if(LENSES.some(l=>l.id===requested))setLens(requested as AtlasLens);
    setSelectedId(params.get("record"));setSearch(params.get("q")??"");
    setTheme(params.get("theme")??"");setRegion(params.get("region")??"");
    setFunderId(params.get("funder")??"");
    const y=Number(params.get("year"));setYear(params.has("year")&&y>=1800&&y<=2200?y:null);
    const t=params.get("type");if(t&&t in TYPE_NAMES)setType(t as NodeType);
    setUrlReady(true);
  },[]);
  useEffect(()=>{
    if(!urlReady)return;
    const url=new URL(window.location.href);
    for(const key of ["lens","record","q","theme","region","funder","year","type"])url.searchParams.delete(key);
    url.searchParams.set("lens",lens);
    if(selectedId)url.searchParams.set("record",selectedId);
    if(search)url.searchParams.set("q",search);
    if(theme)url.searchParams.set("theme",theme);
    if(region)url.searchParams.set("region",region);
    if(funderId)url.searchParams.set("funder",funderId);
    if(year!==null)url.searchParams.set("year",String(year));
    if(type)url.searchParams.set("type",type);
    window.history.replaceState(window.history.state,"",url.toString());
  },[urlReady,lens,selectedId,search,theme,region,funderId,year,type]);
  useEffect(()=>{
    const listener=(e:globalThis.KeyboardEvent)=>{
      if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;
      if(e.key==="/"){e.preventDefault();searchRef.current?.focus();}
      if(e.key==="Escape")setSelectedId(null);
      const index=Number(e.key)-1;
      if(index>=0&&index<LENSES.length)setLens(LENSES[index].id);
    };
    document.addEventListener("keydown",listener);
    return ()=>document.removeEventListener("keydown",listener);
  },[]);
  const filters:AtlasFilters=useMemo(()=>({query:search,theme,region,
    funderId:funderId||undefined,
    types:type?[type]:undefined,
    fromYear:year??undefined,toYear:year??undefined
  }),[search,theme,region,funderId,type,year]);
  const result=useMemo(()=>projectAtlas(graph,filters),[graph,filters]);
  const selected=useMemo(()=>graph.nodes.find(n=>n.id===selectedId)??null,[graph,selectedId]);
  const themes=useMemo(()=>[...new Set(graph.nodes.flatMap(n=>n.tags))].sort(),[graph]);
  const regions=useMemo(()=>[...new Set(graph.nodes.map(n=>n.region).filter((s):s is string=>!!s))].sort(),[graph]);
  const funders=useMemo(()=>graph.nodes.filter(n=>n.type==="funder"),[graph]);
  const timeline=useMemo(()=>recordedTimeline(result.graph),[result.graph]);
  const fullTimeline=useMemo(()=>recordedTimeline(graph),[graph]);
  const overlap=useMemo(()=>atlasFundingOverlap(result.graph),[result.graph]);
  const recordList=useMemo(()=>[...result.graph.nodes].sort((a,b)=>a.label.localeCompare(b.label)),[result.graph]);
  useEffect(()=>setBrowseLimit(100),[filters]);
  const unplaced=useMemo(()=>result.graph.nodes.filter(n=>!recordedCoordinates(n)),[result.graph]);
  function confirm(edge:GraphEdge,input:{relationship:string;reviewer:string;reason:string}){
    try{
      setAnnotations(layer=>confirmInferredRelationship(imported,layer,edge.id,{
        ...input,now:new Date().toISOString()
      }));
      setNotice("Confirmed in a separate local annotation, with reviewer and reason. Source data unchanged.");
    }catch(error){setNotice(error instanceof Error?error.message:"Could not confirm suggestion.");}
  }
  const located=result.graph.nodes.length-unplaced.length;
  return <main className="ml-atlas" data-theme={night?"night":"day"}>
    <header className="ml-header">
      <button className="ml-wordmark" type="button" onClick={onBack} aria-label="Mossline — all maps">
        <span className="ml-logo" aria-hidden="true">✳</span>mossline<span className="ml-period">.</span>
      </button>
      <div className="ml-dataset"><strong>{imported.title}</strong>
        <small>{graph.nodes.length.toLocaleString("en-GB")} records · {graph.edges.filter(isRecorded).length.toLocaleString("en-GB")} recorded links
          {example&&" · example data"}</small></div>
      <nav className="ml-lenses" aria-label="Atlas lenses">
        {LENSES.map((item,i)=><button key={item.id} type="button" title={item.help}
          aria-current={lens===item.id?"page":undefined}
          onClick={()=>setLens(item.id)}>{item.label}<span className="ml-shortcut">{i+1}</span></button>)}
      </nav>
      <div className="ml-header-actions">
        <span className="ml-local-status">On this device</span>
        <button type="button" onClick={()=>setNight(n=>!n)} aria-label={night?"Use day colours":"Use night colours"}>{night?"Day":"Night"}</button>
        <button type="button" onClick={()=>navigator.clipboard?.writeText(window.location.href).then(()=>
          setNotice("View link copied. The underlying local dataset does not travel with the link."))
          .catch(()=>setNotice("Copy the address from your browser."))}>Share view</button>
      </div>
    </header>
    <div className={"ml-tools"+(filtersExpanded?" ml-tools--expanded":"")}>
      <button type="button" className="ml-mobile-filters"
        aria-expanded={filtersExpanded} onClick={()=>setFiltersExpanded(open=>!open)}>
        {filtersExpanded?"Close filters":"Filters"} </button>
      <label className="ml-search"><span>Ask or find</span><input ref={searchRef} value={search}
        onChange={e=>setSearch(e.target.value)} placeholder="Search names, descriptions and tags… (/)" /></label>
      <label>Type<select value={type??""} onChange={e=>setType((e.target.value||null) as NodeType|null)}>
        <option value="">All records</option>{Object.entries(TYPE_NAMES).map(([key,value])=>
          <option key={key} value={key}>{value}</option>)}</select></label>
      <label>Theme<select value={theme} onChange={e=>setTheme(e.target.value)}>
        <option value="">All source tags</option>{themes.map(t=><option key={t}>{t}</option>)}</select></label>
      <label>Place<select value={region} onChange={e=>setRegion(e.target.value)}>
        <option value="">All regions</option>{regions.map(r=><option key={r}>{r}</option>)}</select></label>
      <label>Funder<select value={funderId} onChange={e=>setFunderId(e.target.value)}>
        <option value="">All funders</option>{funders.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
      {(search||type||theme||region||funderId||year!==null)&&<button type="button" onClick={()=>{
        setSearch("");setType(null);setTheme("");setRegion("");setFunderId("");setYear(null);
      }}>Clear filters ×</button>}
    </div>
    {notice&&<div className="ml-notice" role="status">{notice}<button type="button" onClick={()=>setNotice("")}>Dismiss</button></div>}
    <section className="ml-body">
      <div className="ml-main">
        <div className="ml-stage-heading"><div><p className="ml-eyebrow">{lens} lens</p>
          <h1>{lens==="network"?"Who connects with whom":
            lens==="map"?"Where the work happens":lens==="themes"?"What the records are about":
            lens==="funding"?"Where the support goes":"When things happened"}</h1>
          <p>{LENSES.find(l=>l.id===lens)?.help}</p></div>
          <button type="button" onClick={()=>setBrowse(b=>!b)} aria-expanded={browse}>
            {browse?"Hide list":"Browse records"} · {result.graph.nodes.length.toLocaleString("en-GB")}
          </button>
        </div>
        {routeFromId&&<FollowConnection graph={graph} fromId={routeFromId}
          onChoose={setSelectedId} onClose={()=>setRouteFromId(null)}/>}
        <div className="ml-canvas-stage">
          {lens==="network"&&result.graph.nodes.length>MAX_DRAWN?
            <WholeGraphExplorer graph={result.graph} initialMode="full"
              selectedRecordId={selectedId} onPickRecord={setSelectedId}/>:
            (lens==="network"||lens==="map"||lens==="themes")&&
            <GraphDrawing graph={result.graph} lens={lens} selectedId={selectedId} onPick={setSelectedId}/>}
          {lens==="map"&&<aside className="ml-unplaced">
            <strong>Not placed · {unplaced.length}</strong>
            <p>No source coordinates. Mossline will not guess a location.</p>
            {unplaced.slice(0,5).map(n=><button key={n.id} type="button" onClick={()=>setSelectedId(n.id)}>{n.label}</button>)}
            {unplaced.length>5&&<span>+ {unplaced.length-5} more in Browse</span>}
          </aside>}
          {lens==="funding"&&<div className="ml-chart-content">
            <h2>Recorded links to funders</h2>
            <p>Counts below are source relationships, not grant values or evidence that organisations worked together.
            No grant amount is inferred when the source does not provide one.</p>
            {overlap.length?<Bars items={overlap.slice(0,80).map(f=>({
              id:f.funderId,name:graph.nodes.find(n=>n.id===f.funderId)?.label??f.funderId,
              value:f.grantLinks,secondary:f.recipientCount+" linked records"
            }))} onClick={id=>setSelectedId(id)}/>:<p>No funder links in these source records.</p>}
            {overlap.length>80&&<p>{overlap.length-80} additional funders available via the funder filter.</p>}
          </div>}
          {lens==="timeline"&&<div className="ml-chart-content">
            <h2>Recorded relationships by year</h2>
            <p>Undated relationships are listed separately, never assigned an invented year.
              Choose a year to filter the other four lenses.</p>
            <Bars items={fullTimeline.map(item=>({id:item.year===null?"undated":String(item.year),
              name:item.year===null?"No date recorded":String(item.year),value:item.count}))}
              onClick={id=>setYear(id==="undated"?null:Number(id))}/>
            <button type="button" onClick={()=>setYear(null)}>Show all years</button>
          </div>}
        </div>
        {browse&&<section className="ml-browse" aria-label="Keyboard-accessible record list">
          <h2>Browse records · {recordList.length.toLocaleString("en-GB")}</h2>
          <p>All matching records are available here, including those not drawn on a dense network.</p>
          <div className="ml-browse-list">{recordList.slice(0,browseLimit).map(n=><button type="button" key={n.id}
            aria-pressed={selectedId===n.id} onClick={()=>setSelectedId(n.id)}>
            <span className={`ml-type-symbol ml-${n.type}`}/><strong>{n.label}</strong><small>{n.type}</small>
          </button>)}</div>
          {recordList.length>browseLimit&&<button className="ml-browse-next"
            type="button" onClick={()=>setBrowseLimit(n=>n+100)}>
            Show 100 more · {recordList.length-browseLimit} not listed yet
          </button>}
        </section>}
        <div className="ml-grammar" aria-label="How to read this atlas">
          <span><i className="ml-key-ink"/> Ink · recorded in a source</span>
          <span><i className="ml-key-pencil"/> Pencil · inferred, not confirmed</span>
          <span><i className="ml-key-wash"/> Wash · grouping for navigation</span>
        </div>
        <div className="ml-timeline-strip">
          <div><strong>Time</strong><span>{year===null?"All recorded dates":year}</span>
          {year!==null&&<button type="button" onClick={()=>setYear(null)}>Clear ×</button>}</div>
          <div className="ml-time-buttons">{fullTimeline.filter(item=>item.year!==null).map(item=>
            <button key={item.year} type="button" className={year===item.year?"active":""}
              title={item.count+" recorded relationships"} onClick={()=>setYear(item.year)}>
              {item.year}</button>)}</div>
          <small>{result.recordedCount} of {graph.edges.filter(isRecorded).length} recorded links in view ·
            {result.hiddenNodes} records excluded by filters</small>
        </div>
      </div>
      <aside className="ml-inspector" aria-label="Selected record">
        <RecordPanel source={imported} graph={result.graph} node={selected}
          onPick={setSelectedId} onFollow={setRouteFromId} onConfirm={confirm}/>
      </aside>
    </section>
    <footer className="ml-footer">
      <span>Source records stay on this device · Annotations are reviewed and stored separately ·
        No automatic location or partnership claims</span>
      <div><button type="button" onClick={onImport}>Import data</button>
        <button type="button" onClick={onAdvanced}>Detailed tools & full network ↗</button>
        <button type="button" onClick={onBack}>All maps</button></div>
    </footer>
    <div className="ml-announcer" role="status" aria-live="polite">
      {selected?selected.label+", "+selected.type+", "+recordedDegree(graph,selected.id)+" recorded links":""}
    </div>
  </main>;
}
