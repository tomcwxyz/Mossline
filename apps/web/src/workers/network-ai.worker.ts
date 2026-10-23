/// <reference lib="webworker" />
import {prepareNetworkSemanticDocuments,rankNetworkSemanticHits,sourceRelationsAmong,
  sourceNetworkInsights,semanticNetworkInsights,
  type NetworkSemanticDocument,type GraphDocument}
  from "@mossline/graph-core";
import {loadFundingDataset} from "../lib/funding-dataset-store";

type Incoming={
 kind:"init"|"index"|"ask"|"cancel";id:number;
 datasetId?:string;graph?:GraphDocument;model?:string;
 accessKey?:string;question?:string;withAnswer?:boolean;
};
type CacheRow={key:string;model:string;signature:string;start:number;vectors:number[][]};
const DB="mossline-network-semantic-v1",STORE="batches",META="complete";
const BATCH=48;
// Below the observed five requests/minute free-tier allowance; one request
// every 15s leaves headroom for questions or other work sharing the account.
const EMBEDDING_GAP_MS=15_000;
let nextEmbeddingAt=0;
let graph:GraphDocument|null=null;
let docs:NetworkSemanticDocument[]=[];
let signature="",currentModel="",cachePrefix="",running=false;
let cancel=false,activeController:AbortController|null=null;
let inMemory:number[][]|null=null;

