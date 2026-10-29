import {apiResult, noStoreHeaders} from "../../../../lib/hosted-response";
import {requireSignedIn} from "../../../../lib/hosted-guard";
import {exportAccount} from "../../../../lib/account-db";
import {reportError} from "../../../../lib/report";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Everything Mossline holds about this account, as a file to keep. */
export async function GET(request:Request){
  const user=await requireSignedIn(request,{write:false});
  if(user instanceof Response)return user;
  try{
    const data=await exportAccount(user.id);
    if(!data)return apiResult({error:"Not found"},404);
    return new Response(JSON.stringify(data,null,2),{headers:{...noStoreHeaders,"Content-Type":"application/json; charset=utf-8",
      "Content-Disposition":`attachment; filename="mossline-account-${new Date().toISOString().slice(0,10)}.json"`}});
  }catch(error){reportError("account export",error);return apiResult({error:"Couldn't gather your data. Try again shortly."},503);}
}
