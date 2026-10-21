"use client";
import {useEffect,useMemo,useRef,useState,type ChangeEvent} from "react";
import {DiscoverConnections} from "./DiscoverConnections";
import {FundingClusters} from "./FundingClusters";
import {FundingDatasetExplorer} from "./FundingDatasetExplorer";
import {WholeGraphExplorer} from "./WholeGraphExplorer";
import {analyseFundingLandscape,graphFingerprint,
  type FundingImport,type FundingMapping,type FundingFullAnalysis,type GraphDocument,type ImportFile} from "@mossline/graph-core";

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
  onCreate:(graph:GraphDocument,analysis:FundingFullAnalysis,datasetId:string)=>boolean;onClose:()=>void;
}){
  const [file,setFile]=useState<ImportFile|null>(null);
  const [mapping,setMapping]=useState<FundingMapping|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [stage,setStage]=useState("");
  const [dirty,setDirty]=useState(false);
  const [reviewed,setReviewed]=useState(false);
  const [parsed,setParsed]=useState<Pick<FundingImport,"graph"|"issues"|"counts">|null>(null);
  const [fullAnalysis,setFullAnalysis]=useState<FundingFullAnalysis|null>(null);
  const [headings,setHeadings]=useState<string[]>([]);
  const [examples,setExamples]=useState<{title:string;funder:string;recipient:string}[]>([]);
  const workerRef=useRef<Worker|null>(null);
  const requestRef=useRef(0);
  const saveRef=useRef<{id:number;resolve:(datasetId:string)=>void;reject:(error:Error)=>void}|null>(null);
  useEffect(()=>()=>{
    if(saveRef.current)saveRef.current.reject(Error("Import cancelled"));
    saveRef.current=null;
    workerRef.current?.terminate();requestRef.current++;
  },[]);
  const columns=mapping?Object.values(mapping):[];
  const allOptions=[...new Set([...headings,...columns])].filter(Boolean);

  function analyse(next:ImportFile,override?:FundingMapping,newSource=false){
    if(newSource){workerRef.current?.terminate();workerRef.current=null;}
    const needsFile=!workerRef.current;
    if(!workerRef.current){
      try{
        workerRef.current=new Worker(
          new URL("../workers/funding-import.worker.ts",import.meta.url),
          {type:"module"}
        );
      }catch{
        setError("Background CSV processing is not available in this browser.");
        setBusy(false);return;
      }
    }
    const worker=workerRef.current;
    const id=++requestRef.current;
    setBusy(true);setStage("Preparing grant data in the background…");
    setError("");setReviewed(false);setDirty(false);setParsed(null);
    setFullAnalysis(null);
    worker.onmessage=(event:MessageEvent<{
      kind:"stage"|"result"|"failed"|"persisted";id:number;message?:string;datasetId?:string;
      headings?:string[];mapping?:FundingMapping;
      graph?:GraphDocument|null;fullAnalysis?:FundingFullAnalysis|null;
      issues?:FundingImport["issues"];counts?:FundingImport["counts"];
      examples?:{title:string;funder:string;recipient:string}[];
    }>)=>{
      const reply=event.data;
      if(reply.id!==requestRef.current)return;
      if(reply.kind==="stage"){setStage(reply.message??"Analysing…");return;}
      if(reply.kind==="persisted"&&saveRef.current?.id===reply.id){
        saveRef.current.resolve(reply.datasetId??"");saveRef.current=null;return;
      }
      if(reply.kind==="failed"&&saveRef.current?.id===reply.id){
        saveRef.current.reject(Error(reply.message??"Could not save the dataset."));
        saveRef.current=null;return;
      }
      setBusy(false);setStage("");
      if(reply.kind==="failed"){
        setError(reply.message??"Could not analyse this spreadsheet.");return;
      }
      setMapping(reply.mapping??null);setHeadings(reply.headings??[]);
      setParsed(reply.counts&&reply.issues?{
        graph:reply.graph??null,issues:reply.issues,counts:reply.counts
      }:null);
      setFullAnalysis(reply.fullAnalysis??null);
      setExamples(reply.examples??[]);
    };
    worker.onerror=()=>{
      if(workerRef.current!==worker)return;
      saveRef.current?.reject(Error("Dataset worker failed."));
      saveRef.current=null;
      setBusy(false);setStage("");
      setError("The background CSV analysis failed. Try a smaller file or another browser.");
      worker.terminate();workerRef.current=null;
    };
    worker.postMessage({kind:"analyse",id,
      ...(needsFile?{file:next}:{}),
      ...(override?{mapping:override}:{})
    });
  }
  function useFile(next:ImportFile){
    setFile(next);setMapping(null);setHeadings([]);setExamples([]);
    setParsed(null);setFullAnalysis(null);setDirty(false);
    analyse(next,undefined,true);
  }
  async function loadFile(event:ChangeEvent<HTMLInputElement>){
    const uploaded=event.target.files?.[0];event.target.value="";
    if(!uploaded)return;
    if(uploaded.size>60_000_000){
      setError("Choose a CSV smaller than 60 MB for this local browser import. Larger datasets need streamed import.");
      return;
    }
    setBusy(true);setStage("Reading your file…");setError("");
    try{useFile({name:uploaded.name,text:await uploaded.text()});}
    catch{setBusy(false);setStage("");setError("Unable to read the file.");}
  }
  async function sample(){
    setBusy(true);setStage("Loading the fictional example…");setError("");
    try{
      const response=await fetch("/funding-landscape-example.csv",{cache:"no-store"});
      if(!response.ok)throw Error("The example could not be loaded");
      useFile({name:"Fictional funding landscape.csv",text:await response.text()});
    }catch(err){
      setBusy(false);setStage("");
      setError(err instanceof Error?err.message:"Could not load the example");
    }
  }
  function reviseMapping(field:keyof FundingMapping,value:string){
    if(!mapping)return;
    setMapping({...mapping,[field]:value});
    setDirty(true);setReviewed(false);
  }
  function cancel(){
    saveRef.current?.reject(Error("Analysis cancelled"));
    saveRef.current=null;
    requestRef.current++;workerRef.current?.terminate();
    workerRef.current=null;setBusy(false);setStage("");
    setError("Analysis cancelled. Your source CSV has not been saved.");
  }
  async function create(){
    if(!parsed?.graph||!fullAnalysis||!workerRef.current||busy||dirty||
      parsed.issues.some(i=>i.severity==="error")||!reviewed)return;
    const id=++requestRef.current;
    setBusy(true);setStage("Saving the complete dataset for future exploration…");setError("");
    try{
      const datasetId=await new Promise<string>((resolve,reject)=>{
        saveRef.current={id,resolve,reject};
        workerRef.current!.postMessage({kind:"persist",id});
      });
      if(!datasetId)throw Error("Dataset storage did not return an identifier.");
      if(onCreate(parsed.graph,fullAnalysis,datasetId))onClose();
      else setError("The local map library could not save this view. The data is still in IndexedDB; check browser storage.");
    }catch(error){
      setError(error instanceof Error?error.message:"Could not persist the complete funding dataset.");
    }finally{setBusy(false);setStage("");}
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
    {busy&&<div className="funding-csv-coverage" role="status" aria-live="polite">
      <strong>{stage}</strong>
      <p>The page remains usable while the CSV is analysed in a background worker.</p>
      <button type="button" className="button-outline" onClick={cancel}>Cancel analysis</button>
    </div>}
    {file&&mapping&&<div className="funding-file-mapping">
      <h3>{file.name}</h3>
      <div className="funding-mapping-essential">
        {FIELDS.slice(0,2).map(([field,label])=><label key={field}>
          {label} (required)
          <select value={mapping[field]} disabled={busy}
            onChange={e=>reviseMapping(field,e.target.value)}>
            <option value="">Choose a column…</option>
            {allOptions.map(h=><option key={h} value={h}>{h}</option>)}
          </select>
        </label>)}
      </div>
      <details className="funding-advanced">
        <summary>Review other detected grant fields</summary>
        <div className="funding-field-grid">{FIELDS.slice(2).map(([field,label])=>
          <label key={field}>{label}
            <select value={mapping[field]} disabled={busy}
              onChange={e=>reviseMapping(field,e.target.value)}>
              <option value="">Not provided</option>
              {allOptions.map(h=><option key={h} value={h}>{h}</option>)}
            </select>
          </label>)}</div>
      </details>
      {dirty&&<div className="funding-csv-coverage" role="status">
        Column mappings changed. Reanalyse to refresh the preview before creating a map.
        <button className="button-primary" type="button" disabled={busy}
          onClick={()=>analyse(file,mapping)}>Apply mapping and reanalyse</button>
      </div>}
    </div>}
    {file&&mapping&&parsed&&!dirty&&!busy&&<>
      <div className="funding-preview-stats">
        <div><strong>{fullAnalysis?.grants??0}</strong><span>Unique grants analysed (full data)</span></div>
        <div><strong>{fullAnalysis?.funders??0}</strong><span>Funders (full data)</span></div>
        <div><strong>{fullAnalysis?.recipients??0}</strong><span>Recipients (full data)</span></div>
        <div><strong>{parsed.counts.importedGrants}</strong><span>Grants in network view</span></div>
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
            The selection balances funders for network exploration; it is not a
            statistically representative sample. <strong>All {fullAnalysis?.grants??0}
            {" "}unique eligible organisation awards are nevertheless analysed</strong>
            {" "}in the full funding totals and theme clusters. Filter the CSV
            for more detailed mapping.</p>}
        </div>}
      {examples.length>0&&<div className="funding-import-review">
        <strong>Example recorded relationships</strong>
        <ul>{examples.map((item,i)=><li key={i}>
          {item.funder} → <em>{item.title}</em> → {item.recipient}
        </li>)}</ul>
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
      <button type="button" className="button-primary" disabled={!reviewed||!parsed.graph||busy||dirty||
        parsed.issues.some(i=>i.severity==="error")} onClick={()=>void create()}>
        Create funding landscape →
      </button>
    </>}
    {error&&<div role="alert" className="funding-error">
      <p>{error}</p>
      {file&&!busy&&<button className="button-outline" type="button"
        onClick={()=>analyse(file,mapping??undefined,true)}>Retry analysis</button>}
    </div>}
  </section>;
}

