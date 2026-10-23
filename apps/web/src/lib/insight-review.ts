/**
 * A local-only review ledger. Records candidate IDs and decisions, never the
 * original descriptions or source records. The server must not treat these as
 * authenticated, verified, or shared annotations.
 */
export type InsightReviewDecision="saved"|"dismissed";
export type InsightReviewLedger=Record<string,InsightReviewDecision>;
const REVIEW_PREFIX="mossline-insight-decisions-v1:";
const MAX_DECISIONS=100;
export function insightReviewKey(signature:string,model:string):string{
  return /^[a-f0-9]{64}$/.test(signature)&&/^[a-z0-9._/-]{3,100}$/i.test(model)?
    REVIEW_PREFIX+signature+":"+model:"";
}
export function parseInsightReviewLedger(raw:string|null):InsightReviewLedger{
  if(!raw)return {};
  try{
    const parsed:unknown=JSON.parse(raw);
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return {};
    const result:InsightReviewLedger={};
    for(const [id,decision] of Object.entries(parsed).slice(0,MAX_DECISIONS)){
      if(id.length>0&&id.length<=350&&
        (decision==="saved"||decision==="dismissed"))result[id]=decision;
    }
    return result;
  }catch{return {};}
}
export function setInsightReviewDecision(ledger:InsightReviewLedger,id:string,
  decision:InsightReviewDecision|null):InsightReviewLedger{
  if(!id||id.length>350)throw Error("Invalid insight identifier.");
  const updated={...ledger};
  if(decision===null)delete updated[id];
  else updated[id]=decision;
  if(Object.keys(updated).length>MAX_DECISIONS)
    throw Error("You can keep up to 100 review decisions per network version.");
  return updated;
}
