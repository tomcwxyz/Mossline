import {gunzipSync} from "node:zlib";
import {parseGraphDocument, type GraphDocument} from "@mossline/graph-core";
import {currentUser, type SignedIn} from "./auth";
import {isSharedMapsConfigured, sameOrigin, SHARED_MAP_MAX_BYTES, SHARED_MAP_MAX_UNPACKED} from "./hosted-auth";
import {apiResult} from "./hosted-response";
import {roleOn, type MapRole} from "./shared-maps-db";

/** Any signed-in account; changes must come from Mossline's own pages. */
export async function requireAccount(request:Request,{write}:{write:boolean}):Promise<SignedIn|Response>{
  if(!isSharedMapsConfigured())return apiResult({error:"Shared maps are not switched on here"},404);
  if(write&&!sameOrigin(request))return apiResult({error:"Request must come from Mossline"},403);
  let user:SignedIn|null;
  try{user=await currentUser(request);}catch{return apiResult({error:"Accounts are temporarily unavailable"},503);}
  if(!user)return apiResult({error:"Sign in to open shared maps"},401);
  return user;
}

const MAP_ID=/^[0-9a-f-]{36}$/;
/** The account and its role on the map, or the response to send instead. Unknown and forbidden look the same. */
export async function requireRole(request:Request,mapId:string,{write,needs}:{write:boolean;needs:MapRole[]}):
  Promise<{user:SignedIn;role:MapRole}|Response>{
  const user=await requireAccount(request,{write});
  if(user instanceof Response)return user;
  if(!MAP_ID.test(mapId))return apiResult({error:"Not found"},404);
  let role:MapRole|null;
  try{role=await roleOn(mapId,user);}catch{return apiResult({error:"Shared maps are temporarily unavailable"},503);}
  if(!role)return apiResult({error:"Not found"},404);
  if(!needs.includes(role))return apiResult({error:role==="viewer"?"You can view this map but not change it":"Only the map's owner can do that"},403);
  return {user,role};
}

/** Reads a gzip-compressed {title, graph} upload and checks it is a whole, valid map. */
export async function readMapUpload(request:Request):Promise<{title:string;graph:GraphDocument;packed:Buffer}>{
  const reader=request.body?.getReader();
  if(!reader)throw Error("Missing map");
  const chunks:Uint8Array[]=[];let size=0;
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>SHARED_MAP_MAX_BYTES)throw Error("This map is too large to save to an account ("+Math.round(size/1e6)+" MB compressed; the limit is "+SHARED_MAP_MAX_BYTES/1e6+" MB).");
      chunks.push(value);
    }
  }finally{void reader.cancel().catch(()=>{});}
  const packed=Buffer.concat(chunks);
  let body:{title?:unknown;graph?:unknown};
  try{body=JSON.parse(gunzipSync(packed,{maxOutputLength:SHARED_MAP_MAX_UNPACKED}).toString("utf8"));}
  catch{throw Error("The map couldn't be read. Try again.");}
  const title=typeof body?.title==="string"?body.title.trim().slice(0,120):"";
  if(!title)throw Error("The map needs a title.");
  const graph=parseGraphDocument(body.graph);
  return {title,graph:{...graph,title},packed};
}
