import {neon} from "@neondatabase/serverless";
import {parsePublishedSnapshot, type PublishedSnapshot} from "@mossline/graph-core";
import {hashManagementKey, isHostedConfigured} from "./hosted-auth";

type Row={slug:string;snapshot:unknown;revision:number;updated_at:string};
export type HostedPublication={slug:string;snapshot:PublishedSnapshot;revision:number;updatedAt:string};
function connection(){
  if(!isHostedConfigured())throw Error("Hosted publishing is not configured");
  return neon(process.env.MOSSLINE_DATABASE_URL!);
}
function parseRow(row:Row):HostedPublication {
  return {slug:row.slug,snapshot:parsePublishedSnapshot(row.snapshot),
    revision:row.revision,updatedAt:String(row.updated_at)};
}
/** Public read always checks current publish state and never uses static caches. */
export async function getPublished(slug:string):Promise<HostedPublication|null>{
  const sql=connection();
  const rows=await sql`SELECT slug,snapshot,revision,updated_at
    FROM mossline_publications WHERE slug=${slug} AND is_published=true`;
  return rows.length?parseRow(rows[0] as unknown as Row):null;
}
export async function createPublication(slug:string,key:string,snapshot:PublishedSnapshot):
  Promise<HostedPublication>{
  const sql=connection();
  const rows=await sql`INSERT INTO mossline_publications
    (slug,management_hash,snapshot) VALUES
    (${slug},${hashManagementKey(key)},${JSON.stringify(snapshot)}::jsonb)
    RETURNING slug,snapshot,revision,updated_at`;
  return parseRow(rows[0] as unknown as Row);
}
export async function updatePublication(slug:string,key:string,revision:number,snapshot:PublishedSnapshot):
  Promise<HostedPublication|null>{
  const sql=connection();
  const rows=await sql`UPDATE mossline_publications
    SET snapshot=${JSON.stringify(snapshot)}::jsonb,
      revision=revision+1,updated_at=now()
    WHERE slug=${slug} AND management_hash=${hashManagementKey(key)}
      AND revision=${revision} AND is_published=true
    RETURNING slug,snapshot,revision,updated_at`;
  return rows.length?parseRow(rows[0] as unknown as Row):null;
}
export async function unpublish(slug:string,key:string):Promise<boolean>{
  const sql=connection();
  const rows=await sql`UPDATE mossline_publications
    SET is_published=false,updated_at=now()
    WHERE slug=${slug} AND management_hash=${hashManagementKey(key)}
      AND is_published=true RETURNING slug`;
  return rows.length===1;
}
