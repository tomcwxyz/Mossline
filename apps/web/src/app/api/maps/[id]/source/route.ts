import {reportError} from "../../../../../lib/report";
import {apiResult,noStoreHeaders} from "../../../../../lib/hosted-response";
import {readSource,replaceSource} from "../../../../../lib/shared-maps-db";
import {readMapUpload,requireRole,UploadTooLarge} from "../../../../../lib/shared-maps-http";
import {usageFor} from "../../../../../lib/orgs-db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{id:string}>};

/** The imported records, still compressed: the browser unpacks them. */
export async function GET(request:Request,context:Ctx){
  const {id}=await context.params;
  const access=await requireRole(request,id,{write:false,needs:["owner","editor","viewer"]});
  if(access instanceof Response)return access;
  try{
    const found=await readSource(id);
    if(!found)return apiResult({error:"Not found"},404);
    return new Response(new Uint8Array(found.source),{headers:{...noStoreHeaders,"Content-Type":"application/gzip",
      "X-Mossline-Source-Version":String(found.version)}});
  }catch(error){reportError("maps/[id]/source",error);return apiResult({error:"Shared maps are temporarily unavailable"},503);}
}

/** Adding data to a shared map replaces its imported records. Everyone's changes stay, applied over the new records. */
export async function PUT(request:Request,context:Ctx){
  const {id}=await context.params;
  const access=await requireRole(request,id,{write:true,needs:["owner","editor"]});
  if(access instanceof Response)return access;
  const expected=Number(new URL(request.url).searchParams.get("version"));
  if(!Number.isSafeInteger(expected)||expected<1)return apiResult({error:"Say which version you're replacing"},400);
  let upload;
  try{upload=await readMapUpload(request,(await usageFor(access.user.id)).limits.uploadBytes);}
  catch(e){return apiResult({error:e instanceof Error?e.message:"The map couldn't be read."},e instanceof UploadTooLarge?413:400);}
  try{
    const version=await replaceSource(id,access.user.id,expected,upload.title,upload.packed,
      {nodes:upload.graph.nodes.length,edges:upload.graph.edges.length});
    if(version===null)return apiResult({error:"Someone else added data to this map first. Reopen it to get their version, then add yours."},409);
    return apiResult({sourceVersion:version});
  }catch(error){reportError("maps/[id]/source",error);return apiResult({error:"Shared maps are temporarily unavailable"},503);}
}
