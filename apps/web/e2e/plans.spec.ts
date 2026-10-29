import {test,expect,type Browser,type Page} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {createHmac} from "node:crypto";
import {readFile,rm} from "node:fs/promises";
import {join} from "node:path";

/**
 * Plans, organisations, payment events and the policy pages. Runs against a
 * server with plans on, emails written to MOSSLINE_TEST_MAIL_DIR, and a test
 * Stripe webhook secret (CI sets all three; nothing contacts Stripe).
 */
const mailDir=process.env.MOSSLINE_TEST_MAIL_DIR;
const webhookSecret=process.env.MOSSLINE_STRIPE_WEBHOOK_SECRET;
const axe=async(page:Page)=>expect((await new AxeBuilder({page}).include(".ml-atlas")
  .withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
async function mail(file:string){
  for(let i=0;i<40;i++){
    try{return (await readFile(join(mailDir!,file),"utf8")).trim();}catch{await new Promise(r=>setTimeout(r,250));}
  }
  throw Error("No email written: "+file);
}
async function signedIn(browser:Browser,email:string,next="/account"){
  await rm(join(mailDir!,email+".txt"),{force:true});
  const page=await (await browser.newContext()).newPage();
  await page.goto("/sign-in?next="+encodeURIComponent(next));
  await expect(page.getByText("By continuing, you agree to the")).toBeVisible();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button",{name:"Email me a sign-in link"}).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  await page.goto(await mail(email+".txt"));
  return page;
}
const snapshot=(n:number)=>({format:"mossline-shared-view",version:1,title:"Plan test "+n,view:"landscape",layout:"organic",
  labels:"essential",illustrated:false,exportedAt:new Date().toISOString(),nodes:[{id:"a",label:"Allotments",type:"project"}],edges:[]});

test("policies and pricing are readable and accessible",async({page,request})=>{
  const status=await (await request.get("/api/publications/status")).json();
  test.skip(!status.enabled||!status.plans,"Plans are not configured for this server");
  await page.goto("/pricing");
  await expect(page.getByRole("heading",{name:"Organisation"})).toBeVisible();
  await expect(page.locator(".ml-pricing-price").nth(1)).toHaveText(status.price);
  await axe(page);
  for(const [slug,heading] of [["terms","Terms of service"],["privacy","Privacy notice"],["data-processing","Data processing agreement"],
    ["acceptable-use","Acceptable use and takedown"],["cookies","Cookies and browser storage"],["subprocessors","Who else handles data"]]){
    await page.goto("/legal/"+slug);
    await expect(page.getByRole("heading",{level:1,name:heading})).toBeVisible();
  }
  await expect(page.locator(".ml-legal-body")).toContainText("Stripe");
  await axe(page);
  await page.goto("/legal/privacy");
  await expect(page.locator(".ml-legal-body")).toContainText("acknowledge your complaint within 30 days");
  expect((await page.goto("/legal/nothing"))?.status()).toBe(404);
});

test("free limits, an organisation, an invited member, a plan by hand and a payment event",async({browser,request})=>{
  test.setTimeout(150_000);
  const status=await (await request.get("/api/publications/status")).json();
  test.skip(!status.enabled||!status.plans||!mailDir||!webhookSecret,"Plans are not configured for this server");
  const stamp=Date.now(),admin="lead."+stamp+"@example.net",member="kim."+stamp+"@partner.example";
  const operator=process.env.MOSSLINE_ADMINS?.split(",")[0]?.trim();

  // The free plan: three published maps, then a clear message.
  const lead=await signedIn(browser,admin,"/organisation");
  const origin=new URL(lead.url()).origin;
  const publish=(n:number)=>lead.request.post("/api/publications",{headers:{origin},data:{snapshot:snapshot(n)}});
  for(const n of [1,2,3])expect((await publish(n)).status()).toBe(201);
  const fourth=await publish(4);
  expect(fourth.status()).toBe(403);
  expect((await fourth.json()).error).toMatch(/free plan allows 3 published maps/);

  // Starting an organisation brings those maps with it.
  await expect(lead.getByRole("heading",{name:"Your organisation"})).toBeVisible();
  const start=lead.getByRole("form",{name:"Start an organisation"});
  await start.getByLabel("Name").fill("Allotment Network "+stamp);
  await start.getByRole("button",{name:"Start it"}).click();
  await expect(lead.getByRole("heading",{level:1})).toHaveText("Allotment Network "+stamp);
  await expect(lead.locator(".ml-plan-box")).toContainText("Free plan");
  await expect(lead.locator(".ml-plan-usage")).toContainText("3 of 3");
  await axe(lead);

  // Kim isn't on the publishers list; the invitation lets them sign in and join.
  await rm(join(mailDir!,member+".invite.txt"),{force:true});
  const invite=lead.getByRole("form",{name:"Invite someone to the organisation"});
  await invite.getByLabel("Invite by email").fill(member);
  await invite.getByRole("button",{name:"Invite"}).click();
  await expect(lead.getByRole("status")).toContainText("Invitation emailed");
  await mail(member+".invite.txt");
  const kim=await signedIn(browser,member,"/organisation");
  await kim.getByRole("button",{name:"Join"}).click();
  await expect(kim.getByRole("heading",{level:1})).toHaveText("Allotment Network "+stamp);
  await expect(kim.locator(".ml-account-maps").first()).toContainText(admin);
  // As a member, Kim publishes under the organisation, which is still at the free limit.
  const kimPublish=await kim.request.post("/api/publications",{headers:{origin},data:{snapshot:snapshot(5)}});
  expect(kimPublish.status()).toBe(403);

  // The operator puts the organisation on the plan by hand (an invoice customer).
  test.skip(!operator,"No operator address configured");
  const op=await signedIn(browser,operator!,"/admin");
  await expect(op.getByRole("heading",{name:"Running Mossline"})).toBeVisible();
  const row=op.locator(".ml-account-maps li").filter({hasText:"Allotment Network "+stamp});
  await row.getByRole("button",{name:"Organisation plan"}).click();
  await expect(row.locator("small")).toContainText("Organisation plan");
  await axe(op);
  expect((await kim.request.post("/api/publications",{headers:{origin},data:{snapshot:snapshot(6)}})).status()).toBe(201);

  // Back to free, then a signed payment event from Stripe turns the plan on again; an unsigned one is refused.
  await row.getByRole("button",{name:"Free"}).click();
  await expect(row.locator("small")).toContainText("Free");
  const orgId=(await (await lead.request.get("/api/org")).json()).org.id as string;
  const event=JSON.stringify({id:"evt_"+stamp,type:"customer.subscription.updated",data:{object:{id:"sub_"+stamp,customer:"cus_"+stamp,
    status:"active",metadata:{org_id:orgId},items:{data:[{current_period_end:Math.floor(Date.now()/1000)+365*86400}]}}}});
  const t=Math.floor(Date.now()/1000);
  const signature="t="+t+",v1="+createHmac("sha256",webhookSecret!).update(t+"."+event).digest("hex");
  expect((await request.post("/api/billing/webhook",{headers:{"stripe-signature":"t="+t+",v1=00","content-type":"application/json"},data:event})).status()).toBe(400);
  expect((await request.post("/api/billing/webhook",{headers:{"stripe-signature":signature,"content-type":"application/json"},data:event})).status()).toBe(200);
  expect((await request.post("/api/billing/webhook",{headers:{"stripe-signature":signature,"content-type":"application/json"},data:event})).status()).toBe(200);
  await lead.reload();
  await expect(lead.locator(".ml-plan-box")).toContainText("Organisation plan");
  await expect(lead.getByRole("button",{name:"Manage billing and invoices"})).toBeVisible();

  // Kim leaves; what Kim published stays with the organisation.
  await kim.reload();
  await kim.getByLabel("Leave the organisation").check();
  await kim.getByRole("button",{name:"Leave",exact:true}).click();
  await expect(kim.getByRole("status")).toContainText("You've left");
  await lead.reload();
  await expect(lead.locator(".ml-plan-usage")).toContainText("4 of 100");
});
