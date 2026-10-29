import {createHmac, timingSafeEqual} from "node:crypto";

/**
 * Payments through Stripe, spoken to directly over its HTTPS API (no SDK), and
 * only where a deployment sets the keys. Organisations can also be put on a
 * plan by hand, for people who pay by invoice.
 */
type Env=Record<string,string|undefined>;
export const billingEnabled=(env:Env=process.env)=>env.MOSSLINE_PLANS_ENABLED==="true"&&
  !!env.MOSSLINE_STRIPE_SECRET_KEY&&!!env.MOSSLINE_STRIPE_PRICE_ID&&!!env.MOSSLINE_STRIPE_WEBHOOK_SECRET;

function form(params:Record<string,string|number|boolean|undefined>,prefix=""):string[]{
  return Object.entries(params).flatMap(([k,v])=>v===undefined?[]:[encodeURIComponent(prefix?prefix+"["+k+"]":k)+"="+encodeURIComponent(String(v))]);
}
async function stripe<T>(path:string,params:Record<string,string|number|boolean|undefined>):Promise<T>{
  const r=await fetch("https://api.stripe.com/v1/"+path,{method:"POST",
    headers:{Authorization:"Bearer "+process.env.MOSSLINE_STRIPE_SECRET_KEY,"Content-Type":"application/x-www-form-urlencoded"},
    body:form(params).join("&")});
  const data=await r.json() as T&{error?:{message?:string}};
  if(!r.ok)throw Error(data.error?.message??"Stripe refused the request");
  return data;
}

/** A Stripe page where an organisation's admin pays for a year. */
export async function checkoutUrl({orgId,orgName,email,customer,base}:{orgId:string;orgName:string;email:string;customer:string|null;base:string}){
  const s=await stripe<{url:string}>("checkout/sessions",{
    mode:"subscription",
    "line_items[0][price]":process.env.MOSSLINE_STRIPE_PRICE_ID,
    "line_items[0][quantity]":1,
    client_reference_id:orgId,
    "metadata[org_id]":orgId,
    "subscription_data[metadata][org_id]":orgId,
    "subscription_data[description]":"Mossline organisation plan: "+orgName,
    ...(customer?{customer}:{customer_email:email}),
    billing_address_collection:"auto",
    allow_promotion_codes:true,
    success_url:new URL("/organisation?paid=1",base).toString(),
    cancel_url:new URL("/organisation",base).toString()
  });
  return s.url;
}
/** Stripe's own page for invoices, card details and cancelling. */
export async function portalUrl(customer:string,base:string){
  const s=await stripe<{url:string}>("billing_portal/sessions",{customer,return_url:new URL("/organisation",base).toString()});
  return s.url;
}

/** Checks a webhook really came from Stripe: HMAC of "timestamp.body", within five minutes. */
export function verifyWebhook(body:string,header:string|null,secret:string,now=Date.now()):boolean{
  if(!header)return false;
  const parts=Object.fromEntries(header.split(",").map(p=>p.split("=")).filter(p=>p.length===2)) as Record<string,string>;
  const signatures=header.split(",").filter(p=>p.startsWith("v1=")).map(p=>p.slice(3));
  const t=Number(parts.t);
  if(!Number.isFinite(t)||Math.abs(now/1000-t)>300||!signatures.length)return false;
  const expected=createHmac("sha256",secret).update(t+"."+body).digest();
  return signatures.some(sig=>{
    const given=Buffer.from(sig,"hex");
    return given.length===expected.length&&timingSafeEqual(given,expected);
  });
}

type Sub={id:string;customer:string;status:string;metadata?:{org_id?:string};cancel_at_period_end?:boolean;
  current_period_end?:number;items?:{data?:{current_period_end?:number}[]}};
/**
 * What a subscription means for the plan. Paid, trialling or a payment being
 * retried: the plan runs to the end of the paid period, plus two weeks' grace
 * while a payment is retried. Anything else: it ends when the period does.
 */
export function planFromSubscription(sub:Sub):{active:boolean;until:Date|null}{
  const end=sub.current_period_end??Math.max(0,...(sub.items?.data??[]).map(i=>i.current_period_end??0));
  const until=end?new Date(end*1000):null;
  if(["active","trialing"].includes(sub.status))return {active:true,until};
  if(sub.status==="past_due"&&until)return {active:true,until:new Date(until.getTime()+14*864e5)};
  return {active:false,until};
}
export type StripeSubscription=Sub;
