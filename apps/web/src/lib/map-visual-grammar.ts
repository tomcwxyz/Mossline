import {LINK_INKS,type AtlasTheme} from "../components/atlas/palette";

/** A compact, source-driven visual grammar. Colours never imply facts missing
 * from the data: the legend labels are exactly the recorded relationship or
 * the first recorded tag. Map lines are different from suggested network links. */
export type MapInk={label:string;colour:string;count:number};
export type MapConnection={type:string;count:number};
export type MapCategoryRecord={type:string;tags:readonly string[]};
const MAX_CATEGORIES=6;

export function connectionInkKey(links:readonly MapConnection[],theme:AtlasTheme){
  const counts=new Map<string,number>();
  for(const link of links){
    const name=link.type.trim()||"Connected";
    counts.set(name,(counts.get(name)??0)+link.count);
  }
  const sorted=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"en-GB"));
  const entries:MapInk[]=sorted.slice(0,MAX_CATEGORIES).map(([label,count],i)=>({
    label,count,colour:LINK_INKS[theme][i%LINK_INKS[theme].length]
  }));
  const colours=new Map(entries.map(({label,colour})=>[label,colour]));
  const otherCount=sorted.slice(MAX_CATEGORIES).reduce((sum,[,count])=>sum+count,0);
  if(otherCount>0)entries.push({label:"Other relationships",count:otherCount,
    colour:theme==="night"?"#9FAE9F":"#858A82"});
  const other=theme==="night"?"#9FAE9F":"#858A82";
  return {entries, colour:(type:string)=>colours.get(type.trim()||"Connected")??other};
}

/** Category colour is opt-in only when the source has a small, legible set of
 * first-tag categories. For arbitrary tags, keep established record-type ink. */
export function pointCategoryKey(nodes:readonly MapCategoryRecord[],theme:AtlasTheme){
  const tagged=nodes.filter(node=>node.tags[0]?.trim());
  const counts=new Map<string,number>();
  for(const node of tagged){
    const category=node.tags[0].trim();
    counts.set(category,(counts.get(category)??0)+1);
  }
  const available=nodes.length>=5&&tagged.length/nodes.length>=0.75&&counts.size>=2&&counts.size<=MAX_CATEGORIES;
  const sorted=available?[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"en-GB")):[];
  const entries:MapInk[]=sorted.map(([label,count],i)=>({
    label,count,colour:LINK_INKS[theme][(i+2)%LINK_INKS[theme].length]
  }));
  const colours=new Map(entries.map(({label,colour})=>[label,colour]));
  return {available,entries,colour:(tags:readonly string[])=>colours.get(tags[0]?.trim()??"")??null};
}
