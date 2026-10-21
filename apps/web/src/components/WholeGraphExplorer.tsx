"use client";
import {useEffect,useRef,useState} from "react";
import type {AdaptiveGraphProjection,GraphDocument,GraphEdge,GraphNode} from "@mossline/graph-core";
import {WholeGraphCanvas} from "./WholeGraphCanvas";

/** Whole-network navigation never mutates the imported graph, and does not use
 * pages or representative grant samples. View complexity is managed by grouping.
 */
export function WholeGraphExplorer({datasetId,graph}:{datasetId?:string;graph?:GraphDocument}){
  const worker=useRef<Worker|null>(null);
  const request=useRef(0);
  const [expanded,setExpanded]=useState<string[]>([]);
  const [projection,setProjection]=useState<AdaptiveGraphProjection|null>(null);
  const [selected,setSelected]=useState<GraphNode|GraphEdge|null>(null);
  const [busy,setBusy]=useState(false),[status,setStatus]=useState("");
  const [error,setError]=useState("");
  const pending=useRef<string[]>([]);
  useEffect(()=>{
    let instance:Worker|undefined;
    try{
      instance=new Worker(new URL("../workers/whole-graph.worker.ts",import.meta.url),
        {type:"module"});
      worker.current=instance;
      const id=++request.current;
      setBusy(true);setStatus("Preparing complete network…");
      setProjection(null);setExpanded([]);setSelected(null);
      instance.onmessage=(event:MessageEvent<{
        kind:"stage"|"result"|"failed";id:number;message?:string;
        projection?:AdaptiveGraphProjection;
      }>)=>{
        const msg=event.data;if(msg.id!==request.current)return;
        if(msg.kind==="stage"){setStatus(msg.message??"Preparing network…");return;}
        setBusy(false);setStatus("");
        if(msg.kind==="failed"){
          setError(msg.message??"Could not build the whole-network view.");return;
        }
        if(!msg.projection){setError("Network projection was unavailable.");return;}
        setProjection(msg.projection);setExpanded(pending.current);
        setSelected(null);setError("");
      };
      instance.onerror=()=>{setBusy(false);setStatus("");
        setError("The whole-network worker failed. Source data was not changed.");};
      instance.postMessage({kind:"overview",id,datasetId,graph,expandedIds:[]});
    }catch{
      setBusy(false);setError("This browser could not open whole-network exploration.");
    }
    return ()=>{request.current++;instance?.terminate();worker.current=null;};
  },[datasetId,graph]);
  function show(next:string[]){
    if(!worker.current||busy)return;
    pending.current=next;
    const id=++request.current;
    setBusy(true);setStatus("Revealing more of the complete graph…");setError("");
    worker.current.postMessage({kind:"overview",id,datasetId,expandedIds:next});
  }
  function pickNode(id:string){
    if(!projection)return;
    const node=projection.graph.nodes.find(n=>n.id===id);
    if(!node)return;
    if(node.properties?.mosslineAdaptiveCluster===true){show([...expanded,id]);return;}
    setSelected(node);
  }
  function pickEdge(id:string){
    if(!projection)return;
    setSelected(projection.graph.edges.find(e=>e.id===id)??null);
  }
  return <section className="whole-graph-explorer" aria-label="Explore the complete funding network">
    <div className="whole-graph-heading">
      <div>
        <p className="eyebrow">Whole-network exploration · adaptive level of detail</p>
        <h3>The whole network, without the hairball</h3>
        <p>Every entity and relationship in this network is represented. Groups and thicker
          summary lines show where activity is concentrated; select a group to
          reveal its members and original connections. The graph itself is unchanged.</p>
      </div>
      <div className="whole-graph-actions">
        <button type="button" disabled={busy||!expanded.length}
          onClick={()=>show(expanded.slice(0,-1))}>← Back one level</button>
        <button type="button" disabled={busy||!expanded.length}
          onClick={()=>show([])}>Whole network</button>
      </div>
    </div>
    {busy&&<p role="status" className="whole-graph-notice">{status}</p>}
    {error&&<p role="alert" className="whole-graph-error">{error}</p>}
    {projection&&<>
      <div className="whole-graph-coverage" aria-live="polite">
        <span><strong>{projection.representedNodes.toLocaleString("en-GB")}</strong> of
          {" "}{projection.totalNodes.toLocaleString("en-GB")} entities represented</span>
        <span><strong>{projection.representedEdges.toLocaleString("en-GB")}</strong> of
          {" "}{projection.totalEdges.toLocaleString("en-GB")} connections represented</span>
        <span>{projection.visibleNodes} drawn nodes · {projection.visibleEdges} drawn links
          {" "}· {projection.clusterCount} expandable groups</span>
      </div>
      <WholeGraphCanvas projection={projection} onPickNode={pickNode}
        onPickEdge={pickEdge}/>
      <div className="whole-graph-bottom">
        <section className="whole-graph-groups">
          <h4>Explore a group</h4>
          <p>Open a group to see a more detailed network. Every source record remains
            reachable; none is omitted because it fell outside a page.</p>
          {projection.availableGroups.length?
            <div className="whole-graph-group-list">
              {projection.availableGroups.map(g=><button key={g.id} type="button"
                disabled={busy} onClick={()=>show([...expanded,g.id])}>
                <span>{g.label}</span><strong>{g.size.toLocaleString("en-GB")}</strong>
                <span aria-hidden="true">→</span>
              </button>)}
            </div>:
            <p>All entities in this view are individual source records.</p>}
        </section>
        <section className="whole-graph-inspector" aria-label="Selected network item">
          <h4>Inspect</h4>
          {!selected&&<p>Select an individual entity or line in the network to
            inspect it. Grouped lines represent counts, not invented relationships.</p>}
          {selected&&("label" in selected?
            <>
              <strong>{selected.label}</strong>
              <p>{selected.description??"No source description supplied."}</p>
              {selected.sourceUrl&&<a href={selected.sourceUrl} target="_blank"
                rel="noopener noreferrer">Open source record ↗</a>}
              {selected.properties?.mosslineInternalConnections&&
                <p>{String(selected.properties.mosslineInternalConnections)} connections
                  within this item.</p>}
            </>:
            <>
              <strong>{selected.properties?.mosslineAdaptiveSummary===true?
                "Grouped source connections":selected.type}</strong>
              <p>{selected.description??"An individual source relationship."}</p>
              {selected.sourceUrl&&<a href={selected.sourceUrl} target="_blank"
                rel="noopener noreferrer">Open relationship source ↗</a>}
            </>)}
        </section>
      </div>
      <p className="funding-method-note">Grouped nodes and dashed, count-weighted lines
        are presentation summaries, not new source relationships or inferred partnerships.
        Lines within a group are counted in that group. Expansion is limited by a
        responsiveness budget; collapse another group before opening an overly dense area.
        Source records stay in browser storage.</p>
    </>}
  </section>;
}
