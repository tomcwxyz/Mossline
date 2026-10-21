/// <reference lib="webworker" />
import {buildFundingFullAnalysis,importFundingCsv,parseCsv,projectFundingGraph,
  type FundingMapping,type GraphDocument,type ImportFile} from "@mossline/graph-core";
import {saveFundingDataset} from "../lib/funding-dataset-store";

type Job={kind:"analyse"|"persist";id:number;file?:ImportFile;mapping?:FundingMapping};
let currentFile:ImportFile|null=null;
let currentFullGraph:GraphDocument|null=null;
/** Read the first CSV row only, respecting quoted fields and line breaks. */
function headersFromCsv(csv:string):string[]{
  let quoted=false,end=-1;
  for(let i=0;i<csv.length;i++){
    const char=csv[i];
    if(char==='"'){
      if(quoted&&csv[i+1]==='"'){i++;continue;}
      quoted=!quoted;
    }else if(!quoted&&(char==="\n"||char==="\r")){end=i;break;}
  }
  if(end<0)return parseCsv(csv)[0]??[];
  return parseCsv(csv.slice(0,end))[0]??[];
}
self.onmessage=async(event:MessageEvent<Job>)=>{
  const job=event.data;
  if(job.kind==="persist"){
    if(!currentFullGraph){
      self.postMessage({kind:"failed",id:job.id,
        message:"The analysed grant dataset is no longer available. Reanalyse the CSV."});
      return;
    }
    try{
      self.postMessage({kind:"stage",id:job.id,message:
        "Saving the complete organisational funding dataset to local browser storage…"});
      const datasetId=await saveFundingDataset(currentFullGraph);
      self.postMessage({kind:"persisted",id:job.id,datasetId});
    }catch(error){
      self.postMessage({kind:"failed",id:job.id,message:
        error instanceof Error?error.message:"Browser dataset storage failed. Check available disk space."});
    }
    return;
  }
  if(job.kind!=="analyse")return;
  if(job.file)currentFile=job.file;
  if(!currentFile){
    self.postMessage({kind:"failed",id:job.id,message:"Choose a grant CSV file first."});return;
  }
  try{
    currentFullGraph=null;
    self.postMessage({kind:"stage",id:job.id,message:"Reading and checking grant records…"});
    const headings=headersFromCsv(currentFile.text);
    const imported=importFundingCsv(currentFile,job.mapping);
    if(!imported.graph){
      self.postMessage({kind:"result",id:job.id,mapping:imported.mapping,
        headings,graph:null,fullAnalysis:null,issues:imported.issues,
        counts:imported.counts,examples:[]});return;
    }
    self.postMessage({kind:"stage",id:job.id,message:"Calculating full-dataset funding totals and themes…"});
    currentFullGraph=imported.analysisGraph??imported.graph;
    const fullAnalysis=buildFundingFullAnalysis(currentFullGraph);
    const nodesById=new Map(imported.graph.nodes.map(n=>[n.id,n.label]));
    const examples=imported.graph.nodes.filter(n=>n.properties?.mosslineFundingGrant===true)
      .slice(0,6).map(n=>({
        title:n.label,
        funder:nodesById.get(String(n.properties?.funderId))??"Unknown funder",
        recipient:nodesById.get(String(n.properties?.recipientId))??"Unknown recipient"
      }));
    // Never transfer the full award graph or raw CSV back to the main thread.
    // The first network projection is small; later queries can reach all grants from IndexedDB.
    const projection=projectFundingGraph(currentFullGraph,{pageSize:75});
    self.postMessage({kind:"result",id:job.id,headings,graph:projection.graph,
      mapping:imported.mapping,issues:imported.issues,
      counts:{...imported.counts,importedGrants:projection.displayedGrants},fullAnalysis,examples});
  }catch(error){
    self.postMessage({kind:"failed",id:job.id,
      message:error instanceof Error?error.message:"The CSV could not be analysed."});
  }
};
