/// <reference lib="webworker" />
import {listGeneralGraphs,exportGeneralGraphBackup,restoreGeneralGraphBackup}
  from "../lib/general-map-store";
type Job={kind:"list"|"export"|"restore";id:number;file?:File};
self.onmessage=(event:MessageEvent<Job>)=>{
 const job=event.data;
 void (async()=>{
  try{
   if(job.kind==="list"){
     const maps=await listGeneralGraphs();
     self.postMessage({kind:"listed",id:job.id,maps});
   }else if(job.kind==="export"){
     self.postMessage({kind:"stage",id:job.id,message:"Preparing all complete general networks…"});
     const archive=await exportGeneralGraphBackup();
     self.postMessage({kind:"exported",id:job.id,count:archive.datasets.length,
       blob:new Blob([JSON.stringify(archive)],{type:"application/json"})});
   }else if(job.kind==="restore"){
     if(!job.file)throw Error("Choose a compatible generic network backup.");
     if(job.file.size>256_000_000)throw Error("Backup exceeds the 256 MB local restore limit.");
     self.postMessage({kind:"stage",id:job.id,message:"Validating all original network records…"});
     const count=await restoreGeneralGraphBackup(JSON.parse(await job.file.text()));
     const maps=await listGeneralGraphs();
     self.postMessage({kind:"restored",id:job.id,count,maps});
   }
  }catch(error){
   self.postMessage({kind:"failed",id:job.id,message:error instanceof Error?
     error.message:"Full network backup failed."});
  }
 })();
};
