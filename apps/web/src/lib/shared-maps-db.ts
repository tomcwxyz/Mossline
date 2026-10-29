import {randomUUID} from "node:crypto";
import {editSchema, type Edit} from "@mossline/graph-core";
import {pool} from "./db";
import {isSharedMapsConfigured} from "./hosted-auth";

export type MapRole="owner"|"editor"|"viewer";
export type SharedMapSummary={id:string;title:string;role:MapRole;owner:string;nodes:number;edges:number;
  sourceVersion:number;members:number;updatedAt:string};
export type MapMember={email:string;role:"editor"|"viewer";joined:boolean;name:string};
export type RemoteEdit={entry:Edit;undone:boolean;seq:number;version:number};

function db(){
  if(!isSharedMapsConfigured())throw Error("Shared maps are not configured");
  return pool();
}
const iso=(v:Date|string)=>new Date(v).toISOString();

/** Who this account is on a map, if anyone. Invitations are by email address. */
export async function roleOn(mapId:string,user:{id:string;email:string}):Promise<MapRole|null>{
  const {rows}=await db().query<{owner_id:string;role:string|null}>(`SELECT m.owner_id, mm.role
    FROM mossline_maps m LEFT JOIN mossline_map_members mm ON mm.map_id=m.id AND mm.email=$2
    WHERE m.id=$1`,[mapId,user.email.toLowerCase()]);
  if(!rows.length)return null;
  if(rows[0].owner_id===user.id)return "owner";
  return rows[0].role==="editor"||rows[0].role==="viewer"?rows[0].role:null;
}
export const canEdit=(role:MapRole|null)=>role==="owner"||role==="editor";

/** Whether anyone has invited this address to a map: invited people may sign in. */
export async function isInvited(email:string):Promise<boolean>{
  if(!isSharedMapsConfigured())return false;
  const {rows}=await db().query(`SELECT 1 FROM mossline_map_members WHERE email=$1 LIMIT 1`,[email.toLowerCase()]);
  return rows.length>0;
}

export async function listMaps(user:{id:string;email:string}):Promise<SharedMapSummary[]>{
  const {rows}=await db().query<{id:string;title:string;owner_id:string;role:string|null;owner:string;source_nodes:number;
    source_edges:number;source_version:number;members:string;updated_at:Date}>(`
    SELECT m.id, m.title, m.owner_id, mm.role, coalesce(nullif(u.name,''),u.email) AS owner, m.source_nodes, m.source_edges,
      m.source_version, (SELECT count(*) FROM mossline_map_members x WHERE x.map_id=m.id) AS members,
      greatest(m.updated_at, coalesce((SELECT max(e.updated_at) FROM mossline_map_edits e WHERE e.map_id=m.id), m.updated_at)) AS updated_at
    FROM mossline_maps m JOIN mossline_users u ON u.id=m.owner_id
    LEFT JOIN mossline_map_members mm ON mm.map_id=m.id AND mm.email=$2
    WHERE m.owner_id=$1 OR mm.email IS NOT NULL
    ORDER BY updated_at DESC LIMIT 200`,[user.id,user.email.toLowerCase()]);
  return rows.map(r=>({id:r.id,title:r.title,role:r.owner_id===user.id?"owner":(r.role as MapRole),owner:r.owner,
    nodes:r.source_nodes,edges:r.source_edges,sourceVersion:r.source_version,members:Number(r.members),updatedAt:iso(r.updated_at)}));
}

export async function createMap(ownerId:string,title:string,source:Buffer,counts:{nodes:number;edges:number}):Promise<string>{
  const id=randomUUID();
  await db().query(`INSERT INTO mossline_maps (id,owner_id,title,source,source_nodes,source_edges,source_updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$2)`,[id,ownerId,title,source,counts.nodes,counts.edges]);
  return id;
}

export async function mapInfo(mapId:string){
  const {rows}=await db().query<{id:string;title:string;source_version:number;source_nodes:number;source_edges:number;owner:string;updated_at:Date}>(`
    SELECT m.id,m.title,m.source_version,m.source_nodes,m.source_edges,coalesce(nullif(u.name,''),u.email) AS owner,m.updated_at
    FROM mossline_maps m JOIN mossline_users u ON u.id=m.owner_id WHERE m.id=$1`,[mapId]);
  const r=rows[0];
  return r?{id:r.id,title:r.title,sourceVersion:r.source_version,nodes:r.source_nodes,edges:r.source_edges,owner:r.owner,updatedAt:iso(r.updated_at)}:null;
}

export async function readSource(mapId:string):Promise<{source:Buffer;version:number}|null>{
  const {rows}=await db().query<{source:Buffer;source_version:number}>(`SELECT source,source_version FROM mossline_maps WHERE id=$1`,[mapId]);
  return rows.length?{source:rows[0].source,version:rows[0].source_version}:null;
}

