import {createHash,timingSafeEqual} from "node:crypto";
import {z} from "zod";
export const remoteDocumentSchema=z.object({
  grantId:z.string().min(1).max(300),
  text:z.string().min(35).max(900)
}).strict();
export const discoveryRequestSchema=z.object({
  documents:z.array(remoteDocumentSchema).min(2).max(48)
}).strict();
export const explanationRequestSchema=z.object({
  first:remoteDocumentSchema,second:remoteDocumentSchema
}).strict();
function trimSlashes(value:string){return value.replace(/\/+$/,"");}
function urlConfig():string|null{
  const raw=process.env.MOSSLINE_DISCOVERY_BASE_URL??(process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_AI_GATEWAY_API_KEY?"https://ai-gateway.vercel.sh/v1":undefined);
  if(!raw)return null;
  try{
    const parsed=new URL(raw);
    if(parsed.protocol!=="https:"||parsed.username||parsed.password||parsed.search||parsed.hash)
      return null;
    return trimSlashes(parsed.toString());
  }catch{return null;}
}
export const embeddingModel=()=>process.env.MOSSLINE_DISCOVERY_EMBEDDING_MODEL || "openai/text-embedding-3-small";
export const chatModel=()=>process.env.MOSSLINE_DISCOVERY_CHAT_MODEL || "openai/gpt-4.1-mini";
const providerKey=()=>process.env.MOSSLINE_DISCOVERY_API_KEY || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_AI_GATEWAY_API_KEY;
export const discoveryEnabled=()=>Boolean(urlConfig()&&
  providerKey()?.length &&
  embeddingModel().length &&
  (process.env.MOSSLINE_DISCOVERY_ACCESS_KEY?.length??0)>=32);
export const explanationEnabled=()=>discoveryEnabled()&& Boolean(chatModel().length);
export const previewDiscoveryAccess=()=>process.env.VERCEL_ENV==="preview";
export function authoriseDiscovery(request:Request):boolean{
  // Preview deployments are protected by Vercel Authentication. Production
  // always requires the separate discovery code.
  if(previewDiscoveryAccess())return discoveryEnabled();
  const given=request.headers.get("authorization")??"";
  const expected=process.env.MOSSLINE_DISCOVERY_ACCESS_KEY??"";
  if(!discoveryEnabled()||!/^Bearer [A-Za-z0-9_-]{32,256}$/.test(given))return false;
  const hash=(s:string)=>createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(given.slice(7)),hash(expected));
}
export async function readDiscoveryJson(request:Request,maxBytes=53_000):Promise<unknown>{
  const declared=Number(request.headers.get("content-length"));
  if(Number.isFinite(declared)&&declared>maxBytes)throw Error("Too much data");
  const reader=request.body?.getReader();
  if(!reader)throw Error("No data supplied");
  let total=0;
  const chunks:Uint8Array[]=[];
  try{
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      total+=value.length;
      if(total>maxBytes)throw Error("Too much data");
      chunks.push(value);
    }
  }finally{void reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(total);let position=0;
  for(const c of chunks){bytes.set(c,position);position+=c.length;}
  return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
}
export class ModelUnavailable extends Error{}
export async function providerPost(path:"/embeddings"|"/chat/completions",payload:unknown,
  maxReplyChars=1_600_000){
  const base=urlConfig(),key=providerKey();
  if(!base||!key)throw new ModelUnavailable("Remote model not configured");
  // The destination is fixed by the deployer's server-only settings, never by user input.
  let response:Response;
  try{response=await fetch(base+path,{
    method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
    body:JSON.stringify(payload),signal:AbortSignal.timeout(25_000),
    cache:"no-store",redirect:"error"
  });}catch{throw new ModelUnavailable("Model service could not be reached");}
  if(!response.ok){
    const detail=(await response.text()).slice(0,2500);
    let code="unknown";
    try {const err=JSON.parse(detail) as {error?:{code?:string;message?:string}};
      code=err.error?.code||err.error?.message?.slice(0,140)||"unknown";}catch{}
    console.error("Mossline AI Gateway request failed",{path,status:response.status,code});
    throw new ModelUnavailable("Gateway request failed (HTTP "+response.status+", "+code+").");
  }
  const raw=await response.text();
  if(raw.length>maxReplyChars)throw new ModelUnavailable("Model reply too large");
  try{return JSON.parse(raw) as unknown;}
  catch{throw new ModelUnavailable("Model reply was not JSON");}
}
export function parseEmbeddingReply(input:unknown,count:number):number[][]{
  const schema=z.object({data:z.array(z.object({index:z.number().int(),
    embedding:z.array(z.number().finite()).min(1).max(8192)}))}).passthrough();
  const parsed=schema.safeParse(input);
  if(!parsed.success||parsed.data.data.length!==count)throw new ModelUnavailable("Invalid embedding reply");
  const values=new Array<number[]>(count);
  for(const row of parsed.data.data){
    if(row.index<0||row.index>=count||values[row.index])throw new ModelUnavailable("Invalid embedding indices");
    values[row.index]=row.embedding;
  }
  if(values.some(v=>!v||v.length!==values[0].length))
    throw new ModelUnavailable("Unequal embedding dimensions");
  return values;
}
