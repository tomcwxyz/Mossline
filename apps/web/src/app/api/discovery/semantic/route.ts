import {NextResponse} from "next/server";
import {authoriseDiscovery,discoveryEnabled,discoveryRequestSchema,
  parseEmbeddingReply,providerPost,readDiscoveryJson} from "../../../../lib/discovery-provider";
import {noStoreHeaders} from "../../../../lib/hosted-response";
export const dynamic="force-dynamic";export const runtime="nodejs";
export async function POST(request:Request){
  if(!discoveryEnabled())return NextResponse.json({error:"Semantic models are not configured"},
    {status:503,headers:noStoreHeaders});
  if(!authoriseDiscovery(request))return NextResponse.json({error:"Discovery access key required"},
    {status:401,headers:noStoreHeaders});
  let data;
  try{data=discoveryRequestSchema.parse(await readDiscoveryJson(request));}
  catch{return NextResponse.json({error:"Invalid or oversized grant descriptions"},
    {status:400,headers:noStoreHeaders});}
  try{
    const model=process.env.MOSSLINE_DISCOVERY_EMBEDDING_MODEL!;
    const response=await providerPost("/embeddings",{
      model,input:data.documents.map(d=>d.text)
    });
    const vectors=parseEmbeddingReply(response,data.documents.length);
    return NextResponse.json({model,grantIds:data.documents.map(d=>d.grantId),vectors},
      {headers:noStoreHeaders});
  }catch{
    return NextResponse.json({error:"Embedding provider unavailable or incompatible"},
      {status:502,headers:noStoreHeaders});
  }
}
