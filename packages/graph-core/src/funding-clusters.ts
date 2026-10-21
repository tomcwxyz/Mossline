import type {GraphDocument} from "./schema";
import {fundingAwards,TOPIC_BRIDGES,type FundingAward} from "./funding";

/** Analytic grouping ONLY; groups do not become node types or recorded links. */
export type FundingClusterEvidence={
  grantId:string;recipientId:string;funderId:string;
  title:string;description:string;reason:"source-tag"|"phrase-rule";
  phrase:string;
};
export type FundingThemeCluster={
  id:string;title:string;grantCount:number;recipientCount:number;funderCount:number;
  awardsByCurrency:{currency:string;total:number;knownAmounts:number}[];
  organisationBridges:{recipientId:string;funderCount:number;funderIds:string[]}[];
  funderIds:string[];recipientIds:string[];
  evidence:FundingClusterEvidence[];tagEvidence:number;phraseEvidence:number;
};
export type FundingClusterReport={
  clusters:FundingThemeCluster[];
  totalGrants:number;classifiedGrants:number;unclassifiedGrants:number;
  multipleThemeGrants:number;method:"source-tags-and-phrase-rules";
};
const canonical=(value:string)=>value.trim().toLocaleLowerCase("en-GB")
  .replace(/\s+/g," ");
function phraseMatch(text:string,phrase:string):boolean{
  const normal=(input:string)=>" "+input.toLocaleLowerCase("en-GB")
    .replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim()+" ";
  return normal(text).includes(normal(phrase));
}
/** Rules carry explanation phrases, and honour explicit source tags first.
 * The supplied topics are hypotheses, not an authoritative funding taxonomy.
 */
export function identifyFundingThemes(award:FundingAward):{
  id:string;title:string;reason:"source-tag"|"phrase-rule";phrase:string
}[]{
  const matches=new Map<string,{id:string;title:string;reason:"source-tag"|"phrase-rule";phrase:string}>();
  for(const tag of award.themes){
    const value=tag.trim();if(!value)continue;
    const id="source:"+canonical(value);
    if(!matches.has(id))matches.set(id,{id,title:value,reason:"source-tag",phrase:value});
  }
  // Strip programme title here: shared generic grant programmes do not imply common purpose.
  const prose=[award.title,award.description].filter(Boolean).join(" ");
  for(const rule of TOPIC_BRIDGES){
    const phrase=rule.phrases.find(p=>phraseMatch(prose,p));
    if(phrase){
      const id="phrase:"+canonical(rule.topic);
      matches.set(id,{id,title:rule.topic,reason:"phrase-rule",phrase});
    }
  }
  return [...matches.values()];
}
export function buildFundingThemeClusters(graph:GraphDocument,maxEvidence=5):FundingClusterReport{
  const awards=fundingAwards(graph);
  const groups=new Map<string,{
    id:string;title:string;grants:Set<string>;recipients:Set<string>;funders:Set<string>;
    byRecipient:Map<string,Set<string>>;
    amounts:Map<string,{total:number;knownAmounts:number}>;
    evidence:FundingClusterEvidence[];
    tagEvidence:number;phraseEvidence:number;
  }>();
  let classifiedGrants=0,multipleThemeGrants=0;
  for(const grant of awards){
    const topics=identifyFundingThemes(grant);
    if(topics.length)classifiedGrants++;
    if(topics.length>1)multipleThemeGrants++;
    for(const topic of topics){
      let entry=groups.get(topic.id);
      if(!entry){
        entry={id:topic.id,title:topic.title,grants:new Set(),recipients:new Set(),
          funders:new Set(),byRecipient:new Map(),amounts:new Map(),
          evidence:[],tagEvidence:0,phraseEvidence:0};
        groups.set(topic.id,entry);
      }
      // Award IDs are unique in the canonical graph.
      if(entry.grants.has(grant.grantId))continue;
      entry.grants.add(grant.grantId);
      entry.recipients.add(grant.recipientId);entry.funders.add(grant.funderId);
      const other=entry.byRecipient.get(grant.recipientId)??new Set<string>();
      other.add(grant.funderId);entry.byRecipient.set(grant.recipientId,other);
      if(grant.amount!==null&&grant.currency){
        const totals=entry.amounts.get(grant.currency)??{total:0,knownAmounts:0};
        totals.total+=grant.amount;totals.knownAmounts++;
        entry.amounts.set(grant.currency,totals);
      }
      if(topic.reason==="source-tag")entry.tagEvidence++;else entry.phraseEvidence++;
      if(entry.evidence.length<Math.max(1,Math.min(maxEvidence,12)))entry.evidence.push({
        grantId:grant.grantId,recipientId:grant.recipientId,funderId:grant.funderId,
        title:grant.title,description:grant.description.slice(0,250),
        reason:topic.reason,phrase:topic.phrase
      });
    }
  }
  const clusters:FundingThemeCluster[]=[...groups.values()].map(g=>({
    id:g.id,title:g.title,grantCount:g.grants.size,recipientCount:g.recipients.size,
    funderCount:g.funders.size,
    awardsByCurrency:[...g.amounts.entries()].map(([currency,a])=>({currency,...a}))
      .sort((a,b)=>a.currency.localeCompare(b.currency)),
    organisationBridges:[...g.byRecipient.entries()].filter(([,ids])=>ids.size>1)
      .map(([recipientId,ids])=>({recipientId,funderCount:ids.size,funderIds:[...ids]}))
      .sort((a,b)=>b.funderCount-a.funderCount||a.recipientId.localeCompare(b.recipientId))
      .slice(0,12),
    funderIds:[...g.funders],recipientIds:[...g.recipients],
    evidence:g.evidence,tagEvidence:g.tagEvidence,phraseEvidence:g.phraseEvidence
  })).sort((a,b)=>b.grantCount-a.grantCount||a.title.localeCompare(b.title));
  return {clusters,totalGrants:awards.length,classifiedGrants,
    unclassifiedGrants:awards.length-classifiedGrants,multipleThemeGrants,
    method:"source-tags-and-phrase-rules"};
}


