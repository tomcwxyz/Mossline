import {reportError} from "../../../../lib/report";
import {apiResult} from "../../../../lib/hosted-response";
import {claimPublication} from "../../../../lib/hosted-db";
import {readJsonBody,validPublicationId} from "../../../../lib/hosted-auth";
import {requirePublisher} from "../../../../lib/hosted-guard";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Moves a map published before accounts into the signed-in account, using its management key. */
export async function POST(request:Request){
  const user=await requirePublisher(request,{write:true});
  if(user instanceof Response)return user;
  let slug="",key="";
  try{
    const body=await readJsonBody(request,2_000) as Record<string,unknown>;
    slug=typeof body?.slug==="string"?body.slug.trim():"";
    key=typeof body?.managementKey==="string"?body.managementKey.trim():"";
  }catch{/* answered below */}
  if(!validPublicationId(slug)||!/^[A-Za-z0-9_-]{40,256}$/.test(key))
    return apiResult({error:"Give the publication ID and its management key"},400);
  try{
    if(!await claimPublication(slug,key,user.id))
      return apiResult({error:"No unclaimed publication matches that ID and key"},404);
    return apiResult({claimed:true,slug});
  }catch(error){reportError("publications/claim",error);return apiResult({error:"Hosted publishing temporarily unavailable"},503);}
}
