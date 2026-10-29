import {apiResult} from "../../../../lib/hosted-response";
import {requireSignedIn} from "../../../../lib/hosted-guard";
import {billingEnabled,checkoutUrl} from "../../../../lib/billing";
import {orgOf,stripeCustomerOf} from "../../../../lib/orgs-db";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** An organisation's admin starts paying for the organisation plan. */
export async function POST(request:Request){
  const user=await requireSignedIn(request,{write:true});
  if(user instanceof Response)return user;
  if(!billingEnabled())return apiResult({error:"Card payments aren't set up here. Ask about paying by invoice."},404);
  try{
    const org=await orgOf(user.id);
    if(!org||org.role!=="admin")return apiResult({error:"Only an organisation's admins can pay for its plan"},403);
    if(org.plan==="organisation"&&org.billing)return apiResult({error:"This organisation already pays. Use Manage billing."},409);
    const url=await checkoutUrl({orgId:org.id,orgName:org.name,email:user.email,customer:await stripeCustomerOf(org.id),
      base:process.env.MOSSLINE_BASE_URL!});
    return apiResult({url});
  }catch{return apiResult({error:"Couldn't reach the payment service. Try again in a moment."},502);}
}
