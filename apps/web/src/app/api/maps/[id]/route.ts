import {apiResult} from "../../../../lib/hosted-response";
import {deleteMap,listMembers,mapInfo} from "../../../../lib/shared-maps-db";
import {requireRole} from "../../../../lib/shared-maps-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{id:string}>};

export async function GET(request:Request,context:Ctx){
  const {id}=await context.params;
  const access=await requireRole(request,id,{write:false,needs:["owner","editor","viewer"]});
  if(access instanceof Response)return access;
  try{
    const info=await mapInfo(id);
    if(!info)return apiResult({error:"Not found"},404);
    return apiResult({...info,role:access.role,members:await listMembers(id)});
  }catch{return apiResult({error:"Shared maps are temporarily unavailable"},503);}
}

/** The owner takes the map off the server: its records, changes and invitations go. Copies in browsers stay. */
export async function DELETE(request:Request,context:Ctx){
  const {id}=await context.params;
  const access=await requireRole(request,id,{write:true,needs:["owner"]});
  if(access instanceof Response)return access;
  try{
    if(!await deleteMap(id,access.user.id))return apiResult({error:"Not found"},404);
    return apiResult({deleted:true});
  }catch{return apiResult({error:"Shared maps are temporarily unavailable"},503);}
}
