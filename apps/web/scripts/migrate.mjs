#!/usr/bin/env node
/**
 * Applies database migrations in order and records each one, so every
 * deployment runs exactly the ones it hasn't yet.
 *
 *   MOSSLINE_DATABASE_URL=postgres://… npm run db:migrate          apply what's pending
 *   MOSSLINE_DATABASE_URL=postgres://… npm run db:migrate -- --check  list what's pending; exit 1 if any
 *
 * The migrations are written to be safe to re-run, so a database whose
 * migrations were applied by hand before this runner existed is fine:
 * they're applied again harmlessly and recorded.
 */
import {createHash} from "node:crypto";
import {readdirSync, readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import pg from "pg";

const dir=join(dirname(fileURLToPath(import.meta.url)),"..","migrations");
const url=process.env.MOSSLINE_DATABASE_URL;
if(!url){console.error("Set MOSSLINE_DATABASE_URL first.");process.exit(2);}
const check=process.argv.includes("--check");
const client=new pg.Client({connectionString:url});
await client.connect();
// One runner at a time: two deployments building together wait for each other.
// (A pooled connection in transaction mode can't hold this lock; give the
// runner a direct one, e.g. MOSSLINE_MIGRATION_DATABASE_URL on Vercel.)
const LOCK=7307715410;
try{
  await client.query("SELECT pg_advisory_lock($1)",[LOCK]);
  await client.query(`CREATE TABLE IF NOT EXISTS mossline_migrations (
    name TEXT PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const done=new Map((await client.query("SELECT name, checksum FROM mossline_migrations")).rows.map(r=>[r.name,r.checksum]));
  const files=readdirSync(dir).filter(f=>f.endsWith(".sql")).sort();
  const pending=[];
  for(const name of files){
    const sql=readFileSync(join(dir,name),"utf8");
    const checksum=createHash("sha256").update(sql).digest("hex");
    if(!done.has(name)){pending.push({name,sql,checksum});continue;}
    if(done.get(name)!==checksum)console.warn(`! ${name} has changed since it was applied. Add a new migration instead of editing an old one.`);
  }
  if(check){
    console.log(pending.length?"Pending:\n"+pending.map(p=>"  "+p.name).join("\n"):"Up to date.");
    process.exitCode=pending.length?1:0;
  }else{
    for(const m of pending){
      process.stdout.write("Applying "+m.name+"… ");
      try{
        await client.query(m.sql);
        await client.query("INSERT INTO mossline_migrations (name, checksum) VALUES ($1, $2)",[m.name,m.checksum]);
        console.log("done");
      }catch(error){
        await client.query("ROLLBACK").catch(()=>{});
        console.log("failed");
        console.error(error instanceof Error?error.message:error);
        process.exitCode=1;
        break;
      }
    }
    if(!pending.length)console.log("Up to date.");
  }
}finally{
  await client.query("SELECT pg_advisory_unlock($1)",[LOCK]).catch(()=>{});
  await client.end();
}
