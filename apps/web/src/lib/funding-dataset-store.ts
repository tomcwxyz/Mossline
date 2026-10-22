import type {GraphDocument} from "@mossline/graph-core";
import {deleteIndexedDbRecord,getIndexedDbRecord,scanIndexedDbRecords,
  writeIndexedDbRecords,type IndexedDbStoreSpec} from "./indexeddb-store";

/** This is the original funding store, not a new migration destination. */
export const FUNDING_DATASET_DB="mossline-funding-datasets-v1";
export const FUNDING_DATASET_STORE:IndexedDbStoreSpec={
  database:FUNDING_DATASET_DB,store:"datasets",version:1,
  unavailable:"This browser does not support IndexedDB dataset storage.",
  openError:"Could not open dataset storage",
  blocked:"Dataset storage is blocked by another browser tab"
};
export type StoredFundingDataset={
  id:string;createdAt:number;sourceTitle:string;grantCount:number;
  graph:GraphDocument;
};

/** Save a full funding dataset in its existing IndexedDB format. */
export async function saveFundingDataset(graph:GraphDocument):Promise<string>{
  const id=crypto.randomUUID();
  await writeIndexedDbRecords(FUNDING_DATASET_STORE,[{
    id,createdAt:Date.now(),sourceTitle:graph.title,
    grantCount:graph.nodes.filter(n=>n.properties?.mosslineFundingGrant===true).length,
    graph
  } satisfies StoredFundingDataset],"put",{aborted:"Could not save funding dataset"});
  return id;
}
export async function loadFundingDataset(id:string):Promise<StoredFundingDataset>{
  const result=await getIndexedDbRecord<StoredFundingDataset>(
    FUNDING_DATASET_STORE,id,"Cannot load saved funding data");
  if(!result)throw Error("Full funding dataset not found on this browser. Reimport its CSV to restore it.");
  if(!result.graph||!Array.isArray(result.graph.nodes)||!Array.isArray(result.graph.edges))
    throw Error("The stored funding dataset is incomplete. Reimport its CSV.");
  return result;
}
export async function deleteFundingDataset(id:string):Promise<void>{
  await deleteIndexedDbRecord(FUNDING_DATASET_STORE,id,"Could not delete dataset");
}

/** Metadata and large graph reads happen in a Web Worker, not React rendering. */
export type FundingDatasetSummary=Omit<StoredFundingDataset,"graph">;
export async function listFundingDatasets():Promise<FundingDatasetSummary[]>{
  const entries=await scanIndexedDbRecords<StoredFundingDataset,FundingDatasetSummary>(
    FUNDING_DATASET_STORE,({id,createdAt,sourceTitle,grantCount})=>({
      id,createdAt,sourceTitle,grantCount
    }),"Cannot list funding datasets");
  return entries.sort((a,b)=>b.createdAt-a.createdAt);
}

/** Atomic add-only restore: any existing ID aborts the entire transaction. */
export async function restoreFundingDatasets(datasets:StoredFundingDataset[]):Promise<void>{
  await writeIndexedDbRecords(FUNDING_DATASET_STORE,datasets,"add",{
    aborted:"Dataset restoration failed; no datasets were imported.",
    constraint:"A dataset from this backup already exists here. Nothing was replaced. "+
      "Remove the conflicting dataset only after checking it is no longer needed."
  });
}
