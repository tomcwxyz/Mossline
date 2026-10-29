import {reportError} from "../../../lib/report";
import {apiResult} from "../../../lib/hosted-response";
import {readJsonBody} from "../../../lib/hosted-auth";
import {requireSignedIn} from "../../../lib/hosted-guard";
import {createOrg,joinable,members,orgOf,updateOrg,usageFor,validJoinDomain} from "../../../lib/orgs-db";
import {canUseAsJoinDomain,domainOf,planPrice,plansEnabled} from "../../../lib/plans";
import {billingEnabled} from "../../../lib/billing";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** This account's organisation (if any), what it could join, and what its plan allows. */
export async function GET(request:Request){
  const user=await requireSignedIn(request,{write:false});
  if(user instanceof Response)return user;
  try{
    const org=await orgOf(user.id);
    const people=org?await members(org.id):null;
    return apiResult({org,members:people?.members??[],invites:org?.role==="admin"?people?.invites??[]:[],
      joinable:org?[]:await joinable(user.email),usage:await usageFor(user.id),
      canCreate:user.canPublish,plans:plansEnabled(),billing:billingEnabled(),price:planPrice(),
      domain:canUseAsJoinDomain(user.email)?domainOf(user.email):null});
  }catch(error){reportError("org",error);return apiResult({error:"Organisations are temporarily unavailable"},503);}
}

/** Starts an organisation, with this account as its admin. What it already made moves in. */
export async function POST(request:Request){
  const user=await requireSignedIn(request,{write:true});
  if(user instanceof Response)return user;
  if(!user.canPublish)return apiResult({error:"This account can join an organisation it's invited to, but can't start one"},403);
  let name="";
  try{const body=await readJsonBody(request,2_000) as {name?:unknown};name=typeof body?.name==="string"?body.name.trim().slice(0,120):"";}catch{/* below */}
  if(!name)return apiResult({error:"Give the organisation a name"},400);
  try{
    if(await orgOf(user.id))return apiResult({error:"You're already in an organisation. Leave it first."},409);
    return apiResult({org:await createOrg(user.id,name)},201);
  }catch(error){reportError("org",error);return apiResult({error:"Organisations are temporarily unavailable"},503);}
}

/** Admins rename the organisation, or let anyone at their email domain join. */
export async function PATCH(request:Request){
  const user=await requireSignedIn(request,{write:true});
  if(user instanceof Response)return user;
  let body:{name?:unknown;openToDomain?:unknown}={};
  try{body=await readJsonBody(request,2_000) as typeof body;}catch{return apiResult({error:"Couldn't read that"},400);}
  try{
    const org=await orgOf(user.id);
    if(!org||org.role!=="admin")return apiResult({error:"Only an organisation's admins can change it"},403);
    if(typeof body.name==="string"){
      const name=body.name.trim().slice(0,120);
      if(!name)return apiResult({error:"Give the organisation a name"},400);
      await updateOrg(org.id,{name});
    }
    if(typeof body.openToDomain==="boolean"){
      const domain=domainOf(user.email);
      if(body.openToDomain&&!validJoinDomain(user.email,domain))
        return apiResult({error:"Only a domain your organisation owns can be opened, not a shared mail service like Gmail"},400);
      await updateOrg(org.id,{joinDomain:body.openToDomain?domain:null});
    }
    return apiResult({org:await orgOf(user.id)});
  }catch(error){reportError("org",error);return apiResult({error:"Organisations are temporarily unavailable"},503);}
}
