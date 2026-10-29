import {apiResult} from "../../../../lib/hosted-response";
import {isHostedConfigured,isSharedMapsConfigured,signInMethods} from "../../../../lib/hosted-auth";
import {currentUser} from "../../../../lib/auth";
import {isOperator} from "../../../../lib/hosted-guard";
import {openSignUp,planPrice,plansEnabled} from "../../../../lib/plans";
export const dynamic="force-dynamic";
export const runtime="nodejs";

/** Whether publishing is on, how people can sign in, and who is signed in here. */
export async function GET(request:Request){
  if(!isHostedConfigured())return apiResult({enabled:false});
  let user=null;
  try{user=await currentUser(request);}catch{/* shown as signed out */}
  return apiResult({enabled:true,signIn:signInMethods(),sharedMaps:isSharedMapsConfigured(),
    plans:plansEnabled(),openSignUp:openSignUp(),price:planPrice(),
    user:user?{name:user.name,email:user.email,canPublish:user.canPublish,operator:isOperator(user.email)}:null});
}
