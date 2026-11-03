import {reportError} from "../../../../lib/report";
import {apiResult} from "../../../../lib/hosted-response";
import {requireSignedIn} from "../../../../lib/hosted-guard";
import {leave,orgOf} from "../../../../lib/orgs-db";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Leaves the organisation. What you made in it stays with it. */
export async function POST(request:Request){
  const user=await requireSignedIn(request,{write:true});
  if(user instanceof Response)return user;
  try{
    const org=await orgOf(user.id);
    if(!org)return apiResult({error:"You're not in an organisation"},404);
    const result=await leave(org.id,user.id);
    if(result==="last-admin")return apiResult({error:"Make someone else an admin before you leave"},409);
    return apiResult({result});
  }catch(error){reportError("org/leave",error);return apiResult({error:"Organisations are temporarily unavailable"},503);}
}
