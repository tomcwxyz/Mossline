import {fundingAwards} from "./funding";
import {identifyFundingThemes} from "./funding-clusters";
import {parseGraphDocument,type GraphDocument,type GraphNode} from "./schema";

/** Query over the complete organisation-only grant graph. Nothing here depends
 * on the currently rendered selection or a hard-coded preselected set of grants.
 */
export type FundingGraphQuery={
  theme?:string;funderId?:string;recipientId?:string;
  region?:string;search?:string;page?:number;pageSize?:number;
};
export type FundingProjection={
  graph:GraphDocument;matchingGrants:number;displayedGrants:number;
  page:number;pages:number;pageSize:number;
};
export const MAX_FUNDING_CANVAS_GRANTS=120;
export function projectFundingGraph(source:GraphDocument,query:FundingGraphQuery={}):FundingProjection{
  const pageSize=Math.max(1,Math.min(MAX_FUNDING_CANVAS_GRANTS,
    Math.floor(Number.isFinite(query.pageSize)?query.pageSize!:75)));
  const requestedPage=Math.max(1,Math.floor(Number.isFinite(query.page)?query.page!:1));
  const nodes=new Map(source.nodes.map(n=>[n.id,n]));
  const value=(s?:string)=>s?.trim().toLocaleLowerCase("en-GB")??"";
  const term=value(query.search);
  const selected=fundingAwards(source).filter(award=>{
    if(query.funderId&&award.funderId!==query.funderId)return false;
    if(query.recipientId&&award.recipientId!==query.recipientId)return false;
    if(query.region&&value(nodes.get(award.recipientId)?.region)!==value(query.region))return false;
    if(query.theme&&!identifyFundingThemes(award).some(t=>t.id===query.theme))return false;
    if(term){
      const funder=nodes.get(award.funderId)?.label??"";
      const recipient=nodes.get(award.recipientId)?.label??"";
      const haystack=value([award.title,award.description,award.programme,
        award.themes.join(" "),funder,recipient].join(" "));
      if(!haystack.includes(term))return false;
    }
    return true;
  });
  // With no filters, round-robin grants by funder to avoid the first 75
  // records being dominated by one very large publisher. Sort IDs for
  // reproducibility independently of imported row ordering.
  let ordered=selected;
  if(!query.funderId&&!query.recipientId&&!query.region&&!query.theme&&!term){
    const buckets=new Map<string,typeof selected>();
    for(const a of [...selected].sort((a,b)=>a.grantId.localeCompare(b.grantId))){
      const bucket=buckets.get(a.funderId)??[];
      bucket.push(a);buckets.set(a.funderId,bucket);
    }
    ordered=[];
    const keys=[...buckets.keys()].sort();
    for(let round=0;ordered.length<selected.length;round++){
      let found=false;
      for(const key of keys){
        const item=buckets.get(key)?.[round];
        if(item){ordered.push(item);found=true;}
      }
      if(!found)break;
    }
  }else{
    ordered=[...selected].sort((a,b)=>a.grantId.localeCompare(b.grantId));
  }
  const matchingGrants=ordered.length;
  const pages=Math.max(1,Math.ceil(matchingGrants/pageSize));
  const page=Math.min(requestedPage,pages);
  const portion=ordered.slice((page-1)*pageSize,page*pageSize);
  const chosen=new Set(portion.map(a=>a.grantId));
  for(const award of portion){chosen.add(award.funderId);chosen.add(award.recipientId);}
  const reducedNodes=source.nodes.filter(n=>chosen.has(n.id));
  const reducedEdges=source.edges.filter(e=>chosen.has(e.source)&&chosen.has(e.target));
  return {graph:parseGraphDocument({
    version:1,title:source.title,
    description:source.description+" This canvas displays "+portion.length+" of "+
      matchingGrants+" matching unique organisation grants (page "+page+" of "+pages+
      "). Complete data is retained in this browser for further exploration.",
    nodes:reducedNodes,edges:reducedEdges
  }),matchingGrants,displayedGrants:portion.length,page,pages,pageSize};
}
