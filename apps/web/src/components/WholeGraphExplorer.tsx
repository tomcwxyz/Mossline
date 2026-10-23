"use client";

import {useEffect,useMemo,useRef,useState,type FormEvent} from "react";
import type {AdaptiveGraphProjection,GraphDocument,GraphEdge,NetworkInspection,
  NetworkSearch} from "@mossline/graph-core";
import {WholeGraphCanvas} from "./WholeGraphCanvas";
import {FullNetworkCanvas} from "./FullNetworkCanvas";
import {FullNetworkCanvas2D} from "./FullNetworkCanvas2D";
import {NetworkAI} from "./NetworkAI";
import {focusFullNetwork,type FullNetworkGeometry} from "@mossline/graph-core";

type Reply={
  kind:"stage"|"result"|"failed";action?:"overview"|"search"|"select"|"inspect"|"full";
  id:number;message?:string;projection?:AdaptiveGraphProjection;
  inspection?:NetworkInspection;matches?:NetworkSearch;expandedIds?:string[];
  collapsedOtherGroups?:boolean;visualLimit?:string;
  geometry?:FullNetworkGeometry;
};

/** All navigation, search and relationship detail use the canonical source
 * graph in one worker. Only the visual representation is grouped.
 */
export function WholeGraphExplorer({datasetId,graph,initialMode="overview"}:{
  datasetId?:string;graph?:GraphDocument;initialMode?:"overview"|"full";
}){
  const worker=useRef<Worker|null>(null);
  const request=useRef(0);
  const pendingExpanded=useRef<string[]>([]);
  const pendingHistory=useRef<string[]>([]);
  const resetOnOverview=useRef(false);
  const [expanded,setExpanded]=useState<string[]>([]);
  const [viewMode,setViewMode]=useState<"overview"|"full">("overview");
  const [fullRenderer,setFullRenderer]=useState<"webgl"|"canvas2d">("webgl");
  const [nodeSizeMode,setNodeSizeMode]=useState<"connections"|"amount">("connections");
  const [arrangement,setArrangement]=useState<"areas"|"types"|"themes">("areas");
  const [focusAreaId,setFocusAreaId]=useState<string|null>(null);
  const [lineMode,setLineMode]=useState<"subtle"|"visible"|"focus">("focus");
  const inspectorRef=useRef<HTMLElement|null>(null);
  const [aiOpen,setAiOpen]=useState(false);
  const [fullGeometry,setFullGeometry]=useState<FullNetworkGeometry|null>(null);
  const [projection,setProjection]=useState<AdaptiveGraphProjection|null>(null);
  const [inspection,setInspection]=useState<NetworkInspection|null>(null);
  const [selectedEdge,setSelectedEdge]=useState<GraphEdge|null>(null);
  const [history,setHistory]=useState<string[]>([]);
  const [searchTerm,setSearchTerm]=useState("");
  const [matches,setMatches]=useState<NetworkSearch|null>(null);
  const [connectionQuery,setConnectionQuery]=useState("");
  const [appliedConnectionQuery,setAppliedConnectionQuery]=useState("");
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const selectedFocus=useMemo(()=>fullGeometry&&viewMode==="full"?
    focusFullNetwork(fullGeometry,inspection?.node.id):null,
    [fullGeometry,viewMode,inspection?.node.id]);

  useEffect(()=>{
    let instance:Worker|undefined;
    try{
      instance=new Worker(new URL("../workers/whole-graph.worker.ts",import.meta.url),
        {type:"module"});
      worker.current=instance;
      const id=++request.current;
      setBusy(true);setStatus("Preparing the complete network…");
      setProjection(null);setExpanded([]);setInspection(null);
      setFullGeometry(null);setViewMode(initialMode);setFullRenderer("webgl");
      setNodeSizeMode("connections");setArrangement("areas");setLineMode("focus");setFocusAreaId(null);
      setSelectedEdge(null);setHistory([]);setMatches(null);setError("");
      pendingExpanded.current=[];pendingHistory.current=[];
      instance.onmessage=(event:MessageEvent<Reply>)=>{
        const msg=event.data;
        if(msg.id!==request.current)return;
        if(msg.kind==="stage"){setStatus(msg.message??"Exploring…");return;}
        setBusy(false);setStatus("");
        if(msg.kind==="failed"){
          setError(msg.message??"Unable to explore this network.");
          return;
        }
        setError("");
        if(msg.action==="full"&&msg.geometry){
          if(msg.projection)setProjection(msg.projection);
          setFullGeometry(msg.geometry);
          setViewMode("full");
          return;
        }
        if(msg.action==="search"&&msg.matches){
          setMatches(msg.matches);
          return;
        }
        if(msg.action==="inspect"&&msg.inspection){
          setInspection(msg.inspection);
          return;
        }
        if(msg.projection)setProjection(msg.projection);
        if(msg.action==="overview"&&msg.projection){
          setExpanded(pendingExpanded.current);
          if(resetOnOverview.current){
            setInspection(null);setHistory([]);setSelectedEdge(null);
            setConnectionQuery("");setAppliedConnectionQuery("");
            setNotice("");
          }
          resetOnOverview.current=false;
        }
        if(msg.action==="select"&&msg.inspection){
          setExpanded(msg.expandedIds??[]);
          setInspection(msg.inspection);
          setHistory(pendingHistory.current);
          setSelectedEdge(null);setMatches(null);
          setConnectionQuery("");setAppliedConnectionQuery("");
          setNotice(msg.visualLimit?
            msg.visualLimit+" Original connections remain inspectable below.":
            msg.collapsedOtherGroups?
            "Unrelated groups were collapsed to keep this area readable. "+
            "The complete network is still represented.":"");
        }
      };
      instance.onerror=()=>{
        setBusy(false);setStatus("");
        setError("The complete-network worker stopped unexpectedly. Source data is unchanged.");
      };
      instance.postMessage({kind:initialMode,id,datasetId,graph,expandedIds:[],arrangement:"areas"});
    }catch{
      setBusy(false);setError("This browser could not open complete-network exploration.");
    }
    return ()=>{request.current++;instance?.terminate();worker.current=null;};
  },[datasetId,graph,initialMode]);

  function submit(job:Record<string,unknown>,message:string){
    if(!worker.current||busy)return;
    setBusy(true);setStatus(message);setError("");
    worker.current.postMessage({...job,id:++request.current,datasetId});
  }
  function show(next:string[],reset=false){
    setSelectedEdge(null);
    pendingExpanded.current=next;resetOnOverview.current=reset;
    submit({kind:"overview",expandedIds:next},"Updating the network without losing source records…");
  }
  function navigate(id:string,back=false){
    if(busy)return;
    pendingHistory.current=back?history.slice(0,-1):
      inspection&&inspection.node.id!==id?[...history,inspection.node.id]:history;
    submit({kind:"select",nodeId:id,expandedIds:expanded,mode:viewMode},
      "Finding this entity and its recorded connections…");
  }
  function pickNode(id:string){
    if(!projection)return;
    const item=projection.graph.nodes.find(n=>n.id===id);
    if(!item)return;
    if(item.properties?.mosslineAdaptiveCluster===true){
      setSelectedEdge(null);show([...expanded,id]);return;
    }
    navigate(id);
  }
  function pickEdge(id:string){
    const item=projection?.graph.edges.find(e=>e.id===id);
    if(item)setSelectedEdge(item);
  }
  function clearSelection(){
    setInspection(null);setSelectedEdge(null);setHistory([]);
    setMatches(null);setNotice("");
  }
  function search(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!searchTerm.trim()){setMatches(null);return;}
    submit({kind:"search",query:searchTerm},
      "Searching all entities, including those inside groups…");
  }
  function inspect(event?:FormEvent<HTMLFormElement>,page=1){
    event?.preventDefault();
    if(!inspection)return;
    const term=event?connectionQuery:appliedConnectionQuery;
    setAppliedConnectionQuery(term);
    submit({kind:"inspect",nodeId:inspection.node.id,query:term,page},
      "Finding recorded connections…");
  }

  return <section className="whole-graph-explorer" aria-label="Explore the complete network">
    <div className="whole-graph-heading">
      <div>
        <p className="eyebrow">Explore · complete network</p>
        <h3>Discover how things connect</h3>
        <p>The whole network stays represented. Open a group, find an entity or
          follow its recorded connections without losing the wider picture.</p>
      </div>
      <div className="whole-graph-actions">
        <div className="full-network-mode" role="group" aria-label="Network presentation">
          <button type="button" aria-pressed={viewMode==="overview"}
            disabled={busy} className={viewMode==="overview"?"active":""}
            onClick={()=>setViewMode("overview")}>Grouped overview</button>
          <button type="button" aria-pressed={viewMode==="full"}
            disabled={busy} className={viewMode==="full"?"active":""}
            onClick={()=>{
              if(fullGeometry){setViewMode("full");return;}
              submit({kind:"full"},"Preparing every original node and line for GPU rendering…");
            }}>Full graph</button>
        </div>
        <button type="button" disabled={busy||viewMode==="full"||!expanded.length}
          onClick={()=>show(expanded.slice(0,-1))}>← Close last group</button>
        <button type="button" disabled={busy||(!expanded.length&&!inspection)}
          onClick={()=>show([],true)}>Whole network</button>
      </div>
    </div>
    <form className="whole-graph-find" onSubmit={search} role="search">
      <label htmlFor="whole-network-search">Find someone or something in this network</label>
      <div>
        <input id="whole-network-search" value={searchTerm}
          maxLength={200} onChange={event=>setSearchTerm(event.target.value)}
          placeholder="Search every organisation, person, grant, place…" />
        <button type="submit" disabled={busy||!searchTerm.trim()}>Find</button>
      </div>
    </form>
    {matches&&<section className="whole-graph-find-results" aria-label="Full network search results">
      <div className="whole-graph-results-header">
        <strong>{matches.total.toLocaleString("en-GB")} results across the entire network</strong>
        <button type="button" onClick={()=>setMatches(null)}>Close results</button>
      </div>
      {matches.total===0?<p>No matching entities. Try a different name or word.</p>:
      <div className="whole-graph-result-list">
        {matches.items.map(item=><button type="button" key={item.id}
          disabled={busy} onClick={()=>navigate(item.id)}>
          <strong>{item.label}</strong><small>{item.type}{item.region?" · "+item.region:""}</small>
          <span aria-hidden="true">→</span>
        </button>)}
      </div>}
      {matches.total>matches.items.length&&<p>Showing the first {matches.items.length}.
        Try a more specific search to narrow the results.</p>}
    </section>}
    {busy&&<p role="status" className="whole-graph-notice">{status}</p>}
    {error&&<p role="alert" className="whole-graph-error">{error}</p>}
    {notice&&<p role="status" className="whole-graph-notice">{notice}</p>}
    {projection&&<>
      <div className="whole-graph-coverage" aria-live="polite">
        <span><strong>{projection.representedNodes.toLocaleString("en-GB")}</strong> of
          {" "}{projection.totalNodes.toLocaleString("en-GB")} source entities accounted for
          {" "}(including those inside groups)</span>
        <span><strong>{projection.representedEdges.toLocaleString("en-GB")}</strong> of
          {" "}{projection.totalEdges.toLocaleString("en-GB")} source relationships accounted for
          {" "}(including grouped lines)</span>
        <span>{viewMode==="full"&&fullGeometry?
          fullGeometry.nodeCount.toLocaleString("en-GB")+" source nodes · "+
            fullGeometry.edgeCount.toLocaleString("en-GB")+" original relationships available":
          projection.visibleNodes+" summary nodes · "+projection.visibleEdges+" summary lines · "+
            projection.clusterCount+" groups"}</span>
      </div>
      {viewMode==="full"&&fullGeometry&&
        <div className="whole-graph-encoding-controls">
          <label htmlFor="whole-graph-arrangement">Arrange by</label>
          <select id="whole-graph-arrangement" value={arrangement} disabled={busy}
            onChange={event=>{
              const value=event.target.value as "areas"|"types"|"themes";
              setArrangement(value);setFocusAreaId(null);
              submit({kind:"layout",arrangement:value},
                "Rearranging the entire original network…");
            }}>
            <option value="areas">Network areas</option>
            <option value="types">Entity types</option>
            <option value="themes">Themes and cause areas</option>
          </select>
          <label htmlFor="whole-graph-size-mode">Node size</label>
          <select id="whole-graph-size-mode" value={nodeSizeMode}
            onChange={event=>setNodeSizeMode(event.target.value as "connections"|"amount")}>
            <option value="connections">Number of recorded links</option>
            {fullGeometry.amountCurrency&&fullGeometry.amountCount>0&&
              <option value="amount">Award amounts ({fullGeometry.amountCurrency})</option>}
          </select>
          <label htmlFor="whole-graph-line-mode">Connections</label>
          <select id="whole-graph-line-mode" value={lineMode}
            onChange={event=>setLineMode(event.target.value as "subtle"|"visible"|"focus")}>
            <option value="subtle">Subtle</option>
            <option value="visible">Show all</option>
            <option value="focus">On selection</option>
          </select>
          <div className="whole-graph-shape-key" aria-label="Node shapes">
            <span><i className="node-shape-key circle"/> Organisation</span>
            <span><i className="node-shape-key diamond"/> Funder</span>
            <span><i className="node-shape-key square"/> Project / grant</span>
          </div>
        </div>}
      {viewMode==="full"&&fullGeometry?
        fullRenderer==="canvas2d"?
        <FullNetworkCanvas2D geometry={fullGeometry} selectedId={inspection?.node.id}
          sizeMode={nodeSizeMode} lineMode={lineMode}
          focusAreaId={focusAreaId}
          selectedPreview={inspection?.node}
          selectedRelationships={inspection?.totalRelationships??0}
          onDetails={()=>inspectorRef.current?.scrollIntoView({
            behavior:"smooth",block:"start"})}
          onAreaSelect={id=>{
            setFocusAreaId(id);setInspection(null);setSelectedEdge(null);
            setNotice("");
          }}
          onSelect={id=>{
            if(id){setFocusAreaId(null);navigate(id);}
            else clearSelection();
          }}
          onUnavailable={()=>{
            setViewMode("overview");
            setError("Neither WebGL nor Canvas 2D is available in this browser. "+
              "All source records remain accessible via grouped navigation and search.");
          }}/>:
        <FullNetworkCanvas geometry={fullGeometry} selectedId={inspection?.node.id}
          sizeMode={nodeSizeMode} lineMode={lineMode}
          focusAreaId={focusAreaId}
          selectedPreview={inspection?.node}
          selectedRelationships={inspection?.totalRelationships??0}
          onDetails={()=>inspectorRef.current?.scrollIntoView({
            behavior:"smooth",block:"start"})}
          onAreaSelect={id=>{
            setFocusAreaId(id);setInspection(null);setSelectedEdge(null);
            setNotice("");
          }}
          onSelect={id=>{
            if(id){setFocusAreaId(null);navigate(id);}
            else clearSelection();
          }}
          onUnavailable={()=>{
            setFullRenderer("canvas2d");
            setNotice("Your browser could not start WebGL. "+
              "The complete original network is now displayed in Canvas 2D mode.");
          }}/>:
        <WholeGraphCanvas projection={projection}
          selectedId={selectedEdge?null:(inspection?.node.id??null)}
          selectedEdgeId={selectedEdge?.id??null}
          onPickNode={pickNode} onPickEdge={pickEdge}
          onClearSelection={clearSelection}/>}
      {viewMode==="full"&&fullGeometry&&
        <div className="whole-graph-areas-panel" aria-label="Explore source network areas">
          {fullGeometry.areas.length>0&&<p>
            <strong>{fullGeometry.areas.length} {arrangement==="themes"?
              "thematic areas":"visual network areas"}.</strong>
            {" "}{arrangement==="themes"?
              "Grouped using supplied themes, programme names and clearly marked possible topics; ambiguous records remain unclassified. Themes are not verified communities, and a grant with several themes is placed under one primary label only.":
              "Arranged around highly connected source entities or grouped by connectivity and entity type. These are navigation aids, not verified communities."}
          </p>}
          {arrangement==="themes"&&fullGeometry.areas.length>0&&
            <div className="whole-graph-theme-areas">
              {fullGeometry.areas.slice(0,14).map(area=>
                <button key={area.id} type="button"
                  className={focusAreaId===area.id?"active":""}
                  onClick={()=>{
                    setFocusAreaId(area.id);setInspection(null);setSelectedEdge(null);
                  }}>
                  <strong>{area.label}</strong>
                  <small>{area.count.toLocaleString("en-GB")} entities · focus area</small>
                </button>)}
            </div>}
          {fullGeometry.hubs.length>0&&<div className="whole-graph-hub-buttons">
            <span className="whole-graph-hub-heading">Explore key connectors</span>
            {fullGeometry.hubs.slice(0,6).map(hub=>
              <button type="button" key={hub.id} disabled={busy}
                onClick={()=>navigate(hub.id)} title={hub.type}>
                {hub.label}
                <small>{hub.connections.toLocaleString("en-GB")} links</small>
              </button>)}
          </div>}
          {fullGeometry.areas.length>0&&!fullGeometry.hubs.length&&
            <p>No recorded relationships link these entities.
              Areas are grouped for browsing by source entity type.</p>}
        </div>}
      {selectedFocus&&inspection&&<p className="whole-graph-focus-count" role="status">
        <strong>{inspection.node.label}</strong> · {selectedFocus.relationships} original
        {" "}{selectedFocus.relationships===1?"relationship":"relationships"} highlighted ·
        {" "}{selectedFocus.neighbours} directly connected
        {" "}{selectedFocus.neighbours===1?"entity":"entities"}.
        {selectedFocus.relationships===0&&" No recorded connections exist for this entity in the uploaded data."}
        {" "}Tap empty space to clear the focus.
      </p>}
      {viewMode==="full"&&fullGeometry&&
        <p className="whole-graph-full-caption" role="status">
          Shapes identify entity types; spatial areas are a visual arrangement,
          not confirmed associations. Node size uses a restrained logarithmic scale
          {nodeSizeMode==="amount"?
            " of recorded grant amounts in "+fullGeometry.amountCurrency+
            " (funder totals awarded, recipient totals received; only known amounts are counted).":
            " of recorded connections."}{" "}
          {nodeSizeMode==="connections"&&
            "An award amount is available as an alternative only for datasets with one known currency."}
        </p>}
      {viewMode==="full"&&fullGeometry&&
        <p className="whole-graph-full-caption" role="status">
          All {fullGeometry.nodeCount.toLocaleString("en-GB")} source entities and
          {" "}{fullGeometry.edgeCount.toLocaleString("en-GB")} original relationships
          remain in this complete network; {lineMode==="focus"?
            "lines appear when you select an entity":lineMode==="visible"?
            "all lines are shown":"lines are kept deliberately subtle"}.
          Zoom, pan, or use search to inspect the network.
        </p>}
      <details className="network-ai-disclosure"
        onToggle={event=>setAiOpen(event.currentTarget.open)}>
        <summary>Explore signals · Insights &amp; questions</summary>
        {aiOpen&&<NetworkAI datasetId={datasetId} graph={graph}
          onExplore={id=>navigate(id)}
          onViewThemes={()=>{
            if(busy)return;
            setArrangement("themes");setFocusAreaId(null);
            setViewMode("full");
            submit({kind:fullGeometry?"layout":"full",arrangement:"themes"},
              "Arranging the recorded network by source themes…");
          }}/>} 
      </details>
      <div className="whole-graph-bottom">
        <section className="whole-graph-groups">
          <h4>Explore the landscape</h4>
          <p>{viewMode==="full"?
            "Move from broad areas to individual records. Select an area to zoom, "+
            "then choose an entity to reveal source evidence. Zoom back out to "+
            "see the whole network.":
            "Select an exact-count group to expand it, or search for an entity."}</p>
          {viewMode==="full"?<p>The whole source graph is visible. Search any entity, or select a point to follow its real connections.</p>:
          projection.availableGroups.length?
            <div className="whole-graph-group-list">
              {projection.availableGroups.map(g=><button key={g.id} type="button"
                disabled={busy} onClick={()=>show([...expanded,g.id])}>
                <span>{g.label}</span><strong>{g.size.toLocaleString("en-GB")}</strong>
                <span aria-hidden="true">→</span>
              </button>)}
            </div>:
            <p>All entities here are individual source records.</p>}
        </section>
        <section ref={inspectorRef} className="whole-graph-inspector" aria-label="Entity and connection details">
          {selectedEdge?<div className="whole-graph-selected-edge">
            <div className="whole-graph-results-header"><h4>Relationship</h4>
              <button type="button" onClick={()=>setSelectedEdge(null)}>Close</button></div>
            <strong>{selectedEdge.properties?.mosslineAdaptiveSummary===true?
              "Grouped source relationships":selectedEdge.type}</strong>
            <p>{selectedEdge.description??"This is a recorded relationship in the source graph."}</p>
            {selectedEdge.properties?.mosslineAdaptiveSummary!==true&&<>
              {projection.graph.nodes.filter(n=>n.id===selectedEdge.source||
                n.id===selectedEdge.target).map(n=><button
                  className="whole-graph-related" type="button" key={n.id}
                  disabled={busy} onClick={()=>navigate(n.id)}>{n.label} →</button>)}
              {selectedEdge.sourceUrl&&<p><a href={selectedEdge.sourceUrl}
                target="_blank" rel="noopener noreferrer">Open source evidence ↗</a></p>}
            </>}
            {selectedEdge.properties?.mosslineAdaptiveSummary===true&&
              <p>Open one of the connected groups to inspect the actual relationships.</p>}
          </div>:
          inspection?<div className="whole-graph-entity">
            <div className="whole-graph-results-header">
              <p className="eyebrow">{inspection.node.type}</p>
              {history.length>0&&<button type="button" disabled={busy}
                onClick={()=>navigate(history[history.length-1],true)}>
                ← Back to previous</button>}
            </div>
            <h4>{inspection.node.label}</h4>
            <p>{inspection.node.description??"No description supplied in the source data."}</p>
            {inspection.node.sourceUrl&&<p><a href={inspection.node.sourceUrl}
              target="_blank" rel="noopener noreferrer">Open source record ↗</a></p>}
            {inspection.node.region&&<p>Region: {inspection.node.region}</p>}
            <p><strong>{inspection.totalRelationships.toLocaleString("en-GB")}</strong>
              {" "}recorded relationship records connecting to{" "}
              <strong>{inspection.distinctNeighbours.toLocaleString("en-GB")}</strong>
              {" "}distinct entities.</p>
            <form className="whole-graph-connection-find"
              onSubmit={e=>inspect(e)}>
              <label htmlFor="whole-connections-search">Find a connection</label>
              <div><input id="whole-connections-search" value={connectionQuery}
                onChange={e=>setConnectionQuery(e.target.value)}
                placeholder="Name, type or relationship…"/>
                <button type="submit" disabled={busy}>Filter</button></div>
            </form>
            <p className="whole-graph-connection-count">
              {inspection.matchingRelationships} matching connections
              {" "}· page {inspection.page} of {inspection.pages}</p>
            {inspection.connections.length?
              <div className="whole-graph-relationships">
                {inspection.connections.map(({edge,other})=>
                  <div className="whole-graph-relationship" key={edge.id}>
                    <button type="button" disabled={busy}
                      onClick={()=>navigate(other.id)}>
                      <strong>{other.label}</strong>
                      <small>{edge.source===inspection.node.id?"→":"←"} {edge.type}
                        {edge.inferred?" · inferred association":""}</small>
                    </button>
                    {edge.sourceUrl&&<a href={edge.sourceUrl} target="_blank"
                      rel="noopener noreferrer" title="Open source record">↗</a>}
                  </div>)}
              </div>:
              <p>No connections match this filter.</p>}
            {inspection.pages>1&&<div className="whole-graph-pagination">
              <button type="button" disabled={busy||inspection.page<=1}
                onClick={()=>inspect(undefined,inspection.page-1)}>← Previous</button>
              <button type="button" disabled={busy||inspection.page>=inspection.pages}
                onClick={()=>inspect(undefined,inspection.page+1)}>Next →</button>
            </div>}
          </div>:
          <div className="whole-graph-empty-inspector">
            <h4>Follow a connection</h4>
            <p>Select an entity in the network, or find one by name.
              Its real relationships appear here, including connections to
              entities still inside other groups.</p>
          </div>}
        </section>
      </div>
      <p className="funding-method-note">This overview represents all original records
        through expandable groups. Group nodes and dashed, count-weighted lines
        are visual summaries, not invented connections. Entity search and the
        connection inspector query the complete source network in a browser worker.
        Data stays local unless you explicitly approve a model request in Ask this network.</p>
    </>}
  </section>;
}
