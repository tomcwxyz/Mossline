import {parseGraphDocument,type GraphDocument} from "./schema";

/** Portable, browser-local dataset archive. This is not a sanitised publication format. */
export const FUNDING_BACKUP_FORMAT="mossline-funding-datasets-backup" as const;
export type FundingDatasetEntry={
  id:string;createdAt:number;sourceTitle:string;grantCount:number;graph:GraphDocument;
};
export type FundingDatasetMeta=Omit<FundingDatasetEntry,"graph">;
export type FundingDatasetBackup={
  format:typeof FUNDING_BACKUP_FORMAT;version:1;exportedAt:string;
  datasets:FundingDatasetEntry[];
};

export function makeFundingDatasetBackup(datasets:FundingDatasetEntry[]):FundingDatasetBackup{
  return {format:FUNDING_BACKUP_FORMAT,version:1,
    exportedAt:new Date().toISOString(),datasets};
}

/** Validate an untrusted archive before any IndexedDB write. Refuse partial restores. */
export function parseFundingDatasetBackup(value:unknown):FundingDatasetBackup{
  if(!value||typeof value!=="object")throw Error("Invalid funding backup file.");
  const data=value as Record<string,unknown>;
  if(data.format!==FUNDING_BACKUP_FORMAT||data.version!==1)
    throw Error("Not a supported Mossline funding-dataset backup.");
  if(typeof data.exportedAt!=="string"||!Number.isFinite(Date.parse(data.exportedAt)))
    throw Error("The backup has no valid export date.");
  if(!Array.isArray(data.datasets)||!data.datasets.length||data.datasets.length>100)
    throw Error("The backup must contain between 1 and 100 datasets.");
  const ids=new Set<string>();
  const datasets=data.datasets.map((item:unknown)=>{
    if(!item||typeof item!=="object")throw Error("Invalid dataset in backup.");
    const record=item as Record<string,unknown>;
    if(typeof record.id!=="string"||!record.id||record.id.length>128||
      typeof record.createdAt!=="number"||!Number.isFinite(record.createdAt)||
      typeof record.sourceTitle!=="string"||!record.sourceTitle||record.sourceTitle.length>500||
      typeof record.grantCount!=="number"||!Number.isSafeInteger(record.grantCount)||
      record.grantCount<0)throw Error("Funding backup contains invalid dataset metadata.");
    if(ids.has(record.id))throw Error("Funding backup contains duplicate dataset IDs.");
    ids.add(record.id);
    const graph=parseGraphDocument(record.graph);
    const count=graph.nodes.filter(n=>n.properties?.mosslineFundingGrant===true).length;
    if(count!==record.grantCount)throw Error("Funding backup grant totals do not match its records.");
    return {id:record.id,createdAt:record.createdAt,
      sourceTitle:record.sourceTitle,grantCount:record.grantCount,graph};
  });
  return {format:FUNDING_BACKUP_FORMAT,version:1,
    exportedAt:data.exportedAt,datasets};
}
