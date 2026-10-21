"use client";

import {useEffect,useMemo,useState} from "react";
import {analyseFundingLandscape,graphFingerprint,prepareFundingDiscovery,
  rankSemanticSuggestions,reviewKey,type GraphDocument,type ReviewDecision,
  type SemanticSuggestion,type DiscoveryDocument} from "@mossline/graph-core";

type Row={id:string;recipientA:string;recipientB:string;
  grantA?:string;grantB?:string;excerptA:string;excerptB:string;
  kind:string;terms:string[];similarity?:number;model?:string;
  differentFunders:boolean};
type Capabilities={embeddings:boolean;explanations:boolean;provider:string;maxGrants:number};
const storageKey="mossline-reviewed-connection-candidates-v1";
const defaultCaps:Capabilities={embeddings:false,explanations:false,
  provider:"",maxGrants:48};

export function DiscoverConnections({graph,onExplore}:{
  graph:GraphDocument;onExplore:(id:string)=>void;
}){
  const graphId=useMemo(()=>graphFingerprint(graph),[graph]);
  const facts=useMemo(()=>analyseFundingLandscape(graph),[graph]);
  const docs=useMemo(()=>prepareFundingDiscovery(graph),[graph]);
  const docsById=useMemo(()=>new Map(docs.map(d=>[d.grantId,d])),[docs]);
  const [semantic,setSemantic]=useState<SemanticSuggestion[]>([]);
  const [caps,setCaps]=useState<Capabilities>(defaultCaps);
  const [allowTransmit,setAllowTransmit]=useState(false);
  const [accessKey,setAccessKey]=useState("");
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const [showDismissed,setShowDismissed]=useState(false);
  const [decisions,setDecisions]=useState<Record<string,ReviewDecision>>({});
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [explaining,setExplaining]=useState("");
  const [showMore,setShowMore]=useState(false);
  const [method,setMethod]=useState<"local"|"semantic">("local");
  useEffect(()=>{
    let alive=true;
    void fetch("/api/discovery/status",{cache:"no-store"}).then(r=>r.json()).then(
      data=>{if(alive)setCaps({
        embeddings:data.embeddings===true,explanations:data.explanations===true,
        provider:typeof data.provider==="string"?data.provider:"",
        maxGrants:typeof data.maxGrants==="number"?data.maxGrants:48
      });}
    ).catch(()=>{if(alive)setCaps(defaultCaps);});
    return ()=>{alive=false;};
  },[]);
  useEffect(()=>{
    try{
      const saved=JSON.parse(window.localStorage.getItem(storageKey)??"{}") as
        Record<string,Record<string,ReviewDecision>>;
      setDecisions(saved[graphId]??{});
    }catch{setDecisions({});}
  },[graphId]);
  // Imported source maps and auto-suggested network claims are never mutated by review actions.
  function decide(id:string,decision:ReviewDecision|null){
    setDecisions(previous=>{
      const next={...previous};
      if(decision)next[id]=decision;else delete next[id];
      try{
        const stored=JSON.parse(window.localStorage.getItem(storageKey)??"{}") as
          Record<string,Record<string,ReviewDecision>>;
        const keys=Object.keys(stored).slice(-14);
        const kept=Object.fromEntries(keys.map(k=>[k,stored[k]]));
        kept[graphId]=next;
        window.localStorage.setItem(storageKey,JSON.stringify(kept));
      }catch{setError("Review could not be saved in this browser. Export any shortlist you want to keep.");}
      return next;
    });
  }
  const localRows:Row[]=useMemo(()=>facts.insights.map(item=>({
    id:JSON.stringify([item.recipientA,item.recipientB].sort()),
    recipientA:item.recipientA,recipientB:item.recipientB,
    excerptA:item.evidenceA,excerptB:item.evidenceB,
    kind:item.kind,terms:item.common,
    differentFunders:item.differentFunders
  })),[facts]);
  const semanticRows:Row[]=useMemo(()=>semantic.map(s=>({
    id:s.id,recipientA:s.recipientA,recipientB:s.recipientB,
    grantA:s.grantA,grantB:s.grantB,excerptA:s.excerptA,excerptB:s.excerptB,
    kind:"embedding",terms:[],differentFunders:s.differentFunders,
    similarity:s.similarity,model:s.model
  })),[semantic]);
  const allRows=method==="semantic"?semanticRows:localRows;
  const visible=allRows.filter(r=>showDismissed||decisions[r.id]!=="dismissed").slice(
    0,showMore?25:8);
  const shortlisted=[...new Map([...localRows,...semanticRows]
    .filter(r=>decisions[r.id]==="interesting").map(r=>[r.id,r])).values()];
  const name=(id:string)=>facts.getName(id);
  async function findSemantic(){
    if(!allowTransmit||!caps.embeddings||accessKey.length<32||working)return;
    if(docs.length<2){setError("At least two grant descriptions are needed for this model.");return;}
    setWorking(true);setError("");setSemantic([]);setNotes({});
    try{
      const response=await fetch("/api/discovery/semantic",{
        method:"POST",headers:{"Content-Type":"application/json",
          Authorization:"Bearer "+accessKey},
        body:JSON.stringify({documents:docs.map(d=>({grantId:d.grantId,text:d.text}))}),
        cache:"no-store",credentials:"omit"
      });
      const data=await response.json() as {
        model?:string;grantIds?:string[];vectors?:number[][];error?:string
      };
      if(!response.ok||!data.model||!data.vectors||
        JSON.stringify(data.grantIds)!==JSON.stringify(docs.map(d=>d.grantId)))
        throw Error(data.error??"The model returned mismatched grant records.");
      const candidates=rankSemanticSuggestions(docs,data.vectors,data.model);
      setSemantic(candidates);setMethod("semantic");
      if(!candidates.length)setError(
        "No pairs passed the initial text-similarity threshold. This does not show that no connections exist.");
    }catch(e){setError(e instanceof Error?e.message:"Could not discover semantic connections.");}
    finally{setWorking(false);}
  }
  async function explain(row:Row){
    if(!caps.explanations||!allowTransmit||accessKey.length<32||!row.grantA||!row.grantB)return;
    const first=docsById.get(row.grantA),second=docsById.get(row.grantB);
    if(!first||!second)return;
    setExplaining(row.id);setError("");
    try{
      const response=await fetch("/api/discovery/explain",{
        method:"POST",headers:{"Content-Type":"application/json",
          Authorization:"Bearer "+accessKey},
        body:JSON.stringify({first:{grantId:first.grantId,text:first.text},
          second:{grantId:second.grantId,text:second.text}}),
        cache:"no-store",credentials:"omit"
      });
      const result=await response.json() as {explanation?:string;error?:string};
      if(!response.ok||!result.explanation)throw Error(result.error??"No explanation returned");
      setNotes(v=>({...v,[row.id]:result.explanation!}));
    }catch(e){setError(e instanceof Error?e.message:"The model couldn't explain this comparison.");}
    finally{setExplaining("");}
  }
  function exportShortlist(){
    const records=shortlisted.map(r=>({
      organisationA:name(r.recipientA),organisationB:name(r.recipientB),
      recipientA:r.recipientA,recipientB:r.recipientB,
      basis:r.kind,terms:r.terms,grantA:r.grantA,grantB:r.grantB,
      evidenceA:r.excerptA,evidenceB:r.excerptB,
      model:r.model??null,similarity:r.similarity??null,
      reviewerStatus:"worth exploring",explanation:notes[r.id]??null
    }));
    const blob=new Blob([JSON.stringify({
      format:"mossline-discovery-shortlist",version:1,mapTitle:graph.title,
      method:"reviewed candidate connections, NOT confirmed relationships",
      candidates:records
    },null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="mossline-discovery-shortlist.json";a.click();
    URL.revokeObjectURL(url);
  }
  if(!facts.awardCount)return null;
  return <section className="discovery-lab" aria-label="Discover and review possible funding connections">
    <div className="discovery-lab-title">
      <div><p className="eyebrow">Discovery lab · alpha 2</p>
        <h3>Connections worth exploring</h3>
        <p>Investigate patterns that might connect organisations. Review suggestions
          before treating them as meaningful; they are never inserted into the map as facts.</p></div>
      <span>{shortlisted.length} shortlisted</span>
    </div>
    <div className="discovery-lab-switches">
      <button type="button" aria-pressed={method==="local"}
        className={method==="local"?"chosen":""} onClick={()=>setMethod("local")}>
        Transparent local matching <small>{localRows.length} candidates</small>
      </button>
      <button type="button" aria-pressed={method==="semantic"}
        className={method==="semantic"?"chosen":""} disabled={!semantic.length}
        onClick={()=>setMethod("semantic")}>
        Embedding suggestions <small>{semanticRows.length} candidates</small>
      </button>
    </div>
    <details className="discovery-model-options">
      <summary>Optional AI-assisted discovery {caps.embeddings?"· available":"· not configured"}</summary>
      <p>Only grant title, description, programme and source themes are sent when you explicitly
        approve. No source record properties, amounts or contact details are transmitted.
        The provider may process the text under its own terms.</p>
      {caps.embeddings?<div className="discovery-model-form">
        <label className="discovery-confirm">
          <input type="checkbox" checked={allowTransmit}
            onChange={e=>setAllowTransmit(e.target.checked)}/>
          I have permission to send these {docs.length} grant summaries to the configured AI provider.
        </label>
        <label>Discovery access code
          <input type="password" autoComplete="off" value={accessKey}
            onChange={e=>setAccessKey(e.target.value)} placeholder="Private alpha access code"/>
        </label>
        <button type="button" disabled={!allowTransmit||accessKey.length<32||working||docs.length<2}
          onClick={()=>void findSemantic()}>
          {working?"Analysing grant descriptions…":"Find semantically related grants"}
        </button>
        <p>{docs.length} grant summaries selected (maximum {caps.maxGrants}).
          Access codes are held only in this tab, not saved in local storage.
          Results use a provisional similarity threshold, not a calibrated confidence score.</p>
      </div>:<p>The model-assisted service is off until an operator configures an embedding provider
        and access key. You can still review the local candidate connections below.</p>}
    </details>
    <div className="discovery-lab-toolbar">
      <label><input type="checkbox" checked={showDismissed}
        onChange={e=>setShowDismissed(e.target.checked)}/> Include dismissed</label>
      {shortlisted.length>0&&<button type="button" onClick={exportShortlist}>
        Export {shortlisted.length} shortlisted candidates ↓</button>}
    </div>
    {error&&<p className="discovery-lab-error" role="status">{error}</p>}
    {allRows.length===0?<p className="discovery-lab-empty">
      {method==="local"?"No matching evidence in this dataset. Add descriptive grant text or source themes.":
        "No semantic suggestions returned. Try another dataset or switch to local matching."}
    </p>:<div className="discovery-lab-results">
      {visible.map(row=><article className="discovery-candidate" key={row.id}>
        <div className="discovery-candidate-meta">
          <span>{row.kind==="recorded-themes"?"Shared source theme":
            row.kind==="topic-rule"?"Phrase-rule hypothesis":
            row.kind==="embedding"?"Embedding similarity":"Keyword hypothesis"}</span>
          {row.differentFunders&&<span>Different funders for the supporting grants</span>}
        </div>
        <div className="discovery-candidate-pair">
          <button type="button" onClick={()=>onExplore(row.recipientA)}>{name(row.recipientA)}</button>
          <span aria-hidden="true">↔</span>
          <button type="button" onClick={()=>onExplore(row.recipientB)}>{name(row.recipientB)}</button>
        </div>
        {row.terms.length>0&&<p><strong>Possible shared theme:</strong> {row.terms.join(" · ")}</p>}
        {row.similarity!==undefined&&<p>Text similarity: {row.similarity.toFixed(2)}
          {row.model?" · "+row.model:""} (not a probability or assessment of impact)</p>}
        <details className="discovery-candidate-evidence">
          <summary>Evidence from grants</summary>
          <p><strong>{name(row.recipientA)}:</strong> {row.excerptA}</p>
          <p><strong>{name(row.recipientB)}:</strong> {row.excerptB}</p>
        </details>
        {caps.explanations&&method==="semantic"&&row.grantA&&
          <button type="button" className="discovery-explain" disabled={!allowTransmit||
            accessKey.length<32||!!explaining}
            onClick={()=>void explain(row)}>
            {explaining===row.id?"Explaining…":"Ask the model to explain this possibility"}
          </button>}
        {notes[row.id]&&<blockquote className="discovery-model-explanation">
          <strong>AI-assisted interpretation · review against the two grants</strong>
          <p>{notes[row.id]}</p>
        </blockquote>}
        <div className="discovery-candidate-actions">
          <button type="button" className={decisions[row.id]==="interesting"?"selected":""}
            onClick={()=>decide(row.id,decisions[row.id]==="interesting"?null:"interesting")}>
            {decisions[row.id]==="interesting"?"✓ Worth exploring":"＋ Worth exploring"}
          </button>
          <button type="button" className={decisions[row.id]==="dismissed"?"selected":""}
            onClick={()=>decide(row.id,decisions[row.id]==="dismissed"?null:"dismissed")}>
            {decisions[row.id]==="dismissed"?"Restore":"Dismiss"}
          </button>
        </div>
      </article>)}
      {allRows.filter(r=>showDismissed||decisions[r.id]!=="dismissed").length>8&&
        <button type="button" onClick={()=>setShowMore(v=>!v)}
          className="discovery-lab-more">{showMore?"Show fewer":"Show more candidates"}</button>}
    </div>}
    <p className="discovery-lab-footnote">
      Reviews are stored in this browser, scoped to this version of your network;
      exported shortlists contain grant excerpts. Nothing is added to recorded relationships.
      Shared wording and model similarity can reflect generic grant language, not meaningful common purpose.
    </p>
  </section>;
}
