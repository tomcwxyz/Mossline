"use client";
import {useEffect,useRef,useState} from "react";
import type {FundingFullAnalysis,FundingGraphQuery,FundingProjection,GraphDocument} from "@mossline/graph-core";

export function FundingDatasetExplorer({datasetId,analysis,onView}:{
  datasetId:string;analysis:FundingFullAnalysis;onView:(graph:GraphDocument)=>boolean;
}){
  const [theme,setTheme]=useState("");
  const [funder,setFunder]=useState("");
  const [region,setRegion]=useState("");
  const [search,setSearch]=useState("");
  const [busy,setBusy]=useState(false);
  const [stage,setStage]=useState("");
  const [error,setError]=useState("");
  const [result,setResult]=useState<{matches:number;displayed:number;page:number;pages:number}|null>(null);
  const [currentQuery,setCurrentQuery]=useState<FundingGraphQuery|null>(null);
  const worker=useRef<Worker|null>(null);
  const requestId=useRef(0);
  useEffect(()=>()=>{
    requestId.current++;worker.current?.terminate();worker.current=null;
  },[datasetId]);
  function run(query:FundingGraphQuery){
    if(busy)return;
    if(!worker.current){
      try{
        worker.current=new Worker(new URL("../workers/funding-explore.worker.ts",import.meta.url),
          {type:"module"});
      }catch{
        setError("This browser could not open the background dataset explorer.");
        return;
      }
    }
    const id=++requestId.current;
    setError("");setStage("Finding matching grants…");setBusy(true);
    worker.current.onmessage=(event:MessageEvent<{
      kind:"stage"|"result"|"failed";id:number;message?:string;projection?:FundingProjection;
    }>)=>{
      const msg=event.data;
      if(msg.id!==requestId.current)return;
      if(msg.kind==="stage"){setStage(msg.message??"Searching…");return;}
      setStage("");setBusy(false);
      if(msg.kind==="failed"){
        setError(msg.message??"Unable to query this dataset.");return;
      }
      const projected=msg.projection;
      if(!projected){setError("No network projection returned.");return;}
      setResult({matches:projected.matchingGrants,displayed:projected.displayedGrants,
        page:projected.page,pages:projected.pages});
      if(projected.matchingGrants===0){
        setError("No matching grants. Change the filters and try again.");return;
      }
      if(!onView(projected.graph)){
        setError("Could not save this focused network. Check available browser storage.");
        return;
      }
      setCurrentQuery(query);
    };
    worker.current.onerror=()=>{
      if(id!==requestId.current)return;
      setBusy(false);setStage("");
      setError("The dataset query failed in the background worker.");
      worker.current?.terminate();worker.current=null;
    };
    worker.current.postMessage({kind:"project",id,datasetId,query});
  }
  function explore(){run({theme,funderId:funder,region,search:search.trim(),page:1,pageSize:75});}
  function cancel(){
    requestId.current++;worker.current?.terminate();worker.current=null;
    setBusy(false);setStage("");setError("Search cancelled. Existing map kept.");
  }
  return <section className="funding-dataset-explorer" aria-label="Explore all grants in this funding dataset">
    <div className="funding-dataset-explorer-intro">
      <p className="eyebrow">Full-dataset explorer · locally stored</p>
      <h3>Choose which part of the funding network to see</h3>
      <p><strong>{analysis.grants.toLocaleString("en-GB")} grants</strong> are retained in this
        browser's dataset storage. Search the complete collection; Mossline only constructs
        the matching page on the canvas. No data is sent to a remote service.</p>
    </div>
    <div className="funding-dataset-controls">
      <label>Theme
        <select value={theme} onChange={e=>setTheme(e.target.value)}>
          <option value="">All themes</option>
          {analysis.themes.clusters.map(c=><option key={c.id} value={c.id}>
            {c.title} ({c.grantCount})</option>)}
        </select>
      </label>
      <label>Funder
        <select value={funder} onChange={e=>setFunder(e.target.value)}>
          <option value="">All funders</option>
          {analysis.allFunders?.map(f=><option key={f.id} value={f.id}>
            {f.name} ({f.grants})</option>)}
        </select>
      </label>
      <label>Recipient organisation region
        <select value={region} onChange={e=>setRegion(e.target.value)}>
          <option value="">All recipient regions</option>
          {analysis.recipientRegions.map(r=><option key={r.region} value={r.region}>
            {r.region} ({r.grants})</option>)}
        </select>
      </label>
      <label>Search across descriptions and organisation names
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="e.g. community food, literacy, youth…"/>
      </label>
    </div>
    <div className="funding-dataset-actions">
      <button type="button" className="button-primary" disabled={busy}
        onClick={explore}>Explore matching grants →</button>
      <button type="button" className="button-outline" disabled={busy}
        onClick={()=>{setTheme("");setFunder("");setRegion("");setSearch("");
          run({pageSize:75,page:1});}}>View across all funders</button>
      {busy&&<button type="button" className="button-outline"
        onClick={cancel}>Cancel query</button>}
    </div>
    {busy&&<p role="status" className="funding-dataset-status">{stage}</p>}
    {error&&<p role="status" className="funding-dataset-error">{error}</p>}
    {result&&<div className="funding-dataset-paging" aria-live="polite">
      <p><strong>{result.matches.toLocaleString("en-GB")} matching grants</strong> across
        the complete dataset · displaying {result.displayed} grants · page {result.page} of
        {" "}{result.pages}. Each page is an intentional network view, not a truncated analysis.</p>
      <button type="button" disabled={busy||!currentQuery||result.page<=1}
        onClick={()=>run({...currentQuery!,page:result.page-1})}>← Previous</button>
      <button type="button" disabled={busy||!currentQuery||result.page>=result.pages}
        onClick={()=>run({...currentQuery!,page:result.page+1})}>Next page →</button>
    </div>}
    <p className="funding-method-note">The original organisational awards remain
      available across pages, even when absent from the current canvas.
      Themes are source tags or phrase-based hypotheses, not verified connections.
      Data is stored in this browser (IndexedDB), not automatically synchronised
      to another device or published online.</p>
  </section>;
}
