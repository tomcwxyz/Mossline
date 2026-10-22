"use client";

import {useEffect,useRef,useState} from "react";
import {FundingDatasetRecovery} from "./FundingDatasetRecovery";
import {GeneralMapRecovery} from "./GeneralMapRecovery";
import {LEGACY_GRAPH_STORAGE_KEY,MAP_LIBRARY_STORAGE_KEY,
  type MapRecoveryInfo} from "@mossline/graph-core";

type WorkerReply={
  type:"listed"|"candidate"|"restorable"|"error";requestId:number;message?:string;
  activeId?:string;maps?:MapRecoveryInfo[];nextRaw?:string|null;legacyRaw?:string|null;
};

export function MapRecovery(){
  const workerRef=useRef<Worker|null>(null);
  const restoreInput=useRef<HTMLInputElement>(null);
  const requestRef=useRef(0);
  const [maps,setMaps]=useState<MapRecoveryInfo[]>([]);
  const [activeId,setActiveId]=useState("");
  const [selected,setSelected]=useState("");
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [hasLibrary,setHasLibrary]=useState(false);
  const [hasLegacy,setHasLegacy]=useState(false);
  const [confirmedBackup,setConfirmedBackup]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>{
    let worker:Worker;
    try{
      worker=new Worker(new URL("../workers/map-recovery.worker.ts",import.meta.url),
        {type:"module"});
    }catch{
      setReady(true);setError("This browser could not open the map recovery worker.");
      return;
    }
    workerRef.current=worker;
    worker.onmessage=(event:MessageEvent<WorkerReply>)=>{
      const message=event.data;
      if(message.requestId!==requestRef.current)return;
      if(message.type==="error"){
        setBusy(false);setReady(true);setError(message.message??"Could not read map data.");
        return;
      }
      if(message.type==="listed"){
        setMaps(message.maps??[]);
        setActiveId(message.activeId??"");
        setSelected(message.activeId??message.maps?.[0]?.id??"");
        setBusy(false);setReady(true);
      }
      if(message.type==="restorable"){
        const beforeLibrary=window.localStorage.getItem(MAP_LIBRARY_STORAGE_KEY);
        const beforeLegacy=window.localStorage.getItem(LEGACY_GRAPH_STORAGE_KEY);
        try{
          if(message.nextRaw!==null&&message.nextRaw!==undefined)
            window.localStorage.setItem(MAP_LIBRARY_STORAGE_KEY,message.nextRaw);
          else window.localStorage.removeItem(MAP_LIBRARY_STORAGE_KEY);
          if(message.legacyRaw!==null&&message.legacyRaw!==undefined)
            window.localStorage.setItem(LEGACY_GRAPH_STORAGE_KEY,message.legacyRaw);
          else window.localStorage.removeItem(LEGACY_GRAPH_STORAGE_KEY);
          setHasLibrary(!!message.nextRaw);setHasLegacy(!!message.legacyRaw);
          setMaps(message.maps??[]);setActiveId(message.activeId??"");
          setSelected(message.activeId??message.maps?.[0]?.id??"");
          setNotice("Map backup restored in this browser. If it references funding datasets, restore their separate backup too.");
          setError("");setBusy(false);setReady(true);setConfirmedBackup(false);
          if(message.nextRaw)worker.postMessage({type:"inspect",
            raw:message.nextRaw,requestId:++requestRef.current});
        }catch{
          try{
            if(beforeLibrary===null)window.localStorage.removeItem(MAP_LIBRARY_STORAGE_KEY);
            else window.localStorage.setItem(MAP_LIBRARY_STORAGE_KEY,beforeLibrary);
            if(beforeLegacy===null)window.localStorage.removeItem(LEGACY_GRAPH_STORAGE_KEY);
            else window.localStorage.setItem(LEGACY_GRAPH_STORAGE_KEY,beforeLegacy);
          }catch{/* Storage itself may be unavailable. */}
          setBusy(false);setError("Restoring the map backup failed. Existing maps were preserved where browser storage allowed.");
        }
        return;
      }
      if(message.type==="candidate"){
        try{
          if(message.nextRaw){
            window.localStorage.setItem(MAP_LIBRARY_STORAGE_KEY,message.nextRaw);
          }else{
            window.localStorage.removeItem(MAP_LIBRARY_STORAGE_KEY);
          }
          // The obsolete single-map cache must not resurrect a deleted map.
          window.localStorage.removeItem(LEGACY_GRAPH_STORAGE_KEY);
          setHasLegacy(false);
          worker.postMessage({type:"commit",requestId:++requestRef.current});
          setMaps(message.maps??[]);
          setActiveId(message.activeId??"");
          setSelected(message.activeId??message.maps?.[0]?.id??"");
          setNotice("Saved map removed from this browser. Other saved maps were retained.");
          setError("");setBusy(false);setConfirmedBackup(false);
          if(!message.maps?.length)setHasLibrary(false);
        }catch{
          setBusy(false);
          setError("Browser storage could not be updated. No map was deliberately removed. "+
            "Keep your backup, close other Mossline tabs and try again.");
        }
      }
    };
    worker.onerror=()=>{
      setBusy(false);setReady(true);
      setError("The background map recovery worker encountered an error.");
    };
    try{
      const raw=window.localStorage.getItem(MAP_LIBRARY_STORAGE_KEY);
      setHasLegacy(window.localStorage.getItem(LEGACY_GRAPH_STORAGE_KEY)!==null);
      if(!raw){
        setReady(true);setHasLibrary(false);
      }else{
        setBusy(true);setHasLibrary(true);
        worker.postMessage({type:"inspect",requestId:++requestRef.current,raw});
      }
    }catch{
      setReady(true);setError("Browser storage access was blocked.");
    }
    return ()=>{worker.terminate();workerRef.current=null;requestRef.current++;};
  },[]);

  function exportBackup(){
    try{
      const library=window.localStorage.getItem(MAP_LIBRARY_STORAGE_KEY);
      const legacy=window.localStorage.getItem(LEGACY_GRAPH_STORAGE_KEY);
      if(!library&&!legacy){setNotice("There are no cached maps to back up.");return;}
      const blob=new Blob([JSON.stringify({
        format:"mossline-browser-recovery-backup",version:1,
        exportedAt:new Date().toISOString(),
        // Raw JSON is preserved for eventual exact restoration.
        values:{
          [MAP_LIBRARY_STORAGE_KEY]:library,
          [LEGACY_GRAPH_STORAGE_KEY]:legacy
        }
      })],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const link=document.createElement("a");
      link.href=url;link.download="mossline-local-maps-backup.json";
      document.body.appendChild(link);link.click();link.remove();
      URL.revokeObjectURL(url);
      setNotice("Backup download requested. Confirm the file is saved before deleting.");
      setConfirmedBackup(false);
    }catch{setError("Unable to export the backup from browser storage.");}
  }

  async function restoreBackup(file?:File){
    if(!file)return;
    if(file.size>64*1024*1024){
      setError("Map-library backup must be smaller than 64 MB.");return;
    }
    if(!window.confirm("Restore this map-library backup? Existing saved maps in this browser "+
      "will be REPLACED. Export and check a fresh backup of your current work first. "+
      "Complete general and funding datasets must be restored separately."))return;
    try{
      setBusy(true);setError("");setNotice("Validating map backup in a background worker…");
      workerRef.current?.postMessage({type:"restore",requestId:++requestRef.current,
        raw:await file.text()});
    }catch{setBusy(false);setError("The selected map backup could not be read.");}
  }

  function removeSelected(){
    if(!confirmedBackup||!ready||busy||!selected||!workerRef.current)return;
    const title=maps.find(m=>m.id===selected)?.title??"this saved map";
    if(!window.confirm("Remove “"+title+"” from THIS browser? "+
      "The map will no longer be available locally. "+
      "Keep your downloaded backup before continuing."))return;
    setBusy(true);setNotice("");setError("");
    workerRef.current.postMessage({
      type:"remove",id:selected,requestId:++requestRef.current
    });
  }

  function clearSavedMaps(){
    if(!confirmedBackup||busy||!ready)return;
    if(!window.confirm("Clear ALL Mossline maps saved in THIS browser? "+
      "This does not remove any hosted publications. "+
      "Only proceed if you've checked your backup."))return;
    try{
      window.localStorage.removeItem(MAP_LIBRARY_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_GRAPH_STORAGE_KEY);
      setMaps([]);setActiveId("");setSelected("");setHasLibrary(false);
      setHasLegacy(false);setConfirmedBackup(false);
      setNotice("Only Mossline's local saved-map cache was cleared. Reload the studio to open a fresh example.");
      setError("");
    }catch{setError("Unable to clear the saved-map cache. Check browser storage permissions.");}
  }
  const count=maps.length;
  return <main className="recovery-shell">
    <header className="recovery-header">
      <a href="/" className="recovery-brand">✳ mossline.</a>
      <span>Browser map recovery</span>
    </header>
    <div className="recovery-content">
      <p className="eyebrow">Recovery tools · no network visualisation</p>
      <h1>Manage saved maps without loading the canvas.</h1>
      <p>This page intentionally does not open your network or analyse your funding data.
        Saved maps live in <strong>this browser</strong>, not in your public publishing database.
        Other Mossline tabs should be closed before making changes here.</p>
      <nav className="recovery-nav"><a href="/">← Back to Mossline</a></nav>
      <section className="recovery-section">
        <h2>1. Back up or restore your maps</h2>
        <p>Save your original map-library cache, including the legacy copy if one exists.
          Check the download in your computer's Downloads folder before removing anything.
          <strong> This backup contains map names and references, but not complete
          general networks or funding datasets stored separately in this browser.</strong>
          Download the corresponding complete-network backups below too.</p>
        <button type="button" onClick={exportBackup} disabled={!hasLibrary&&!hasLegacy}>
          ↓ Download map-library backup
        </button>
        <button type="button" className="recovery-secondary"
          disabled={busy} onClick={()=>restoreInput.current?.click()}>
          ↑ Restore map-library backup
        </button>
        <input type="file" hidden ref={restoreInput} accept=".json,application/json"
          aria-label="Choose map-library backup JSON"
          onChange={e=>{const file=e.target.files?.[0];e.target.value="";
            void restoreBackup(file);}}/>
        <p>Restoring a map backup replaces this browser's saved map list. It does not restore
          complete general networks or funding datasets; restore those separately below.</p>
      </section>
      <section className="recovery-section">
        <h2>2. Select a map to remove</h2>
        {busy&&<p role="status">Reading saved maps in the background…</p>}
        {!ready&&!busy&&<p role="status">Opening map recovery…</p>}
        {ready&&maps.length===0&&<p>No maps were found in the current map library.
          {hasLegacy?" A legacy saved map copy exists and can be backed up or cleared below.":""}</p>}
        {maps.length>0&&<>
          <p>{count} saved {count===1?"map":"maps"} found. Removing one retains the others.</p>
          <div className="recovery-map-list" role="radiogroup" aria-label="Choose map to remove">
            {maps.map(map=><label key={map.id}>
              <input type="radio" name="map-to-remove" value={map.id}
                checked={selected===map.id} disabled={busy}
                onChange={()=>setSelected(map.id)}/>
              <span><strong>{map.title}</strong>
                <small>{map.nodes.toLocaleString("en-GB")} nodes ·
                  {" "}{map.edges.toLocaleString("en-GB")} links
                  {activeId===map.id?" · Currently selected":""}</small>
              </span>
            </label>)}
          </div>
        </>}
        {(hasLibrary||hasLegacy)&&<label className="recovery-acknowledge">
          <input type="checkbox" checked={confirmedBackup}
            onChange={e=>setConfirmedBackup(e.target.checked)}/>
          I've downloaded and checked my map backup and understand that deleting
          local data cannot be undone from Mossline.
        </label>}
        <div className="recovery-actions">
          <button type="button" disabled={!selected||busy||!ready||!confirmedBackup}
            onClick={removeSelected}>Remove selected map</button>
          <button type="button" className="recovery-danger"
            disabled={busy||!ready||!confirmedBackup||(!hasLibrary&&!hasLegacy)}
            onClick={clearSavedMaps}>Clear all saved maps</button>
        </div>
      </section>
      <GeneralMapRecovery linkedIds={maps.flatMap(m=>m.generalDatasetId?
        [m.generalDatasetId]:[])} />
      <FundingDatasetRecovery linkedDatasetIds={maps.flatMap(m=>m.fundingDatasetId?
        [m.fundingDatasetId]:[])} canInspectMaps={ready&&!error}/>
      {notice&&<p className="recovery-notice" role="status">{notice}</p>}
      {error&&<p className="recovery-error" role="alert">{error}</p>}
      <p className="recovery-note">This only affects locally saved map entries.
        Hosted publications and the Neon database are not touched.
        Complete general networks and funding datasets held in IndexedDB are not automatically
         erased with map entries. Use the sections above to back up or restore them.
         Keep the map-library backup with both complete-network backups when moving browsers.
        A backup export may contain sensitive descriptions, so store it securely.
      </p>
    </div>
  </main>;
}
