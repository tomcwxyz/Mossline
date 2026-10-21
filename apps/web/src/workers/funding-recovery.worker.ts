/// <reference lib="webworker" />
import {makeFundingDatasetBackup,parseFundingDatasetBackup}
  from "@mossline/graph-core";
import {deleteFundingDataset,listFundingDatasets,loadFundingDataset,
  restoreFundingDatasets} from "../lib/funding-dataset-store";

type Job={type:"list"|"export"|"import"|"delete";requestId:number;
  ids?:string[];id?:string;file?:File};
const MAX_ARCHIVE_BYTES=256*1024*1024;
const respond=(requestId:number,type:string,extra:Record<string,unknown>={})=>
  self.postMessage({requestId,type,...extra});
self.onmessage=async(event:MessageEvent<Job>)=>{
  const {type,requestId,ids,id,file}=event.data;
  try{
    if(type==="list"){
      respond(requestId,"listed",{datasets:await listFundingDatasets()});
    }else if(type==="export"){
      const available=await listFundingDatasets();
      const chosen=ids?.length?available.filter(item=>ids.includes(item.id)):available;
      if(!chosen.length)throw Error("There are no funding datasets to export.");
      respond(requestId,"stage",{message:"Preparing complete grant records for backup…"});
      const datasets=[];
      for(const entry of chosen)datasets.push(await loadFundingDataset(entry.id));
      const backup=makeFundingDatasetBackup(datasets);
      const blob=new Blob([JSON.stringify(backup)],{type:"application/json"});
      respond(requestId,"exported",{blob,count:datasets.length});
    }else if(type==="import"){
      if(!file||file.size>MAX_ARCHIVE_BYTES)throw Error(
        "Choose a funding backup JSON file smaller than 256 MB.");
      respond(requestId,"stage",{message:"Validating every grant and dataset before restoring…"});
      const backup=parseFundingDatasetBackup(JSON.parse(await file.text()));
      await restoreFundingDatasets(backup.datasets);
      respond(requestId,"imported",{count:backup.datasets.length,
        datasets:await listFundingDatasets()});
    }else if(type==="delete"){
      if(!id)throw Error("Choose a dataset first.");
      await deleteFundingDataset(id);
      respond(requestId,"deleted",{datasets:await listFundingDatasets()});
    }
  }catch(error){
    respond(requestId,"error",{message:error instanceof Error?error.message:
      "Funding dataset recovery could not finish."});
  }
};
