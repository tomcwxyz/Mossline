import {reportError} from "../../../../lib/report";
import {parseHostedSnapshot} from "@mossline/graph-core";
import {apiResult} from "../../../../lib/hosted-response";
import {getPublished,updatePublication,unpublish} from "../../../../lib/hosted-db";
import {isHostedConfigured,readJsonBody,validPublicationId} from "../../../../lib/hosted-auth";
import {requirePublisher} from "../../../../lib/hosted-guard";
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
  }catch(error){reportError("publications/[slug]",error);return apiResult({error:"Hosted publishing temporarily unavailable"},503);}
}
/** Only the owning account can replace a publication, and only from the revision it last saw. */
export async function PATCH(request:Request,context:Ctx){
  const user=await requirePublisher(request,{write:true});
  if(user instanceof Response)return user;
  const slug=await readSlug(context);
  if(!slug)return apiResult({error:"Not found"},404);
  let revision:number,snapshot;
  try {
    const body=await readJsonBody(request) as Record<string,unknown>;
    if(!body || typeof body!=="object" || Array.isArray(body) ||
      Object.keys(body).sort().join(",")!=="revision,snapshot" ||
      !Number.isSafeInteger(body.revision) || (body.revision as number)<1)
      throw Error("Invalid publication revision");
    revision=body.revision as number;
    snapshot=parseHostedSnapshot(body.snapshot);
  }catch{return apiResult({error:"Invalid or oversized publication update"},400);}
  try {
    const updated=await updatePublication(slug,user.id,revision,snapshot);
    if(!updated)return apiResult({error:"Not yours, withdrawn, or changed since you opened it"},409);
    return apiResult({slug:updated.slug,revision:updated.revision});
  }catch(error){reportError("publications/[slug]",error);return apiResult({error:"Hosted publishing temporarily unavailable"},503);}
}
/** Unpublishing deletes the stored copy. */
export async function DELETE(request:Request,context:Ctx){
  const user=await requirePublisher(request,{write:true});
  if(user instanceof Response)return user;
  const slug=await readSlug(context);
  if(!slug)return apiResult({error:"Not found"},404);
  try {
    if(!await unpublish(slug,user.id))return apiResult({error:"Not found"},404);
    return apiResult({unpublished:true});
  }catch(error){reportError("publications/[slug]",error);return apiResult({error:"Hosted publishing temporarily unavailable"},503);}
}
