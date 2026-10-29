import {apiResult} from "../../../../lib/hosted-response";
import {isHostedConfigured,signInMethods} from "../../../../lib/hosted-auth";
import {currentUser} from "../../../../lib/auth";
export const dynamic="force-dynamic";
export const runtime="nodejs";

/** Whether publishing is on, how people can sign in, and who is signed in here. */
export async function GET(request:Request){
  if(!isHostedConfigured())return apiResult({enabled:false});
  let user=null;
  try{user=await currentUser(request);}catch{/* shown as signed out */}
  return apiResult({enabled:true,signIn:signInMethods(),
    user:user?{name:user.name,email:user.email,canPublish:user.canPublish}:null});
}
