import {toNextJsHandler} from "better-auth/next-js";
import {getAuth} from "../../../../lib/auth";
import {apiResult} from "../../../../lib/hosted-response";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Sign-in, sign-out and account deletion. Off unless hosted publishing is configured. */
async function handle(request:Request){
  const auth=getAuth();
  if(!auth)return apiResult({error:"Accounts are not enabled on this deployment"},404);
  const handlers=toNextJsHandler(auth);
  return request.method==="GET"?handlers.GET(request):handlers.POST(request);
}
export const GET=handle;
export const POST=handle;
