import {createHash, randomBytes, timingSafeEqual} from "node:crypto";

export const PUBLICATION_SLUG=/^[A-Za-z0-9_-]{16,32}$/;
export const PUBLISH_MAX_BYTES=170_000;
export const isHostedConfigured=()=>process.env.MOSSLINE_HOSTED_PUBLISHING_ENABLED==="true" &&
  !!process.env.MOSSLINE_DATABASE_URL &&
  (process.env.MOSSLINE_PUBLISH_ADMIN_KEY?.length??0)>=32;
export const makePublicationId=()=>randomBytes(12).toString("base64url");
export const makeManagementKey=()=>randomBytes(32).toString("base64url");
export const hashManagementKey=(key:string)=>createHash("sha256").update(key).digest("hex");
/** Only the hash of a management key is retained in the database. */
export function verifyPublisherKey(provided:string):boolean{
  const expected=process.env.MOSSLINE_PUBLISH_ADMIN_KEY;
  if(!isHostedConfigured()||!expected||!provided)return false;
  return timingSafeEqual(
    createHash("sha256").update(provided).digest(),
    createHash("sha256").update(expected).digest()
  );
}
export function readBearer(request:Request):string {
  const value=request.headers.get("authorization")??"";
  return /^Bearer [A-Za-z0-9_-]{16,256}$/.test(value)?value.slice(7):"";
}
export function validPublicationId(id:string):boolean{return PUBLICATION_SLUG.test(id);}
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
