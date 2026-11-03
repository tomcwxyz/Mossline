import {timingSafeEqual,createHash} from "node:crypto";
import {apiResult} from "../../../../lib/hosted-response";
import {isHostedConfigured} from "../../../../lib/hosted-auth";
import {housekeeping} from "../../../../lib/housekeeping";
import {reportError} from "../../../../lib/report";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/**
 * Run daily by a scheduler with "Authorization: Bearer <MOSSLINE_CRON_SECRET>".
 * Vercel Cron sends CRON_SECRET this way automatically; either name works.
 */
function allowed(request:Request):boolean{
  const secret=process.env.MOSSLINE_CRON_SECRET||process.env.CRON_SECRET;
  const given=(request.headers.get("authorization")??"").replace(/^Bearer /,"");
  if(!secret||secret.length<16||!given)return false;
  const a=createHash("sha256").update(secret).digest(),b=createHash("sha256").update(given).digest();
  return timingSafeEqual(a,b);
}
async function run(request:Request){
  if(!isHostedConfigured()||!allowed(request))return apiResult({error:"Not found"},404);
  try{return apiResult({done:await housekeeping()});}
  catch(error){reportError("housekeeping",error);return apiResult({error:"Housekeeping failed"},500);}
}
export const GET=run;
export const POST=run;