/** Compact, portable aggregate built from ALL eligible awards. The complete
 * source graph can then be discarded: do not persist raw 360Giving rows in
 * localStorage or upload them to Mossline's publishing service.
 */
export type FundingFullAnalysis={
  version:1;
  scope:"eligible-organisation-grants";
  grants:number;funders:number;recipients:number;
  amounts:{currency:string;total:number;knownAmounts:number}[];
  multiFundedCount:number;
  leadingFunders:{id:string;name:string;grants:number;recipients:number}[];
  sharedRecipients:{id:string;name:string;funders:number;grants:number}[];
  recipientRegions:{region:string;grants:number}[];
  themes:FundingClusterReport;
};
export function buildFundingFullAnalysis(graph:GraphDocument):FundingFullAnalysis{
  const awards=fundingAwards(graph);
  const names=new Map(graph.nodes.map(n=>[n.id,n.label]));
  const regions=new Map(graph.nodes.map(n=>[n.id,n.region?.trim()??""]));
  const funders=new Map<string,{grants:number;recipients:Set<string>}>();
  const recipients=new Map<string,{grants:number;funders:Set<string>}>();
  const amounts=new Map<string,{total:number;knownAmounts:number}>();
  const recipientRegions=new Map<string,number>();
  for(const a of awards){
    const f=funders.get(a.funderId)??{grants:0,recipients:new Set<string>()};
    f.grants++;f.recipients.add(a.recipientId);funders.set(a.funderId,f);
    const r=recipients.get(a.recipientId)??{grants:0,funders:new Set<string>()};
    r.grants++;r.funders.add(a.funderId);recipients.set(a.recipientId,r);
    if(a.amount!==null&&a.currency){
      const tot=amounts.get(a.currency)??{total:0,knownAmounts:0};
      tot.total+=a.amount;tot.knownAmounts++;amounts.set(a.currency,tot);
    }
    const region=regions.get(a.recipientId)||"Unknown recipient location";
    recipientRegions.set(region,(recipientRegions.get(region)??0)+1);
  }
  const orderedFunders=[...funders.entries()].map(([id,v])=>({
    id,name:names.get(id)??id,grants:v.grants,recipients:v.recipients.size
  })).sort((a,b)=>b.grants-a.grants||a.name.localeCompare(b.name));
  const orderedRecipients=[...recipients.entries()].filter(([,v])=>v.funders.size>1)
    .map(([id,v])=>({id,name:names.get(id)??id,funders:v.funders.size,grants:v.grants}))
    .sort((a,b)=>b.funders-a.funders||b.grants-a.grants||a.name.localeCompare(b.name));
  return {version:1,scope:"eligible-organisation-grants",grants:awards.length,
    funders:funders.size,recipients:recipients.size,
    amounts:[...amounts.entries()].map(([currency,v])=>({currency,...v}))
      .sort((a,b)=>a.currency.localeCompare(b.currency)),
    multiFundedCount:orderedRecipients.length,
    leadingFunders:orderedFunders.slice(0,18),
    sharedRecipients:orderedRecipients.slice(0,18),
    recipientRegions:[...recipientRegions.entries()].map(([region,grants])=>({region,grants}))
      .sort((a,b)=>b.grants-a.grants),
    themes:buildFundingThemeClusters(graph)
  };
}
