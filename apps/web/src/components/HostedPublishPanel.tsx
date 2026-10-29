"use client";

import {useEffect,useState} from "react";
import {createPublishedSnapshot,HOSTED_LIMITS,type GraphDocument,type NodeStyleOverride,
  type PublishedSnapshot,type PublishSettings} from "@mossline/graph-core";
import type {LabelDensity,NetworkLayout} from "./GraphCanvas";
import {account,useAccount,type OwnedPublication} from "../hooks/useAccount";

type Props={
  graph:GraphDocument;
  view:"landscape"|"collaborations"|"atlas";
  layout:NetworkLayout; labels:LabelDensity; illustrated:boolean;
  title:string; introduction?:string; coverUrl?:string;
  positions:Record<string,{x:number;y:number}>;
  nodeStyles:Record<string,NodeStyleOverride>;
};
export function HostedPublishPanel(props:Props){
  const [open,setOpen]=useState(false);
  const {state}=useAccount();
  const user=state.status==="ready"?state.user:null;
  const [mine,setMine]=useState<OwnedPublication[]>([]);
  const [slug,setSlug]=useState("");
  const [includeDescriptions,setIncludeDescriptions]=useState(false);
  const [includeIntroduction,setIncludeIntroduction]=useState(false);
  const [includeImages,setIncludeImages]=useState(false);
  const [reviewed,setReviewed]=useState(false);
  const [snapshot,setSnapshot]=useState<PublishedSnapshot|null>(null);
  const [result,setResult]=useState<{slug:string;revision:number}|null>(null);
  const [link,setLink]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    if(!open||!user?.canPublish)return;
    account.publications().then(setMine).catch(()=>setMine([]));
  },[open,user?.canPublish]);

  function review(){
    setSnapshot(null);setReviewed(false);setError("");setLink("");
    try{
      const settings:PublishSettings={
        ...props,includeDescriptions,includeImages,
        introduction:includeIntroduction?props.introduction:undefined
      };
      setSnapshot(createPublishedSnapshot(props.graph,settings,new Date(),HOSTED_LIMITS));
    }catch(err){setError(err instanceof Error?err.message:"Could not prepare publication.");}
  }
  function changeOptions(update:()=>void){
    update();setSnapshot(null);setReviewed(false);setLink("");setError("");
  }
  async function send(){
    if(!snapshot||!reviewed||busy)return;
    setBusy(true);setError("");
    try{
      const current=mine.find(m=>m.slug===slug);
      const data=current?await account.update(current.slug,current.revision,snapshot):await account.publish(snapshot);
      setResult(data);setLink(window.location.origin+"/p/"+data.slug);setSnapshot(null);setReviewed(false);
      setMine(await account.publications());
    }catch(err){setError(err instanceof Error?err.message:"Could not publish this map.");}
    finally{setBusy(false);}
  }
  return <section className="hosted-publish-panel" aria-label="Managed online publishing">
    <button className="share-toggle" type="button" onClick={()=>{
      setOpen(!open);setSnapshot(null);setReviewed(false);setError("");
    }}>{open?"− Close online publishing":"+ Publish online"}</button>
    {open&&<div className="hosted-controls">
      <p className="eyebrow">Hosted publishing</p>
      {state.status==="loading"&&<p className="help" role="status">Checking publishing configuration…</p>}
      {state.status==="off"&&<p className="help">
        Hosted publishing is not enabled for this deployment. The local Share a view option still works.
      </p>}
      {state.status==="ready"&&!user&&<p className="help">Publishing needs an account.{" "}
        <a href={"/sign-in?next="+encodeURIComponent(window.location.pathname+window.location.search)}>Sign in to publish</a></p>}
      {user&&!user.canPublish&&<p className="help">{user.email} isn&apos;t set up to publish here.</p>}
      {user?.canPublish&&<>
        <p className="help">Create a stable, read-only URL you can update or unpublish from your account.
          Only what you explicitly approve is stored online. Anyone with the URL can see it.</p>
        <label>Publish as
          <select className="search" value={slug} onChange={e=>{setSlug(e.target.value);setLink("");setResult(null);}}>
            <option value="">A new publication</option>
            {mine.map(m=><option key={m.slug} value={m.slug}>Update “{m.title}”</option>)}
          </select>
        </label>
        <label className="share-checkbox"><input type="checkbox" checked={includeDescriptions}
          onChange={e=>changeOptions(()=>setIncludeDescriptions(e.target.checked))}/>
          Include entity descriptions</label>
        <label className="share-checkbox"><input type="checkbox" checked={includeIntroduction}
          onChange={e=>changeOptions(()=>setIncludeIntroduction(e.target.checked))}/>
          Include introductory story text</label>
        <label className="share-checkbox"><input type="checkbox" checked={includeImages}
          onChange={e=>changeOptions(()=>setIncludeImages(e.target.checked))}/>
          Include external images and cover</label>
        <button className="share-preview-button" type="button" onClick={review}
          disabled={!props.graph.nodes.length}>Review exact public content</button>
        {snapshot&&<div className="share-review">
          <strong>{snapshot.nodes.length} entities · {snapshot.edges.length} relationships</strong>
          <p>{snapshot.title}</p>
          {snapshot.introduction&&<p>Story: {snapshot.introduction}</p>}
          <details open className="share-disclosure">
            <summary>Review all entity names, IDs and any descriptions/images</summary>
            <ul>{snapshot.nodes.map(node=><li key={node.id}>{node.label}
              <small> ({node.id} · {node.type})</small>
              {node.description&&<small> {node.description}</small>}
              {node.imageUrl&&<small> {node.imageUrl}</small>}
            </li>)}</ul>
          </details>
          <details className="share-disclosure">
            <summary>Review all {snapshot.edges.length} relationship assertions</summary>
            <ul>{snapshot.edges.map(edge=><li key={edge.id}>
              {snapshot.nodes.find(n=>n.id===edge.source)?.label} →
              {" "}{snapshot.nodes.find(n=>n.id===edge.target)?.label} · {edge.type} ·
              {" "}{edge.inferred?"inferred":"recorded"}
            </li>)}</ul>
          </details>
          <label className="share-checkbox">
            <input type="checkbox" checked={reviewed}
              onChange={e=>setReviewed(e.target.checked)}/>
            I have reviewed everything included and have permission to publish it.
          </label>
          <button type="button" className="share-publish-button" disabled={!reviewed||busy}
            onClick={send}>{busy?"Publishing…":slug?"Update this publication":"Publish reviewed snapshot"}</button>
        </div>}
        {result&&link&&<div className="share-review" role="status">
          <strong>Published! Revision {result.revision}</strong>
          <label>Public link
            <textarea rows={2} readOnly value={link} aria-label="Hosted publication URL"
              onFocus={e=>e.target.select()}/>
          </label>
          <div className="share-link-actions"><button type="button" onClick={()=>void navigator.clipboard?.writeText(link).catch(()=>setError("Copy the link manually."))}>
            Copy public URL</button><a href={link} target="_blank" rel="noreferrer">Open public map ↗</a></div>
        </div>}
        <p className="help">Signed in as {user.name||user.email}. Unpublish from{" "}
          <a href="/account" target="_blank" rel="noreferrer">your account ↗</a>. Unpublishing cannot remove downloaded or cached copies.</p>
      </>}
      {error&&<p role="alert" className="share-error">{error}</p>}
    </div>}
  </section>;
}
