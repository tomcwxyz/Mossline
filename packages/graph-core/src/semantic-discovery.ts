import {fundingAwards,type FundingAward} from "./funding";
import type {GraphDocument} from "./schema";

/** The only fields deliberately sent to an optional remote embedding service.
 * No source metadata, organisation contact details, graph properties or awards amounts.
 */
export type DiscoveryDocument={
  grantId:string;recipientId:string;funderId:string;
  title:string;excerpt:string;themes:string[];text:string;
};
export type SemanticSuggestion={
  id:string;recipientA:string;recipientB:string;funderA:string;funderB:string;
  grantA:string;grantB:string;excerptA:string;excerptB:string;
  titleA:string;titleB:string;similarity:number;differentFunders:boolean;
  method:"embedding";model:string;
};
const clean=(input:string)=>input.replace(/\s+/g," ").trim();
const LIMIT=48;
export function prepareFundingDiscovery(graph:GraphDocument,max=LIMIT):DiscoveryDocument[]{
  const records=fundingAwards(graph);
  const result:DiscoveryDocument[]=[];
  for(const a of records){
    // Avoid one-word titles, empty grant boilerplate and uninformative matching.
    const text=clean([a.title,a.description,a.programme,a.themes.join("; ")].filter(Boolean).join(". ")).slice(0,850);
    if(text.length<35)continue;
    result.push({grantId:a.grantId,recipientId:a.recipientId,funderId:a.funderId,
      title:clean(a.title).slice(0,110),
      excerpt:clean(a.description||a.title).slice(0,280),
      themes:a.themes.slice(0,8),text});
    if(result.length>=Math.max(1,Math.min(LIMIT,max)))break;
  }
  return result;
}
export function cosineSimilarity(left:number[],right:number[]):number{
  if(left.length===0||right.length!==left.length||left.length>8192)return 0;
  let product=0,lengthA=0,lengthB=0;
  for(let i=0;i<left.length;i++){
    const a=left[i],b=right[i];
    if(!Number.isFinite(a)||!Number.isFinite(b))return 0;
    product+=a*b;lengthA+=a*a;lengthB+=b*b;
  }
  if(lengthA===0||lengthB===0)return 0;
  return Math.max(-1,Math.min(1,product/Math.sqrt(lengthA*lengthB)));
}
/** Suggestions are kept separate from GraphDocument; this function NEVER
 * infers or saves any network edges.
 */
export function rankSemanticSuggestions(docs:DiscoveryDocument[],embeddings:number[][],
  model:string,minSimilarity=0.67,maxResults=15):SemanticSuggestion[]{
  if(docs.length!==embeddings.length||embeddings.some(v=>!Array.isArray(v)||
    v.length===0||v.length!==embeddings[0]?.length))
    throw Error("Embedding response did not match the reviewed grant records");
  if(!Number.isFinite(minSimilarity)||minSimilarity<0||minSimilarity>1)
    throw Error("Invalid similarity threshold");
  const candidates=new Map<string,SemanticSuggestion>();
  for(let i=0;i<docs.length;i++)for(let j=i+1;j<docs.length;j++){
    const a=docs[i],b=docs[j];
    if(a.recipientId===b.recipientId)continue;
    const similarity=cosineSimilarity(embeddings[i],embeddings[j]);
    if(similarity<minSimilarity)continue;
    const pair=[a.recipientId,b.recipientId].sort();
    const key=JSON.stringify(pair);
    const forward=pair[0]===a.recipientId;
    const first=forward?a:b,second=forward?b:a;
    const item:SemanticSuggestion={
      id:key,recipientA:first.recipientId,recipientB:second.recipientId,
      funderA:first.funderId,funderB:second.funderId,
      grantA:first.grantId,grantB:second.grantId,
      titleA:first.title,titleB:second.title,
      excerptA:first.excerpt,excerptB:second.excerpt,
      similarity:Number(similarity.toFixed(4)),
      differentFunders:first.funderId!==second.funderId,
      method:"embedding",model
    };
    if(!candidates.has(key)||similarity>candidates.get(key)!.similarity)candidates.set(key,item);
  }
  return [...candidates.values()].sort((a,b)=>b.similarity-a.similarity||
    a.id.localeCompare(b.id)).slice(0,Math.max(1,Math.min(30,maxResults)));
}
export type ReviewDecision="interesting"|"dismissed";
export type DiscoveryReview={id:string;decision:ReviewDecision;updatedAt:string};
export function reviewKey(graphIdentity:string,candidateId:string):string{
  return JSON.stringify([graphIdentity,candidateId]);
}
