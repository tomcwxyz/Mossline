import {apiResult} from "../../../lib/hosted-response";
import {requirePublisher} from "../../../lib/hosted-guard";
import {readJsonBody,validPublicationId,isHostedConfigured} from "../../../lib/hosted-auth";
import {featuredShowcase,submitShowcase} from "../../../lib/showcase-db";
import {reportError} from "../../../lib/report";
import {z} from "zod";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const submission=z.object({
  slug:z.string().refine(validPublicationId),
  credit:z.string().trim().min(2).max(80),
  description:z.string().trim().min(30).max(600)
}).strict();
export async function GET(){
  if(!isHostedConfigured())return apiResult({items:[]});
  try{return apiResult({items:await featuredShowcase()});}
  catch(error){reportError("showcase",error);return apiResult({error:"Showcase is temporarily unavailable"},503);}
}
/** Nothing reaches the gallery automatically: a publisher must deliberately submit it. */
export async function POST(request:Request){
  const user=await requirePublisher(request,{write:true});
  if(user instanceof Response)return user;
  let input:z.infer<typeof submission>;
  try{input=submission.parse(await readJsonBody(request,2048));}
  catch{return apiResult({error:"Provide a published map, a short description and a public credit"},400);}
  try{
    const saved=await submitShowcase(user.id,input.slug,input.description,input.credit);
    if(!saved)return apiResult({error:"This isn't one of your published maps"},404);
    return apiResult({submitted:true,status:"pending"},201);
  }catch(error){reportError("showcase submit",error);return apiResult({error:"Showcase submissions unavailable"},503);}
}
