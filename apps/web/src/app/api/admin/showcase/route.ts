import {apiResult} from "../../../../lib/hosted-response";
import {requireSignedIn,isOperator} from "../../../../lib/hosted-guard";
import {reviewQueue,decideShowcase} from "../../../../lib/showcase-db";
import {readJsonBody,validPublicationId} from "../../../../lib/hosted-auth";
import {reportError} from "../../../../lib/report";
import {z} from "zod";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const choice=z.object({slug:z.string().refine(validPublicationId),status:z.enum(["approved","rejected"])}).strict();
async function operator(request:Request,write:boolean){
  const user=await requireSignedIn(request,{write});
  if(user instanceof Response)return user;
  if(!isOperator(user.email))return apiResult({error:"Not found"},404);
  return user;
}
export async function GET(request:Request){
  const user=await operator(request,false);
  if(user instanceof Response)return user;
  try{return apiResult({items:await reviewQueue()});}
  catch(error){reportError("admin showcase",error);return apiResult({error:"Showcase review unavailable"},503);}
}
export async function PATCH(request:Request){
  const user=await operator(request,true);
  if(user instanceof Response)return user;
  let body:z.infer<typeof choice>;
  try{body=choice.parse(await readJsonBody(request,2048));}
  catch{return apiResult({error:"Invalid review decision"},400);}
  try{
    const ok=await decideShowcase(body.slug,body.status,user.id);
    return ok?apiResult({saved:true}):apiResult({error:"Publication no longer available"},404);
  }catch(error){reportError("admin showcase decision",error);return apiResult({error:"Could not save review"},503);}
}
