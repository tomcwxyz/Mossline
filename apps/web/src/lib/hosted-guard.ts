import {currentUser, type SignedIn} from "./auth";
import {isHostedConfigured, sameOrigin} from "./hosted-auth";
import {apiResult} from "./hosted-response";

/**
 * Every publication change needs: the feature on, a request from Mossline's
 * own pages, a signed-in account, and that account still allowed to publish.
 */
export async function requirePublisher(request:Request,{write}:{write:boolean}):Promise<SignedIn|Response>{
  if(!isHostedConfigured())return apiResult({error:"Hosted publishing is not configured"},503);
  if(write&&!sameOrigin(request))return apiResult({error:"Request must come from Mossline"},403);
  let user:SignedIn|null;
  try{user=await currentUser(request);}
  catch{return apiResult({error:"Accounts are temporarily unavailable"},503);}
  if(!user)return apiResult({error:"Sign in to publish"},401);
  if(!user.canPublish)return apiResult({error:"This account can't publish from Mossline"},403);
  return user;
}
