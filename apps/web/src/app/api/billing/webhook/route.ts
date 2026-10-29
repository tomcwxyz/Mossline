import {reportError} from "../../../../lib/report";
import {billingEnabled,planFromSubscription,verifyWebhook,type StripeSubscription} from "../../../../lib/billing";
import {firstTime,forgetEvent,orgForStripe,setPlan,setStripe} from "../../../../lib/orgs-db";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/**
 * Stripe tells Mossline about payments here. Each event is checked against the
 * webhook secret and handled once; the plan follows the subscription.
 */
export async function POST(request:Request){
  if(!billingEnabled())return new Response("Not found",{status:404});
  const body=await request.text();
  if(!verifyWebhook(body,request.headers.get("stripe-signature"),process.env.MOSSLINE_STRIPE_WEBHOOK_SECRET!))
    return new Response("Bad signature",{status:400});
  let event:{id:string;type:string;data:{object:Record<string,unknown>}};
  try{event=JSON.parse(body);}catch{return new Response("Bad body",{status:400});}
  try{
    if(!await firstTime(event.id,event.type))return new Response("Already handled",{status:200});
    const o=event.data.object;
    if(event.type==="checkout.session.completed"){
      const orgId=(o.client_reference_id as string|undefined)??(o.metadata as {org_id?:string}|undefined)?.org_id;
      if(orgId)await setStripe(orgId,(o.customer as string)??null,(o.subscription as string)??null);
    }
    if(event.type.startsWith("customer.subscription.")){
      const sub=o as unknown as StripeSubscription;
      const orgId=sub.metadata?.org_id??await orgForStripe(sub.customer,sub.id);
      if(orgId){
        await setStripe(orgId,sub.customer,sub.id);
        const {active,until}=planFromSubscription(sub);
        // Cancelled or unpaid: the plan still runs to the end of what was paid for, then the free limits apply.
        await setPlan(orgId,"organisation",active?until:until??new Date(),"stripe");
      }
    }
    return new Response("OK",{status:200});
  }catch(error){
    reportError("billing webhook "+event.type,error);
    // Stripe retries on failure, so this event mustn't count as handled.
    await forgetEvent(event.id).catch(()=>{});
    return new Response("Try again",{status:500});
  }
}
