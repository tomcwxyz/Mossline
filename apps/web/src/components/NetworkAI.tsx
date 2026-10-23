"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import type {GraphDocument,SemanticHit,NetworkEvidenceRelation} from "@mossline/graph-core";

type Caps={embeddings:boolean;explanations:boolean;embeddingModel?:string|null;maxBatch?:number;accessCodeRequired?:boolean};
type Plan={total:number;eligible:number;excludedPrivate:number;batches:number;cached:boolean;model:string};
type Answer={hits:SemanticHit[];relations:NetworkEvidenceRelation[];answer:string;model:string};
type Reply={
 kind:"plan"|"progress"|"waiting"|"indexed"|"semantic"|"answer"|"failed";
 id:number;message?:string;total?:number;eligible?:number;excludedPrivate?:number;
 batches?:number;completed?:number;cached?:boolean;model?:string;
 hits?:SemanticHit[];relations?:NetworkEvidenceRelation[];answer?:string;
 insights?:NetworkInsight[];
};
export function NetworkAI({graph,datasetId,onExplore}:{
 graph?:GraphDocument;datasetId?:string;onExplore:(id:string)=>void;
}){
 const [caps,setCaps]=useState<Caps>({embeddings:false,explanations:false});
 const [plan,setPlan]=useState<Plan|null>(null);
 const [permission,setPermission]=useState(false),[key,setKey]=useState("");
 const [question,setQuestion]=useState("");
 const [sourceSignals,setSourceSignals]=useState<NetworkInsight[]>([]);
 const [semanticSignals,setSemanticSignals]=useState<NetworkInsight[]>([]);
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState("");
 const [error,setError]=useState(""),[answer,setAnswer]=useState<Answer|null>(null);
 const worker=useRef<Worker|null>(null),seq=useRef(0);
 const start=useRef(false);
 const [ready,setReady]=useState(false);
 const explore=useRef(onExplore);explore.current=onExplore;
 useEffect(()=>{
  let alive=true;
  void fetch("/api/discovery/status",{cache:"no-store"}).then(r=>r.json())
    .then(data=>{
      if(!alive)return;
      setCaps({embeddings:data.embeddings===true,
        explanations:data.explanations===true,
        embeddingModel:typeof data.embeddingModel==="string"?data.embeddingModel:null,
        maxBatch:48,accessCodeRequired:data.accessCodeRequired!==false});
    }).catch(()=>setError("Could not check the model service configuration."));
  return ()=>{alive=false;};
 },[]);
 useEffect(()=>{
  const instance=new Worker(new URL("../workers/network-ai.worker.ts",import.meta.url),
    {type:"module"});
  worker.current=instance;
  instance.onmessage=(event:MessageEvent<Reply>)=>{
    const msg=event.data;if(msg.id!==seq.current)return;
    if(msg.kind==="plan"){
      setPlan({total:msg.total??0,eligible:msg.eligible??0,
        excludedPrivate:msg.excludedPrivate??0,batches:msg.batches??0,
        cached:msg.cached===true,model:msg.model??""});
      setSourceSignals(msg.insights??[]);setSemanticSignals([]);
      setReady(msg.cached===true);setBusy(false);setProgress("");
    }else if(msg.kind==="waiting"){
      setProgress(msg.message??"Waiting for the model provider…");
    }else if(msg.kind==="semantic"){
      setSemanticSignals(msg.insights??[]);
    }else if(msg.kind==="progress"){
      setProgress((msg.completed??0).toLocaleString("en-GB")+" of "+
        (msg.total??0).toLocaleString("en-GB")+" descriptions indexed");
    }else if(msg.kind==="indexed"){
      setReady(true);setBusy(false);setProgress("Complete: all eligible entities indexed.");
      setPlan(p=>p?{...p,cached:true}:p);
    }else if(msg.kind==="answer"){
      setAnswer({hits:msg.hits??[],relations:msg.relations??[],
        answer:msg.answer??"",model:msg.model??""});
      setBusy(false);setProgress("");
    }else if(msg.kind==="failed"){
      setError(msg.message??"Network model request failed");
      setBusy(false);setProgress("");
    }
  };
  instance.onerror=(event)=>{
    setBusy(false);setError("Network AI worker could not start: "+(event.message||"unknown browser error")+". The source graph was not changed.");
  };
  if(worker.current===instance){
    const id=++seq.current;
    instance.postMessage({kind:"init",id,datasetId,graph,
      model:caps.embeddingModel??""});
  }
  return ()=>{instance.terminate();if(worker.current===instance)worker.current=null;};
 },[datasetId,graph,caps.embeddingModel]);
 function send(kind:"index"|"ask",questionText?:string){
  if(!permission||(caps.accessCodeRequired!==false&&key.length<32)||!worker.current){setError("Approve remote processing and enter the configured discovery access code before indexing.");return;}
  setBusy(true);setError("");setAnswer(null);
  setProgress(kind==="index"?"Checking cached batches and indexing the remaining records…":
    "Retrieving relevant source records…");
  worker.current.postMessage({kind,id:++seq.current,accessKey:key,
    ...(questionText?{question:questionText,withAnswer:caps.explanations}: {})});
 }
 function ask(e:FormEvent){e.preventDefault();if(!question.trim()||busy||!ready)return;
   send("ask",question.trim());}
 return <section className="network-ai-panel" aria-label="Ask and discover with network models">
  <h4>Discover this network</h4>
  <p>See promising signals already present in the source records, then explore
    possible thematic connections with AI. Suggested similarities are leads to
    investigate, not new relationships or evidence of partnership.</p>
  <p className="network-ai-capability">{!caps.embeddings?
    "AI connection is not configured. Recorded network exploration works without it.":
    "Embedding provider configured"+(caps.explanations?" · LLM explanations available":
      " · semantic retrieval only")}</p>
  {sourceSignals.length>0&&<section className="network-insights" aria-label="Signals worth exploring">
    <h5>Signals worth exploring</h5>
    <p>Calculated locally from recorded links, topics and regions. These are starting
      points for investigation, not conclusions generated by AI.</p>
    <div className="network-insight-grid">
      {sourceSignals.map(signal=><article className="network-insight" key={signal.id}>
        <small>{signal.kind==="recorded"?"Recorded relationships":
          signal.kind==="theme"?"Source tags":
          signal.kind==="geography"?"Recorded places":"Data coverage"}</small>
        <strong>{signal.title}</strong>
        <p>{signal.summary}</p>
        <div className="network-insight-actions">
          {signal.sourceIds.slice(0,2).map((id,i)=><button type="button" key={id}
            onClick={()=>explore.current(id)}>
            Explore {signal.sourceLabels?.[i]??"source "+(i+1)} →
          </button>)}
        </div>
      </article>)}
    </div>
  </section>}
  {semanticSignals.length>0&&<section className="network-insights" aria-label="AI-suggested signals">
    <h5>Possible thematic connections</h5>
    <p>Suggested from similar descriptions, not existing relationship edges. Review
      the source records before treating these as meaningful connections.</p>
    <div className="network-insight-grid">
      {semanticSignals.map(signal=><article className="network-insight" key={signal.id}>
        <small>Possible association · unverified</small>
        <strong>{signal.title}</strong>
        <p>{signal.summary}</p>
        <div className="network-insight-actions">
          {signal.sourceIds.map((id,i)=><button type="button" key={id}
            onClick={()=>explore.current(id)}>
            Inspect {signal.sourceLabels?.[i]??"source "+(i+1)} →
          </button>)}
        </div>
      </article>)}
    </div>
  </section>}
  {plan&&<p>{plan.eligible.toLocaleString("en-GB")} eligible source entities of{" "}
    {plan.total.toLocaleString("en-GB")} total; {plan.excludedPrivate} explicitly
    private records excluded. Indexing uses up to {plan.batches} batches of 48 texts. Large networks may
    take tens of minutes on a limited provider; successful batches resume from your browser cache. {plan.cached?"An index for this version of the data and model is saved in this browser.":
      "No complete cached semantic index yet."}</p>}
  {caps.embeddings&&plan&&<>
    <label className="network-ai-consent"><input type="checkbox"
      checked={permission} onChange={e=>setPermission(e.target.checked)}/>
      <span>I have permission to send these source descriptions and questions
        to the configured model provider. I understand this may incur usage charges,
        and text can contain sensitive details even when records are public.</span>
    </label>
    {caps.accessCodeRequired!==false&&<label className="network-ai-key">Discovery access code
      <input type="password" autoComplete="off" value={key}
        onChange={e=>setKey(e.target.value)}
        placeholder="Alpha access code (not saved in this browser)"/>
    </label>}
    {!ready&&<div className="network-ai-index-actions">
      <button type="button" disabled={busy||!permission||(caps.accessCodeRequired!==false&&key.length<32)||!plan.eligible}
        onClick={()=>send("index")}>Build insights index</button>
      {busy&&<button type="button" onClick={()=>{
        worker.current?.postMessage({kind:"cancel",id:++seq.current});
        setBusy(false);setProgress("Indexing cancelled. Finished batches remain cached.");
      }}>Cancel</button>}
    </div>}
    {ready&&<form className="network-ai-ask" onSubmit={ask}>
      <label htmlFor="network-ai-question">What would you like to understand?</label>
      <div>
        <input id="network-ai-question" maxLength={450} value={question}
          onChange={e=>setQuestion(e.target.value)}
          placeholder="Which projects address food insecurity in different ways?"/>
        <button type="submit" disabled={!permission||(caps.accessCodeRequired!==false&&key.length<32)||busy||
          question.trim().length<4}>Explore question →</button>
      </div>
    </form>}
  </>}
  {progress&&<p role="status">{progress}</p>}
  {error&&<p role="alert" className="whole-graph-error">{error}</p>}
  {answer&&<div className="network-ai-answer">
    {answer.answer&&<>
      <p className="eyebrow">Model-assisted interpretation · check against sources</p>
      <p className="network-ai-answer-text">{answer.answer}</p>
      <small>Generated by {answer.model}; limited to the retrieved source excerpts below.</small>
    </>}
    <h5>Retrieved source evidence</h5>
    <p>These are text-similarity rankings, not probabilities of partnership or
      confirmation of an edge. Select a source to inspect its recorded connections.</p>
    <div className="network-ai-hits">
      {answer.hits.map(item=><button type="button" key={item.id}
        onClick={()=>explore.current(item.id)}>
        <strong>{item.label}</strong><small>{item.type} · similarity {item.score.toFixed(3)}</small>
        <span>{item.text.slice(0,180)}{item.text.length>180?"…":""}</span>
      </button>)}
    </div>
    <p>{answer.relations.length} original relationship records found between
      these retrieved entities. Other links may exist elsewhere in the complete network.</p>
  </div>}
  <p className="funding-method-note">Source records stay in browser storage. Only explicitly
    approved text and questions are sent to the server-configured provider.
    Cached vectors remain in this browser. Answers cannot modify source relationships.
    Semantic coverage excludes records explicitly marked private.</p>
 </section>;
}
