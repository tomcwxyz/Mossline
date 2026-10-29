import {apiResult} from "../../../lib/hosted-response";
import {createMap,listMaps} from "../../../lib/shared-maps-db";
import {readMapUpload,requireAccount} from "../../../lib/shared-maps-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Maps this account owns or has been invited to. */
export async function GET(request:Request){
  const user=await requireAccount(request,{write:false});
  if(user instanceof Response)return user;
  try{return apiResult({maps:await listMaps(user),canCreate:user.canPublish});}
  catch{return apiResult({error:"Shared maps are temporarily unavailable"},503);}
}

/** Saves a whole map to this account. Only people on the publishers list can. */
export async function POST(request:Request){
  const user=await requireAccount(request,{write:true});
  if(user instanceof Response)return user;
  if(!user.canPublish)return apiResult({error:"This account can open maps shared with it, but can't save its own"},403);
  let upload;
  try{upload=await readMapUpload(request);}
  catch(e){return apiResult({error:e instanceof Error?e.message:"The map couldn't be read."},400);}
  try{
    const id=await createMap(user.id,upload.title,upload.packed,{nodes:upload.graph.nodes.length,edges:upload.graph.edges.length});
    return apiResult({id,sourceVersion:1},201);
  }catch{return apiResult({error:"Couldn't save the map. Check the database migration and connection."},503);}
}
