"use client";
import {useMemo,useState,type ChangeEvent} from "react";
import {DiscoverConnections} from "./DiscoverConnections";
import {FundingClusters} from "./FundingClusters";
import {analyseFundingLandscape,graphFingerprint,importFundingCsv,parseCsv,suggestFundingMapping,
  type FundingMapping,type GraphDocument,type ImportFile} from "@mossline/graph-core";

const FIELDS:[keyof FundingMapping,string][]=[
 ["funder","Funder / awarding organisation"],["recipient","Recipient organisation"],
 ["grantId","Unique grant identifier"],["funderId","Funder identifier"],
 ["recipientId","Recipient identifier"],["title","Grant or project title"],
 ["description","What the grant funds"],["amount","Award amount"],
 ["currency","Currency"],["date","Award date"],["programme","Programme"],
 ["themes","Recorded themes / topics"],["region","Recipient region"],
 ["publicFlag","Public/private flag"]
];

export function FundingWorkbench({onCreate,onClose}:{
  onCreate:(graph:GraphDocument)=>boolean;onClose:()=>void;
}){
  const [file,setFile]=useState<ImportFile|null>(null);
  const [mapping,setMapping]=useState<FundingMapping|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [reviewed,setReviewed]=useState(false);
  const parsed=useMemo(()=>file?importFundingCsv(file,mapping??undefined):null,[file,mapping]);
  const headers=useMemo(()=>{
    if(!file)return [];
    try{return parseCsv(file.text)[0]??[];}catch{return [];}
  },[file]);
  const columns=mapping?Object.values(mapping):[];
  const allOptions=[...new Set([...headers,...columns])].filter(Boolean);

  function useFile(next:ImportFile){
    const headings=(()=>{try{return parseCsv(next.text)[0]??[];}catch{return [];}})();
    setFile(next);setMapping(suggestFundingMapping(headings));
    setError("");setReviewed(false);
  }
  async function loadFile(event:ChangeEvent<HTMLInputElement>){
    const uploaded=event.target.files?.[0];event.target.value="";
    if(!uploaded)return;
    if(uploaded.size>12_000_000){setError("Choose a CSV file smaller than 12 MB for now. Split larger exports into smaller datasets.");return;}
    try{useFile({name:uploaded.name,text:await uploaded.text()});}
    catch{setError("Unable to read the file.");}
  }
  async function sample(){
    setBusy(true);setError("");
    try{
      const response=await fetch("/funding-landscape-example.csv",{cache:"no-store"});
      if(!response.ok)throw Error("The example could not be loaded");
      useFile({name:"Fictional funding landscape.csv",text:await response.text()});
    }catch(err){setError(err instanceof Error?err.message:"Could not load the fictional example");}
    finally{setBusy(false);}
  }
  function create(){
    if(!parsed?.graph||parsed.issues.some(i=>i.severity==="error")||!reviewed)return;
    if(onCreate(parsed.graph))onClose();
    else setError("The map couldn't be saved. Export or remove a browser-local map first.");
  }
  return <section className="funding-workbench" aria-label="Create a funding landscape">
    <div className="funding-workbench-head">
      <div><p className="eyebrow">New mapping workflow · funding landscapes</p>
        <h2>Discover the funding landscape.</h2>
        <p>Who is funding whom? Where are funders supporting the same organisations?
          What themes might connect work across otherwise separate grants?</p>
      </div>
      <button type="button" className="button-outline" onClick={onClose}>Close</button>
    </div>
    <div className="funding-import-actions">
      <label>Upload a grant awards CSV
        <input type="file" accept=".csv,text/csv" onChange={loadFile}/>
      </label>
      <button type="button" className="button-outline" disabled={busy}
        onClick={sample}>{busy?"Loading…":"Try fictional funding landscape"}</button>
      <a href="/funding-landscape-example.csv" download="mossline-funding-example.csv">
        Download example CSV ↓</a>
    </div>
    <p className="help">Supports common grant exports and columns from 360Giving's grants CSV.
      Files are processed in your browser. No model or AI provider receives them.
      This version maps grants to <strong>funder → award → recipient</strong>,
      keeping every grant independently inspectable.</p>
    {file&&mapping&&parsed&&<>
      <h3>{file.name}</h3>
      <div className="funding-mapping-essential">
        {FIELDS.slice(0,2).map(([field,label])=><label key={field}>
          {label} (required)
          <select value={mapping[field]} onChange={e=>{
            setMapping({...mapping,[field]:e.target.value});setReviewed(false);
          }}>
            <option value="">Choose a column…</option>
            {allOptions.map(h=><option key={h} value={h}>{h}</option>)}
          </select>
        </label>)}
      </div>
      <details className="funding-advanced">
        <summary>Review other detected grant fields</summary>
        <div className="funding-field-grid">{FIELDS.slice(2).map(([field,label])=>
          <label key={field}>{label}
            <select value={mapping[field]} onChange={e=>{
              setMapping({...mapping,[field]:e.target.value});setReviewed(false);
            }}>
              <option value="">Not provided</option>
              {allOptions.map(h=><option key={h} value={h}>{h}</option>)}
            </select>
          </label>)}</div>
      </details>
      <div className="funding-preview-stats">
        <div><strong>{parsed.counts.importedGrants}</strong><span>Recorded grants</span></div>
        <div><strong>{parsed.counts.funders}</strong><span>Funders</span></div>
        <div><strong>{parsed.counts.recipients}</strong><span>Recipients</span></div>
        <div><strong>{parsed.counts.skipped}</strong><span>Excluded / not mapped</span></div>
      </div>
      {(parsed.counts.individualExcluded>0||parsed.counts.overflowExcluded>0)&&
        <div className="funding-csv-coverage" role="status">
          {parsed.counts.individualExcluded>0&&<p><strong>{parsed.counts.individualExcluded}
          {" "}individual-recipient awards excluded.</strong> No recipient names or personal
            grant details from these records are included in the map.</p>}
          {parsed.counts.overflowExcluded>0&&<p><strong>Large export:</strong>
            {" "}{parsed.counts.eligibleOrganisationRows} eligible organisational records were
            detected, but only {parsed.counts.importedGrants} are being mapped.
            {parsed.counts.overflowExcluded} remaining records are not represented.
            The selection balances funders to support exploration; it is neither
            a complete landscape nor a statistically representative sample.
            Filter the CSV to a programme, period or area for deeper analysis.</p>}
        </div>}
      {parsed.graph&&<div className="funding-import-review">
        <strong>Example recorded relationships</strong>
        <ul>{analyseFundingLandscape(parsed.graph).awards.slice(0,6).map(a=>{
          const names=new Map(parsed.graph!.nodes.map(n=>[n.id,n.label]));
          return <li key={a.grantId}>
            {names.get(a.funderId)} → <em>{a.title}</em> → {names.get(a.recipientId)}
          </li>;
        })}</ul>
      </div>}
      {parsed.issues.length>0&&<details className="funding-advanced">
        <summary>{parsed.issues.length} findings to review</summary>
        <ul>{parsed.issues.slice(0,40).map((issue,i)=>
          <li key={i}>{issue.severity}: {issue.message}</li>)}</ul>
      </details>}
      {parsed.graph&&<label className="funding-confirm">
        <input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>
        These are the funding records I want to map; excluded records and any
        uncertain identities have been reviewed.
      </label>}
      <button type="button" className="button-primary" disabled={!reviewed||!parsed.graph||
        parsed.issues.some(i=>i.severity==="error")} onClick={create}>
        Create funding landscape →
      </button>
    </>}
    {error&&<p role="alert" className="funding-error">{error}</p>}
  </section>;
}

