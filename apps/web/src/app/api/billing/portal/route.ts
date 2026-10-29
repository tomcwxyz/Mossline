import {reportError} from "../../../../lib/report";
import {apiResult} from "../../../../lib/hosted-response";
import {requireSignedIn} from "../../../../lib/hosted-guard";
import {billingEnabled,portalUrl} from "../../../../lib/billing";
import {orgOf,stripeCustomerOf} from "../../../../lib/orgs-db";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Invoices, card details and cancelling, on Stripe's own page. */
export async function POST(request:Request){
  const user=await requireSignedIn(request,{write:true});
  if(user instanceof Response)return user;
  if(!billingEnabled())return apiResult({error:"Card payments aren't set up here"},404);
  try{
    const org=await orgOf(user.id);
    if(!org||org.role!=="admin")return apiResult({error:"Only an organisation's admins can manage billing"},403);
    const customer=await stripeCustomerOf(org.id);
    if(!customer)return apiResult({error:"This organisation hasn't paid by card yet"},404);
    return apiResult({url:await portalUrl(customer,process.env.MOSSLINE_BASE_URL!)});
  }catch(error){reportError("billing/portal",error);return apiResult({error:"Couldn't reach the payment service. Try again in a moment."},502);}
}