function respond(payload:Record<string,unknown>){
 self.postMessage(payload);
}
function openDB():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:"key"});
   if(!db.objectStoreNames.contains(META))db.createObjectStore(META,{keyPath:"key"});
  };
  req.onerror=()=>reject(req.error??Error("Could not open semantic cache"));
  req.onsuccess=()=>resolve(req.result);
 });
}
async function getRow(db:IDBDatabase,store:string,key:string):Promise<any>{
 return new Promise((resolve,reject)=>{
  const r=db.transaction(store,"readonly").objectStore(store).get(key);
  r.onsuccess=()=>resolve(r.result);
  r.onerror=()=>reject(r.error??Error("Cannot read semantic cache"));
 });
}
async function putRow(db:IDBDatabase,store:string,value:Record<string,unknown>):Promise<void>{
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(store,"readwrite");
  tx.oncomplete=()=>resolve();
  tx.onabort=()=>reject(tx.error??Error("Could not save semantic cache"));
  tx.objectStore(store).put(value);
 });
}
async function hashDocuments(items:NetworkSemanticDocument[]):Promise<string>{
 // Hash every identifier and every text, never a truncated first-page sample.
 const encoder=new TextEncoder();
 const parts:Uint8Array[]=[];
 for(let start=0;start<items.length;start+=256){
   const chunk=items.slice(start,start+256)
     .map(d=>JSON.stringify([d.id,d.text])).join("\n");
   parts.push(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(chunk))));
 }
 const data=new Uint8Array(parts.length*32+8);
 const view=new DataView(data.buffer);
 view.setUint32(0,items.length);
 view.setUint32(4,parts.length);
 parts.forEach((part,i)=>data.set(part,8+i*32));
 const buf=await crypto.subtle.digest("SHA-256",data);
 return [...new Uint8Array(buf)].map(n=>n.toString(16).padStart(2,"0")).join("");
}
async function waitForEmbedding(ms:number,controller:AbortController,id:number,
  reason:string):Promise<void>{
 if(ms<=0)return;
 respond({kind:"waiting",id,message:reason+" ("+Math.ceil(ms/1000)+"s). "+
   "Finished batches remain saved in this browser."});
 await new Promise<void>((resolve,reject)=>{
   if(controller.signal.aborted){reject(Error("Indexing cancelled."));return;}
   const done=()=>{clearTimeout(timer);controller.signal.removeEventListener("abort",abort);};
   const abort=()=>{done();reject(Error("Indexing cancelled."));};
   const timer=setTimeout(()=>{done();resolve();},ms);
   controller.signal.addEventListener("abort",abort,{once:true});
 });
}
async function sendEmbed(items:{id:string;text:string}[],key:string,
  controller:AbortController,jobId:number):Promise<number[][]>{
 for(let attempt=0;attempt<8;attempt++){
   await waitForEmbedding(Math.max(0,nextEmbeddingAt-Date.now()),controller,jobId,
     "Respecting the provider request limit");
   if(cancel||controller.signal.aborted)throw Error("Indexing cancelled.");
   nextEmbeddingAt=Date.now()+EMBEDDING_GAP_MS;
   const response=await fetch("/api/discovery/embed",{
     method:"POST",cache:"no-store",credentials:"same-origin",signal:controller.signal,
     headers:{"Content-Type":"application/json",...(key?{Authorization:"Bearer "+key}:{})},
     body:JSON.stringify({documents:items})
   });
   const contentType=response.headers.get("content-type")??"";
   if(!contentType.includes("application/json"))throw Error(
     "Embedding endpoint returned HTTP "+response.status+
     " rather than JSON. Check preview authentication.");
   const result=await response.json() as {model?:string;ids?:string[];
     vectors?:number[][];error?:string;retryAfterSeconds?:number};
   if(response.status===429){
     const safe=Number(result.retryAfterSeconds);
     const delay=Number.isFinite(safe)&&safe>0?
       Math.max(60,Math.min(120,Math.ceil(safe))):60;
     nextEmbeddingAt=Math.max(nextEmbeddingAt,Date.now()+delay*1000);
     if(attempt===7)throw Error(
       "The embedding provider is still rate-limiting this network. "+
       "Completed batches are saved; try resuming later.");
     continue;
   }
   if(!response.ok||!result.model||!result.vectors)
     throw Error(typeof result.error==="string"?result.error:
       "Embedding request failed (HTTP "+response.status+").");
   if(JSON.stringify(result.ids)!==JSON.stringify(items.map(d=>d.id)))
     throw Error("Embedding reply did not match source identifiers.");
   if(result.vectors.length!==items.length||result.vectors.some(v=>!v.length||
     v.length!==result.vectors?.[0].length||!v.every(Number.isFinite)))
     throw Error("Embedding dimensions are missing or inconsistent.");
   if(currentModel&&currentModel!==result.model)throw Error(
     "Configured embedding model changed. Re-open the network and rebuild its index.");
   return result.vectors;
 }
 throw Error("Embedding provider rate limit did not recover.");
}
async function initialise(job:Incoming){
 if(job.graph)graph=job.graph;
 else if(job.datasetId)graph=(await loadFundingDataset(job.datasetId)).graph;
 if(!graph)throw Error("The complete source graph is unavailable.");
 const prepared=prepareNetworkSemanticDocuments(graph);
 docs=prepared.documents;
 currentModel=job.model??"";
 inMemory=null;
 signature=await hashDocuments(docs);
 cachePrefix=signature+":"+currentModel;
 const db=await openDB();
 try{
  const complete=await getRow(db,META,cachePrefix);
  const insights=sourceNetworkInsights(graph,new Set(docs.map(d=>d.id)));
  respond({kind:"plan",id:job.id,total:prepared.totalNodes,
    eligible:docs.length,excludedPrivate:prepared.excludedPrivate,
    batches:Math.ceil(docs.length/BATCH),cached:!!complete?.complete,
    model:currentModel,insights});
  if(complete?.complete)void emitSemanticInsights(job.id);
 }finally{db.close();}
}
async function indexAll(job:Incoming){
 if(running)throw Error("Indexing is already running.");
 if(!graph||!currentModel)throw Error("Embedding provider is not configured.");
 const key=job.accessKey??"";
 if(key.length>0&&key.length<32)throw Error("Invalid discovery access code.");
 running=true;cancel=false;inMemory=null;
 const db=await openDB();
 try{
  let embedded=0;
  for(let start=0;start<docs.length;start+=BATCH){
   if(cancel)throw Error("Indexing cancelled. Completed batches were saved locally.");
   const batch=docs.slice(start,start+BATCH);
   const batchKey=cachePrefix+":"+start;
   let cached=await getRow(db,STORE,batchKey) as CacheRow|undefined;
   if(!cached||cached.vectors.length!==batch.length||
      cached.model!==currentModel||cached.signature!==signature){
      const inputs=batch.map((d,i)=>({id:"d"+(start+i),text:d.text}));
      const controller=new AbortController();activeController=controller;
      const vectors=await sendEmbed(inputs,key,controller,job.id);
      activeController=null;
      if(cancel)throw Error("Indexing cancelled. Completed batches were saved locally.");
      cached={key:batchKey,model:currentModel,signature,start,vectors};
      await putRow(db,STORE,cached);
   }
   embedded+=batch.length;
   respond({kind:"progress",id:job.id,completed:embedded,total:docs.length,
     batches:Math.ceil(docs.length/BATCH)});
  }
  await putRow(db,META,{key:cachePrefix,complete:true,model:currentModel,
    count:docs.length,updatedAt:Date.now()});
  respond({kind:"indexed",id:job.id,completed:embedded,total:docs.length});
  void emitSemanticInsights(job.id);
 }finally{activeController=null;running=false;db.close();}
}
async function loadVectors():Promise<number[][]>{
 if(inMemory)return inMemory;
 const db=await openDB();
 try{
  const meta=await getRow(db,META,cachePrefix);
  if(!meta?.complete||meta.count!==docs.length)throw Error(
    "Semantic index is incomplete. Build it before asking a question.");
  const vectors:number[][]=[];
  for(let i=0;i<docs.length;i+=BATCH){
   const row=await getRow(db,STORE,cachePrefix+":"+i) as CacheRow|undefined;
   if(!row||row.vectors.length!==Math.min(BATCH,docs.length-i))
     throw Error("Cached embeddings are missing. Rebuild the semantic index.");
   vectors.push(...row.vectors);
  }
  return inMemory=vectors;
 }finally{db.close();}
}
async function emitSemanticInsights(id:number){
 if(!graph||!docs.length)return;
 try{
   const vectors=await loadVectors();
   if(cancel)return;
   const insights=semanticNetworkInsights(graph,docs,vectors,6);
   respond({kind:"semantic",id,insights});
 }catch{
   // A slow or unavailable optional suggestion pass must never invalidate
   // an otherwise complete and usable searchable semantic index.
   respond({kind:"semantic",id,insights:[]});
 }
}
async function ask(job:Incoming){
 const question=job.question?.trim()??"";
 const key=job.accessKey??"";
 if(question.length<4||question.length>450)throw Error("Enter a short question.");
 if(key.length>0&&key.length<32)throw Error("Invalid discovery access code.");
 if(!graph)throw Error("Complete graph not loaded.");
 const vectors=await loadVectors();
 const controller=new AbortController();activeController=controller;
 try{
  const query=await sendEmbed([{id:"q",text:question}],key,controller,job.id);
  const hits=rankNetworkSemanticHits(docs,vectors,query[0],8);
  const relations=sourceRelationsAmong(graph,hits.map(x=>x.id),24);
  let answer="",model="";
  // A semantic question can always return retrievable source evidence, even
  // when the optional chat model is not configured.
  if(job.withAnswer&&hits.length){
   const request={
     question,sources:hits.map(h=>({id:h.id,label:h.label,type:h.type,text:h.text})),
     relations:relations.map(({id,source,target,type,inferred})=>
       ({id,source,target,type,inferred}))
   };
   const response=await fetch("/api/discovery/ask",{
     method:"POST",credentials:"same-origin",cache:"no-store",signal:controller.signal,
     headers:{"Content-Type":"application/json",...(key?{Authorization:"Bearer "+key}:{})},
     body:JSON.stringify(request)
   });
   if(!(response.headers.get("content-type")??"").includes("application/json"))
     throw Error("Answer endpoint returned HTTP "+response.status+" rather than JSON.");
   const result=await response.json() as {answer?:string;model?:string;error?:string};
   if(!response.ok||!result.answer)throw Error(typeof result.error==="string"?result.error:"Grounded answer unavailable.");
   answer=result.answer;model=result.model??"";
  }
  respond({kind:"answer",id:job.id,hits,relations,answer,model});
 }finally{activeController=null;}
}
self.onmessage=(event:MessageEvent<Incoming>)=>{
 const job=event.data;
 if(job.kind==="cancel"){
   cancel=true;activeController?.abort();
   return;
 }
 void (async()=>{
  try{
   if(job.kind==="init")await initialise(job);
   else if(job.kind==="index")await indexAll(job);
   else if(job.kind==="ask")await ask(job);
  }catch(error){
   respond({kind:"failed",id:job.id,message:
     error instanceof Error?error.message:typeof error==="string"?error:"Network AI unavailable."});
  }
 })();
};
