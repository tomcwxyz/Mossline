import {parseStory, type Story} from "@mossline/graph-core";
import {pool} from "./db";

/** Stories kept with a shared map. Listing sends no pictures; a story is fetched whole when it has changed. */
export type StorySummary={id:string;title:string;steps:number;version:number;updatedAt:string;updatedBy:string};
export const STORIES_PER_MAP=50;
const iso=(v:Date|string)=>new Date(v).toISOString();

export async function listMapStories(mapId:string):Promise<StorySummary[]>{
  const {rows}=await pool().query<{id:string;title:string;steps:number;version:number;updated_at:Date;updated_by:string|null}>(`
    SELECT s.id,s.title,s.steps,s.version,s.updated_at,coalesce(nullif(u.name,''),u.email) AS updated_by
    FROM mossline_map_stories s LEFT JOIN mossline_users u ON u.id=s.updated_by
    WHERE s.map_id=$1 ORDER BY s.updated_at DESC`,[mapId]);
  return rows.map(r=>({id:r.id,title:r.title,steps:r.steps,version:r.version,updatedAt:iso(r.updated_at),updatedBy:r.updated_by??""}));
}

export async function readMapStory(mapId:string,id:string):Promise<{story:Story;version:number}|null>{
  const {rows}=await pool().query<{story:unknown;version:number}>(`SELECT story,version FROM mossline_map_stories WHERE map_id=$1 AND id=$2`,[mapId,id]);
  if(!rows.length)return null;
  return {story:parseStory(rows[0].story),version:rows[0].version};
}

export type SaveResult={saved:true;version:number}|{saved:false;reason:"conflict"|"full"};
/**
 * Saves a story only over the version the writer last saw (0 for a new one).
 * Anything else is a conflict: someone else saved first.
 */
export async function saveMapStory(mapId:string,userId:string,story:Story,expected:number):Promise<SaveResult>{
  const json=JSON.stringify(story);
  const bytes=Buffer.byteLength(json);
  if(expected===0){
    const {rows}=await pool().query<{version:number}>(`INSERT INTO mossline_map_stories (map_id,id,title,steps,story,bytes,created_by,updated_by)
      SELECT $1,$2,$3,$4,$5::jsonb,$6,$7,$7
      WHERE (SELECT count(*) FROM mossline_map_stories WHERE map_id=$1) < $8
      ON CONFLICT (map_id,id) DO NOTHING RETURNING version`,[mapId,story.id,story.title,story.steps.length,json,bytes,userId,STORIES_PER_MAP]);
    if(rows.length)return {saved:true,version:rows[0].version};
    const exists=await pool().query(`SELECT 1 FROM mossline_map_stories WHERE map_id=$1 AND id=$2`,[mapId,story.id]);
    return {saved:false,reason:exists.rows.length?"conflict":"full"};
  }
  const {rows}=await pool().query<{version:number}>(`UPDATE mossline_map_stories SET title=$3,steps=$4,story=$5::jsonb,bytes=$6,
    version=version+1,updated_by=$7,updated_at=now() WHERE map_id=$1 AND id=$2 AND version=$8 RETURNING version`,
    [mapId,story.id,story.title,story.steps.length,json,bytes,userId,expected]);
  return rows.length?{saved:true,version:rows[0].version}:{saved:false,reason:"conflict"};
}

export async function deleteMapStory(mapId:string,id:string):Promise<boolean>{
  const {rowCount}=await pool().query(`DELETE FROM mossline_map_stories WHERE map_id=$1 AND id=$2`,[mapId,id]);
  return rowCount===1;
}

