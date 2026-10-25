"use client";

import {useEffect,useMemo,useState} from "react";
import {
  evidenceReceipt,findRecordedRoutes,isRecorded,
  type ConnectionTrail,type GraphDocument
} from "@mossline/graph-core";

type Props={
  graph:GraphDocument;fromId:string;
  onChoose:(nodeId:string)=>void;onClose:()=>void;
  /** The route currently shown, so the Network lens can draw it. */
  onRoute?:(route:ConnectionTrail|null)=>void;
};

/** A question-centred exploration tool; uses only recorded source edges.
 * No model, geocoder or inferred collaboration is ever involved.
 */
export function FollowConnection({graph,fromId,onChoose,onClose,onRoute}:Props){
  const [query,setQuery]=useState("");
  const [target,setTarget]=useState("");
  const [routes,setRoutes]=useState<ConnectionTrail[]>([]);
  const [routeIndex,setRouteIndex]=useState(0);
  const [searched,setSearched]=useState(false);
  const byId=useMemo(()=>new Map(graph.nodes.map(n=>[n.id,n])),[graph.nodes]);
  const edges=useMemo(()=>new Map(graph.edges.filter(isRecorded).map(e=>[e.id,e])),[graph.edges]);
  const from=byId.get(fromId);
  const choices=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase();
    if(q.length<2)return [];
    return graph.nodes.filter(n=>n.id!==fromId &&
      [n.label,n.description??"",...n.tags].some(t=>t.toLocaleLowerCase().includes(q)))
      .sort((a,b)=>a.label.localeCompare(b.label)).slice(0,12);
  },[graph.nodes,query,fromId]);
  const route=routes[routeIndex]??null;
  useEffect(()=>{onRoute?.(route);},[route,onRoute]);
  useEffect(()=>()=>onRoute?.(null),[onRoute]);
  function choose(id:string){
    setTarget(id);setQuery(byId.get(id)?.label??id);
    setRoutes([]);setSearched(false);setRouteIndex(0);
  }
  function follow(){
    if(!target||!from)return;
    setRoutes(findRecordedRoutes(graph,from.id,target,{maxHops:5,maxRoutes:3}));
    setSearched(true);setRouteIndex(0);
  }
  return <section className="ml-follow" aria-label="Follow a recorded connection">
    <div className="ml-follow-head">
      <div><p className="ml-eyebrow">A question for this network</p>
        <h2>How are these connected?</h2></div>
      <button type="button" onClick={onClose} aria-label="Close connection explorer">×</button>
    </div>
    <p>Follow actual source records, not inferred partnerships. We search up to five recorded steps.</p>
    <div className="ml-follow-route-form">
      <div><span>From</span><strong>{from?.label??"Select a record"}</strong></div>
      <label>To
        <input value={query} placeholder="Find another person, organisation, project…"
          onChange={event=>{
            setQuery(event.target.value);setTarget("");setRoutes([]);setSearched(false);
          }}/>
      </label>
      <button type="button" disabled={!target} onClick={follow}>Find recorded route →</button>
    </div>
    {query.trim().length>=2&&!target&&<div className="ml-follow-choices" role="group" aria-label="Matching destinations">
      {choices.length?choices.map(node=><button type="button" key={node.id}
        onClick={()=>choose(node.id)}><strong>{node.label}</strong><small>{node.type}</small></button>):
        <p>No matching record in this dataset.</p>}
      {choices.length===12&&<small>Showing the first 12. Add more words to narrow your search.</small>}
    </div>}
    {searched&&routes.length===0&&<p role="status" className="ml-route-none">
      No recorded route within five steps. This does not mean the records are unconnected
      outside this dataset or beyond five steps.
    </p>}
    {route&&<section className="ml-route-result" aria-label="Documented route">
      <div className="ml-route-nav"><strong>{routes.length===1?"Recorded route":"Recorded route "+(routeIndex+1)+" of "+routes.length}</strong>
        {routes.length>1&&<div>
          <button type="button" disabled={routeIndex===0}
            onClick={()=>setRouteIndex(i=>i-1)}>← Previous</button>
          <button type="button" disabled={routeIndex===routes.length-1}
            onClick={()=>setRouteIndex(i=>i+1)}>Next →</button>
        </div>}</div>
      <p>{route.steps.length} source-recorded {route.steps.length===1?"step":"steps"} connect
        {" "}{from?.label} and {byId.get(target)?.label} in this dataset.
        Following a shared funder or project is not proof of a partnership.</p>
      <ol className="ml-route-steps">
        {route.steps.map((step,i)=>{
          const e=edges.get(step.edgeId);
          return <li key={step.edgeId+"-"+i}>
            <button type="button" onClick={()=>onChoose(step.fromId)}>
              {byId.get(step.fromId)?.label??step.fromId}</button>
            <span className="ml-route-relation">{step.forward?"→":"←"} {step.relation}</span>
            <button type="button" onClick={()=>onChoose(step.toId)}>
              {byId.get(step.toId)?.label??step.toId}</button>
            <small>{e?evidenceReceipt(e):"Source record unavailable"}
              {e?.sourceUrl&&<> · <a href={e.sourceUrl} target="_blank"
                rel="noreferrer">Inspect record ↗</a></>}</small>
          </li>;
        })}</ol>
      <p className="ml-route-disclaimer">Records are shown as supplied; Mossline has not independently
        verified their claims. Arrows preserve the direction stored in the source.
        Routes are bounded and alternatives are not exhaustive.</p>
    </section>}
  </section>;
}
