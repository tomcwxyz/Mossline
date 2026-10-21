import type {GraphDocument} from "@mossline/graph-core";

export const FUNDING_DATASET_DB="mossline-funding-datasets-v1";
const STORE="datasets";
export type StoredFundingDataset={
  id:string;createdAt:number;sourceTitle:string;grantCount:number;
  graph:GraphDocument;
};
function open():Promise<IDBDatabase>{
  if(typeof indexedDB==="undefined")return Promise.reject(
    new Error("This browser does not support IndexedDB dataset storage."));
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(FUNDING_DATASET_DB,1);
    request.onupgradeneeded=()=>{
      const database=request.result;
      if(!database.objectStoreNames.contains(STORE))database.createObjectStore(STORE,{keyPath:"id"});
    };
    request.onerror=()=>reject(request.error??Error("Could not open dataset storage"));
    request.onsuccess=()=>resolve(request.result);
    request.onblocked=()=>reject(Error("Dataset storage is blocked by another browser tab"));
  });
}
export async function saveFundingDataset(graph:GraphDocument):Promise<string>{
  const db=await open();
  const id=crypto.randomUUID();
  try{
    await new Promise<void>((resolve,reject)=>{
      const transaction=db.transaction(STORE,"readwrite");
      transaction.oncomplete=()=>resolve();
      transaction.onerror=()=>reject(transaction.error??Error("Could not save funding dataset"));
      transaction.onabort=()=>reject(transaction.error??Error("Dataset storage transaction aborted"));
      transaction.objectStore(STORE).put({
        id,createdAt:Date.now(),sourceTitle:graph.title,
        grantCount:graph.nodes.filter(n=>n.properties?.mosslineFundingGrant===true).length,
        graph
      } satisfies StoredFundingDataset);
    });
    return id;
  }finally{db.close();}
}
export async function loadFundingDataset(id:string):Promise<StoredFundingDataset>{
  const db=await open();
  try{
    const result=await new Promise<StoredFundingDataset|undefined>((resolve,reject)=>{
      const t=db.transaction(STORE,"readonly");
      const request=t.objectStore(STORE).get(id);
      request.onsuccess=()=>resolve(request.result as StoredFundingDataset|undefined);
      request.onerror=()=>reject(request.error??Error("Cannot load saved funding data"));
    });
    if(!result)throw Error("Full funding dataset not found on this browser. Reimport its CSV to restore it.");
    if(!result.graph||!Array.isArray(result.graph.nodes)||!Array.isArray(result.graph.edges))
      throw Error("The stored funding dataset is incomplete. Reimport its CSV.");
    return result;
  }finally{db.close();}
}
export async function deleteFundingDataset(id:string):Promise<void>{
  const db=await open();
  try{
    await new Promise<void>((resolve,reject)=>{
      const transaction=db.transaction(STORE,"readwrite");
      transaction.oncomplete=()=>resolve();
      transaction.onerror=()=>reject(transaction.error??Error("Could not delete dataset"));
      transaction.objectStore(STORE).delete(id);
    });
  }finally{db.close();}
}
