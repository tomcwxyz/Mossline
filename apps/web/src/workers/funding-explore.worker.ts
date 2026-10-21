/// <reference lib="webworker" />
import {projectFundingGraph,type FundingGraphQuery,type GraphDocument} from "@mossline/graph-core";
import {loadFundingDataset} from "../lib/funding-dataset-store";
type Job={kind:"project";id:number;datasetId:string;query:FundingGraphQuery};
let loadedId="",graph:GraphDocument|null=null;
self.onmessage=async(event:MessageEvent<Job>)=>{
  const job=event.data;
  if(job.kind!=="project")return;
  try{
    if(!graph||loadedId!==job.datasetId){
      self.postMessage({kind:"stage",id:job.id,message:"Opening complete funding data from browser storage…"});
      const dataset=await loadFundingDataset(job.datasetId);
      graph=dataset.graph;loadedId=dataset.id;
    }
    self.postMessage({kind:"stage",id:job.id,message:"Finding matching grants across the entire dataset…"});
    const projected=projectFundingGraph(graph,job.query);
    self.postMessage({kind:"result",id:job.id,projection:projected});
  }catch(error){
    self.postMessage({kind:"failed",id:job.id,message:
      error instanceof Error?error.message:"Could not load the saved dataset"});
  }
};
