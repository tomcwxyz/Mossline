"use client";

import {useEffect,useMemo,useState} from "react";
import {useAtlasTheme} from "./atlas/theme";
import {ThemeButton,Wordmark} from "./atlas/Wordmark";
import {applyNodeStyleImages,sharedSnapshotGraph,type PublishedSnapshot}
  from "@mossline/graph-core";
import {GraphCanvas} from "./GraphCanvas";
import {AtlasCanvas,type AtlasMode,type KindFilter} from "./AtlasCanvas";
import {decodeShareSnapshot} from "../lib/share-codec";

export function SharedView({initialSnapshot}:{initialSnapshot?:PublishedSnapshot}={}){
  const [theme,setTheme]=useAtlasTheme();
  const [snapshot,setSnapshot]=useState<PublishedSnapshot|null>(initialSnapshot??null);
  const [error,setError]=useState("");
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [selectedEdgeId,setSelectedEdgeId]=useState<string|null>(null);
  const [atlasMode,setAtlasMode]=useState<AtlasMode>("places");
  const [atlasKind,setAtlasKind]=useState<KindFilter>("all");

  useEffect(()=>{
    if(initialSnapshot)return;
    let cancelled=false;
    async function load(){
      try {
        const token=new URLSearchParams(window.location.hash.replace(/^#/,"")).get("s");
        if(!token)throw Error("No snapshot found. Ask the map author for the complete share link.");
        const parsed=await decodeShareSnapshot(token);
        if(!cancelled)setSnapshot(parsed);
      }catch(err) {
        if(!cancelled)setError(err instanceof Error?err.message:"Could not open this shared view.");
      }
    }
    void load();
    return ()=>{cancelled=true;};
  },[initialSnapshot]);

  const graph=useMemo(()=>snapshot?
    applyNodeStyleImages(sharedSnapshotGraph(snapshot),snapshot.nodeStyles??{}):null,[snapshot]);
  const selected=graph?.nodes.find(node=>node.id===selectedId);
  const edge=graph?.edges.find(edge=>edge.id===selectedEdgeId);
  const related=graph&&selected?graph.edges.filter(e=>e.source===selected.id||e.target===selected.id):[];
  return <main className="shell published-shell">
    <header className="topbar">
      <div className="brand"><Wordmark/><small>Shared view</small></div>
      <div className="topbar-right"><ThemeButton theme={theme} onChange={setTheme}/><a href="/" rel="noreferrer">Open Mossline ↗</a></div>
    </header>
    {!snapshot&&<section className="published-wait" role={error?"alert":"status"}>
      <h1>{error?"Unable to open this view":"Opening shared map…"}</h1>
      {error?<p>{error}</p>:<p>Checking and decoding the link in your browser.</p>}
    </section>}
    {snapshot&&graph&&<>
      <section className="published-head">
        <p className="eyebrow">Read-only · author-shared snapshot</p>
        <h1>{snapshot.title}</h1>
        {snapshot.introduction&&<p>{snapshot.introduction}</p>}
        {snapshot.coverUrl&&<img loading="lazy" src={snapshot.coverUrl}
          referrerPolicy="no-referrer" alt="Author-selected cover artwork"/>}
        <p className="published-caveat">Anyone with this link can copy the included content.
          This is a fixed snapshot, not the author's live data. Recorded and
          inferred connections are distinguished where source data supplied that flag.</p>
      </section>
      <section className="published-workspace" aria-label="Read-only network map">
        <div className="published-main">
          <div className="published-stats">{graph.nodes.length} entities · {graph.edges.length} relationships
            <span> · {snapshot.view==="atlas"?"UK atlas":snapshot.view==="collaborations"?"Collaborations":"Network landscape"}</span>
          </div>
          {snapshot.view==="atlas"?
            <AtlasCanvas graph={graph} selectedId={selectedId}
              onSelect={id=>{setSelectedId(id);setSelectedEdgeId(null);}}
              onPickEdge={id=>{setSelectedEdgeId(id);setSelectedId(null);}}
              mode={atlasMode} onModeChange={setAtlasMode}
              kind={atlasKind} onKindChange={setAtlasKind}/>:
            <GraphCanvas graph={graph} contextNodeIds={[]}
              selectedId={selectedId} selectedEdgeId={selectedEdgeId}
              pathNodeIds={[]} pathEdgeIds={[]} junctionNodeIds={[]}
              onSelect={id=>{setSelectedId(id);setSelectedEdgeId(null);}}
              onSelectEdge={id=>{setSelectedEdgeId(id);setSelectedId(null);}}
              view={snapshot.view} layoutMode={snapshot.layout} labelDensity={snapshot.labels}
              illustrated={snapshot.illustrated} nodeStyles={snapshot.nodeStyles}
              savedPositions={snapshot.positions}/>}
        </div>
        <aside className="published-inspector" aria-label="Explore shared entities">
          {selected&&<div>
            <p className="eyebrow">{selected.type}</p>
            <h2>{selected.label}</h2>
            {selected.description&&<p>{selected.description}</p>}
            <p className="published-detail-subtitle">Connections in this snapshot</p>
            {related.length===0?<p>No visible connections.</p>:
              <ul>{related.map(e=>{
                const other=graph.nodes.find(n=>n.id===(e.source===selected.id?e.target:e.source));
                return <li key={e.id}><button type="button"
                  onClick={()=>{setSelectedId(other?.id??null);setSelectedEdgeId(null);}}>
                  {other?.label??"Unknown"} <small>{e.type} · {e.inferred?"Inferred":"Recorded"}</small>
                </button></li>;
              })}</ul>}
          </div>}
          {edge&&<div><p className="eyebrow">Relationship</p>
            <h2>{edge.type}</h2>
            <p>{graph.nodes.find(n=>n.id===edge.source)?.label} →
              {" "}{graph.nodes.find(n=>n.id===edge.target)?.label}</p>
            <p>{edge.inferred?"Inferred association — not an independently verified relationship.":
              "Recorded relationship in the author's supplied dataset; independently unverified."}</p>
          </div>}
          {!selected&&!edge&&<>
            <p className="eyebrow">Explore this view</p>
            <h2>Follow a connection.</h2>
            <p>Choose an entity or relationship to explore what the author shared.</p>
          </>}
          <details className="published-browse">
            <summary>Browse all {graph.nodes.length} entities</summary>
            <ul>{graph.nodes.map(node=><li key={node.id}>
              <button type="button" onClick={()=>{setSelectedId(node.id);setSelectedEdgeId(null);}}>
                {node.label} <small>{node.type}</small>
              </button>
            </li>)}</ul>
          </details>
        </aside>
      </section>
      <footer className="footer"><span>mossline — explore connected worlds.</span>
        <span>Self-contained share link · No sign-in · No live editing</span></footer>
    </>}
  </main>;
}
