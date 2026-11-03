import {reportError} from "../../../lib/report";
import {parseHostedSnapshot} from "@mossline/graph-core";
import {apiResult} from "../../../lib/hosted-response";
import {createPublication,listOwned,publishedToday} from "../../../lib/hosted-db";
import {dailyPublishLimit,makePublicationId,readJsonBody} from "../../../lib/hosted-auth";
import {requirePublisher} from "../../../lib/hosted-guard";
import {usageFor} from "../../../lib/orgs-db";
import {limitMessage} from "../../../lib/plans";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** The signed-in account's published maps. */
export async function GET(request:Request){
  const user=await requirePublisher(request,{write:false});
  if(user instanceof Response)return user;
  try{return apiResult({publications:await listOwned(user.id),usage:await usageFor(user.id)});}
  catch(error){reportError("publications",error);return apiResult({error:"Hosted publishing temporarily unavailable"},503);}
}

/** Publishes one reviewed, reduced snapshot under the signed-in account. */
export async function POST(request:Request){
  const user=await requirePublisher(request,{write:true});
  if(user instanceof Response)return user;
  let snapshot;
  try {
    const body=await readJsonBody(request) as Record<string,unknown>;
    if(!body || typeof body!=="object" || Array.isArray(body) ||
      Object.keys(body).length!==1 || !("snapshot" in body))
      throw Error("Provide one reviewed snapshot");
    snapshot=parseHostedSnapshot(body.snapshot);
  }catch{
    return apiResult({error:"Invalid or oversized publication snapshot"},400);
  }
  try{
    if(await publishedToday(user.id)>=dailyPublishLimit())
      return apiResult({error:"You've reached today's publishing limit. Try again tomorrow, or update a map you've already published."},429);
    const usage=await usageFor(user.id);
    if(usage.publications>=usage.limits.publications)
      return apiResult({error:limitMessage("publications",usage.plan,usage.limits.publications),limit:"publications"},403);
    const publication=await createPublication(makePublicationId(),user.id,snapshot,usage.org?.id??null);
    return apiResult({slug:publication.slug,revision:publication.revision},201);
  }catch(error){
    reportError("publications",error);
    return apiResult({error:"Could not publish. Check the database migration and connection."},503);
  }
}
