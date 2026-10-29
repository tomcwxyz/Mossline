import {apiResult} from "../../../../../lib/hosted-response";
import {readJsonBody} from "../../../../../lib/hosted-auth";
import {canSendMail,sendInvitation} from "../../../../../lib/auth-mail";
import {listMembers,mapInfo,removeMember,setMember} from "../../../../../lib/shared-maps-db";
import {requireRole} from "../../../../../lib/shared-maps-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{id:string}>};
const EMAIL=/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

/**
 * The owner invites someone by email, as an editor or a viewer. They can sign
 * in with that address to open the map. An email goes out when this
 * deployment can send one; otherwise the owner shares the link themselves.
 */
export async function POST(request:Request,context:Ctx){
  const {id}=await context.params;
  const access=await requireRole(request,id,{write:true,needs:["owner"]});
  if(access instanceof Response)return access;
  let email="",role:"editor"|"viewer"="editor";
  try{
    const body=await readJsonBody(request,2_000) as {email?:unknown;role?:unknown};
    email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";
    role=body?.role==="viewer"?"viewer":"editor";
  }catch{/* answered below */}
  if(!EMAIL.test(email))return apiResult({error:"Give an email address"},400);
  if(email===access.user.email.toLowerCase())return apiResult({error:"That's you: you own this map"},400);
  try{
    const isNew=await setMember(id,email,role,access.user.id);
    let emailed=false;
    if(isNew&&canSendMail()){
      const info=await mapInfo(id);
      const url=new URL("/?map="+id,process.env.MOSSLINE_BASE_URL).toString();
      try{await sendInvitation(email,access.user.name||access.user.email,info?.title??"a map",role,url);emailed=true;}catch{/* the link still works */}
    }
    return apiResult({members:await listMembers(id),emailed},isNew?201:200);
  }catch{return apiResult({error:"Shared maps are temporarily unavailable"},503);}
}

/** The owner removes someone, or a member leaves. */
export async function DELETE(request:Request,context:Ctx){
  const {id}=await context.params;
  const access=await requireRole(request,id,{write:true,needs:["owner","editor","viewer"]});
  if(access instanceof Response)return access;
  const email=(new URL(request.url).searchParams.get("email")??"").trim().toLowerCase();
  const self=email===access.user.email.toLowerCase();
  if(!email||(!self&&access.role!=="owner"))return apiResult({error:"Only the map's owner can remove people"},403);
  try{
    await removeMember(id,email);
    return apiResult({members:self?[]:await listMembers(id)});
  }catch{return apiResult({error:"Shared maps are temporarily unavailable"},503);}
}
