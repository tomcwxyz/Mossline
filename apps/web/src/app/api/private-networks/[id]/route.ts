import {privateWorkspacesEnabled,privateWorkspaceUser}
  from "../../../../lib/private-workspace-auth";
import {getPrivateNetwork,deletePrivateNetwork}
  from "../../../../lib/private-network-db";
import {apiResult} from "../../../../lib/hosted-response";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
async function scoped(params:Promise<{id:string}>){
  if(!privateWorkspacesEnabled())return {error:apiResult({error:"Not found"},404)};
  const owner=await privateWorkspaceUser();
  if(!owner)return {error:apiResult({error:"Authentication required"},401)};
  const {id}=await params;
  if(!UUID.test(id))return {error:apiResult({error:"Not found"},404)};
  return {owner,id};
}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const a=await scoped(params);if(a.error)return a.error;
  try{
    const network=await getPrivateNetwork(a.owner!,a.id!);
    return network?apiResult(network):apiResult({error:"Not found"},404);
  }catch{return apiResult({error:"Private network unavailable"},503);}
}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
  const a=await scoped(params);if(a.error)return a.error;
  const origin=request.headers.get("origin");
  if(origin && origin!==new URL(request.url).origin)
    return apiResult({error:"Cross-origin deletion is not permitted"},403);
  try{
    const deleted=await deletePrivateNetwork(a.owner!,a.id!);
    return deleted?apiResult({deleted:true}):apiResult({error:"Not found"},404);
  }catch{return apiResult({error:"Could not delete private network"},503);}
}
