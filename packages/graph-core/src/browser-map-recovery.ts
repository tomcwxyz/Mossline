/** Browser-only map recovery helper. Never imports the graph renderer, parses map
 * schemas or performs graph analytics. Intended to be called inside a Worker.
 */
export const MAP_LIBRARY_STORAGE_KEY="mossline-local-maps-v1";
export const LEGACY_GRAPH_STORAGE_KEY="mossline-demo-graph-v1";

export type MapRecoveryInfo={
  id:string;title:string;createdAt:number;
  nodes:number;edges:number;
};
export type StoredMapRecovery={id:string;title:string;createdAt:number;
  graph:{nodes?:unknown[];edges?:unknown[]};[key:string]:unknown};
export type StoredMapLibraryRecovery={activeId:string;maps:StoredMapRecovery[]};

export function readMapLibraryForRecovery(raw:string):StoredMapLibraryRecovery{
  const value:unknown=JSON.parse(raw);
  if(!value||typeof value!=="object")throw Error("The saved map library is not a JSON object.");
  const record=value as Record<string,unknown>;
  if(!Array.isArray(record.maps))throw Error("The saved map library has no maps collection.");
  if(record.maps.length>200)throw Error("The saved map library has an unexpected number of maps.");
  const seen=new Set<string>();
  const maps=record.maps.map(item=>{
    if(!item||typeof item!=="object")throw Error("An entry in the saved map library is invalid.");
    const map=item as Record<string,unknown>;
    if(typeof map.id!=="string"||!map.id||typeof map.title!=="string"||
      typeof map.createdAt!=="number"||!Number.isFinite(map.createdAt))
      throw Error("A saved map is missing its identity or title.");
    if(seen.has(map.id))throw Error("The saved map library contains duplicate map IDs.");
    seen.add(map.id);
    if(!map.graph||typeof map.graph!=="object")throw Error("A saved map has no graph data.");
    return map as StoredMapRecovery;
  });
  const activeId=typeof record.activeId==="string"&&seen.has(record.activeId)?
    record.activeId:(maps[0]?.id??"");
  return {activeId,maps};
}
export function listRecoveryMaps(data:StoredMapLibraryRecovery):MapRecoveryInfo[]{
  return data.maps.map(m=>({
    id:m.id,title:m.title,createdAt:m.createdAt,
    nodes:Array.isArray(m.graph.nodes)?m.graph.nodes.length:0,
    edges:Array.isArray(m.graph.edges)?m.graph.edges.length:0
  }));
}
export function omitRecoveryMap(data:StoredMapLibraryRecovery,id:string):StoredMapLibraryRecovery{
  if(!data.maps.some(m=>m.id===id))throw Error("That map was not found.");
  const maps=data.maps.filter(m=>m.id!==id);
  const activeId=maps.some(m=>m.id===data.activeId)?data.activeId:(maps[0]?.id??"");
  return {activeId,maps};
}
