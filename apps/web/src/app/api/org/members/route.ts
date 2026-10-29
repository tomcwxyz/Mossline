import {apiResult} from "../../../../lib/hosted-response";
import {readJsonBody} from "../../../../lib/hosted-auth";
import {requireSignedIn} from "../../../../lib/hosted-guard";
import {leave,members,orgOf,setRole} from "../../../../lib/orgs-db";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Admins make someone an admin, or a member again. There's always at least one admin. */
export async function PATCH(request:Request){
  const user=await requireSignedIn(request,{write:true});
  if(user instanceof Response)return user;
  let userId="",role:"admin"|"member"="member";
  try{const body=await readJsonBody(request,1_000) as {userId?:unknown;role?:unknown};
    userId=typeof body?.userId==="string"?body.userId:"";role=body?.role==="admin"?"admin":"member";}catch{/* below */}
  try{
    const org=await orgOf(user.id);
    if(!org||org.role!=="admin")return apiResult({error:"Only an organisation's admins can do that"},403);
    if(!await setRole(org.id,userId,role))return apiResult({error:"An organisation needs at least one admin"},409);
    return apiResult(await members(org.id));
  }catch{return apiResult({error:"Organisations are temporarily unavailable"},503);}
}

/** Admins remove someone. What they made stays with the organisation. */
export async function DELETE(request:Request){
  const user=await requireSignedIn(request,{write:true});
  if(user instanceof Response)return user;
  const userId=new URL(request.url).searchParams.get("userId")??"";
  try{
    const org=await orgOf(user.id);
    if(!org||org.role!=="admin")return apiResult({error:"Only an organisation's admins can do that"},403);
    if(userId===user.id)return apiResult({error:"Use Leave to remove yourself"},400);
    const result=await leave(org.id,userId);
    if(result==="not-member")return apiResult({error:"They're not in this organisation"},404);
    return apiResult(await members(org.id));
  }catch{return apiResult({error:"Organisations are temporarily unavailable"},503);}
}