export function FundingInsights({graph,onExplore}:{
  graph:GraphDocument;onExplore:(id:string)=>void;
}){
  const facts=useMemo(()=>analyseFundingLandscape(graph),[graph]);
  const [showAll,setShowAll]=useState(false);
  if(facts.awardCount===0)return null;
  const formatAmount=(amount:number,currency:string)=>new Intl.NumberFormat("en-GB",{
    style:"currency",currency,maximumFractionDigits:0}).format(amount);
  return <section className="funding-insights" aria-label="Explore funding landscape insights">
    <div className="funding-insights-head"><div>
      <p className="eyebrow">Funding landscape · recorded evidence + possible connections</p>
      <h2>Where does the funding connect?</h2>
      <p>This view separates known grant relationships from questions worth exploring.
        Potentially related themes are <strong>not</strong> assertions of collaboration.</p>
    </div></div>
    <div className="funding-preview-stats">
      <div><strong>{facts.awardCount}</strong><span>Grant records</span></div>
      <div><strong>{facts.funderCount}</strong><span>Funders</span></div>
      <div><strong>{facts.recipientCount}</strong><span>Recipients</span></div>
      <div><strong>{facts.multiFunded.length}</strong><span>Recipients supported by multiple funders</span></div>
    </div>
    {facts.amounts.length>0&&<p className="funding-amounts">
      Recorded award totals (not spending, adjusted for inflation or proven impact):
      {" "}{facts.amounts.map(({currency,total,count})=>{
        try{return formatAmount(total,currency)+" across "+count+" awards";}
        catch{return currency+" "+total+" across "+count+" awards";}
      }).join(" · ")}
    </p>}
    <div className="funding-insight-columns">
      <div className="funding-insight-column">
        <h3>Shared recipients</h3>
        <p>Organisations recorded as receiving awards from more than one funder.</p>
        {facts.multiFunded.length===0?<p className="funding-muted">No overlaps recorded in these grants.</p>:
          <ul>{facts.multiFunded.slice(0,8).map(item=><li key={item.id}>
            <button type="button" onClick={()=>onExplore(item.id)}>
              <strong>{item.name}</strong><small>Funded by {item.funders.join(" · ")}</small>
            </button></li>)}</ul>}
      </div>
      <div className="funding-insight-column">
        <h3>Possible thematic connections</h3>
        <p>Pairs of recipients with recorded shared themes, or related words in their
          award descriptions. Suggestions to investigate, not network links.</p>
        {facts.insights.length===0?<p className="funding-muted">
          Not enough shared themes or description detail to suggest connections yet.
          Adding grant descriptions or theme tags will help.
        </p>:<ul>{facts.insights.slice(0,showAll?16:6).map((item,i)=>
          <li className="funding-theme-suggestion" key={item.recipientA+"|"+item.recipientB}>
            <div><span className="funding-evidence-label">{item.kind==="recorded-themes"?
              "Shared source themes":item.kind==="topic-rule"?
              "Candidate · matching topic phrases":"Candidate · shared description words"}</span>
              {item.differentFunders&&<span className="funding-cross-funder">Across different funders</span>}
            </div>
            <div className="funding-theme-pair">
              <button type="button" onClick={()=>onExplore(item.recipientA)}>
                {facts.getName(item.recipientA)}</button>
              <span>↔</span>
              <button type="button" onClick={()=>onExplore(item.recipientB)}>
                {facts.getName(item.recipientB)}</button>
            </div>
            <p><strong>Overlap:</strong> {item.common.join(" · ")}</p>
            <details><summary>What in the records suggests this?</summary>
              <p><strong>{facts.getName(item.recipientA)}:</strong> {item.evidenceA}</p>
              <p><strong>{facts.getName(item.recipientB)}:</strong> {item.evidenceB}</p>
            </details>
          </li>)}</ul>}
        {facts.insights.length>6&&<button type="button" className="funding-more"
          onClick={()=>setShowAll(v=>!v)}>{showAll?"Show fewer":"Show all "+facts.insights.length+" suggestions"}</button>}
      </div>
    </div>
    <FundingClusters graph={graph} onExplore={onExplore}/>
    <DiscoverConnections key={graphFingerprint(graph)}
      graph={graph} onExplore={onExplore}/>
    <p className="funding-method-note">Method: recorded source grant links; shared tags where supplied;
      phrase-rule theme clusters and local keyword overlaps.
      Optional AI analysis can be enabled separately; neither embeddings nor an LLM
      makes any recorded graph links.
      Scores are ranking aids, not probabilities, evidence of need, or impact assessments.</p>
  </section>;
}
