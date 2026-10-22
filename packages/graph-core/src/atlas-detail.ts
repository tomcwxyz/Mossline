import type {FullNetworkGeometry} from "./full-network-layout";

/** A layout-specific, screen-based scale, not a graph-size-dependent cutoff. */
export type AtlasDetail="landscape"|"area"|"entity";
export function atlasDetailLevel(geometry:FullNetworkGeometry,zoom:number):AtlasDetail{
 if(geometry.arrangement==="types"||!geometry.areas.length)return "entity";
 const radii=geometry.areas.map(a=>a.radius).sort((a,b)=>a-b);
 const median=radii[Math.floor(radii.length/2)]*zoom;
 if(median<105)return "landscape";
 return median<250?"area":"entity";
}
export type AtlasNodeLabel={index:number;x:number;y:number;label:string};
/** Screen-pixel collision avoidance and deterministic source-entity prioritisation.
 * Labels do not limit records drawn or available to click/search.
 */
export function visibleAtlasNodeLabels(
 geometry:FullNetworkGeometry,zoom:number,offsetX:number,offsetY:number,
 width:number,height:number,maxLabels=22
):AtlasNodeLabel[]{
 const level=atlasDetailLevel(geometry,zoom);
 if(level==="landscape"||width<80||height<80)return [];
 const cap=Math.min(maxLabels,level==="area"?12:36);
 const candidates:{index:number;x:number;y:number;score:number;label:string}[]=[];
 for(let i=0;i<geometry.nodeCount;i++){
  const x=width/2+(geometry.positions[2*i]+offsetX)*zoom;
  const y=height/2+(geometry.positions[2*i+1]+offsetY)*zoom;
  if(x<15||x>width-15||y<15||y>height-15)continue;
  // At intermediate scales only genuine high-degree connectors receive text.
  const size=geometry.degreeSizes[i]??3.5;
  if(level==="area"&&size<7)continue;
  candidates.push({index:i,x,y,label:geometry.labels[i],
    score:size*100-(Math.abs(x-width/2)+Math.abs(y-height/2))*.05});
 }
 candidates.sort((a,b)=>b.score-a.score||
   a.label.localeCompare(b.label)||a.index-b.index);
 const labels:AtlasNodeLabel[]=[];
 const occupied:{x:number;y:number;w:number;h:number}[]=[];
 for(const candidate of candidates){
  const text=candidate.label.length>34?
    candidate.label.slice(0,32)+"…":candidate.label;
  const w=Math.min(width-24,Math.max(40,text.length*6.5+13));
  const x=Math.max(8,Math.min(width-w-8,candidate.x+11));
  const y=Math.max(8,Math.min(height-20,candidate.y-12));
  if(occupied.some(o=>x<o.x+o.w+6&&x+w+6>o.x&&
    y<o.y+o.h+4&&y+19+4>o.y))continue;
  occupied.push({x,y,w,h:19});
  labels.push({index:candidate.index,x,y,label:text});
  if(labels.length>=cap)break;
 }
 return labels;
}
