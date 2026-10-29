import {reportError} from "../../../../../lib/report";
import {apiResult} from "../../../../../lib/hosted-response";
import {listMapStories} from "../../../../../lib/map-stories-db";
import {requireRole} from "../../../../../lib/shared-maps-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{id:string}>};

/** The map's stories, without their contents: browsers fetch a story when its version moves on. */
export async function GET(request:Request,context:Ctx){
  const {id}=await context.params;
  const access=await requireRole(request,id,{write:false,needs:["owner","editor","viewer"]});
  if(access instanceof Response)return access;
  try{return apiResult({stories:await listMapStories(id),canWrite:access.role!=="viewer"});}
  catch(error){reportError("maps/[id]/stories",error);return apiResult({error:"Stories are temporarily unavailable"},503);}
}
