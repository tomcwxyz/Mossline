import {isRecorded,placedCoordinates,type GraphDocument} from "@mossline/graph-core";

export type PositionedLink={
  id:string;source:string;target:string;type:string;count:number;
  from:[number,number];to:[number,number];
};
export type SpatialConnections={
  links:PositionedLink[];recorded:number;unplaced:number;colocated:number;plotted:number;
};
/** Only recorded direct relationships with both endpoints placed can appear as map lines.
 * Suggested similarities or third-party relationships are not geographical links.
 * Repeated rows with the same directed endpoints and type share a line and retain a count.
 */
export function spatialConnections(graph:GraphDocument):SpatialConnections{
  const coords=new Map(graph.nodes.flatMap(n=>{
    const p=placedCoordinates(n);
    return p?[[n.id,[p.lon,p.lat] as [number,number]] as const]:[];
  }));
  const seen=new Map<string,PositionedLink>();
  let recorded=0,unplaced=0,colocated=0,plotted=0;
  for(const e of graph.edges){
    if(!isRecorded(e))continue;
    recorded++;
    const from=coords.get(e.source),to=coords.get(e.target);
    if(!from||!to){unplaced++;continue;}
    if(Math.abs(from[0]-to[0])<.000001&&Math.abs(from[1]-to[1])<.000001){colocated++;continue;}
    plotted++;
    const key=JSON.stringify([e.source,e.target,e.type]);
    const existing=seen.get(key);
    if(existing){existing.count++;continue;}
    seen.set(key,{id:e.id,source:e.source,target:e.target,type:e.type,count:1,from,to});
  }
  const links=[...seen.values()].sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id));
  return {links,recorded,unplaced,colocated,plotted};
}
export const SPATIAL_LINK_LIMIT=450;
