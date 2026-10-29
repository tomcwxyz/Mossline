import {createHash, randomBytes} from "node:crypto";

type Env=Record<string,string|undefined>;
export const PUBLICATION_SLUG=/^[A-Za-z0-9_-]{16,32}$/;
/** One upload, kept under what a serverless request can carry (about 4.5 MB on Vercel). */
export const PUBLISH_MAX_BYTES=4_000_000;

/** Ways to sign in that this deployment has been given credentials for. */
export function signInMethods(env:Env=process.env){
  return {
    microsoft:!!(env.MOSSLINE_MICROSOFT_CLIENT_ID&&env.MOSSLINE_MICROSOFT_CLIENT_SECRET),
    google:!!(env.MOSSLINE_GOOGLE_CLIENT_ID&&env.MOSSLINE_GOOGLE_CLIENT_SECRET),
    email:!!(env.MOSSLINE_EMAIL_FROM&&(env.MOSSLINE_SMTP_URL||env.MOSSLINE_TEST_MAIL_DIR))
  };
}

/**
 * Hosted publishing needs a database, a signing secret, the address people
 * reach Mossline at, someone allowed to publish and at least one way to sign
 * in. Without all of them the feature stays off and nothing leaves the browser.
 */
export function isHostedConfigured(env:Env=process.env):boolean{
  const methods=signInMethods(env);
  return env.MOSSLINE_HOSTED_PUBLISHING_ENABLED==="true" &&
    !!env.MOSSLINE_DATABASE_URL &&
    (env.MOSSLINE_AUTH_SECRET?.length??0)>=32 &&
    !!env.MOSSLINE_BASE_URL &&
    publisherRules(env).length>0 &&
    (methods.microsoft||methods.google||methods.email);
}

/**
 * Shared maps keep whole maps (every imported field) on this server, so a
 * deployment turns them on separately, on top of publishing.
 */
export function isSharedMapsConfigured(env:Env=process.env):boolean{
  return isHostedConfigured(env)&&env.MOSSLINE_SHARED_MAPS_ENABLED==="true";
}
/** Compressed upload of a whole map; the unpacked map may be larger. */
export const SHARED_MAP_MAX_BYTES=4_000_000;
export const SHARED_MAP_MAX_UNPACKED=60_000_000;

/**
 * Who may have an account and publish: full addresses (tom@example.org),
 * whole domains (@example.org) or "*" for anyone. They can also save maps
 * to their account and share them. People they invite to a map can sign in
 * too, to open it, but can't publish or share maps of their own.
 */
export function publisherRules(env:Env=process.env):string[]{
  return (env.MOSSLINE_PUBLISHERS??"").split(/[,\s]+/).map(s=>s.trim().toLowerCase()).filter(Boolean);
}
export function mayPublish(email:string|null|undefined,rules:string[]=publisherRules()):boolean{
  const address=(email??"").trim().toLowerCase();
  const at=address.lastIndexOf("@");
  if(at<1||at===address.length-1)return false;
  const domain=address.slice(at);
  return rules.some(rule=>rule==="*"||rule===address||(rule.startsWith("@")&&rule===domain));
}
/** New publications per account in any 24 hours. */
export function dailyPublishLimit(env:Env=process.env):number{
  const n=Number(env.MOSSLINE_PUBLISH_DAILY_LIMIT);
  return Number.isSafeInteger(n)&&n>0?n:20;
}

export const makePublicationId=()=>randomBytes(12).toString("base64url");
/** Publications made before accounts carried a management key; only its hash was kept. */
export const hashManagementKey=(key:string)=>createHash("sha256").update(key).digest("hex");
export function validPublicationId(id:string):boolean{return PUBLICATION_SLUG.test(id);}

/**
 * Changes to publications ride on the session cookie, so they must come from
 * Mossline's own pages. Browsers always send Origin on these requests.
 */
export function sameOrigin(request:Request,base=process.env.MOSSLINE_BASE_URL):boolean{
  const origin=request.headers.get("origin");
  if(!origin)return false;
  try{
    const allowed=new Set([new URL(request.url).origin]);
    if(base)allowed.add(new URL(base).origin);
    return allowed.has(new URL(origin).origin);
  }catch{return false;}
}

export async function readJsonBody(request:Request,maxBytes=PUBLISH_MAX_BYTES):Promise<unknown> {
  const reader=request.body?.getReader();
  if(!reader)throw Error("Missing request body");
  const chunks:Uint8Array[]=[];
  let count=0;
  try{
    while(true) {
      const {done,value}=await reader.read();
      if(done)break;
      count+=value.byteLength;
      if(count>maxBytes)throw Error("Publication exceeds the maximum request size");
      chunks.push(value);
    }
  }finally{void reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(count);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
}
