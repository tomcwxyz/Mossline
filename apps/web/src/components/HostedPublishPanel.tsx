"use client";

import {useEffect,useState} from "react";
import {createPublishedSnapshot,type GraphDocument,type NodeStyleOverride,
  type PublishedSnapshot,type PublishSettings} from "@mossline/graph-core";
import type {LabelDensity,NetworkLayout} from "./GraphCanvas";

type Props={
  graph:GraphDocument;
  view:"landscape"|"collaborations"|"atlas";
  layout:NetworkLayout; labels:LabelDensity; illustrated:boolean;
  title:string; introduction?:string; coverUrl?:string;
  positions:Record<string,{x:number;y:number}>;
  nodeStyles:Record<string,NodeStyleOverride>;
};
type Result={slug:string;revision:number;managementKey?:string;error?:string};
const PUBLIC_ID=/^[A-Za-z0-9_-]{16,32}$/;
export function HostedPublishPanel(props:Props){
  const [open,setOpen]=useState(false);
  const [available,setAvailable]=useState<boolean|null>(null);
  const [adminKey,setAdminKey]=useState("");
  const [slug,setSlug]=useState("");
  const [managementKey,setManagementKey]=useState("");
  const [includeDescriptions,setIncludeDescriptions]=useState(false);
  const [includeIntroduction,setIncludeIntroduction]=useState(false);
  const [includeImages,setIncludeImages]=useState(false);
  const [reviewed,setReviewed]=useState(false);
  const [snapshot,setSnapshot]=useState<PublishedSnapshot|null>(null);
  const [result,setResult]=useState<{slug:string;revision:number}|null>(null);
  const [link,setLink]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [withdrawConfirm,setWithdrawConfirm]=useState(false);
  const [keyCopied,setKeyCopied]=useState(false);

  useEffect(()=>{
    if(!open)return;
    let cancelled=false;
    void fetch("/api/publications/status",{cache:"no-store"}).then(r=>r.json()).then(
      data=>{if(!cancelled)setAvailable(data.enabled===true);}
    ).catch(()=>{if(!cancelled)setAvailable(false);});
    return ()=>{cancelled=true;};
  },[open]);

  function review(){
    setSnapshot(null);setReviewed(false);setError("");setLink("");
    try{
      const settings:PublishSettings={
        ...props,includeDescriptions,includeImages,
        introduction:includeIntroduction?props.introduction:undefined
      };
      setSnapshot(createPublishedSnapshot(props.graph,settings));
    }catch(err){setError(err instanceof Error?err.message:"Could not prepare publication.");}
  }
  function changeOptions(update:()=>void){
    update();setSnapshot(null);setReviewed(false);setLink("");setError("");
  }
  function publicationUrl(id:string){return window.location.origin+"/p/"+id;}
  async function copy(value:string,label:string){
    try{await navigator.clipboard.writeText(value);if(label==="key")setKeyCopied(true);}
    catch{setError("Clipboard permission unavailable. Copy the value manually.");}
  }
  async function send(){
    if(!snapshot||!reviewed||!available||busy)return;
    const updating=!!slug.trim();
    if(updating && (!PUBLIC_ID.test(slug.trim())||managementKey.length<40)){
      setError("For an update, provide the existing publication ID and its secret management key.");
      return;
    }
    if(!updating && adminKey.length<32){
      setError("Enter the author's publishing key (at least 32 characters).");return;
    }
    setBusy(true);setError("");setKeyCopied(false);
    try{
      let expectedRevision=1;
      if(updating){
        const current=await fetch("/api/publications/"+slug.trim(),{cache:"no-store"});
        if(!current.ok)throw Error("This publication is not available to update.");
        const metadata=await current.json() as {revision:number};
        expectedRevision=metadata.revision;
      }
      const response=await fetch(
        updating?"/api/publications/"+slug.trim():"/api/publications",{
          method:updating?"PATCH":"POST",
          headers:{"Content-Type":"application/json",
            "Authorization":"Bearer "+(updating?managementKey:adminKey)},
          body:JSON.stringify(updating?{snapshot,revision:expectedRevision}:{snapshot}),
          cache:"no-store",
          credentials:"omit"
        });
      const data=await response.json() as Result;
      if(!response.ok)throw Error(data.error??"Publication failed.");
      setSlug(data.slug);setResult({slug:data.slug,revision:data.revision});
      if(data.managementKey)setManagementKey(data.managementKey);
      setLink(publicationUrl(data.slug));setAdminKey("");setSnapshot(null);setReviewed(false);
    }catch(err){setError(err instanceof Error?err.message:"Could not publish this map.");}
    finally{setBusy(false);}
  }
  async function withdraw(){
    if(!withdrawConfirm||busy||!PUBLIC_ID.test(slug)||managementKey.length<40)return;
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/publications/"+slug,{
        method:"DELETE",headers:{"Authorization":"Bearer "+managementKey},
        cache:"no-store",credentials:"omit"
      });
      if(!response.ok){
        const data=await response.json() as {error?:string};
        throw Error(data.error??"Could not withdraw this publication.");
      }
      setResult(null);setLink("");setWithdrawConfirm(false);setSnapshot(null);
      setManagementKey("");setSlug("");
      setError("Publication withdrawn. Its public page now returns not found. Previously downloaded copies cannot be recalled.");
    }catch(err){setError(err instanceof Error?err.message:"Withdrawal failed.");}
    finally{setBusy(false);}
  }
  return <section className="hosted-publish-panel" aria-label="Managed online publishing">
    <button className="share-toggle" type="button" onClick={()=>{
      setOpen(!open);setSnapshot(null);setReviewed(false);setError("");
    }}>{open?"− Close online publishing":"+ Publish online"}</button>
    {open&&<div className="hosted-controls">
      <p className="eyebrow">Hosted publishing · controlled alpha</p>
      {available===null&&<p className="help" role="status">Checking publishing configuration…</p>}
      {available===false&&<p className="help">
        Hosted publishing is not enabled for this deployment. An administrator needs to
        configure a Neon database, apply the publication migration and set the server-only
        publishing credentials. The local Share a view option still works.
      </p>}
      {available===true&&<>
        <p className="help">Create a stable, read-only URL you can update or unpublish.
          Only what you explicitly approve is stored online. Anyone with the URL can see the
          published content; this version does not support private audience access.</p>
        <label>Existing publication ID (leave blank to publish new)
          <input className="search" value={slug} maxLength={32}
            onChange={e=>{setSlug(e.target.value.trim());setLink("");setResult(null);}} placeholder="Optional publication ID"/>
        </label>
        {slug?<label>Secret management key
          <input className="search" type="password" autoComplete="off" value={managementKey}
            onChange={e=>setManagementKey(e.target.value)} placeholder="Paste the key saved at publication"/>
        </label>:<label>Author publishing key
          <input className="search" type="password" autoComplete="off" value={adminKey}
            onChange={e=>setAdminKey(e.target.value)} placeholder="Server-authorised creation key"/>
        </label>}
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
          <div className="share-link-actions"><button type="button" onClick={()=>void copy(link,"link")}>
            Copy public URL</button><a href={link} target="_blank" rel="noreferrer">Open public map ↗</a></div>
          {managementKey&&<div className="hosted-secret">
            <strong>Keep this management key safe</strong>
            <p>It is required to update or unpublish this map. Mossline cannot recover it.
              It is not included in the public URL.</p>
            <textarea rows={2} readOnly value={managementKey}
              aria-label="Secret publication management key"
              onFocus={e=>e.target.select()}/>
            <button type="button" onClick={()=>void copy(managementKey,"key")}>
              {keyCopied?"Management key copied":"Copy management key"}
            </button>
          </div>}
        </div>}
        {slug&&<div className="hosted-withdraw">
          <label className="share-checkbox">
            <input type="checkbox" checked={withdrawConfirm}
              onChange={e=>setWithdrawConfirm(e.target.checked)}/>
            Unpublish the existing map and make its URL inaccessible.
          </label>
          <button type="button" disabled={!withdrawConfirm||managementKey.length<40||busy}
            onClick={withdraw}>Unpublish this map</button>
        </div>}
        <p className="help">Keep the management key in your password manager.
          Mossline does not store it in browser storage. Unpublishing stops access on this
          server, but cannot remove downloaded or cached copies.</p>
      </>}
      {error&&<p role="alert" className="share-error">{error}</p>}
    </div>}
  </section>;
}
