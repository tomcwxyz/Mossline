import {test,expect,type Browser,type Page} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {readFile,rm} from "node:fs/promises";
import {join} from "node:path";
import {gunzipSync,gzipSync} from "node:zlib";

/**
 * Two people on one map. Runs only against a server with shared maps on and
 * emails written to MOSSLINE_TEST_MAIL_DIR (CI starts Postgres for this).
 */
const mailDir=process.env.MOSSLINE_TEST_MAIL_DIR;
const axe=async(page:Page)=>expect((await new AxeBuilder({page}).include(".ml-atlas")
  .withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
async function mail(file:string){
  for(let i=0;i<40;i++){
    try{return (await readFile(join(mailDir!,file),"utf8")).trim();}catch{await new Promise(r=>setTimeout(r,250));}
  }
  throw Error("No email written: "+file);
}
async function signIn(page:Page,email:string){
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button",{name:"Email me a sign-in link"}).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  await page.goto(await mail(email+".txt"));
}
async function person(browser:Browser){
  const context=await browser.newContext();
  return context.newPage();
}
const findRecord=async(page:Page,name:string)=>{
  await page.getByRole("button",{name:/Browse records/}).click();
  await page.locator(".ml-search input").fill(name);
};

test("an owner shares a map; an invited editor's changes reach them, and undo reaches everyone",async({browser,request})=>{
  test.setTimeout(150_000);
  const status=await (await request.get("/api/publications/status")).json();
  test.skip(!status.enabled||!status.sharedMaps||!mailDir,"Shared maps are not configured for this server");
  const stamp=Date.now(),owner="owner."+stamp+"@example.net",editor="ade."+stamp+"@invited.example";
  for(const f of [owner+".txt",editor+".txt",editor+".invite.txt"])await rm(join(mailDir!,f),{force:true});

  // Sam builds a map in their browser, then saves it to their account.
  const sam=await person(browser);
  await sam.goto("/");
  await sam.getByRole("button",{name:/Map your own data/}).click();
  await sam.getByRole("button",{name:"Try a cause-and-effect map"}).click();
  await sam.getByRole("button",{name:/Check what this adds/}).click();
  await sam.getByRole("button",{name:"Create the map"}).click();
  await sam.locator(".ml-toast button").click();
  await sam.locator(".ml-dataset summary").click();
  await sam.getByRole("button",{name:"Save to your account…"}).click();
  const samCard=sam.getByRole("complementary",{name:"Save to your account"});
  await samCard.getByRole("link",{name:"Sign in"}).click();
  await signIn(sam,owner);
  await expect(sam.locator(".ml-header .ml-dataset")).toBeVisible();
  await sam.locator(".ml-dataset summary").click();
  await sam.getByRole("button",{name:"Save to your account…"}).click();
  await expect(samCard).toContainText("What this copies to the server");
  await samCard.getByLabel(/I'm allowed to keep this data/).check();
  await samCard.getByRole("button",{name:"Save to my account"}).click();
  const sharing=sam.getByRole("complementary",{name:"Sharing this map"});
  await expect(sharing).toContainText("In your account");
  await sharing.getByLabel("Invite by email").fill(editor);
  await sharing.getByRole("button",{name:"Invite"}).click();
  await expect(sharing).toContainText("Invitation emailed to "+editor);
  await expect(sharing.getByLabel("People with this map")).toContainText("can edit · invited");
  await axe(sam);
  await expect(sam.locator(".ml-shared-badge")).toContainText("Shared");

  // Ade isn't on the publishers list, but the invitation lets them sign in and open it.
  const link=await mail(editor+".invite.txt");
  const ade=await person(browser);
  await ade.goto(link);
  await expect(ade.getByRole("heading",{name:"Sign in to Mossline"})).toBeVisible();
  await signIn(ade,editor);
  await expect(ade.locator(".ml-shared-badge")).toContainText("Shared");
  await expect(ade.locator(".ml-dataset")).toContainText("Invented systems map");

  // Ade adds a record; Sam's map gets it, stamped with Ade's account.
  await ade.getByRole("button",{name:"Edit",exact:true}).click();
  const add=ade.getByRole("form",{name:"Add a record"});
  await add.getByLabel("Name").fill("Shared kitchen rota");
  await add.getByLabel("Type").selectOption("outcome");
  await add.getByRole("button",{name:"Add record"}).click();
  await expect(ade.locator(".ml-inspector h2")).toHaveText("Shared kitchen rota");

  await expect(async()=>{
    await sam.evaluate(()=>window.dispatchEvent(new Event("focus")));
    await expect(sam.locator(".ml-dataset")).toContainText("13 records",{timeout:2_000});
  }).toPass({timeout:30_000});
  await sam.getByRole("button",{name:"Close sharing"}).click();
  await sam.locator(".ml-edit-toggle").click();
  await sam.getByRole("group",{name:"Editing"}).getByRole("button",{name:/Changes/}).click();
  const changes=sam.locator(".ml-edit-changes");
  await expect(changes).toContainText("Shared kitchen rota");
  await expect(changes).toContainText(editor.split("@")[0]);

  // Sam undoes it; Ade's map follows.
  await changes.getByRole("button",{name:"Undo"}).first().click();
  await expect(sam.locator(".ml-dataset")).toContainText("12 records");
  await expect(async()=>{
    await ade.evaluate(()=>window.dispatchEvent(new Event("focus")));
    await expect(ade.locator(".ml-dataset")).toContainText("12 records",{timeout:2_000});
  }).toPass({timeout:30_000});

  // Sam adds data (here straight through the API); Ade is told and pulls it in, keeping everyone's changes.
  const mapId=new URL(link).searchParams.get("map")!;
  const origin=new URL(sam.url()).origin;
  const current=await sam.request.get("/api/maps/"+mapId+"/source");
  const body=JSON.parse(gunzipSync(await current.body()).toString()) as {title:string;graph:{nodes:unknown[]}};
  body.graph.nodes.push({id:"added-later",label:"Seed library",type:"project"});
  const put=await sam.request.put("/api/maps/"+mapId+"/source?version="+current.headers()["x-mossline-source-version"],
    {headers:{origin,"content-type":"application/gzip"},data:gzipSync(JSON.stringify(body))});
  expect(put.status()).toBe(200);
  await expect(async()=>{
    await ade.evaluate(()=>window.dispatchEvent(new Event("focus")));
    await expect(ade.getByRole("status").filter({hasText:"Someone has added data"})).toBeVisible({timeout:2_000});
  }).toPass({timeout:30_000});
  await ade.getByRole("button",{name:"Get it"}).click();
  await expect(ade.locator(".ml-dataset")).toContainText("13 records");
  // A stale version is refused rather than overwriting someone's newer data.
  const stale=await sam.request.put("/api/maps/"+mapId+"/source?version=1",
    {headers:{origin,"content-type":"application/gzip"},data:gzipSync(JSON.stringify(body))});
  expect(stale.status()).toBe(409);

  // Ade's account can open maps shared with it, but can't save its own or publish.
  const own=await ade.request.post("/api/maps",{headers:{origin:new URL(ade.url()).origin},data:"x"});
  expect(own.status()).toBe(403);

  // Sam stops sharing: the map leaves the server; both browsers keep their copies.
  await sam.locator(".ml-shared-badge").click();
  await sharing.getByLabel("Delete it from my account").check();
  await sharing.getByRole("button",{name:"Stop sharing"}).click();
  await expect(sam.getByRole("complementary",{name:"Save to your account"})).toContainText("Deleted from your account");
  await expect(sam.locator(".ml-header .ml-local")).toContainText("On this device");
  await expect(async()=>{
    await ade.evaluate(()=>window.dispatchEvent(new Event("focus")));
    await expect(ade.locator(".ml-shared-badge")).toContainText("offline",{timeout:2_000});
  }).toPass({timeout:30_000});
  await expect(ade.locator(".ml-dataset")).toContainText("13 records");
});
