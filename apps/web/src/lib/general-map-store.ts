import type {GraphDocument} from "@mossline/graph-core";

/** Large general-purpose maps live in IndexedDB rather than the synchronous
 * localStorage map library. The latter stores only the identity and a tiny stub.
 * Do not delete datasets during a failed or cancelled import.
 */
const DB="mossline-general-maps-v1",STORE="graphs";
export const LARGE_GENERAL_GRAPH_CHARS=300_000;
export type GeneralMapCounts={nodes:number;edges:number};
export const generalMapCounts=(graph:GraphDocument):GeneralMapCounts=>({
  nodes:graph.nodes.length,edges:graph.edges.length
});
export const generalMapStub=(graph:GraphDocument):GraphDocument=>({
  version:1,title:graph.title,description:graph.description,nodes:[],edges:[]
});
export const shouldStoreGeneralGraph=(graph:GraphDocument)=>
  JSON.stringify(graph).length>LARGE_GENERAL_GRAPH_CHARS;
function open():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==="undefined"){reject(Error("IndexedDB is unavailable"));return;}
    const request=indexedDB.open(DB,1);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE,{keyPath:"id"});
    };
    request.onerror=()=>reject(request.error??Error("Cannot open network storage"));
    request.onblocked=()=>reject(Error("Network storage is blocked by another tab"));
    request.onsuccess=()=>resolve(request.result);
  });
}
export async function saveGeneralGraph(id:string,graph:GraphDocument):Promise<void>{
  const db=await open();
  try{
    await new Promise<void>((resolve,reject)=>{
      const transaction=db.transaction(STORE,"readwrite");
      transaction.oncomplete=()=>resolve();
      transaction.onabort=()=>reject(transaction.error??Error("Saving the full network failed"));
      transaction.onerror=()=>{};
      transaction.objectStore(STORE).put({id,graph,updatedAt:Date.now()});
    });
  }finally{db.close();}
}
export async function loadGeneralGraph(id:string):Promise<GraphDocument>{
  const db=await open();
  try{
    const value=await new Promise<{graph?:GraphDocument}|undefined>((resolve,reject)=>{
      const request=db.transaction(STORE,"readonly").objectStore(STORE).get(id);
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error??Error("Cannot read saved network"));
    });
    if(!value?.graph||!Array.isArray(value.graph.nodes)||!Array.isArray(value.graph.edges))
      throw Error("The complete map is missing from this browser. Restore an exported backup or reimport its source file.");
    return value.graph;
  }finally{db.close();}
}
export async function deleteGeneralGraph(id:string):Promise<void>{
  const db=await open();
  try{await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(tx.error??Error("Could not clean up map storage"));
    tx.objectStore(STORE).delete(id);
  });}finally{db.close();}
}
