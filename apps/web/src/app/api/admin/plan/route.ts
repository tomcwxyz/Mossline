import {reportError} from "../../../../lib/report";
import {apiResult} from "../../../../lib/hosted-response";
import {readJsonBody} from "../../../../lib/hosted-auth";
import {isOperator,requireSignedIn} from "../../../../lib/hosted-guard";
import {setPlan} from "../../../../lib/orgs-db";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Puts an organisation on a plan by hand: paid by invoice, or given by the operator. */
export async function POST(request:Request){
  const user=await requireSignedIn(request,{write:true});
  if(user instanceof Response)return user;
  if(!isOperator(user.email))return apiResult({error:"Not found"},404);
  let body:{orgId?:unknown;plan?:unknown;until?:unknown;source?:unknown};
  try{body=await readJsonBody(request,1_000) as typeof body;}catch{return apiResult({error:"Couldn't read that"},400);}
  const orgId=typeof body.orgId==="string"?body.orgId:"";
  const plan=body.plan==="organisation"?"organisation":"free";
  const until=typeof body.until==="string"&&body.until?new Date(body.until):null;
  if(until&&Number.isNaN(until.getTime()))return apiResult({error:"That end date isn't a date"},400);
  const source=body.source==="operator"?"operator":"invoice";
  try{await setPlan(orgId,plan,until,source);return apiResult({ok:true});}
  catch(error){reportError("admin/plan",error);return apiResult({error:"Temporarily unavailable"},503);}
}