export function FundingInsights({graph,fullAnalysis,datasetId,onViewProjection,onExplore,showWholeGraph=true}:{
  graph:GraphDocument;fullAnalysis?:FundingFullAnalysis;
  datasetId?:string;showWholeGraph?:boolean;onViewProjection?:(graph:GraphDocument)=>boolean;
  onExplore:(id:string)=>void;
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
      <div><strong>{fullAnalysis?.grants??facts.awardCount}</strong><span>Unique grants analysed</span></div>
      <div><strong>{fullAnalysis?.funders??facts.funderCount}</strong><span>Funders</span></div>
      <div><strong>{fullAnalysis?.recipients??facts.recipientCount}</strong><span>Recipients</span></div>
      <div><strong>{fullAnalysis?.multiFundedCount??facts.multiFunded.length}</strong><span>Recipients supported by multiple funders</span></div>
    </div>
    {facts.amounts.length>0&&<p className="funding-amounts">
      Recorded award totals (not spending, adjusted for inflation or proven impact):
      {" "}{(fullAnalysis?.amounts??facts.amounts.map(x=>({currency:x.currency,total:x.total,knownAmounts:x.count}))).map(({currency,total,knownAmounts})=>{
        try{return formatAmount(total,currency)+" across "+knownAmounts+" awards";}
        catch{return currency+" "+total+" across "+knownAmounts+" awards";}
      }).join(" · ")}
    </p>}
    {fullAnalysis&&fullAnalysis.grants>facts.awardCount&&
      <p className="funding-cluster-caveat">
        Full-data funding figures above cover {fullAnalysis.grants} unique eligible grants.
        The network visualisation below and the pairwise comparison list show
        a funder-balanced selection of {facts.awardCount} grants.
        They are for exploration and are not representative of the whole dataset.
      </p>}
    {fullAnalysis&&<details className="funding-full-overview">
      <summary>Explore funders, repeated recipients and locations across all {fullAnalysis.grants} grants</summary>
      <div className="funding-full-overview-grid">
        <section><h3>Leading funders by recorded grants</h3>
          <ol>{fullAnalysis.leadingFunders.slice(0,12).map(f=>
            <li key={f.id}><strong>{f.name}</strong>
              <span>{f.grants} grants · {f.recipients} recipients</span></li>)}</ol>
        </section>
        <section><h3>Recipients appearing across several funders</h3>
          <ol>{fullAnalysis.sharedRecipients.slice(0,12).map(r=>
            <li key={r.id}><strong>{r.name}</strong>
              <span>{r.funders} funders · {r.grants} grants</span></li>)}</ol>
          {!fullAnalysis.sharedRecipients.length&&<p>No repeated recipients in these records.</p>}
        </section>
      </div>
      <p className="funding-method-note">Source geography here is the
        <strong> recipient organisation's region</strong>, not proof that the
        funding was spent in that region or that its beneficiaries live there.</p>
      <div className="funding-regions">{fullAnalysis.recipientRegions.slice(0,12).map(r=>
        <span key={r.region}>{r.region}: {r.grants} grants</span>)}</div>
    </details>}
    <div className="funding-insight-columns">
      <div className="funding-insight-column">
        <h3>Shared recipients {fullAnalysis?.grants!==facts.awardCount?"· network selection":""}</h3>
        <p>Organisations recorded as receiving awards from more than one funder
          {fullAnalysis?.grants!==facts.awardCount?" in the selected network view":""}.</p>
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
    {fullAnalysis&&datasetId&&<>
      {showWholeGraph&&<WholeGraphExplorer datasetId={datasetId}/>}
      {onViewProjection&&<details className="funding-detail-pages">
        <summary>Advanced: open an individual grant page in the older detailed canvas</summary>
        <p>The whole-network view above represents every record. This optional legacy
          detail tool opens smaller selections in the main studio for editing and
          close-up inspection; it does not determine what belongs in the network.</p>
        <FundingDatasetExplorer datasetId={datasetId} analysis={fullAnalysis}
          onView={onViewProjection}/>
      </details>}
    </>}
    {fullAnalysis&&!datasetId&&fullAnalysis.grants>facts.awardCount&&
      <p className="funding-cluster-caveat">This map was saved before complete-dataset storage was available.
        Reimport the CSV to make every grant searchable and navigable without repeated uploads.</p>}
    <FundingClusters graph={graph} fullAnalysis={fullAnalysis} onExplore={onExplore}/>
    <DiscoverConnections key={graphFingerprint(graph)}
      graph={graph} onExplore={onExplore}/>
    <p className="funding-method-note">Method: recorded source grant links; shared tags where supplied;
      phrase-rule theme clusters and local keyword overlaps.
      Optional AI analysis can be enabled separately; neither embeddings nor an LLM
      makes any recorded graph links.
      Scores are ranking aids, not probabilities, evidence of need, or impact assessments.</p>
  </section>;
}
