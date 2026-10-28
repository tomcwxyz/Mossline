import {parseHostedSnapshot, type PublishedSnapshot} from "@mossline/graph-core";
import {pool} from "./db";
import {hashManagementKey, isHostedConfigured} from "./hosted-auth";

type Row={slug:string;snapshot:unknown;revision:number;created_at:Date|string;updated_at:Date|string};
export type HostedPublication={slug:string;snapshot:PublishedSnapshot;revision:number;updatedAt:string};
export type OwnedPublication={slug:string;title:string;nodes:number;edges:number;revision:number;
  createdAt:string;updatedAt:string};

function db(){
  if(!isHostedConfigured())throw Error("Hosted publishing is not configured");
  return pool();
}
const iso=(v:Date|string)=>new Date(v).toISOString();
function parseRow(row:Row):HostedPublication {
  return {slug:row.slug,snapshot:parseHostedSnapshot(row.snapshot),revision:row.revision,updatedAt:iso(row.updated_at)};
}

/** Public read always checks current publish state and never uses static caches. */
export async function getPublished(slug:string):Promise<HostedPublication|null>{
  const {rows}=await db().query<Row>(`SELECT slug,snapshot,revision,created_at,updated_at
    FROM mossline_publications WHERE slug=$1 AND is_published=true`,[slug]);
  return rows.length?parseRow(rows[0]):null;
}

/** How many maps this account has published in the last day, to keep a lid on abuse. */
export async function publishedToday(ownerId:string):Promise<number>{
  const {rows}=await db().query<{n:string}>(`SELECT count(*) AS n FROM mossline_publications
    WHERE owner_id=$1 AND created_at > now() - interval '1 day'`,[ownerId]);
  return Number(rows[0]?.n??0);
}

export async function createPublication(slug:string,ownerId:string,snapshot:PublishedSnapshot):Promise<HostedPublication>{
  const {rows}=await db().query<Row>(`INSERT INTO mossline_publications (slug,owner_id,snapshot)
    VALUES ($1,$2,$3::jsonb) RETURNING slug,snapshot,revision,created_at,updated_at`,
    [slug,ownerId,JSON.stringify(snapshot)]);
  return parseRow(rows[0]);
}

/** Replaces the public copy only for its owner and only from the revision they last saw. */
export async function updatePublication(slug:string,ownerId:string,revision:number,snapshot:PublishedSnapshot):
  Promise<HostedPublication|null>{
  const {rows}=await db().query<Row>(`UPDATE mossline_publications
    SET snapshot=$1::jsonb, revision=revision+1, updated_at=now()
    WHERE slug=$2 AND owner_id=$3 AND revision=$4 AND is_published=true
    RETURNING slug,snapshot,revision,created_at,updated_at`,
    [JSON.stringify(snapshot),slug,ownerId,revision]);
  return rows.length?parseRow(rows[0]):null;
}

/** Unpublishing deletes the stored copy: nothing is kept once a map is withdrawn. */
export async function unpublish(slug:string,ownerId:string):Promise<boolean>{
  const {rowCount}=await db().query(`DELETE FROM mossline_publications WHERE slug=$1 AND owner_id=$2`,[slug,ownerId]);
  return rowCount===1;
}

export async function listOwned(ownerId:string):Promise<OwnedPublication[]>{
  const {rows}=await db().query<Row>(`SELECT slug,snapshot,revision,created_at,updated_at
    FROM mossline_publications WHERE owner_id=$1 AND is_published=true ORDER BY updated_at DESC LIMIT 200`,[ownerId]);
  return rows.map(row=>{
    const s=row.snapshot as {title?:unknown;nodes?:unknown[];edges?:unknown[]};
    return {slug:row.slug,title:typeof s.title==="string"?s.title:"Untitled map",
      nodes:Array.isArray(s.nodes)?s.nodes.length:0,edges:Array.isArray(s.edges)?s.edges.length:0,
      revision:row.revision,createdAt:iso(row.created_at),updatedAt:iso(row.updated_at)};
  });
}

/**
 * A map published before accounts is adopted by whoever holds its management
 * key. The key stops working once claimed: the account controls it from then on.
 */
export async function claimPublication(slug:string,managementKey:string,ownerId:string):Promise<boolean>{
  const {rowCount}=await db().query(`UPDATE mossline_publications
    SET owner_id=$1, management_hash=NULL, updated_at=now()
    WHERE slug=$2 AND owner_id IS NULL AND management_hash=$3 AND is_published=true`,
    [ownerId,slug,hashManagementKey(managementKey)]);
  return rowCount===1;
}
