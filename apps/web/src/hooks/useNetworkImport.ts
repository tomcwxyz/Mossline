"use client";

import {useEffect,useRef,useState,type ChangeEvent} from "react";
import {discoverData,type ImportPreview,type ImportFile,type DataDiscovery,
  type MappedPreview,type ColumnMapping} from "@mossline/graph-core";

/** The source import worker, transient mapping state and cancellation lifecycle
 * live independently of map-library persistence. Complete graph writes and the
 * final new/replace decision remain in MapStudio.
 */
const DISCOVERY_EXAMPLE: ImportFile = {
  name:"fictional-farming-relationships.csv",
  text:"Organisation,Project,Funder,Region,Public\n" +
    "Moorland Co-operative,Living Soil Trials,Common Acre Fund,North East,TRUE\n" +
    "River Network,Living Soil Trials,Common Acre Fund,North West,TRUE\n" +
    "Village Growers,Food Futures Lab,Green Field Foundation,Yorkshire,TRUE\n" +
    "Hidden Example,Private Project,Private Funder,South West,FALSE\n"
};

export function useNetworkImport({setNotice,onImportStarted,onFundingFileDetected}:{
  setNotice:(message:string)=>void;
  onImportStarted:()=>void;
  onFundingFileDetected:(file:File)=>void;
}){
  const [importMode,setImportMode]=useState<"new"|"replace">("new");
  const [importMapName,setImportMapName]=useState("");
  const [importPreview,setImportPreview]=useState<ImportPreview|null>(null);
  const [acknowledgeRemovals,setAcknowledgeRemovals]=useState(false);
  const [discovery,setDiscovery]=useState<DataDiscovery|null>(null);
  const [mappingFile,setMappingFile]=useState<ImportFile|null>(null);
  const [initialMapped,setInitialMapped]=useState<MappedPreview|null>(null);
  const [importNeedsIndexedDb,setImportNeedsIndexedDb]=useState(false);
  const [showImportCoverage,setShowImportCoverage]=useState(false);
  const [importBusy,setImportBusy]=useState(false);
  const [importStage,setImportStage]=useState("");
  const importWorkerRef=useRef<Worker|null>(null);
  const importRequestRef=useRef(0);
  const [mappingSession,setMappingSession]=useState(0);

  useEffect(()=>()=>{importWorkerRef.current?.terminate();
    importWorkerRef.current=null;importRequestRef.current++;
  },[]);

  async function onImport(event:ChangeEvent<HTMLInputElement>){
    const files=Array.from(event.target.files??[]);
    event.target.value="";
    if(!files.length)return;
    if(files.some(f=>f.size>60_000_000)||
      files.reduce((sum,f)=>sum+f.size,0)>60_000_000){
      setNotice("Select CSV or JSON files totalling at most 60 MB for local import. "+
        "Larger files will need streamed parsing.");return;
    }
    onImportStarted();
    importWorkerRef.current?.terminate();
    importWorkerRef.current=null;
    const id=++importRequestRef.current;
    setImportBusy(true);setImportStage("Opening your files in a background worker…");
    setImportNeedsIndexedDb(false);
    setShowImportCoverage(false);
    setNotice("");setImportPreview(null);setDiscovery(null);
    setMappingFile(null);setInitialMapped(null);
    try{
      const worker=new Worker(new URL("../workers/general-import.worker.ts",import.meta.url),
        {type:"module"});
      importWorkerRef.current=worker;
      worker.onmessage=(event:MessageEvent<{
        kind:"stage"|"analysed"|"mapped"|"funding-detected"|"failed";id:number;message?:string;
        preview?:ImportPreview|null;discovery?:DataDiscovery|null;
        initial?:MappedPreview|null;proposal?:MappedPreview;fileName?:string;
        needsIndexedDb?:boolean;
      }>)=>{
        const result=event.data;
        if(result.id!==importRequestRef.current)return;
        if(result.kind==="stage"){setImportStage(result.message??"Working…");return;}
        setImportBusy(false);setImportStage("");
        if(result.kind==="funding-detected"){
          closeImport();
          onFundingFileDetected(files[0]);
          setNotice("This looks like grant awards data. Review the detected columns in the funding importer before creating your map.");
          return;
        }
        if(result.kind==="failed"){
          setNotice(result.message??"Unable to import these source files.");return;
        }
        if(result.kind==="mapped"&&result.proposal){
          setImportNeedsIndexedDb(result.needsIndexedDb===true);
          previewMappedGraph(result.proposal);
          return;
        }
        if(result.kind!=="analysed")return;
        const preview=result.preview??null,analysis=result.discovery??null;
        setDiscovery(preview?.source==="mossline"&&preview.graph?null:analysis);
        // File contents remain in the worker; the mapping editor only needs
        // a filename and the source discovery, never a second huge CSV string.
        setMappingFile(analysis?.kind==="csv-table"?
          {name:result.fileName??files[0].name,text:""}:null);
        setInitialMapped(result.initial??null);
        setImportNeedsIndexedDb(result.needsIndexedDb===true);
        setMappingSession(v=>v+1);
        setAcknowledgeRemovals(false);
        setImportMode("new");
        setImportMapName((result.fileName??"Imported network")
          .replace(/\.(csv|json)$/i,""));
        setImportPreview(preview);
      };
      worker.onerror=()=>{
        if(importWorkerRef.current!==worker)return;
        setImportBusy(false);setImportStage("");
        setNotice("Background import failed. Try a smaller file or another browser.");
        worker.terminate();importWorkerRef.current=null;
      };
      worker.postMessage({kind:"analyse",id,files});
    }catch{
      setImportBusy(false);setImportStage("");
      setNotice("This browser could not start background data import.");
    }
  }

  function buildMappedInWorker(mapping:ColumnMapping){
    if(!importWorkerRef.current)return;
    const id=++importRequestRef.current;
    setImportBusy(true);setImportStage("Mapping every source record in the background…");
    setImportPreview(null);
    importWorkerRef.current.postMessage({kind:"map",id,mapping});
  }

  function previewMappedGraph(result: MappedPreview) {
    setAcknowledgeRemovals(false);
    setImportPreview({
      graph:result.graph, issues:result.issues,source:"csv",
      counts:{nodes:result.counts.nodes,edges:result.counts.edges}
    });
  }

  function closeImport() {
    setShowImportCoverage(false);
    setImportNeedsIndexedDb(false);
    importWorkerRef.current?.terminate();importWorkerRef.current=null;
    importRequestRef.current++;
    setImportBusy(false);setImportStage("");setInitialMapped(null);
    setImportPreview(null);setDiscovery(null);setMappingFile(null);
    setAcknowledgeRemovals(false);setImportMode("new");setImportMapName("");
  }

  function tryExampleDiscovery() {
    importWorkerRef.current?.terminate();importWorkerRef.current=null;
    importRequestRef.current++;setImportNeedsIndexedDb(false);
    const analysis=discoverData(DISCOVERY_EXAMPLE);
    setDiscovery(analysis);
    setMappingFile(DISCOVERY_EXAMPLE);
    setMappingSession(previous=>previous+1);
    setImportPreview(null);
    setAcknowledgeRemovals(false);
    setImportMode("new");
    setImportMapName("Fictional farming network");
    setNotice("Fictional example spreadsheet analysed. Review the suggested mappings before generating a graph.");
  }


  return {
    importMode,setImportMode,importMapName,setImportMapName,
    importPreview,setImportPreview,acknowledgeRemovals,setAcknowledgeRemovals,
    discovery,mappingFile,initialMapped,importNeedsIndexedDb,
    showImportCoverage,setShowImportCoverage,importBusy,setImportBusy,
    importStage,setImportStage,importWorkerRef,importRequestRef,
    mappingSession,onImport,buildMappedInWorker,previewMappedGraph,
    closeImport,tryExampleDiscovery
  };
}
