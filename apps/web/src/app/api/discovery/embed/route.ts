import {NextResponse} from "next/server";
import {z} from "zod";
import {authoriseDiscovery,discoveryEnabled,embeddingModel,parseEmbeddingReply,providerPost,
  readDiscoveryJson} from "../../../../lib/discovery-provider";
import {noStoreHeaders} from "../../../../lib/hosted-response";
export const dynamic="force-dynamic";export const runtime="nodejs";
const docs=z.object({id:z.string().min(1).max(300),
  text:z.string().min(1).max(900)}).strict();
const schema=z.object({documents:z.array(docs).min(1).max(48)}).strict();
export async function POST(request:Request){
  if(!discoveryEnabled())return NextResponse.json({error:"Embedding provider is not configured"},
    {status:503,headers:noStoreHeaders});
  if(!authoriseDiscovery(request))return NextResponse.json({error:"Discovery access key required"},
    {status:401,headers:noStoreHeaders});
  let data:z.infer<typeof schema>;
  try{data=schema.parse(await readDiscoveryJson(request));}
  catch{return NextResponse.json({error:"Invalid or oversized network text batch"},
    {status:400,headers:noStoreHeaders});}
  try{
    const model=embeddingModel();
    const result=await providerPost("/embeddings",{
      model,input:data.documents.map(d=>d.text),encoding_format:"float"
    },10_000_000);
    const vectors=parseEmbeddingReply(result,data.documents.length);
    return NextResponse.json({model,ids:data.documents.map(d=>d.id),vectors},
      {headers:noStoreHeaders});
  }catch(error){
    const reason=error instanceof Error?error.message:"Embedding provider unavailable";
    return NextResponse.json({error:reason},
      {status:502,headers:noStoreHeaders});
  }
}
