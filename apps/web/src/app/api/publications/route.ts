import {parsePublishedSnapshot} from "@mossline/graph-core";
import {apiResult} from "../../../lib/hosted-response";
import {createPublication} from "../../../lib/hosted-db";
import {isHostedConfigured,makePublicationId,makeManagementKey,
  readBearer,readJsonBody,verifyPublisherKey} from "../../../lib/hosted-auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Creation is disabled without both DB and a strong server-side admin key.
 *  Never store the admin key or include it in any URL or published snapshot.
 */
export async function POST(request:Request){
  if(!isHostedConfigured())return apiResult({error:"Hosted publishing is not configured"},503);
  if(!verifyPublisherKey(readBearer(request)))
    return apiResult({error:"Authorisation required"},401);
  let snapshot;
  try {
    const body=await readJsonBody(request) as Record<string,unknown>;
    if(!body || typeof body!=="object" || Array.isArray(body) ||
      Object.keys(body).length!==1 || !("snapshot" in body))
      throw Error("Provide one reviewed snapshot");
    snapshot=parsePublishedSnapshot(body.snapshot);
  }catch{
    return apiResult({error:"Invalid or oversized publication snapshot"},400);
  }
  try{
    const slug=makePublicationId(),managementKey=makeManagementKey();
    const publication=await createPublication(slug,managementKey,snapshot);
    return apiResult({slug:publication.slug,revision:publication.revision,
      managementKey},201);
  }catch{
    return apiResult({error:"Could not publish. Check the database migration and connection."},503);
  }
}
