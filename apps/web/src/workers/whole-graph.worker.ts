/// <reference lib="webworker" />
import {buildAdaptiveGraphIndex,projectAdaptiveGraph,
  buildNetworkNavigation,searchNetwork,inspectNetworkNode,revealNetworkNode,layoutFullNetwork,
  type AdaptiveGraphIndex,type NetworkNavigationIndex,type GraphDocument}
  from "@mossline/graph-core";
import {loadFundingDataset} from "../lib/funding-dataset-store";

type Job={
  kind:"overview"|"search"|"select"|"inspect"|"full";id:number;mode?:"full"|"overview";
  datasetId?:string;graph?:GraphDocument;expandedIds?:string[];
  nodeId?:string;query?:string;page?:number;
};
let loadedId="",index:AdaptiveGraphIndex|null=null,
  navigation:NetworkNavigationIndex|null=null;
self.onmessage=async(event:MessageEvent<Job>)=>{
  const job=event.data;
  try{
    if(job.kind==="overview"){
      if(job.graph){
        index=buildAdaptiveGraphIndex(job.graph);
        navigation=buildNetworkNavigation(job.graph);
        loadedId="generic";
      }else if(job.datasetId&&(!index||job.datasetId!==loadedId)){
        self.postMessage({kind:"stage",id:job.id,
          message:"Opening the complete network from browser storage…"});
        const dataset=await loadFundingDataset(job.datasetId);
        index=buildAdaptiveGraphIndex(dataset.graph);
        navigation=buildNetworkNavigation(dataset.graph);
        loadedId=dataset.id;
      }
    }
    if(!index||!navigation)throw Error("No complete network is ready for exploration.");
    if(job.kind==="overview"){
      self.postMessage({kind:"stage",id:job.id,
        message:"Preparing the whole-network view…"});
      const projection=projectAdaptiveGraph(index,job.expandedIds??[]);
      self.postMessage({kind:"result",action:"overview",id:job.id,projection});
    }else if(job.kind==="full"){
      self.postMessage({kind:"stage",id:job.id,
        message:"Positioning every original entity and relationship…"});
      const geometry=layoutFullNetwork(index.source);
      self.postMessage({kind:"result",action:"full",id:job.id,geometry},
        [geometry.positions.buffer,geometry.segments.buffer,geometry.types.buffer]);
    }else if(job.kind==="search"){
      const matches=searchNetwork(navigation,job.query??"",20);
      self.postMessage({kind:"result",action:"search",id:job.id,matches});
    }else if(job.kind==="select"){
      if(!job.nodeId)throw Error("Select an entity to explore.");
      const inspection=inspectNetworkNode(navigation,job.nodeId);
      if(job.mode==="full"){
        self.postMessage({kind:"result",action:"select",id:job.id,inspection,
          expandedIds:job.expandedIds??[]});
        return;
      }
      try{
        const revealed=revealNetworkNode(index,job.expandedIds??[],job.nodeId);
        self.postMessage({kind:"result",action:"select",id:job.id,
          projection:revealed.projection,inspection,
          expandedIds:revealed.expandedIds,
          collapsedOtherGroups:revealed.collapsedOtherGroups});
      }catch(error){
        // A dense visual area must never block inspection of a real source
        // entity. Leave the last valid overview in place.
        self.postMessage({kind:"result",action:"select",id:job.id,inspection,
          expandedIds:job.expandedIds??[],visualLimit:
            error instanceof Error?error.message:
            "The entity cannot be revealed at this detail level."});
      }
    }else if(job.kind==="inspect"){
      if(!job.nodeId)throw Error("Select an entity to explore.");
      const inspection=inspectNetworkNode(navigation,job.nodeId,
        {query:job.query??"",page:job.page??1,pageSize:20});
      self.postMessage({kind:"result",action:"inspect",id:job.id,inspection});
    }
  }catch(error){
    self.postMessage({kind:"failed",action:job.kind,id:job.id,
      message:error instanceof Error?error.message:
        "Could not explore the complete network."});
  }
};
