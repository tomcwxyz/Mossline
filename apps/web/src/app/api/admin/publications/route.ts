import {reportError} from "../../../../lib/report";
import {apiResult} from "../../../../lib/hosted-response";
import {isOperator,requireSignedIn} from "../../../../lib/hosted-guard";
import {takeDown} from "../../../../lib/orgs-db";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Takes a published map down, after a report under the acceptable use policy. */
export async function DELETE(request:Request){
  const user=await requireSignedIn(request,{write:true});
  if(user instanceof Response)return user;
  if(!isOperator(user.email))return apiResult({error:"Not found"},404);
  const slug=new URL(request.url).searchParams.get("slug")??"";
  try{return apiResult({removed:await takeDown(slug)});}
  catch(error){reportError("admin/publications",error);return apiResult({error:"Temporarily unavailable"},503);}
}
