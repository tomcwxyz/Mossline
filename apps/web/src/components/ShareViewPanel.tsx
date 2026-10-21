"use client";
import {useState} from "react";
import {createPublishedSnapshot,type GraphDocument,type NodeStyleOverride,
  type PublishedSnapshot,type PublishSettings} from "@mossline/graph-core";
import type {LabelDensity,NetworkLayout} from "./GraphCanvas";
import {encodeShareSnapshot} from "../lib/share-codec";

type Props={
  graph:GraphDocument;
  view:"landscape"|"collaborations"|"atlas";
  layout:NetworkLayout;
  labels:LabelDensity;
  illustrated:boolean;
  title:string;
  introduction?:string;
  coverUrl?:string;
  positions:Record<string,{x:number;y:number}>;
  nodeStyles:Record<string,NodeStyleOverride>;
};
export function ShareViewPanel(props:Props){
  const [open,setOpen]=useState(false);
  const [includeDescriptions,setIncludeDescriptions]=useState(false);
  const [includeImages,setIncludeImages]=useState(false);
  const [snapshot,setSnapshot]=useState<PublishedSnapshot|null>(null);
  const [link,setLink]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState(false);

  function review(){
    setLink("");setCopied(false);setError("");setSnapshot(null);
    try {
      const settings:PublishSettings={
        ...props,includeDescriptions,includeImages
      };
      setSnapshot(createPublishedSnapshot(props.graph,settings));
    }catch(err){
      setError(err instanceof Error?err.message:"Unable to prepare a snapshot.");
    }
  }
  async function publish(){
    if(!snapshot)return;
    setBusy(true);setError("");
    try{
      const hash=await encodeShareSnapshot(snapshot);
      setLink(window.location.origin+"/share#s="+hash);
    }catch(err){
      setError(err instanceof Error?err.message:"Could not produce this link.");
    }finally{setBusy(false);}
  }
  async function copyLink(){
    if(!link)return;
    try{await navigator.clipboard.writeText(link);setCopied(true);}
    catch{setError("Could not copy automatically. Select the link in the field and copy it manually.");}
  }
  return <section className="share-view-panel" aria-label="Share read-only view">
    <button type="button" className="share-toggle" onClick={()=>{
      setOpen(!open);setSnapshot(null);setLink("");setError("");
    }}>{open?"− Close sharing":"+ Share a view"}</button>
    {open&&<div className="share-view-content">
      <p className="eyebrow">Read-only link · experimental</p>
      <p className="help">Share the <strong>currently visible</strong> entities and recorded
        or inferred relationships. The recipient can explore the snapshot
        without opening your editing workspace.</p>
      <label className="share-checkbox"><input type="checkbox"
        checked={includeDescriptions} onChange={e=>{
          setIncludeDescriptions(e.target.checked);setSnapshot(null);setLink("");
        }}/> Include entity descriptions</label>
      <label className="share-checkbox"><input type="checkbox"
        checked={includeImages} onChange={e=>{
          setIncludeImages(e.target.checked);setSnapshot(null);setLink("");
        }}/> Include external images and cover artwork</label>
      <p className="help"><strong>Public means public.</strong> Anyone with the link can
        copy the included labels, relationship types, descriptions or picture URLs.
        The link contains the full snapshot, so you cannot revoke it, and edits
        made later will not update it. Review the entities before sharing.
        Unselected private metadata and source record details are excluded.</p>
      <button type="button" className="share-preview-button"
        disabled={props.graph.nodes.length===0} onClick={review}>Review what will be shared</button>
      {snapshot&&!link&&<div className="share-review" aria-label="Review public snapshot">
        <strong>{snapshot.nodes.length} entities · {snapshot.edges.length} relationships</strong>
        <p>Title: {snapshot.title}</p>
        <p>Shared names include:</p>
        <ul>{snapshot.nodes.slice(0,10).map(node=>
          <li key={node.id}>{node.label} <small>({node.type})</small></li>)}</ul>
        {snapshot.nodes.length>10&&<small>…and {snapshot.nodes.length-10} more visible entities.</small>}
        <p>{includeDescriptions?"Descriptions included.":"Descriptions omitted."}{" "}
          {includeImages?"External images included.":"External images omitted."}</p>
        <label className="share-confirm-label">Only share data and images you are
          authorised to publish.</label>
        <button type="button" className="share-publish-button"
          disabled={busy} onClick={publish}>
          {busy?"Preparing…":"Generate share link for this snapshot"}
        </button>
      </div>}
      {link&&<div className="share-review">
        <strong>Link generated locally</strong>
        <p>Anyone with this link can view the snapshot. No content was uploaded by Mossline.</p>
        <textarea readOnly rows={3} value={link} aria-label="Public snapshot URL"
          onFocus={e=>e.target.select()}/>
        <div className="share-link-actions">
          <button type="button" onClick={copyLink}>{copied?"Copied":"Copy link"}</button>
          <a href={link} target="_blank" rel="noreferrer">Preview read-only view ↗</a>
        </div>
      </div>}
      {error&&<p role="alert" className="share-error">{error}</p>}
      <p className="help">This prototype uses compressed URL fragments and supports
        smaller maps. It is not a hosted publishing platform. Large maps will
        need managed storage and access controls in a later release.</p>
    </div>}
  </section>;
}
