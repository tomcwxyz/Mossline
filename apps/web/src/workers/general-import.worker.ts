/// <reference lib="webworker" />
import {discoverData,previewImport,buildMappedGraph,isFundingAwardsCsv,
  type DataDiscovery,type ImportPreview,type ImportFile,type ColumnMapping,
  type MappedPreview} from "@mossline/graph-core";

type Command={kind:"analyse";id:number;files:File[]}|
  {kind:"map";id:number;mapping:ColumnMapping};
let current:ImportFile[]=[];
const notify=(message:Record<string,unknown>)=>self.postMessage(message);
self.onmessage=(event:MessageEvent<Command>)=>{
 const job=event.data;
 void (async()=>{
  try{
   if(job.kind==="analyse"){
     if(!job.files.length||job.files.some(f=>f.size>60_000_000))
       throw Error("Choose CSV or JSON files smaller than 60 MB each.");
     current=[];
     notify({kind:"stage",id:job.id,message:"Reading source files in the background…"});
     current=await Promise.all(job.files.map(async f=>({name:f.name,text:await f.text()})));
     if(current.length===1&&isFundingAwardsCsv(current[0])){
       notify({kind:"funding-detected",id:job.id});
       return;
     }
     notify({kind:"stage",id:job.id,message:"Discovering columns and source relationships…"});
     const discovery:DataDiscovery|null=current.length===1?
       discoverData(current[0]):null;
     const preview:ImportPreview|null=discovery?.kind==="csv-table"?
       null:previewImport(current);
     const initial:MappedPreview|null=discovery?.kind==="csv-table"?
       buildMappedGraph(current[0],discovery.mapping):null;
     notify({kind:"analysed",id:job.id,discovery,preview,initial,
       needsIndexedDb:JSON.stringify(preview?.graph??initial?.graph??null).length>300_000,
       fileName:current.length===1?current[0].name:"Imported network"});
   }else{
     if(current.length!==1||!current[0].name.toLowerCase().endsWith(".csv"))
       throw Error("Select one general-purpose CSV to review its mapping.");
     notify({kind:"stage",id:job.id,message:"Building the complete mapped graph in the background…"});
     const proposal=buildMappedGraph(current[0],job.mapping);
     notify({kind:"mapped",id:job.id,proposal,
       needsIndexedDb:JSON.stringify(proposal.graph??null).length>300_000});
   }
  }catch(error){
   notify({kind:"failed",id:job.id,
     message:error instanceof Error?error.message:"Could not analyse these files."});
  }
 })();
};
