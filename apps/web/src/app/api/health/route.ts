import {apiResult} from "../../../lib/hosted-response";
import {isHostedConfigured} from "../../../lib/hosted-auth";
import {pool} from "../../../lib/db";
import {LATEST_MIGRATION} from "../../../lib/migrations";
import {reportError} from "../../../lib/report";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** For uptime checks: is Mossline up, can it reach its database, and is the database up to date? */
export async function GET(){
  if(!isHostedConfigured())return apiResult({ok:true,accounts:"off"});
  try{
    const runner=(await pool().query<{t:string|null}>(`SELECT to_regclass('mossline_migrations')::text AS t`)).rows[0]?.t;
    const current=!!runner&&(await pool().query(`SELECT 1 FROM mossline_migrations WHERE name=$1`,[LATEST_MIGRATION])).rows.length>0;
    if(!current)reportError("health","database migrations are behind: run npm run db:migrate");
    return apiResult({ok:current,accounts:"on",database:"reachable",migrations:current?"up to date":"behind"},current?200:503);
  }catch(error){
    reportError("health",error);
    return apiResult({ok:false,accounts:"on",database:"unreachable"},503);
  }
}
