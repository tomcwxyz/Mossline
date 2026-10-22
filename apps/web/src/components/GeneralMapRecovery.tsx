"use client";
import {useEffect,useRef,useState} from "react";
import type {GeneralMapInfo} from "../lib/general-map-store";

type Reply={kind:"listed"|"stage"|"exported"|"restored"|"failed";
  id:number;message?:string;count?:number;maps?:GeneralMapInfo[];blob?:Blob};
export function GeneralMapRecovery({linkedIds}:{linkedIds:string[]}){
 const workerRef=useRef<Worker|null>(null),sequence=useRef(0);
 const fileInput=useRef<HTMLInputElement>(null);
 const [maps,setMaps]=useState<GeneralMapInfo[]>([]);
 const [busy,setBusy]=useState(false),[ready,setReady]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 useEffect(()=>{
  let worker:Worker;
  try{
   worker=new Worker(new URL("../workers/general-map-recovery.worker.ts",import.meta.url),
     {type:"module"});
  }catch{setError("This browser cannot open the general network recovery worker.");return;}
  workerRef.current=worker;setReady(false);setBusy(true);
  worker.onmessage=(event:MessageEvent<Reply>)=>{
   const reply=event.data;if(reply.id!==sequence.current)return;
   if(reply.kind==="stage"){setMessage(reply.message??"Processing…");return;}
   setBusy(false);
   if(reply.kind==="listed")setReady(true);
   if(reply.kind==="failed"){setError(reply.message??"Backup failed");return;}
   setError("");
   if(reply.maps)setMaps(reply.maps);
   if(reply.kind==="exported"&&reply.blob){
     const url=URL.createObjectURL(reply.blob);
     const link=document.createElement("a");
     link.href=url;link.download="mossline-complete-general-networks.json";
     document.body.append(link);link.click();link.remove();
     URL.revokeObjectURL(url);
     setMessage("Requested a full backup of "+(reply.count??0)+
       " general network(s). Keep it alongside your map-library backup.");
   }else if(reply.kind==="restored"){
     setMessage("Restored "+(reply.count??0)+
       " complete networks. Restore the corresponding map-library backup too, then reload Mossline.");
   }else{setMessage("");}
  };
  worker.onerror=()=>{setBusy(false);setError("Recovery worker failed.");};
  worker.postMessage({kind:"list",id:++sequence.current});
  return ()=>{worker.terminate();workerRef.current=null;sequence.current++;};
 },[]);
 function send(kind:"export"|"restore",file?:File){
  if(!workerRef.current||busy||!ready)return;
  setError("");setBusy(true);setMessage("Preparing the network backup…");
  workerRef.current.postMessage({kind,id:++sequence.current,...(file?{file}:{})});
 }
 async function restore(file?:File){
  if(!file)return;
  if(!window.confirm("Import complete network datasets into this browser? Existing dataset "+
      "identifiers will NOT be overwritten. You will need the matching map-library "+
      "backup to restore map names and selections."))return;
  send("restore",file);
 }
 const linked=new Set(linkedIds);
 return <section className="recovery-section" aria-label="Complete general network recovery">
  <h2>Complete general networks</h2>
  <p>Large non-funding maps are stored separately in IndexedDB. The small map-library
    backup above does <strong>not</strong> contain their original nodes and relationships.
    Download both backups if you plan to move browsers or clear local data.</p>
  {maps.length>0?<div>
    <p>{maps.length} complete network dataset(s) stored in this browser.</p>
    <ul>{maps.map(map=><li key={map.id}>
      {map.title} · {map.nodes.toLocaleString("en-GB")} entities ·
      {" "}{map.edges.toLocaleString("en-GB")} relationships
      {linked.has(map.id)?" · Linked to saved map":" · Not referenced in map library"}
    </li>)}</ul>
  </div>:ready&&!busy?<p>No complete generic networks detected in browser storage.</p>:null}
  <div className="recovery-actions">
    <button type="button" disabled={!ready||busy||!maps.length}
      onClick={()=>send("export")}>↓ Download all complete general networks</button>
    <button type="button" className="recovery-secondary" disabled={!ready||busy}
      onClick={()=>fileInput.current?.click()}>↑ Restore general network backup</button>
  </div>
  <input ref={fileInput} hidden type="file" accept=".json,application/json"
    aria-label="Choose full general network backup"
    onChange={e=>{const file=e.target.files?.[0];e.target.value="";
      void restore(file);}}/>
  {!ready&&<p role="status">Checking this browser’s complete-network storage…</p>}
  {busy&&ready&&<p role="status">Reading complete networks in the background…</p>}
  {message&&<p role="status" className="recovery-notice">{message}</p>}
  {error&&<p role="alert" className="recovery-error">{error}</p>}
  <p className="recovery-note">Backups contain original node descriptions and other source
    properties. Keep them securely. Restoring datasets never overwrites an existing
    dataset ID; browser storage quotas still apply.</p>
 </section>;
}
