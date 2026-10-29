import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {activePlan,canUseAsJoinDomain,limitMessage,limitsFor,PLANS} from "../src/lib/plans";
import {planFromSubscription,verifyWebhook} from "../src/lib/billing";
import {fillPolicy,operator} from "../src/lib/legal";
import {mayCreate} from "../src/lib/hosted-auth";

test("a paid plan counts until its end date; no end date means until changed",()=>{
 const now=new Date("2026-10-29T12:00:00Z");
 assert.equal(activePlan(null,now),"free");
 assert.equal(activePlan({plan:"organisation",planUntil:"2027-10-29T00:00:00Z"},now),"organisation");
 assert.equal(activePlan({plan:"organisation",planUntil:"2026-10-28T00:00:00Z"},now),"free");
 assert.equal(activePlan({plan:"organisation",planUntil:null},now),"organisation");
 assert.equal(activePlan({plan:"free",planUntil:null},now),"free");
});

test("limits apply only where plans are switched on",()=>{
 assert.deepEqual(limitsFor("free",{MOSSLINE_PLANS_ENABLED:"true"}),PLANS.free.limits);
 assert.equal(limitsFor("free",{}).publications,Infinity);
 assert.match(limitMessage("publications","free",3,{}),/free plan allows 3 published maps.*£49 a year/);
});

test("open sign-up lets anyone with an address in; otherwise the list decides",()=>{
 assert.equal(mayCreate("someone@anywhere.org",{MOSSLINE_OPEN_SIGNUP:"true"}),true);
 assert.equal(mayCreate("not-an-address",{MOSSLINE_OPEN_SIGNUP:"true"}),false);
 assert.equal(mayCreate("someone@anywhere.org",{MOSSLINE_PUBLISHERS:"@example.org"}),false);
 assert.equal(mayCreate("sam@example.org",{MOSSLINE_PUBLISHERS:"@example.org"}),true);
});

test("only an organisation's own domain can be opened to everyone at it",()=>{
 assert.equal(canUseAsJoinDomain("sam@allotments.org.uk"),true);
 assert.equal(canUseAsJoinDomain("sam@gmail.com"),false);
 assert.equal(canUseAsJoinDomain("sam@outlook.com"),false);
});

test("payment events are believed only with Stripe's signature, and only while fresh",()=>{
 const secret="whsec_test",body=JSON.stringify({id:"evt_1"}),t=Math.floor(Date.now()/1000);
 const sig=createHmac("sha256",secret).update(t+"."+body).digest("hex");
 assert.equal(verifyWebhook(body,"t="+t+",v1="+sig,secret),true);
 assert.equal(verifyWebhook(body+" ","t="+t+",v1="+sig,secret),false);
 assert.equal(verifyWebhook(body,"t="+t+",v1="+sig,"whsec_other"),false);
 assert.equal(verifyWebhook(body,"t="+(t-600)+",v1="+createHmac("sha256",secret).update((t-600)+"."+body).digest("hex"),secret),false);
 assert.equal(verifyWebhook(body,null,secret),false);
});

test("a subscription keeps the plan to the end of what was paid, with grace while a payment is retried",()=>{
 const end=Math.floor(new Date("2027-10-29T00:00:00Z").getTime()/1000);
 assert.deepEqual(planFromSubscription({id:"s",customer:"c",status:"active",current_period_end:end}),{active:true,until:new Date(end*1000)});
 // Newer Stripe API versions put the period on the subscription's items.
 assert.equal(planFromSubscription({id:"s",customer:"c",status:"active",items:{data:[{current_period_end:end}]}}).until?.getTime(),end*1000);
 assert.equal(planFromSubscription({id:"s",customer:"c",status:"past_due",current_period_end:end}).until?.getTime(),end*1000+14*864e5);
 assert.equal(planFromSubscription({id:"s",customer:"c",status:"canceled",current_period_end:end}).active,false);
});

test("policies are filled in from the operator's settings, and unset details stay visibly blank",()=>{
 const env={MOSSLINE_OPERATOR_NAME:"The Good Ship",MOSSLINE_OPERATOR_EMAIL:"hello@example.org",MOSSLINE_BASE_URL:"https://mossline.example"};
 assert.equal(operator(env).address,"[postal address not set]");
 const text=fillPolicy("{{name}} ({{email}}) at {{site}}. {{vat_statement}} {{address}} {{unknown}}",env);
 assert.equal(text,"The Good Ship (hello@example.org) at https://mossline.example. We aren't registered for VAT, so no VAT is charged. [postal address not set] {{unknown}}");
 assert.equal(fillPolicy("{{name}}",{MOSSLINE_OPERATOR_NAME:"<b>A & B</b>"}),"&lt;b&gt;A &amp; B&lt;/b&gt;");
 assert.match(fillPolicy("{{vat_statement}}",{...env,MOSSLINE_OPERATOR_VAT_NUMBER:"GB123"}),/exclude VAT.*GB123/);
});
