import {parseGraphDocument,type FundingFullAnalysis,type GraphDocument}
  from "@mossline/graph-core";
import {generalMapCounts,generalMapStub} from "./general-map-store";

/** The localStorage map library has a stable v1 JSON shape. It is distinct
 * from the complete graph databases, which are stored separately in IndexedDB.
 * Never change the keys or format without a versioned, recoverable migration.
 */
export const MAX_LOCAL_MAPS=8;
export const MAX_AUTO_RESTORE_CHARS=2_600_000;
export type LocalMap={id:string;createdAt:number;title:string;graph:GraphDocument;
  generalDatasetId?:string;sourceCounts?:{nodes:number;edges:number};
  fundingAnalysis?:FundingFullAnalysis;fundingDatasetId?:string};
export type PersistedMapLibrary={activeId:string;maps:LocalMap[]};

/** Store a tiny placeholder for any complete general network held in IndexedDB. */
export function serialiseMapLibrary(maps:readonly LocalMap[],activeId:string):
  PersistedMapLibrary{
  return {activeId,maps:maps.map(m=>m.generalDatasetId?
    {...m,graph:generalMapStub(m.graph),
      sourceCounts:m.sourceCounts??generalMapCounts(m.graph)}:m)};
}

/** Parse the established v1 library; errors are caught by the recovery UI.
 * Unknown optional fields are carried through, not silently thrown away.
 */
export function readStoredMapLibrary(raw:string):PersistedMapLibrary|null{
  const data=JSON.parse(raw) as {activeId?:unknown;maps?:unknown};
  if(!data||!Array.isArray(data.maps)||!data.maps.length||
    data.maps.length>MAX_LOCAL_MAPS)return null;
  const maps:LocalMap[]=data.maps.map(item=>{
    if(!item||typeof item!=="object")throw Error("Invalid stored map");
    const entry=item as LocalMap;
    if(typeof entry.id!=="string"||typeof entry.title!=="string"||
      typeof entry.createdAt!=="number")throw Error("Invalid stored map");
    return {...entry,graph:parseGraphDocument(entry.graph)};
  });
  return {activeId:typeof data.activeId==="string"?data.activeId:"",maps};
}
