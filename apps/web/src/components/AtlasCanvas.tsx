"use client";

import { useMemo, useState } from "react";
import { buildUkAtlas, UK_ATLAS_SIZE, type GraphDocument, type GraphNode } from "@mossline/graph-core";
import { UK_LAND_OUTLINES } from "../data/uk-land-outline";
import { PFT_VISUAL_PACK } from "../data/pft-visual-pack";
import { visualAssetUrl } from "@mossline/graph-core";

interface Props {
  graph:GraphDocument;
  selectedId:string|null;
  onSelect:(id:string|null)=>void;
  onPickEdge:(id:string)=>void;
}
type LocationGroup={key:string;x:number;y:number;ids:string[]};
type KindFilter="all"|"project"|"organisation"|"funder"|"place";
type AtlasMode="stories"|"places";
const W=UK_ATLAS_SIZE.width,H=UK_ATLAS_SIZE.height;
const STORY_PAGE_SIZE=8;
const categoryIcons:Record<string,string>={
  organisation:"🌱",project:"✳",funder:"◈",place:"●",topic:"✦",
  methodology:"◇",outcome:"◆",person:"◉",other:"○"
};
const categoryNames:Record<KindFilter,string>={
  all:"All",project:"Projects",organisation:"Organisations",funder:"Funders",place:"Places"
};
function nearestGroups(points:ReturnType<typeof buildUkAtlas>["placed"],cellSize=45):LocationGroup[] {
  const grid=new Map<string,LocationGroup>();
  for(const point of points){
    const key=Math.floor(point.x/cellSize)+":"+Math.floor(point.y/cellSize);
    const group=grid.get(key);
    if(group){
      const count=group.ids.length;
      group.x=(group.x*count+point.x)/(count+1);
      group.y=(group.y*count+point.y)/(count+1);
      group.ids.push(point.nodeId);
    }else grid.set(key,{key,x:point.x,y:point.y,ids:[point.nodeId]});
  }
  return [...grid.values()];
}
export function AtlasCanvas({graph,selectedId,onSelect,onPickEdge}:Props){
  const [mode,setMode]=useState<AtlasMode>("stories");
  const [kind,setKind]=useState<KindFilter>("project");
  const [search,setSearch]=useState("");
  const [storyPage,setStoryPage]=useState(0);
  const [expandedGroup,setExpandedGroup]=useState<string|null>(null);
  const [showReference,setShowReference]=useState(false);
  const atlas=useMemo(()=>buildUkAtlas(graph),[graph]);
  const byId=useMemo(()=>new Map(graph.nodes.map(n=>[n.id,n])),[graph]);
  const placedById=useMemo(()=>new Map(atlas.placed.map(p=>[p.nodeId,p])),[atlas.placed]);
  const projects=useMemo(()=>atlas.placed.filter(p=>p.type==="project")
    .sort((a,b)=>a.label.localeCompare(b.label)),[atlas.placed]);
  const isStories=mode==="stories"&&projects.length>0;
  const filtered=useMemo(()=>atlas.placed.filter(point=>{
    const labelMatch=!search||point.label.toLowerCase().includes(search.trim().toLowerCase());
    const kindMatch=isStories?point.type==="project":kind==="all"||point.type===kind;
    return labelMatch&&kindMatch;
  }),[atlas.placed,kind,isStories,search]);
  const pages=Math.max(1,Math.ceil(filtered.length/STORY_PAGE_SIZE));
  const page=Math.min(storyPage,pages-1);
  const featured=isStories?filtered.slice(page*STORY_PAGE_SIZE,(page+1)*STORY_PAGE_SIZE):[];
  const groups=useMemo(()=>nearestGroups(filtered,isStories?29:45),[filtered,isStories]);
  const idToGroup=useMemo(()=>{
    const map=new Map<string,LocationGroup>();
    for(const group of groups)for(const id of group.ids)map.set(id,group);
    return map;
  },[groups]);
  const selected=selectedId?byId.get(selectedId):undefined;
  const selectedPoint=selectedId?placedById.get(selectedId):undefined;
  const attached=useMemo(()=>selectedId?graph.edges.filter(e=>!e.inferred&&
    (e.source===selectedId||e.target===selectedId)):[],[graph.edges,selectedId]);
  const lines=useMemo(()=>attached.map(edge=>{
    const a=idToGroup.get(edge.source),b=idToGroup.get(edge.target);
    if(!a||!b||a===b)return null;
    return {id:edge.id,x1:a.x,y1:a.y,x2:b.x,y2:b.y};
  }).filter((x):x is NonNullable<typeof x>=>!!x).slice(0,40),[attached,idToGroup]);
  const mappedConnections=lines.length;
  const selectedFeatured=isStories&&!!selectedPoint&&selected?.type==="project"&&idToGroup.has(selected.id);
  const selectedInPage=featured.some(p=>p.nodeId===selectedId);
  const pick=(id:string)=>{
    setExpandedGroup(null);
    onSelect(id);
  };
  const choices=(Object.keys(categoryNames) as KindFilter[]).map(key=>({
    key,label:categoryNames[key],
    count:key==="all"?atlas.placed.length:atlas.placed.filter(p=>p.type===key).length
  }));
  const hint=selectedFeatured&&selectedInPage?
    "Gold thread highlights this project’s source location, not a relationship between entities.":
    "Source locations are approximate; select a project or marker to explore its recorded relationships.";
  return <div className="uk-atlas" aria-label="Source-grounded UK network atlas">
    <header className="uk-atlas-intro">
      <div>
        <p className="eyebrow">A place to explore · UK network atlas</p>
        <h3>Where the work happens</h3>
        <p>Places give this network its shape. Follow the projects, find an organisation, and explore what the source records say connects them.</p>
      </div>
      <div className="atlas-counts" aria-label="Source coordinate coverage">
        <span><strong>{atlas.placed.length}</strong> located</span>
        <span><strong>{atlas.withoutLocation.length}</strong> unlocated</span>
        {atlas.outsideArea.length>0&&<span><strong>{atlas.outsideArea.length}</strong> beyond this map</span>}
      </div>
    </header>
    {atlas.placed.length===0?
      <div className="atlas-no-locations">
        <p>No UK locations recorded in this map yet.</p>
        <p>Import the PFT Elements and Connections tables, or its portable Mossline JSON.
          This atlas only uses <strong>Atlas location</strong> coordinates.
          We don't invent positions from names, regions or Kumu layout data.</p>
      </div>:
      <>
        <div className="atlas-mode-switch" role="group" aria-label="Choose how to explore the atlas">
          <button type="button" className={isStories?"active":""}
            disabled={!projects.length} aria-pressed={isStories}
            onClick={()=>{setMode("stories");setSearch("");setStoryPage(0);setExpandedGroup(null);}}>
            <span aria-hidden="true">✳</span> Illustrated projects
          </button>
          <button type="button" className={!isStories?"active":""}
            aria-pressed={!isStories}
            onClick={()=>{setMode("places");setSearch("");setExpandedGroup(null);}}>
            <span aria-hidden="true">⌖</span> Explore places
          </button>
          <p>{isStories?"A visual introduction to the located projects":
            "All the source-located entities, without fabricated locations"}</p>
        </div>
        <div className="atlas-filter-bar">
          {!isStories&&<div className="atlas-filter-types" role="group" aria-label="Show types of located entities">
            {choices.filter(x=>x.count>0).map(x=><button key={x.key} type="button"
              aria-pressed={kind===x.key} className={kind===x.key?"selected":""}
              onClick={()=>{setKind(x.key);setExpandedGroup(null);}}>
              {x.label} <span>{x.count}</span>
            </button>)}
          </div>}
          <label className="atlas-search">
            <span>{isStories?"Find a project":"Find a located entity"}</span>
            <input value={search} onChange={e=>{setSearch(e.target.value);setStoryPage(0);setExpandedGroup(null);}}
              placeholder={isStories?"Search projects…":"Search by name…"} type="search"/>
          </label>
          <p className="atlas-filter-feedback" role="status">
            {filtered.length} {filtered.length===1?"location":"locations"} shown
            {isStories?" · Project artwork from source IDs":""}
          </p>
        </div>
        <div className="atlas-body">
          <div className="atlas-primary">
            <div className={"uk-atlas-stage"+(isStories?" atlas-story-mode":"")}>
              <svg className="atlas-land" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
                role="img" aria-label="Natural Earth country outlines aligned to the coordinates of plotted UK network entities">
                <defs>
                  <pattern id="atlas-grid" width="65" height="65" patternUnits="userSpaceOnUse">
                    <path d="M65 0 L0 0 0 65" fill="none" stroke="#a6bfae" strokeWidth=".9" opacity=".35"/>
                  </pattern>
                  <radialGradient id="atlas-sea" cx="47%" cy="45%" r="80%">
                    <stop offset="0%" stopColor="#ecf1e7"/>
                    <stop offset="100%" stopColor="#dce8df"/>
                  </radialGradient>
                </defs>
                <rect width={W} height={H} fill="url(#atlas-sea)"/>
                <rect width={W} height={H} fill="url(#atlas-grid)"/>
                <path d={UK_LAND_OUTLINES.ireland} fill="#dee6cd" stroke="#a2b99f" strokeWidth="3"/>
                <path d={UK_LAND_OUTLINES.britain} fill="#e1e8ce" stroke="#98b095" strokeWidth="3"/>
                {isStories&&selectedFeatured&&selectedInPage&&selectedPoint&&
                  <path d={`M${W*.5},${H} Q${selectedPoint.x},${H*.76} ${selectedPoint.x},${selectedPoint.y}`}
                    fill="none" stroke="#b88f46" strokeWidth="3.5" strokeDasharray="8 7" opacity=".88"/>}
                {!isStories&&lines.map(line=><line key={line.id}
                  x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                  stroke="#b58143" strokeWidth="3" opacity=".85" strokeDasharray="6 6"/>)}
              </svg>
              <div className="atlas-hint">{isStories?"Location threads are not relationship lines":"Recorded relationships appear when you select an entity"}</div>
              {groups.map(group=>{
                const first=byId.get(group.ids[0]);
                if(!first)return null;
                const multiple=group.ids.length>1,active=group.ids.includes(selectedId??"");
                const photo=multiple?undefined:first.imageUrl;
                return <button key={group.key} type="button"
                  className={"atlas-pin "+first.type+(multiple?" grouped":"")+
                    (active?" selected":"")+(isStories?" atlas-story-pin":"")}
                  style={{left:(group.x/W*100)+"%",top:(group.y/H*100)+"%"}}
                  title={multiple?group.ids.length+" located entities":first.label}
                  aria-label={multiple?group.ids.length+" nearby entities. Choose one":
                    "Explore "+first.label+" ("+first.type+")"}
                  aria-expanded={multiple?expandedGroup===group.key:undefined}
                  onClick={()=>multiple?setExpandedGroup(expandedGroup===group.key?null:group.key):pick(group.ids[0])}>
                  {multiple?<span className="atlas-cluster-count">{group.ids.length}</span>:
                    photo?<img src={photo} alt="" loading="lazy"/>:
                    <span aria-hidden="true">{categoryIcons[first.type]??"○"}</span>}
                </button>;
              })}
              {expandedGroup&&(()=>{
                const group=groups.find(x=>x.key===expandedGroup);
                if(!group)return null;
                return <div className="atlas-group-list" role="group" aria-label="Choose an entity at this location">
                  <div><strong>{group.ids.length} nearby entities</strong>
                    <button type="button" aria-label="Close nearby entities" onClick={()=>setExpandedGroup(null)}>×</button></div>
                  {group.ids.map(id=><button type="button" onClick={()=>pick(id)} key={id}>
                    {byId.get(id)?.label??id} <small>{byId.get(id)?.type}</small>
                  </button>)}
                </div>;
              })()}
            </div>
            {isStories&&<section className="atlas-story-strip" aria-label="Illustrated located projects">
              <div className="atlas-story-strip-heading">
                <div>
                  <p className="eyebrow">The projects · Explore their locations</p>
                  <h4>Stories across the landscape</h4>
                </div>
                <div className="atlas-pagination">
                  <button type="button" onClick={()=>setStoryPage(p=>Math.max(0,p-1))}
                    disabled={page===0} aria-label="Previous illustrated projects">←</button>
                  <span>{page+1} / {pages}</span>
                  <button type="button" onClick={()=>setStoryPage(p=>Math.min(pages-1,p+1))}
                    disabled={page===pages-1} aria-label="Next illustrated projects">→</button>
                </div>
              </div>
              <div className="atlas-story-cards">
                {featured.map(p=>{
                  const node=byId.get(p.nodeId)!;
                  return <button key={p.nodeId} type="button"
                    className={"atlas-story-card"+(selectedId===p.nodeId?" selected":"")}
                    aria-pressed={selectedId===p.nodeId} onClick={()=>pick(p.nodeId)}>
                    <span className="atlas-story-art">{node.imageUrl?
                      <img src={node.imageUrl} loading="lazy" alt=""/>:
                      <span aria-hidden="true">✳</span>}</span>
                    <span className="atlas-story-text"><strong>{node.label}</strong>
                      <small>{node.region||"Recorded UK location"}</small></span>
                  </button>;
                })}
              </div>
              {filtered.length===0&&<p className="atlas-story-empty">No projects match that search. Try another name.</p>}
              <p className="atlas-story-caption">{hint}</p>
            </section>}
          </div>
          <aside className="atlas-detail">
            <div className="atlas-detail-top">
              <p className="eyebrow">Follow a place</p>
              <h4>{selected?.label??"Where shall we begin?"}</h4>
              <p>{selected?(selected.type+" · "+(selectedPoint?"Source location recorded":"Not located in this atlas")):
                "Choose an illustrated project or a map marker to explore what connects it to the wider landscape."}</p>
            </div>
            {selected&&<div className="atlas-selected-summary">
              {selected.imageUrl&&<img src={selected.imageUrl} loading="lazy" alt=""/>}
              <div>
                {selected.region&&<span>{selected.region}</span>}
                {selectedPoint&&<small>{selectedPoint.latitude.toFixed(3)}° N · {Math.abs(selectedPoint.longitude).toFixed(3)}° {selectedPoint.longitude<0?"W":"E"}</small>}
              </div>
            </div>}
            {selected&&<div className="atlas-relationships">
              <p><strong>{attached.length}</strong> recorded relationships for this entity.
                {isStories?" Switch to Explore places to see geographical relationship lines.":
                  ` ${mappedConnections} can currently be drawn between visible markers.`}</p>
              {attached.slice(0,8).map(edge=>{
                const other=edge.source===selectedId?edge.target:edge.source;
                return <div className="atlas-relationship" key={edge.id}>
                  <button type="button" onClick={()=>pick(other)}>{byId.get(other)?.label??other}</button>
                  <span>{edge.type}</span>
                  <button type="button" onClick={()=>onPickEdge(edge.id)}>Why?</button>
                </div>;
              })}
              {attached.length>8&&<p>Showing eight connections. Use Landscape to explore the entire network.</p>}
            </div>}
            <div className="atlas-reference">
              <button type="button" onClick={()=>setShowReference(v=>!v)} aria-expanded={showReference}>
                {showReference?"Hide":"View"} PFT’s original illustrated UK map ↗
              </button>
              {showReference&&<>
                <img loading="lazy" src={visualAssetUrl(PFT_VISUAL_PACK,PFT_VISUAL_PACK.basemap!)}
                  alt="Original PFT illustrated UK map, shown as an artistic reference"/>
                <p>The artwork is not georeferenced, so it is displayed separately from source-location markers.</p>
              </>}
            </div>
            <div className="atlas-explanation">
              <strong>Not everything has a location</strong>
              <p>{atlas.withoutLocation.length} entities have no source Atlas location.
                They remain in Landscape and Collaborations. Kumu's mapx/mapy describe an authored arrangement, not geography.</p>
            </div>
          </aside>
        </div>
      </>}
  </div>;
}
