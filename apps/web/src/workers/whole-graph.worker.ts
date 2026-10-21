/// <reference lib="webworker" />
import {buildAdaptiveGraphIndex,projectAdaptiveGraph,
  type AdaptiveGraphIndex,type GraphDocument} from "@mossline/graph-core";
import {loadFundingDataset} from "../lib/funding-dataset-store";

type Job={kind:"overview";id:number;datasetId?:string;graph?:GraphDocument;expandedIds:string[]};
let loadedId="",index:AdaptiveGraphIndex|null=null;
self.onmessage=async(event:MessageEvent<Job>)=>{
  const job=event.data;
  if(job.kind!=="overview")return;
  try{
    if(job.graph){
      // Generic Kumu/CSV maps send their complete graph once on first load.
      // Subsequent expansion calls reuse the background-worker index.
      index=buildAdaptiveGraphIndex(job.graph);
      loadedId="generic";
    }else if(job.datasetId&&(!index||job.datasetId!==loadedId)){
      self.postMessage({kind:"stage",id:job.id,
        message:"Opening the complete source network…"});
      const dataset=await loadFundingDataset(job.datasetId);
      index=buildAdaptiveGraphIndex(dataset.graph);
      loadedId=dataset.id;
    }
    if(!index)throw Error("No complete network was available for exploration.");
    self.postMessage({kind:"stage",id:job.id,
      message:"Summarising the network without losing any source connections…"});
    const projection=projectAdaptiveGraph(index,job.expandedIds);
    self.postMessage({kind:"result",id:job.id,projection});
  }catch(error){
    self.postMessage({kind:"failed",id:job.id,
      message:error instanceof Error?error.message:"Unable to prepare whole-network overview."});
  }
};
