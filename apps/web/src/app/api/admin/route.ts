import {apiResult} from "../../../lib/hosted-response";
import {isOperator,requireSignedIn} from "../../../lib/hosted-guard";
import {allOrgs,counts,recentPublications} from "../../../lib/orgs-db";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** For the people running this Mossline (MOSSLINE_ADMINS): organisations, plans and what's published. */
export async function GET(request:Request){
  const user=await requireSignedIn(request,{write:false});
  if(user instanceof Response)return user;
  if(!isOperator(user.email))return apiResult({error:"Not found"},404);
  try{return apiResult({counts:await counts(),orgs:await allOrgs(),publications:await recentPublications()});}
  catch{return apiResult({error:"Temporarily unavailable"},503);}
}
