"use client";

import { useMemo, useState } from "react";
import {
  buildUkAtlas, UK_ATLAS_SIZE, type GraphDocument
} from "@mossline/graph-core";
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
const W=UK_ATLAS_SIZE.width,H=UK_ATLAS_SIZE.height;
const iconByType:Record<string,string>={
  organisation:"🌱",project:"✳",funder:"◈",place:"●",topic:"✦",
  methodology:"◇",outcome:"◆",person:"◉",other:"○"
};
export function AtlasCanvas({graph,selectedId,onSelect,onPickEdge}:Props){
  const [expandedGroup,setExpandedGroup]=useState<string|null>(null);
  const [showReference,setShowReference]=useState(false);
  const atlas=useMemo(()=>buildUkAtlas(graph),[graph]);
  const byId=useMemo(()=>new Map(graph.nodes.map(n=>[n.id,n])),[graph]);
  const groups=useMemo(()=>{
    const cells=new Map<string,LocationGroup>();
    for(const point of atlas.placed){
      // Nearby pins are grouped for legibility. The centre is a visual
      // aggregation only; individual source coordinates are never altered.
      const key=Math.floor(point.x/43)+":"+Math.floor(point.y/43);
      const cell=cells.get(key);
      if(cell){cell.x=(cell.x*cell.ids.length+point.x)/(cell.ids.length+1);
        cell.y=(cell.y*cell.ids.length+point.y)/(cell.ids.length+1);
        cell.ids.push(point.nodeId);
      }else cells.set(key,{key,x:point.x,y:point.y,ids:[point.nodeId]});
    }
    return [...cells.values()];
  },[atlas.placed]);
  const idToGroup=useMemo(()=>{
    const map=new Map<string,LocationGroup>();
    for(const group of groups)for(const id of group.ids)map.set(id,group);
    return map;
  },[groups]);
  const selected=selectedId?byId.get(selectedId):undefined;
  const attached=useMemo(()=>selectedId?graph.edges.filter(e=>!e.inferred&&
    (e.source===selectedId||e.target===selectedId)) : [],[graph.edges,selectedId]);
  const lines=useMemo(()=>attached
    .map(edge=>{
      const a=idToGroup.get(edge.source),b=idToGroup.get(edge.target);
      if(!a||!b||a===b)return null;
      return {id:edge.id,x1:a.x,y1:a.y,x2:b.x,y2:b.y};
    }).filter((x):x is NonNullable<typeof x>=>!!x).slice(0,60),[attached,idToGroup]);
  const pick=(id:string)=>{
    setExpandedGroup(null);
    onSelect(id);
  };
  return <div className="uk-atlas" aria-label="UK geographic atlas, using source-provided coordinates">
    <header className="uk-atlas-intro">
      <div>
        <p className="eyebrow">UK atlas · geographic perspective</p>
        <h3>Where the work happens</h3>
        <p>Explore locations from the source data. Select a marker to follow its recorded
          relationships. Nearby markers are grouped until you choose one.</p>
      </div>
      <div className="atlas-counts" aria-label="Location coverage">
        <span><strong>{atlas.placed.length}</strong> located</span>
        <span><strong>{atlas.withoutLocation.length}</strong> not placed</span>
        {atlas.outsideArea.length>0&&<span><strong>{atlas.outsideArea.length}</strong> outside UK view</span>}
      </div>
    </header>
    {atlas.placed.length===0 ?
      <div className="atlas-no-locations">
        <p>There are no UK <strong>Atlas location</strong> coordinates in this map.</p>
        <p>Import the PFT Elements and Connections tables or the portable PFT network JSON
          to see its actual UK locations. Mossline won't invent positions from names, regions,
          or the separate Kumu layout fields.</p>
      </div> :
      <div className="atlas-body">
        <div className="uk-atlas-stage">
          <svg className="atlas-land" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
            role="img" aria-label="Approximate UK and Ireland outlines with a latitude-longitude reference grid">
            <defs>
              <pattern id="atlas-grid" width="62" height="62" patternUnits="userSpaceOnUse">
                <path d="M62 0 L0 0 0 62" fill="none" stroke="#abc5b6" strokeWidth="1" opacity=".45"/>
              </pattern>
            </defs>
            <rect width={W} height={H} fill="#e4ede9"/>
            <rect width={W} height={H} fill="url(#atlas-grid)"/>
            <path d={UK_LAND_OUTLINES.ireland} fill="#e8ebd6" stroke="#9cb393" strokeWidth="2.8"/>
            <path d={UK_LAND_OUTLINES.britain} fill="#e6e9d2" stroke="#91ad8e" strokeWidth="2.8"/>
            {lines.map(line=><line key={line.id}
              x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
              stroke="#b37d40" strokeWidth="2.9" opacity=".85" strokeDasharray="5 5"/>)}
          </svg>
          <div className="atlas-hint">Approximate regional projection · Not a survey map</div>
          {groups.map(group=>{
            const first=byId.get(group.ids[0]);
            if(!first)return null;
            const multiple=group.ids.length>1;
            const active=group.ids.includes(selectedId??"");
            const img=multiple?undefined:first.imageUrl;
            return <button key={group.key} type="button"
              className={"atlas-pin "+first.type+(multiple?" grouped":"")+(active?" selected":"")}
              style={{left:(group.x/W*100)+"%",top:(group.y/H*100)+"%"}}
              title={multiple?group.ids.length+" nearby entities":first.label}
              aria-label={multiple?group.ids.length+" nearby located entities. Choose to see them":
                "Explore "+first.label+" ("+first.type+")"}
              aria-expanded={multiple?expandedGroup===group.key:undefined}
              onClick={()=>multiple?setExpandedGroup(expandedGroup===group.key?null:group.key):pick(group.ids[0])}>
              {multiple?<span className="atlas-cluster-count">{group.ids.length}</span>:
                img?<img src={img} alt="" loading="lazy"/>:
                <span aria-hidden="true">{iconByType[first.type]??"○"}</span>}
            </button>;
          })}
          {expandedGroup&&(()=>{
            const group=groups.find(x=>x.key===expandedGroup);
            if(!group)return null;
            return <div className="atlas-group-list" role="group" aria-label="Choose one of the nearby entities">
              <div><strong>{group.ids.length} nearby entities</strong>
                <button type="button" aria-label="Close nearby entity list" onClick={()=>setExpandedGroup(null)}>×</button></div>
              {group.ids.map(id=><button type="button" onClick={()=>pick(id)} key={id}>
                {byId.get(id)?.label??id} <small>{byId.get(id)?.type}</small>
              </button>)}
            </div>;
          })()}
        </div>
        <aside className="atlas-detail">
          <div className="atlas-detail-top">
            <h4>{selected?.label??"Find a place to start"}</h4>
            <p>{selected ? (selected.type+" · "+(idToGroup.has(selected.id)?"Located in this view":"Not located")):
              "Choose one of the illustrated markers or a group of nearby places."}</p>
          </div>
          {selected && <div className="atlas-relationships">
            <p><strong>{attached.length}</strong> source-recorded relationships from this entity.
              Lines connect only other entities with locations.</p>
            {attached.slice(0,8).map(edge=>{
              const other=edge.source===selectedId?edge.target:edge.source;
              return <div className="atlas-relationship" key={edge.id}>
                <button type="button" onClick={()=>pick(other)}>{byId.get(other)?.label??other}</button>
                <span>{edge.type}</span>
                <button type="button" onClick={()=>onPickEdge(edge.id)}>Why?</button>
              </div>;
            })}
            {attached.length>8&&<p>Showing eight connections. Use Landscape to explore the full network.</p>}
          </div>}
          <div className="atlas-reference">
            <button type="button" onClick={()=>setShowReference(v=>!v)} aria-expanded={showReference}>
              {showReference?"Hide":"View"} the original PFT illustrated basemap ↗
            </button>
            {showReference&&<>
              <img loading="lazy" src={visualAssetUrl(PFT_VISUAL_PACK,PFT_VISUAL_PACK.basemap!)}
                alt="Original PFT UK basemap illustration, provided as an artistic reference" />
              <p>This original artwork is a visual reference, not georeferenced to the plotted pins.</p>
            </>}
          </div>
          <div className="atlas-explanation">
            <strong>What about the other entities?</strong>
            <p>{atlas.withoutLocation.length} have no source Atlas location and are not plotted.
              They remain part of the network. Kumu `mapx`/`mapy` are not treated as latitude and longitude.</p>
          </div>
        </aside>
      </div>}
  </div>;
}
