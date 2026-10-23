import {privateWorkspacesEnabled,privateWorkspaceUser}
  from "../../../lib/private-workspace-auth";
import {readDiscoveryJson} from "../../../lib/discovery-provider";
import {PRIVATE_UPLOAD_MAX_BYTES,parsePrivateNetworkUpload}
  from "../../../lib/private-network-input";
import {createPrivateNetwork,listPrivateNetworks} from "../../../lib/private-network-db";
import {apiResult} from "../../../lib/hosted-response";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
  if(!privateWorkspacesEnabled())return apiResult({error:"Private workspaces unavailable"},404);
  const owner=await privateWorkspaceUser();
  if(!owner)return apiResult({error:"Sign in to access your private networks"},401);
  try{return apiResult({networks:await listPrivateNetworks(owner)});}
  catch{return apiResult({error:"Private network storage is unavailable"},503);}
}
export async function POST(request:Request){
  if(!privateWorkspacesEnabled())return apiResult({error:"Private workspaces unavailable"},404);
  const owner=await privateWorkspaceUser();
  if(!owner)return apiResult({error:"Sign in to save privately"},401);
  const origin=request.headers.get("origin");
  if(origin && origin!==new URL(request.url).origin)
    return apiResult({error:"Cross-origin uploads are not permitted"},403);
  const length=Number(request.headers.get("content-length"));
  if(Number.isFinite(length)&&length>PRIVATE_UPLOAD_MAX_BYTES)
    return apiResult({error:"Private network exceeds upload limit"},413);
  let upload;
  try{
    upload=parsePrivateNetworkUpload(
      await readDiscoveryJson(request,PRIVATE_UPLOAD_MAX_BYTES));
  }catch{return apiResult({error:"Invalid network or private-storage approval missing"},400);}
  try{return apiResult({network:await createPrivateNetwork(owner,upload)},201);}
  catch{return apiResult({error:"Could not store private network"},503);}
}
