import {reportError} from "../../../../lib/report";
import {apiResult} from "../../../../lib/hosted-response";
import {readJsonBody} from "../../../../lib/hosted-auth";
import {requireSignedIn} from "../../../../lib/hosted-guard";
import {join,orgOf} from "../../../../lib/orgs-db";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Accepts an invitation, or joins an organisation open to this account's email domain. */
export async function POST(request:Request){
  const user=await requireSignedIn(request,{write:true});
  if(user instanceof Response)return user;
  let orgId="";
  try{const body=await readJsonBody(request,1_000) as {orgId?:unknown};orgId=typeof body?.orgId==="string"?body.orgId:"";}catch{/* below */}
  try{
    if(await orgOf(user.id))return apiResult({error:"You're already in an organisation. Leave it first."},409);
    if(!await join(user.id,user.email,orgId))return apiResult({error:"That invitation isn't there any more"},404);
    return apiResult({org:await orgOf(user.id)});
  }catch(error){reportError("org/join",error);return apiResult({error:"Organisations are temporarily unavailable"},503);}
}
