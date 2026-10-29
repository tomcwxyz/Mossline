import {test,expect,type Browser} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {readFile,rm} from "node:fs/promises";
import {join} from "node:path";

/** Your data, changing your address, signing out everywhere, housekeeping and health. */
const mailDir=process.env.MOSSLINE_TEST_MAIL_DIR;
async function mail(file:string){
  for(let i=0;i<40;i++){
    try{return (await readFile(join(mailDir!,file),"utf8")).trim();}catch{await new Promise(r=>setTimeout(r,250));}
  }
  throw Error("No email written: "+file);
}
async function signedIn(browser:Browser,email:string){
  await rm(join(mailDir!,email+".txt"),{force:true});
  const page=await (await browser.newContext()).newPage();
  await page.goto("/sign-in?next=/account");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button",{name:"Email me a sign-in link"}).click();
  await expect(page.getByRole("status").filter({hasText:"Check your email"})).toBeVisible();
  await page.goto(await mail(email+".txt"));
  return page;
}

test("people can take their data, change their address and sign out everywhere",async({browser,request})=>{
  const status=await (await request.get("/api/publications/status")).json();
  test.skip(!status.enabled||!mailDir,"Accounts are not configured for this server");
  const stamp=Date.now(),first="ash."+stamp+"@example.net",second="ash.new."+stamp+"@example.net";
  const page=await signedIn(browser,first);
  await expect(page.getByRole("heading",{name:"Your account"})).toBeVisible();
  const origin=new URL(page.url()).origin;
  expect((await page.request.post("/api/publications",{headers:{origin},data:{snapshot:{format:"mossline-shared-view",version:1,
    title:"Ash's map",view:"landscape",layout:"organic",labels:"essential",illustrated:false,exportedAt:new Date().toISOString(),
    nodes:[{id:"a",label:"Allotments",type:"project"}],edges:[]}}})).status()).toBe(201);

  // Everything held about them, in one file.
  const download=page.waitForEvent("download");
  await page.getByRole("link",{name:"Download your data"}).click();
  const file=await (await download).path();
  const data=JSON.parse(await readFile(file!,"utf8"));
  expect(data.kind).toBe("mossline-account-export");
  expect(data.account.email).toBe(first);
  expect(data.account.termsVersion).toBeTruthy();
  expect(data.publications[0].snapshot.title).toBe("Ash's map");

  // A new address: a link goes to it, the old one is told, and nothing changes until it's opened.
  await rm(join(mailDir!,second+".email-change.txt"),{force:true});
  const form=page.getByRole("form",{name:"Change your email address"});
  await form.getByLabel(/Change email address/).fill(second);
  await form.getByRole("button",{name:"Send a link"}).click();
  await expect(page.getByRole("status").filter({hasText:"Check "+second})).toBeVisible();
  await mail(first+".notice.txt");
  await page.goto(await mail(second+".email-change.txt"));
  await expect(page.getByRole("status").filter({hasText:"Your email address has changed"})).toBeVisible();
  await expect(page.locator(".ml-account-who")).toContainText(second);
  await expect(new AxeBuilder({page}).include(".ml-atlas").withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()
    .then(r=>r.violations)).resolves.toEqual([]);

  // Sign out everywhere ends this session too.
  await page.getByRole("button",{name:"Sign out everywhere"}).click();
  await expect(page.getByRole("status").filter({hasText:"Signed out on every device"})).toBeVisible();
  expect((await page.request.get("/api/account/export")).status()).toBe(401);
});

test("housekeeping runs only with its secret, and health reports the database",async({request})=>{
  const status=await (await request.get("/api/publications/status")).json();
  test.skip(!status.enabled||!process.env.MOSSLINE_CRON_SECRET,"Housekeeping is not configured for this server");
  expect((await request.get("/api/cron/housekeeping")).status()).toBe(404);
  expect((await request.get("/api/cron/housekeeping",{headers:{authorization:"Bearer wrong-secret-value"}})).status()).toBe(404);
  const run=await request.get("/api/cron/housekeeping",{headers:{authorization:"Bearer "+process.env.MOSSLINE_CRON_SECRET}});
  expect(run.status()).toBe(200);
  expect(Object.keys((await run.json()).done)).toEqual(expect.arrayContaining(["sessions","signInLinks","warned","deleted"]));
  const health=await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ok:true,database:"reachable",migrations:"up to date"});
});
