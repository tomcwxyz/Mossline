"use client";

import {useEffect,useRef,useState} from "react";
import type {FundingDatasetMeta} from "@mossline/graph-core";

type Reply={
  type:"listed"|"stage"|"exported"|"imported"|"deleted"|"error";
  requestId:number;datasets?:FundingDatasetMeta[];message?:string;
  blob?:Blob;count?:number;
};

/** Isolated recovery tool: never mounts the canvas or the funding explorer. */
export function FundingDatasetRecovery({linkedDatasetIds,canInspectMaps}:{
  linkedDatasetIds:string[];canInspectMaps:boolean;
}){
  const worker=useRef<Worker|null>(null);
  const requestId=useRef(0);
  const upload=useRef<HTMLInputElement>(null);
  const [datasets,setDatasets]=useState<FundingDatasetMeta[]>([]);
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [selected,setSelected]=useState("");
  useEffect(()=>{
    try{
      const w=new Worker(new URL("../workers/funding-recovery.worker.ts",import.meta.url),
        {type:"module"});
      worker.current=w;
      w.onmessage=(event:MessageEvent<Reply>)=>{
        const reply=event.data;
        if(reply.requestId!==requestId.current)return;
        if(reply.type==="stage"){setMessage(reply.message??"Working…");return;}
        setBusy(false);setReady(true);
        if(reply.type==="error"){setError(reply.message??"Dataset recovery failed.");return;}
        setError("");
        if(reply.datasets){
          setDatasets(reply.datasets);
          setSelected(previous=>reply.datasets?.some(d=>d.id===previous)?
            previous:(reply.datasets?.[0]?.id??""));
        }
        if(reply.type==="exported"&&reply.blob){
          const url=URL.createObjectURL(reply.blob);
          const a=document.createElement("a");a.href=url;
          a.download="mossline-funding-datasets-backup.json";
          document.body.appendChild(a);a.click();a.remove();
          setTimeout(()=>URL.revokeObjectURL(url),30000);
          setMessage("Funding backup download requested. Check the file before deleting anything.");
        }else if(reply.type==="imported"){
          setMessage("Restored "+reply.count+" funding dataset(s) without overwriting existing data.");
        }else if(reply.type==="deleted"){
          setMessage("Selected dataset removed from this browser. Other datasets remain.");
        }else if(reply.type==="listed"){setMessage("");}
      };
      w.onerror=()=>{
        setBusy(false);setReady(true);
        setError("Funding recovery worker failed. Other browser data is unchanged.");
      };
      setBusy(true);w.postMessage({type:"list",requestId:++requestId.current});
      return ()=>{w.terminate();worker.current=null;requestId.current++;};
    }catch{
      setError("This browser cannot open funding recovery tools.");setReady(true);
    }
  },[]);
  function send(type:"export"|"delete"|"import",extra:Record<string,unknown>={}){
    if(busy||!worker.current)return;
    setBusy(true);setError("");setMessage("Working with browser funding storage…");
    worker.current.postMessage({type,requestId:++requestId.current,...extra});
  }
  async function importArchive(file?:File){
    if(!file)return;
    if(file.size>256*1024*1024){
      setError("Funding backup files must be smaller than 256 MB.");return;
    }
    if(!window.confirm("Restore all datasets from this archive? "+
      "Existing datasets with the same ID will NOT be overwritten; "+
      "the whole import fails if any ID already exists."))return;
    send("import",{file});
  }
  const linked=new Set(linkedDatasetIds);
  const selectedEntry=datasets.find(d=>d.id===selected);
  const isLinked=!!selectedEntry&&linked.has(selectedEntry.id);
  function remove(){
    if(!selectedEntry||isLinked||!canInspectMaps)return;
    if(!window.confirm("Permanently delete the full funding dataset ‘"+
      selectedEntry.sourceTitle+"’ from this browser? "+
      "Keep a checked backup first. This cannot be undone."))return;
    send("delete",{id:selectedEntry.id});
  }
  return <section className="recovery-section" aria-label="Funding dataset recovery">
    <h2>Full funding datasets</h2>
    <p>Large funding imports are stored separately from saved maps in this browser.
      Download <strong>both</strong> the map-library backup above and this funding backup
      if you want to preserve your complete work. Neither file is uploaded to Mossline.</p>
    {!ready&&<p role="status">Checking browser datasets…</p>}
    {ready&&datasets.length===0&&<p>No full funding datasets are stored in this browser.</p>}
    {datasets.length>0&&<>
      <label htmlFor="recovery-dataset">Choose a dataset
        <select id="recovery-dataset" className="recovery-select"
          value={selected} disabled={busy} onChange={e=>setSelected(e.target.value)}>
          {datasets.map(dataset=><option key={dataset.id} value={dataset.id}>
            {dataset.sourceTitle} · {dataset.grantCount.toLocaleString("en-GB")} grants
          </option>)}
        </select>
      </label>
      <p>{datasets.length} stored dataset(s). {isLinked?
        "This dataset is referenced by a saved map, so deletion is disabled.":
        "Unreferenced datasets may be removed after backing them up."}</p>
    </>}
    <div className="recovery-actions">
      <button type="button" disabled={busy||!datasets.length}
        onClick={()=>send("export")}>↓ Download all full funding datasets</button>
      <button type="button" onClick={()=>upload.current?.click()} disabled={busy}>
        ↑ Restore funding backup
      </button>
      <button type="button" className="recovery-danger"
        disabled={busy||!selectedEntry||isLinked||!canInspectMaps} onClick={remove}>
        Delete unreferenced dataset
      </button>
    </div>
    <input ref={upload} type="file" hidden accept=".json,application/json"
      aria-label="Choose funding dataset backup"
      onChange={e=>{const file=e.target.files?.[0];e.target.value="";void importArchive(file);}}/>
    {!canInspectMaps&&<p>Map references could not be checked, so dataset deletion is disabled.
      Export a backup and repair the map library before trying again.</p>}
    {message&&<p className="recovery-notice" role="status">{message}</p>}
    {error&&<p className="recovery-error" role="alert">{error}</p>}
    <p className="recovery-note">Funding backup JSON contains original organisational grant
      records, descriptions and relationships. Treat it as potentially sensitive.
      Restoring datasets preserves their original IDs so restored maps can find them.
      Dataset exports are not yet streaming: exceptionally large collections may
      exceed this browser's memory or download limits.</p>
  </section>;
}
