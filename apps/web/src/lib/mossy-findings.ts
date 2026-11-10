import {fundingFlows,isRecorded,recordedCoordinates,recordedYear,type AtlasLens,type GraphDocument} from "@mossline/graph-core";

export type MossyFinding={
  id:string;heading:string;detail:string;lens:AtlasLens;recordId?:string;label:string;
};
export type MossyOverview={
  records:number;relationships:number;findings:MossyFinding[];
  recommended:AtlasLens;missingPlaces:number;noConnections:number;
};

/**
 * Grounded, deterministic observations on the source graph.
 * This is NOT a language-model answer. Suggestions are named as suggestions;
 * counts only use source-recorded links, dates and locations.
 */
export function mossyOverview(graph:GraphDocument):MossyOverview {
  const recorded=graph.edges.filter(isRecorded);
  const degree=new Map(graph.nodes.map(n=>[n.id,0]));
  for(const e of recorded){
    degree.set(e.source,(degree.get(e.source)??0)+1);
    if(e.source!==e.target)degree.set(e.target,(degree.get(e.target)??0)+1);
  }
  const leads=graph.nodes.map(n=>({node:n,degree:degree.get(n.id)??0})).filter(x=>x.degree>0)
    .sort((a,b)=>b.degree-a.degree||a.node.label.localeCompare(b.node.label));
  const located=graph.nodes.filter(n=>recordedCoordinates(n)!==null);
  const flows=fundingFlows(graph);
  const years=recorded.map(recordedYear).filter((v):v is number=>v!==null);
  const distinctYears=[...new Set(years)].sort((a,b)=>a-b);
  const themes=new Map<string,number>();
  for(const node of graph.nodes)for(const tag of new Set(node.tags)){
    if(tag.trim())themes.set(tag,(themes.get(tag)??0)+1);
  }
  const findings:MossyFinding[]=[];
  if(leads[0] && recorded.length>=2){
    const top=leads[0];
    findings.push({id:"connections",heading:"A place to start following connections",
      detail:top.node.label+" has "+top.degree.toLocaleString("en-GB")+" recorded "+(top.degree===1?"relationship":"relationships")+
        ". Open it to follow the evidence behind those connections.",
      lens:"network",recordId:top.node.id,label:"Explore this record"});
  }
  if(flows.length>=2){
    const valued=flows.filter(f=>f.amount!==null && f.currency);
    const currencies=[...new Set(valued.map(f=>f.currency))];
    const amount=currencies.length===1?valued.reduce((n,f)=>n+(f.amount??0),0):null;
    const note=amount!==null?" "+new Intl.NumberFormat("en-GB",{style:"currency",currency:currencies[0]!,maximumFractionDigits:0}).format(amount)+
      " across "+valued.length+" valued awards.":"";
    findings.push({id:"funding",heading:"A funding picture",
      detail:flows.length+" recorded funding "+(flows.length===1?"relationship":"relationships")+". "+note+
        " Shared funders do not prove that recipients collaborate.",
      lens:"funding",label:"Explore funding"});
  }
  if(located.length>=3){
    findings.push({id:"places",heading:"A picture of where things happen",
      detail:located.length+" of "+graph.nodes.length+" records have source-given coordinates."+
        " The other locations are not guessed from names.",
      lens:"map",label:"Explore places"});
  }
  if(distinctYears.length>=2){
    findings.push({id:"time",heading:"A story across time",
      detail:years.length+" recorded relationships carry a year, from "+distinctYears[0]+" to "+distinctYears[distinctYears.length-1]+
        ". Explore when things were recorded, without inventing missing dates.",
      lens:"timeline",label:"Explore time"});
  }
  const topThemes=[...themes].filter(([,n])=>n>=2).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,2);
  if(topThemes.length){
    findings.push({id:"themes",heading:"Themes that recur",
      detail:topThemes.map(([name,count])=>name+" ("+count+")").join(" and ")+
        " appear in the source tags. These are recorded categories, not AI-derived partnerships.",
      lens:"themes",label:"Explore themes"});
  }
  const disconnected=graph.nodes.filter(n=>(degree.get(n.id)??0)===0).length;
  const recommended:AtlasLens=flows.length>=8?"funding":located.length>=Math.max(3,Math.ceil(graph.nodes.length*.5))?"map":
    distinctYears.length>=3&&years.length>=Math.max(5,Math.ceil(recorded.length*.6))?"timeline":"network";
  if(!findings.length)findings.push({id:"records",heading:"Start with the records",
    detail:graph.nodes.length+" records were recognised. No source-recorded relationships are available yet. You can browse records or add a connection.",
    lens:"network",label:"Browse and explore"});
  return {records:graph.nodes.length,relationships:recorded.length,
    findings, recommended,missingPlaces:graph.nodes.length-located.length,noConnections:disconnected};
}
