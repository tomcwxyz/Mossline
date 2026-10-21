import {parsePublishedSnapshot} from "@mossline/graph-core";
import {apiResult} from "../../../../lib/hosted-response";
import {getPublished,updatePublication,unpublish} from "../../../../lib/hosted-db";
import {isHostedConfigured,readBearer,readJsonBody,
  validPublicationId} from "../../../../lib/hosted-auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{slug:string}>};
async function readSlug(context:Ctx):Promise<string>{
  const {slug}=await context.params;
  return validPublicationId(slug)?slug:"";
}
export async function GET(_:Request,context:Ctx){
  if(!isHostedConfigured())return apiResult({error:"Hosted publishing unavailable"},503);
  const slug=await readSlug(context);
  if(!slug)return apiResult({error:"Not found"},404);
  try{
    const item=await getPublished(slug);
    if(!item)return apiResult({error:"Not found"},404);
    return apiResult({slug:item.slug,revision:item.revision,snapshot:item.snapshot,
      updatedAt:item.updatedAt});
  }catch{return apiResult({error:"Hosted publishing temporarily unavailable"},503);}
}
/** The management key is an unguessable capability returned on creation only.
 *  Missing, invalid or stale capabilities never update a published snapshot.
 */
export async function PATCH(request:Request,context:Ctx){
  if(!isHostedConfigured())return apiResult({error:"Hosted publishing unavailable"},503);
  const slug=await readSlug(context),ownerKey=readBearer(request);
  if(!slug)return apiResult({error:"Not found"},404);
  if(ownerKey.length<40)return apiResult({error:"Management key required"},401);
  let revision:number,snapshot;
  try {
    const body=await readJsonBody(request) as Record<string,unknown>;
    if(!body || typeof body!=="object" || Array.isArray(body) ||
      Object.keys(body).sort().join(",")!=="revision,snapshot" ||
      !Number.isSafeInteger(body.revision) || (body.revision as number)<1)
      throw Error("Invalid publication revision");
    revision=body.revision as number;
    snapshot=parsePublishedSnapshot(body.snapshot);
  }catch{return apiResult({error:"Invalid or oversized publication update"},400);}
  try {
    const updated=await updatePublication(slug,ownerKey,revision,snapshot);
    if(!updated)return apiResult({error:"Not authorised, withdrawn, or revision changed"},409);
    return apiResult({slug:updated.slug,revision:updated.revision});
  }catch{return apiResult({error:"Hosted publishing temporarily unavailable"},503);}
}
export async function DELETE(request:Request,context:Ctx){
  if(!isHostedConfigured())return apiResult({error:"Hosted publishing unavailable"},503);
  const slug=await readSlug(context),ownerKey=readBearer(request);
  if(!slug)return apiResult({error:"Not found"},404);
  if(ownerKey.length<40)return apiResult({error:"Management key required"},401);
  try {
    const withdrawn=await unpublish(slug,ownerKey);
    if(!withdrawn)return apiResult({error:"Not authorised or already withdrawn"},404);
    return apiResult({unpublished:true});
  }catch{return apiResult({error:"Hosted publishing temporarily unavailable"},503);}
}
