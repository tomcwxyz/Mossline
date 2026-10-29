import {reportError} from "../../../../lib/report";
import {apiResult} from "../../../../lib/hosted-response";
import {readJsonBody} from "../../../../lib/hosted-auth";
import {requireSignedIn} from "../../../../lib/hosted-guard";
import {canSendMail,sendOrgInvitation} from "../../../../lib/auth-mail";
import {cancelInvite,invite,members,orgOf} from "../../../../lib/orgs-db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const EMAIL=/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

/** Admins invite someone by email. Emailed when this deployment can send mail. */
export async function POST(request:Request){
  const user=await requireSignedIn(request,{write:true});
  if(user instanceof Response)return user;
  let email="",role:"admin"|"member"="member";
  try{const body=await readJsonBody(request,2_000) as {email?:unknown;role?:unknown};
    email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";role=body?.role==="admin"?"admin":"member";}catch{/* below */}
  if(!EMAIL.test(email))return apiResult({error:"Give an email address"},400);
  try{
    const org=await orgOf(user.id);
    if(!org||org.role!=="admin")return apiResult({error:"Only an organisation's admins can invite people"},403);
    const people=await members(org.id);
    if(people.members.some(m=>m.email.toLowerCase()===email))return apiResult({error:"They're already in the organisation"},409);
    await invite(org.id,email,role,user.id);
    let emailed=false;
    if(canSendMail()){
      try{await sendOrgInvitation(email,user.name||user.email,org.name,new URL("/account",process.env.MOSSLINE_BASE_URL).toString());emailed=true;}
      catch{/* they can still sign in and accept */}
    }
    return apiResult({...(await members(org.id)),emailed},201);
  }catch(error){reportError("org/invites",error);return apiResult({error:"Organisations are temporarily unavailable"},503);}
}
export async function DELETE(request:Request){
  const user=await requireSignedIn(request,{write:true});
  if(user instanceof Response)return user;
  const email=(new URL(request.url).searchParams.get("email")??"").trim().toLowerCase();
  try{
    const org=await orgOf(user.id);
    if(!org||org.role!=="admin")return apiResult({error:"Only an organisation's admins can do that"},403);
    await cancelInvite(org.id,email);
    return apiResult(await members(org.id));
  }catch(error){reportError("org/invites",error);return apiResult({error:"Organisations are temporarily unavailable"},503);}
}
