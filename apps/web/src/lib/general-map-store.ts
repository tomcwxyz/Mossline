import {parseGraphDocument,type GraphDocument} from "@mossline/graph-core";
import {deleteIndexedDbRecord,getIndexedDbRecord,getAllIndexedDbRecords,
  scanIndexedDbRecords,writeIndexedDbRecords,type IndexedDbStoreSpec}
  from "./indexeddb-store";

/** Keep the existing browser DB, object store and record schema unchanged.
 * Small map-library entries hold only an identity and stub for large networks.
 */
export const GENERAL_MAP_STORE:IndexedDbStoreSpec={
  database:"mossline-general-maps-v1",store:"graphs",version:1,
  unavailable:"IndexedDB is unavailable",
  openError:"Cannot open network storage",
  blocked:"Network storage is blocked by another tab"
};
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

export type StoredGeneralMap={id:string;graph:GraphDocument;updatedAt:number};
export type GeneralMapInfo={id:string;title:string;nodes:number;edges:number;updatedAt:number};
export type GeneralMapBackup={
  format:"mossline-general-graphs";version:1;
  exportedAt:string;datasets:StoredGeneralMap[];
};

export async function saveGeneralGraph(id:string,graph:GraphDocument):Promise<void>{
  await writeIndexedDbRecords(GENERAL_MAP_STORE,[{id,graph,updatedAt:Date.now()}],
    "put",{aborted:"Saving the full network failed"});
}
export async function loadGeneralGraph(id:string):Promise<GraphDocument>{
  const value=await getIndexedDbRecord<{graph?:GraphDocument}>(
    GENERAL_MAP_STORE,id,"Cannot read saved network");
  if(!value?.graph||!Array.isArray(value.graph.nodes)||!Array.isArray(value.graph.edges))
    throw Error("The complete map is missing from this browser. Restore an exported backup or reimport its source file.");
  return value.graph;
}
export async function deleteGeneralGraph(id:string):Promise<void>{
  await deleteIndexedDbRecord(GENERAL_MAP_STORE,id,"Could not clean up map storage");
}
export async function listGeneralGraphs():Promise<GeneralMapInfo[]>{
  const result=await scanIndexedDbRecords<StoredGeneralMap,GeneralMapInfo>(
    GENERAL_MAP_STORE,row=>{
      if(!row.graph||!Array.isArray(row.graph.nodes)||!Array.isArray(row.graph.edges))
        return undefined;
      return {id:row.id,title:row.graph.title,
        nodes:row.graph.nodes.length,edges:row.graph.edges.length,
        updatedAt:row.updatedAt??0};
    },"Unable to list saved networks");
  return result.sort((a,b)=>b.updatedAt-a.updatedAt);
}
export async function exportGeneralGraphBackup():Promise<GeneralMapBackup>{
  const datasets=await getAllIndexedDbRecords<StoredGeneralMap>(
    GENERAL_MAP_STORE,"Could not read full network backup");
  return {format:"mossline-general-graphs",version:1,
    exportedAt:new Date().toISOString(),datasets};
}

/** Restore is add-only and all-or-nothing; existing IDs are never overwritten. */
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
  await writeIndexedDbRecords(GENERAL_MAP_STORE,rows,"add",{
    aborted:"Network restoration failed; nothing was imported.",
    constraint:"A map in this backup already exists. No maps were overwritten."
  });
  return rows.length;
}