/** New imported records replace the old, only from the version the editor last saw. Changes stay. */
export async function replaceSource(mapId:string,userId:string,expected:number,title:string,source:Buffer,
  counts:{nodes:number;edges:number}):Promise<number|null>{
  const {rows}=await db().query<{source_version:number}>(`UPDATE mossline_maps SET source=$1, source_nodes=$2, source_edges=$3,
    title=$4, source_version=source_version+1, source_updated_by=$5, updated_at=now()
    WHERE id=$6 AND source_version=$7 RETURNING source_version`,[source,counts.nodes,counts.edges,title,userId,mapId,expected]);
  return rows[0]?.source_version??null;
}

export async function deleteMap(mapId:string,ownerId:string):Promise<boolean>{
  const {rowCount}=await db().query(`DELETE FROM mossline_maps WHERE id=$1 AND owner_id=$2`,[mapId,ownerId]);
  return rowCount===1;
}

export async function listMembers(mapId:string):Promise<MapMember[]>{
  const {rows}=await db().query<{email:string;role:"editor"|"viewer";name:string|null}>(`SELECT mm.email, mm.role, u.name
    FROM mossline_map_members mm LEFT JOIN mossline_users u ON u.email=mm.email
    WHERE mm.map_id=$1 ORDER BY mm.created_at`,[mapId]);
  return rows.map(r=>({email:r.email,role:r.role,joined:r.name!==null,name:r.name??""}));
}
export async function setMember(mapId:string,email:string,role:"editor"|"viewer",invitedBy:string):Promise<boolean>{
  const {rows}=await db().query<{inserted:boolean}>(`INSERT INTO mossline_map_members (map_id,email,role,invited_by) VALUES ($1,$2,$3,$4)
    ON CONFLICT (map_id,email) DO UPDATE SET role=EXCLUDED.role RETURNING (xmax = 0) AS inserted`,[mapId,email.toLowerCase(),role,invitedBy]);
  return rows[0]?.inserted??false;
}
export async function removeMember(mapId:string,email:string):Promise<boolean>{
  const {rowCount}=await db().query(`DELETE FROM mossline_map_members WHERE map_id=$1 AND email=$2`,[mapId,email.toLowerCase()]);
  return rowCount===1;
}
/** When someone deletes their account, they leave every map they were invited to. */
export async function forgetMemberships(email:string):Promise<void>{
  if(!isSharedMapsConfigured())return;
  await db().query(`DELETE FROM mossline_map_members WHERE email=$1`,[email.toLowerCase()]);
}

/** Changes since a version: new ones and any undone or redone since. */
export async function editsSince(mapId:string,since:number):Promise<{edits:RemoteEdit[];version:number;sourceVersion:number}>{
  const {rows}=await db().query<{entry:unknown;undone:boolean;seq:string;version:string}>(`SELECT entry,undone,seq,version
    FROM mossline_map_edits WHERE map_id=$1 AND version>$2 ORDER BY seq`,[mapId,since]);
  const edits:RemoteEdit[]=[];
  for(const r of rows){
    const parsed=editSchema.safeParse(r.entry);
    if(parsed.success)edits.push({entry:parsed.data,undone:r.undone,seq:Number(r.seq),version:Number(r.version)});
  }
  // The imported records' version rides along, so browsers notice when someone adds data.
  const top=await db().query<{v:string|null;s:number}>(`SELECT (SELECT max(version) FROM mossline_map_edits WHERE map_id=$1) AS v,
    (SELECT source_version FROM mossline_maps WHERE id=$1) AS s`,[mapId]);
  return {edits,version:Number(top.rows[0]?.v??0),sourceVersion:Number(top.rows[0]?.s??1)};
}

/** Stores changes as received; an edit already stored (a retry) is left as it was. */
export async function addEdits(mapId:string,authorId:string,edits:Edit[]):Promise<void>{
  if(!edits.length)return;
  const client=await db().connect();
  try{
    await client.query("BEGIN");
    for(const e of edits){
      await client.query(`INSERT INTO mossline_map_edits (map_id,id,author_id,entry,undone) VALUES ($1,$2,$3,$4::jsonb,$5)
        ON CONFLICT (map_id,id) DO NOTHING`,[mapId,e.id,authorId,JSON.stringify({...e,undone:undefined}),!!e.undone]);
    }
    await client.query("UPDATE mossline_maps SET updated_at=now() WHERE id=$1",[mapId]);
    await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK");throw error;}
  finally{client.release();}
}

export async function setEditUndone(mapId:string,editId:string,undone:boolean):Promise<boolean>{
  const {rowCount}=await db().query(`UPDATE mossline_map_edits SET undone=$1, version=nextval('mossline_map_edit_seq'), updated_at=now()
    WHERE map_id=$2 AND id=$3`,[undone,mapId,editId]);
  return rowCount===1;
}
