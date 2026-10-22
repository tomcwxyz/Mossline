"use client";
import {useMemo,useState} from "react";
import {buildConnectionDirectory,type ConnectionRow,type GraphDocument}
  from "@mossline/graph-core";
import {WholeGraphExplorer} from "./WholeGraphExplorer";

/** This is deliberately a focused relationship reader, not a graph that
 * attempts to simultaneously show 20,000 inferred association lines.
 */
export function ConnectionsExplorer({graph,sourceGraph}:{
 graph:GraphDocument;sourceGraph:GraphDocument;
}){
 const directory=useMemo(()=>buildConnectionDirectory(graph,sourceGraph),[graph,sourceGraph]);
 const [query,setQuery]=useState("");
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [showCount,setShowCount]=useState(18);
 const [openEvidence,setOpenEvidence]=useState<string|null>(null);
 const [showOverview,setShowOverview]=useState(false);
 const matching=directory.ranked.filter(x=>x.node.label.toLocaleLowerCase("en-GB")
   .includes(query.trim().toLocaleLowerCase("en-GB")));
 const selected=selectedId&&directory.byId.has(selectedId)?selectedId:
   directory.ranked[0]?.node.id??null;
 const entity=directory.ranked.find(item=>item.node.id===selected);
 const rows=selected?directory.byId.get(selected)??[]:[];
 const visible=rows.slice(0,showCount);
 const spokes=rows.slice(0,7);
 const fmt=(n:number)=>n.toLocaleString("en-GB");
 const select=(id:string)=>{
   setSelectedId(id);setShowCount(18);setOpenEvidence(null);
 };
 return <section className="connection-reader" aria-label="Explore organisational connections">
   <header className="connection-reader-header">
     <div><p className="eyebrow">Connections · explore the evidence</p>
       <h3>Follow a relationship</h3>
       <p>Start with an organisation, then follow its recorded relationships and
         shared associations. No need to untangle thousands of crossing lines.</p></div>
     <div className="connection-reader-overview">
       <strong>{fmt(directory.totalOrganisations)}</strong><span>organisations</span>
       <strong>{fmt(directory.recordedLinks)}</strong><span>recorded links</span>
       <strong>{fmt(directory.sharedAssociations)}</strong><span>shared associations</span>
     </div>
   </header>
   <div className="connection-reader-guide" role="note">
     <strong>Shared association ≠ collaboration.</strong>
     Two organisations may be connected to the same funder or project,
     but that does not establish that they work together.
   </div>
   <div className="connection-reader-toolbar">
     <label htmlFor="connection-reader-search">Find an organisation</label>
     <input id="connection-reader-search" type="search" value={query}
       onChange={event=>setQuery(event.target.value)}
       placeholder="Search all organisations in this view…"/>
     <span>{matching.length.toLocaleString("en-GB")} matching organisations</span>
   </div>
   <div className="connection-reader-quick">
     <strong>{query?"Matching organisations":"Start with a well-connected organisation"}</strong>
     {matching.length===0?<span>No matches. Try part of the name.</span>:
       matching.slice(0,8).map(item=>
         <button key={item.node.id} type="button" aria-pressed={selected===item.node.id}
           className={selected===item.node.id?"active":""}
           onClick={()=>select(item.node.id)}>
           <span>{item.node.label}</span>
           <small>{fmt(item.links)} associations / links</small>
         </button>)}
   </div>
   {entity&&<div className="connection-reader-body">
     <div className="connection-reader-figure">
       <div className="connection-reader-figure-heading">
         <p className="eyebrow">A network of relationships</p>
         <h4>{entity.node.label}</h4>
         <p><strong>{fmt(entity.links)}</strong> connections in this view:
           {" "}{fmt(entity.recorded)} recorded and {fmt(entity.shared)} shared associations.</p>
       </div>
       <div className="connection-reader-radial" role="img"
         aria-label={entity.node.label+" and "+spokes.length+
           " of its directly connected organisations. All connections are listed alongside."}>
         <svg viewBox="0 0 520 365" aria-hidden="true">
           <defs><radialGradient id="relation-centre"><stop offset="0%" stopColor="#376b4f"/>
             <stop offset="100%" stopColor="#183d31"/></radialGradient></defs>
           <ellipse cx="260" cy="181" rx="206" ry="143" fill="none"
             stroke="#698974" strokeDasharray="3 9" strokeOpacity=".35"/>
           {spokes.map((row,i)=>{
             const theta=(-Math.PI*.93)+i*(Math.PI*1.86/Math.max(1,spokes.length-1));
             const x=260+198*Math.cos(theta),y=181+135*Math.sin(theta);
             return <path key={row.edge.id} d={"M260 181 Q"+((260+x)/2)+" "+((181+y)/2-12)+
                 " "+x+" "+y} fill="none"
               stroke={row.inferred?"#c8ab71":"#98bda1"}
               strokeWidth={row.inferred?1.3:2.5}
               strokeDasharray={row.inferred?"5 7":undefined} strokeOpacity=".85"/>;
           })}
           <circle cx="260" cy="181" r="57" fill="url(#relation-centre)"
             stroke="#d5c58a" strokeWidth="2"/>
           <text x="260" y="176" textAnchor="middle" fontSize="12"
             fill="#f4edd0" fontWeight="700">FOCUS</text>
           <text x="260" y="196" textAnchor="middle" fontSize="12"
             fill="#cfdfca">{entity.links} links</text>
           {spokes.map((row,i)=>{
             const theta=(-Math.PI*.93)+i*(Math.PI*1.86/Math.max(1,spokes.length-1));
             const x=260+198*Math.cos(theta),y=181+135*Math.sin(theta);
             return <circle key={row.edge.id} cx={x} cy={y} r="9"
               fill={row.inferred?"#dec38c":"#87bd9a"} stroke="#193c31" strokeWidth="2"/>;
           })}
         </svg>
         {spokes.map((row,i)=>{
           const theta=(-Math.PI*.93)+i*(Math.PI*1.86/Math.max(1,spokes.length-1));
           return <button key={row.edge.id} type="button" title={"Follow "+row.other.label}
             className={"connection-reader-spoke "+(row.inferred?"shared":"recorded")}
             style={{left:(50+38*Math.cos(theta))+"%",
               top:(50+37*Math.sin(theta))+"%"}}
             onClick={()=>select(row.other.id)}>
             {row.other.label}
           </button>;
         })}
       </div>
       <p className="connection-reader-diagram-note">A readable snapshot of up to seven
         direct relationships, not a sampled source graph. Choose any name or
         explore the full list to follow all connections.</p>
     </div>
     <div className="connection-reader-list">
       <div className="connection-reader-list-title">
         <h4>Connected organisations</h4>
         <span>{fmt(rows.length)} in total</span>
       </div>
       {rows.length===0&&<p>No connections match this view. Change the basis
         on the left to explore other types of shared association.</p>}
       <div className="connection-reader-rows">
         {visible.map(row=><article key={row.edge.id} className="connection-reader-row">
           <div className="connection-reader-row-main">
             <button type="button" className="connection-reader-name"
               onClick={()=>select(row.other.id)}>{row.other.label}</button>
             <span className={row.inferred?"shared":"recorded"}>
               {row.inferred?"Shared association":"Recorded relationship"}</span>
           </div>
           {row.inferred?<p>These organisations share a link to
             {row.evidenceCount>0?" "+fmt(row.evidenceCount)+" supporting source "+
               (row.evidenceCount===1?"entity":"entities"):" a project or funder"}.</p>:
             <p>{row.edge.type}</p>}
           <button type="button" className="connection-reader-why"
             aria-expanded={openEvidence===row.edge.id}
             onClick={()=>setOpenEvidence(value=>value===row.edge.id?null:row.edge.id)}>
             {openEvidence===row.edge.id?"Hide evidence":"Why are these connected?"}
             <span aria-hidden="true">{openEvidence===row.edge.id?"−":"+"}</span>
           </button>
           {openEvidence===row.edge.id&&
             <div className="connection-reader-evidence">
               <strong>{row.inferred?"Evidence behind this shared association":
                 "Recorded relationship evidence"}</strong>
               {row.evidenceLabels.length>0?
                 <ul>{row.evidenceLabels.map((label,i)=><li key={i}>{label}</li>)}</ul>:
                 <p>{row.edge.description||row.edge.type||"No additional source details provided."}</p>}
               {row.evidenceCount>row.evidenceLabels.length&&
                 <p>Showing {row.evidenceLabels.length} of {row.evidenceCount} evidence references.</p>}
               {row.inferred&&<small>A shared source is not proof of partnership,
                 collaboration or impact.</small>}
             </div>}
         </article>)}
       </div>
       {rows.length>visible.length&&
         <button className="connection-reader-more" type="button"
           onClick={()=>setShowCount(n=>n+18)}>
           Show 18 more connections ({fmt(rows.length-visible.length)} remaining)
         </button>}
     </div>
   </div>}
   <details className="connection-reader-advanced" open={showOverview}
     onToggle={event=>setShowOverview(event.currentTarget.open)}>
     <summary>Advanced: view the complete association graph</summary>
     <p>The complete graph includes all recorded links and shared associations.
       The grouped overview compresses many relationships and is less helpful
       for reading individual evidence. Use the reader above for that.</p>
     {showOverview&&<WholeGraphExplorer graph={graph} initialMode="overview"/>}
   </details>
 </section>;
}
