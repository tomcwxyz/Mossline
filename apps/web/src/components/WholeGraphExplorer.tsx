"use client";

import {useEffect,useRef,useState,type FormEvent} from "react";
import type {AdaptiveGraphProjection,GraphDocument,GraphEdge,NetworkInspection,
  NetworkSearch} from "@mossline/graph-core";
import {WholeGraphCanvas} from "./WholeGraphCanvas";

type Reply={
  kind:"stage"|"result"|"failed";action?:"overview"|"search"|"select"|"inspect";
  id:number;message?:string;projection?:AdaptiveGraphProjection;
  inspection?:NetworkInspection;matches?:NetworkSearch;expandedIds?:string[];
  collapsedOtherGroups?:boolean;
};

/** All navigation, search and relationship detail use the canonical source
 * graph in one worker. Only the visual representation is grouped.
 */
export function WholeGraphExplorer({datasetId,graph}:{datasetId?:string;graph?:GraphDocument}){
  const worker=useRef<Worker|null>(null);
  const request=useRef(0);
  const pendingExpanded=useRef<string[]>([]);
  const pendingHistory=useRef<string[]>([]);
  const resetOnOverview=useRef(false);
  const [expanded,setExpanded]=useState<string[]>([]);
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

  useEffect(()=>{
    let instance:Worker|undefined;
    try{
      instance=new Worker(new URL("../workers/whole-graph.worker.ts",import.meta.url),
        {type:"module"});
      worker.current=instance;
      const id=++request.current;
      setBusy(true);setStatus("Preparing the complete network…");
      setProjection(null);setExpanded([]);setInspection(null);
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
        if(msg.action==="search"&&msg.matches){
          setMatches(msg.matches);
          return;
        }
        if(msg.action==="inspect"&&msg.inspection){
          setInspection(msg.inspection);
          return;
        }
        if(msg.projection){
          setProjection(msg.projection);
          if(msg.action==="overview"){
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
            setNotice(msg.collapsedOtherGroups?
              "Unrelated groups were collapsed to keep this area readable. "+
              "The complete network is still represented.":"");
          }
        }
      };
      instance.onerror=()=>{
        setBusy(false);setStatus("");
        setError("The complete-network worker stopped unexpectedly. Source data is unchanged.");
      };
      instance.postMessage({kind:"overview",id,datasetId,graph,expandedIds:[]});
    }catch{
      setBusy(false);setError("This browser could not open complete-network exploration.");
    }
    return ()=>{request.current++;instance?.terminate();worker.current=null;};
  },[datasetId,graph]);

  function submit(job:Record<string,unknown>,message:string){
    if(!worker.current||busy)return;
    setBusy(true);setStatus(message);setError("");
    worker.current.postMessage({...job,id:++request.current,datasetId});
  }
  function show(next:string[],reset=false){
    pendingExpanded.current=next;resetOnOverview.current=reset;
    submit({kind:"overview",expandedIds:next},"Updating the network without losing source records…");
  }
  function navigate(id:string,back=false){
    if(busy)return;
    pendingHistory.current=back?history.slice(0,-1):
      inspection&&inspection.node.id!==id?[...history,inspection.node.id]:history;
    submit({kind:"select",nodeId:id,expandedIds:expanded},
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
        <button type="button" disabled={busy||!expanded.length}
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
          {" "}{projection.totalNodes.toLocaleString("en-GB")} entities represented</span>
        <span><strong>{projection.representedEdges.toLocaleString("en-GB")}</strong> of
          {" "}{projection.totalEdges.toLocaleString("en-GB")} connections represented</span>
        <span>{projection.visibleNodes} drawn nodes · {projection.visibleEdges} drawn lines
          {" "}· {projection.clusterCount} groups</span>
      </div>
      <WholeGraphCanvas projection={projection}
        selectedId={inspection?.node.id??null} selectedEdgeId={selectedEdge?.id??null}
        onPickNode={pickNode} onPickEdge={pickEdge}/>
      <div className="whole-graph-bottom">
        <section className="whole-graph-groups">
          <h4>Explore the landscape</h4>
          <p>Each group represents the exact number of source entities shown.
            Select a group to expand it, or search to jump directly to an entity.</p>
          {projection.availableGroups.length?
            <div className="whole-graph-group-list">
              {projection.availableGroups.map(g=><button key={g.id} type="button"
                disabled={busy} onClick={()=>show([...expanded,g.id])}>
                <span>{g.label}</span><strong>{g.size.toLocaleString("en-GB")}</strong>
                <span aria-hidden="true">→</span>
              </button>)}
            </div>:
            <p>All entities here are individual source records.</p>}
        </section>
        <section className="whole-graph-inspector" aria-label="Entity and connection details">
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
        Nothing is uploaded to an external service.</p>
    </>}
  </section>;
}
