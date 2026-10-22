import {parseGraphDocument,type GraphDocument} from "@mossline/graph-core";

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

export type StoredGeneralMap={id:string;graph:GraphDocument;updatedAt:number};
export type GeneralMapInfo={id:string;title:string;nodes:number;edges:number;updatedAt:number};
export type GeneralMapBackup={
  format:"mossline-general-graphs";version:1;
  exportedAt:string;datasets:StoredGeneralMap[];
};
export async function listGeneralGraphs():Promise<GeneralMapInfo[]>{
  const db=await open();
  try{
    return await new Promise((resolve,reject)=>{
      const result:GeneralMapInfo[]=[];
      const request=db.transaction(STORE,"readonly").objectStore(STORE).openCursor();
      request.onerror=()=>reject(request.error??Error("Unable to list saved networks"));
      request.onsuccess=()=>{
        const cursor=request.result;
        if(!cursor){resolve(result.sort((a,b)=>b.updatedAt-a.updatedAt));return;}
        const row=cursor.value as StoredGeneralMap;
        if(row.graph&&Array.isArray(row.graph.nodes)&&Array.isArray(row.graph.edges))
          result.push({id:row.id,title:row.graph.title,
            nodes:row.graph.nodes.length,edges:row.graph.edges.length,
            updatedAt:row.updatedAt??0});
        cursor.continue();
      };
    });
  }finally{db.close();}
}
export async function exportGeneralGraphBackup():Promise<GeneralMapBackup>{
  const db=await open();
  try{
    const rows=await new Promise<StoredGeneralMap[]>((resolve,reject)=>{
      const request=db.transaction(STORE,"readonly").objectStore(STORE).getAll();
      request.onsuccess=()=>resolve(request.result as StoredGeneralMap[]);
      request.onerror=()=>reject(request.error??Error("Could not read full network backup"));
    });
    return {format:"mossline-general-graphs",version:1,
      exportedAt:new Date().toISOString(),datasets:rows};
  }finally{db.close();}
}
/** Restore is add-only and all-or-nothing; existing IDs are not overwritten. */
export async function restoreGeneralGraphBackup(input:unknown):Promise<number>{
  if(!input||typeof input!=="object")throw Error("Invalid network backup");
  const backup=input as Partial<GeneralMapBackup>;
  if(backup.format!=="mossline-general-graphs"||backup.version!==1||
    !Array.isArray(backup.datasets)||backup.datasets.length>100)
    throw Error("This is not a compatible generic network backup");
  const ids=new Set<string>();
  const rows:StoredGeneralMap[]=backup.datasets.map(row=>{
    if(!row||typeof row.id!=="string"||!row.id||ids.has(row.id))
      throw Error("Duplicate or missing map identifier in backup");
    ids.add(row.id);
    return {id:row.id,graph:parseGraphDocument(row.graph),
      updatedAt:typeof row.updatedAt==="number"?row.updatedAt:Date.now()};
  });
  if(!rows.length)return 0;
  const db=await open();
  try{
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite");
      tx.oncomplete=()=>resolve();
      tx.onabort=()=>reject(tx.error?.name==="ConstraintError"?
        Error("A map in this backup already exists. No maps were overwritten."):
        tx.error??Error("Network restoration failed; nothing was imported."));
      tx.onerror=()=>{};
      for(const row of rows)tx.objectStore(STORE).add(row);
    });
  }finally{db.close();}
  return rows.length;
}
