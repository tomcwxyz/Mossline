import {createHash, randomBytes} from "node:crypto";
import {gunzipSync} from "node:zlib";
import {pool} from "./db";

const hash=(token:string)=>createHash("sha256").update(token).digest("hex");

/** Everything Mossline holds about one account, as one JSON document they can keep or take elsewhere. */
export async function exportAccount(userId:string){
  const q=<T extends Record<string,unknown>>(sql:string,args:unknown[])=>pool().query<T>(sql,args).then(r=>r.rows);
  const [user]=await q<{id:string;name:string;email:string;created_at:Date;terms_version:string|null;terms_accepted_at:Date|null;last_active_at:Date|null}>(
    `SELECT id,name,email,created_at,terms_version,terms_accepted_at,last_active_at FROM mossline_users WHERE id=$1`,[userId]);
  if(!user)return null;
  const signIns=await q<{provider_id:string;created_at:Date}>(`SELECT provider_id,created_at FROM mossline_accounts WHERE user_id=$1`,[userId]);
  const org=await q<{name:string;role:string;created_at:Date}>(`SELECT o.name,m.role,m.created_at FROM mossline_org_members m
    JOIN mossline_orgs o ON o.id=m.org_id WHERE m.user_id=$1`,[userId]);
  const publications=await q<{slug:string;snapshot:unknown;revision:number;created_at:Date;updated_at:Date}>(
    `SELECT slug,snapshot,revision,created_at,updated_at FROM mossline_publications WHERE owner_id=$1 ORDER BY created_at`,[userId]);
  const maps=await q<{id:string;title:string;source:Buffer;created_at:Date;updated_at:Date}>(
    `SELECT id,title,source,created_at,updated_at FROM mossline_maps WHERE owner_id=$1 ORDER BY created_at`,[userId]);
  const mapsOut=[];
  for(const m of maps){
    const edits=await q<{entry:unknown;undone:boolean}>(`SELECT entry,undone FROM mossline_map_edits WHERE map_id=$1 ORDER BY seq`,[m.id]);
    const members=await q<{email:string;role:string}>(`SELECT email,role FROM mossline_map_members WHERE map_id=$1`,[m.id]);
    const stories=await q<{story:unknown}>(`SELECT story FROM mossline_map_stories WHERE map_id=$1 ORDER BY created_at`,[m.id]);
    let graph:unknown=null;
    try{graph=(JSON.parse(gunzipSync(m.source).toString("utf8")) as {graph:unknown}).graph;}catch{/* left out if unreadable */}
    mapsOut.push({id:m.id,title:m.title,created:m.created_at,updated:m.updated_at,sharedWith:members,
      graph,changes:edits.map(e=>({...(e.entry as object),undone:e.undone})),stories:stories.map(s=>s.story)});
  }
  const sharedWithMe=await q<{title:string;role:string}>(`SELECT m.title,mm.role FROM mossline_map_members mm
    JOIN mossline_maps m ON m.id=mm.map_id WHERE mm.email=$1`,[user.email]);
  const myChangesElsewhere=await q<{title:string;entry:unknown}>(`SELECT m.title,e.entry FROM mossline_map_edits e
    JOIN mossline_maps m ON m.id=e.map_id WHERE e.author_id=$1 AND m.owner_id<>$1 ORDER BY e.seq`,[userId]);
  return {
    kind:"mossline-account-export",version:1,exportedAt:new Date().toISOString(),
    account:{name:user.name,email:user.email,created:user.created_at,termsVersion:user.terms_version,
      termsAccepted:user.terms_accepted_at,lastActive:user.last_active_at,signInMethods:signIns.map(s=>s.provider_id)},
    organisation:org[0]??null,
    publications:publications.map(p=>({slug:p.slug,revision:p.revision,created:p.created_at,updated:p.updated_at,snapshot:p.snapshot})),
    maps:mapsOut,
    mapsSharedWithMe:sharedWithMe,
    myChangesToOthersMaps:myChangesElsewhere.map(c=>({map:c.title,change:c.entry}))
  };
}

/** Starts an email change: a one-hour link to the new address. */
export async function startEmailChange(userId:string,newEmail:string):Promise<string>{
  const token=randomBytes(32).toString("base64url");
  await pool().query(`DELETE FROM mossline_email_changes WHERE user_id=$1`,[userId]);
  await pool().query(`INSERT INTO mossline_email_changes (token_hash,user_id,new_email,expires_at) VALUES ($1,$2,$3,now()+interval '1 hour')`,
    [hash(token),userId,newEmail.toLowerCase()]);
  return token;
}
export async function emailInUse(email:string):Promise<boolean>{
  return (await pool().query(`SELECT 1 FROM mossline_users WHERE email=$1`,[email.toLowerCase()])).rows.length>0;
}

/**
 * Finishes an email change. Invitations to maps and organisations follow the
 * address, so the person keeps everything shared with them.
 */
export async function confirmEmailChange(token:string):Promise<{oldEmail:string;newEmail:string}|"expired"|"taken"|null>{
  const client=await pool().connect();
  try{
    await client.query("BEGIN");
    const {rows}=await client.query<{user_id:string;new_email:string;expired:boolean;old_email:string}>(`DELETE FROM mossline_email_changes c
      USING mossline_users u WHERE c.token_hash=$1 AND u.id=c.user_id
      RETURNING c.user_id,c.new_email,c.expires_at<now() AS expired,u.email AS old_email`,[hash(token)]);
    const r=rows[0];
    if(!r){await client.query("ROLLBACK");return null;}
    if(r.expired){await client.query("COMMIT");return "expired";}
    if((await client.query(`SELECT 1 FROM mossline_users WHERE email=$1`,[r.new_email])).rows.length){await client.query("COMMIT");return "taken";}
    await client.query(`UPDATE mossline_users SET email=$1, email_verified=true, updated_at=now() WHERE id=$2`,[r.new_email,r.user_id]);
    for(const table of ["mossline_map_members","mossline_org_invites"]){
      const key=table==="mossline_map_members"?"map_id":"org_id";
      // Where the new address was already invited too, keep one invitation.
      await client.query(`DELETE FROM ${table} a USING ${table} b WHERE a.email=$1 AND b.email=$2 AND a.${key}=b.${key}`,[r.old_email,r.new_email]);
      await client.query(`UPDATE ${table} SET email=$2 WHERE email=$1`,[r.old_email,r.new_email]);
    }
    await client.query("COMMIT");
    return {oldEmail:r.old_email,newEmail:r.new_email};
  }catch(error){await client.query("ROLLBACK");throw error;}
  finally{client.release();}
}
