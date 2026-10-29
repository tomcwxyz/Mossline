import {apiResult} from "../../../lib/hosted-response";
import {createMap,listMaps} from "../../../lib/shared-maps-db";
import {readMapUpload,requireAccount,UploadTooLarge} from "../../../lib/shared-maps-http";
import {usageFor} from "../../../lib/orgs-db";
import {limitMessage} from "../../../lib/plans";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Maps this account owns or has been invited to. */
export async function GET(request:Request){
  const user=await requireAccount(request,{write:false});
  if(user instanceof Response)return user;
  try{return apiResult({maps:await listMaps(user),canCreate:user.canPublish,usage:await usageFor(user.id)});}
  catch{return apiResult({error:"Shared maps are temporarily unavailable"},503);}
}

/** Saves a whole map to this account. Only people on the publishers list can. */
export async function POST(request:Request){
  const user=await requireAccount(request,{write:true});
  if(user instanceof Response)return user;
  if(!user.canPublish)return apiResult({error:"This account can open maps shared with it, but can't save its own"},403);
  let usage;
  try{usage=await usageFor(user.id);}catch{return apiResult({error:"Shared maps are temporarily unavailable"},503);}
  if(usage.savedMaps>=usage.limits.savedMaps)
    return apiResult({error:limitMessage("savedMaps",usage.plan,usage.limits.savedMaps),limit:"savedMaps"},403);
  let upload;
  try{upload=await readMapUpload(request,usage.limits.uploadBytes);}
  catch(e){
    if(e instanceof UploadTooLarge&&usage.plan==="free"&&e.size<=4_000_000)
      return apiResult({error:e.message+" "+limitMessage("uploadBytes",usage.plan,usage.limits.uploadBytes),limit:"uploadBytes"},413);
    return apiResult({error:e instanceof Error?e.message:"The map couldn't be read."},e instanceof UploadTooLarge?413:400);
  }
  try{
    const id=await createMap(user.id,upload.title,upload.packed,{nodes:upload.graph.nodes.length,edges:upload.graph.edges.length},usage.org?.id??null);
    return apiResult({id,sourceVersion:1},201);
  }catch{return apiResult({error:"Couldn't save the map. Check the database migration and connection."},503);}
}
