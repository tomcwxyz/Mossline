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


async function openStories(page:Page){
  await page.locator(".ml-dataset summary").click();
  await page.getByRole("button",{name:/^Stories/}).click();
}

test("stories travel with a shared map: moved in, written together, clashes keep both, viewers read",async({browser,request})=>{
  test.setTimeout(180_000);
  const status=await (await request.get("/api/publications/status")).json();
  test.skip(!status.enabled||!status.sharedMaps||!mailDir,"Shared maps are not configured for this server");
  const stamp=Date.now(),owner="teller."+stamp+"@example.net",editor="co."+stamp+"@invited.example",viewer="look."+stamp+"@invited.example";
  for(const f of [owner,editor,viewer].flatMap(e=>[e+".txt",e+".invite.txt"]))await rm(join(mailDir!,f),{force:true});

  // A story written before the map was shared.
  const sam=await person(browser);
  await sam.goto("/");
  await sam.getByRole("button",{name:/Map your own data/}).click();
  await sam.getByRole("button",{name:"Try a cause-and-effect map"}).click();
  await sam.getByRole("button",{name:/Check what this adds/}).click();
  await sam.getByRole("button",{name:"Create the map"}).click();
  await sam.locator(".ml-toast button").click();
  await openStories(sam);
  let writing=sam.getByRole("complementary",{name:"Writing a story"});
  await expect(writing).toContainText("Save the map to your account");
  await writing.getByLabel("New story").fill("Before sharing");
  await writing.getByRole("button",{name:"Start a story"}).click();
  await writing.getByRole("button",{name:"Add a step from this view"}).click();
  await writing.getByLabel("Heading").fill("Where we started");
  await writing.getByRole("button",{name:"Close stories"}).click();

  // Saved to an account, with an editor and a viewer.
  await sam.locator(".ml-dataset summary").click();
  await sam.getByRole("button",{name:"Save to your account…"}).click();
  const card=sam.getByRole("complementary",{name:"Save to your account"});
  await card.getByRole("link",{name:"Sign in"}).click();
  await signIn(sam,owner);
  await sam.locator(".ml-dataset summary").click();
  await sam.getByRole("button",{name:"Save to your account…"}).click();
  await card.getByLabel(/I'm allowed to keep this data/).check();
  await card.getByRole("button",{name:"Save to my account"}).click();
  const sharing=sam.getByRole("complementary",{name:"Sharing this map"});
  await sharing.getByLabel("Invite by email").fill(editor);
  await sharing.getByRole("button",{name:"Invite",exact:true}).click();
  await expect(sharing).toContainText("Invitation emailed to "+editor);
  await sharing.getByLabel("Invite by email").fill(viewer);
  await sharing.getByLabel("They can").selectOption("viewer");
  await sharing.getByRole("button",{name:"Invite",exact:true}).click();
  await expect(sharing).toContainText("Invitation emailed to "+viewer);

  // The browser's story is offered for moving in.
  await openStories(sam);
  writing=sam.getByRole("complementary",{name:"Writing a story"});
  await expect(writing).toContainText("everyone who can open it can read them");
  const here=writing.getByRole("group",{name:"Stories in this browser"});
  await expect(here).toContainText("“Before sharing” is only in this browser");
  await here.getByRole("button",{name:"Move it into the shared map"}).click();
  await expect(sam.locator(".ml-toast")).toContainText("Story moved into the shared map.");
  await expect(writing.locator(".ml-story-list")).toContainText("Before sharing");
  await axe(sam);

  // The editor sees it and adds a step.
  const ade=await person(browser);
  await ade.goto(await mail(editor+".invite.txt"));
  await signIn(ade,editor);
  await expect(ade.locator(".ml-shared-badge")).toContainText("Shared");
  await openStories(ade);
  const adeWriting=ade.getByRole("complementary",{name:"Writing a story"});
  await adeWriting.getByRole("button",{name:/Before sharing/}).click();
  await adeWriting.getByRole("button",{name:"Add a step from this view"}).click();
  await adeWriting.getByLabel("Heading").fill("Ade's step");
  await adeWriting.getByLabel("Title").click(); // focus leaves the step: saved now
  await expect.poll(async()=>{
    const r=await ade.request.get("/api/maps").then(x=>x.json());
    const id=(r.maps as {id:string}[])[0].id;
    const list=await ade.request.get("/api/maps/"+id+"/stories").then(x=>x.json());
    return list.stories[0].steps;
  },{timeout:10_000}).toBe(2);

  // Sam sees Ade's step arrive.
  await writing.getByRole("button",{name:"Close stories"}).click();
  await openStories(sam);
  await expect(writing.locator(".ml-story-list")).toContainText("2 steps");

  // Saving over a version someone else has replaced is refused, with what's there now.
  const mapId=((await sam.request.get("/api/maps").then(x=>x.json())).maps as {id:string}[])[0].id;
  const [first]=(await sam.request.get("/api/maps/"+mapId+"/stories").then(x=>x.json())).stories;
  const now=await sam.request.get("/api/maps/"+mapId+"/stories/"+encodeURIComponent(first.id)).then(x=>x.json());
  const stale=await sam.request.put("/api/maps/"+mapId+"/stories/"+encodeURIComponent(first.id)+"?version="+(now.version-1),
    {headers:{origin:new URL(sam.url()).origin},data:{story:{...now.story,title:"Older"}}});
  expect(stale.status()).toBe(409);
  expect((await stale.json()).current.story.steps).toHaveLength(2);

  // In the editor, a clash shows the other version and keeps the writer's as a copy.
  await writing.getByRole("button",{name:/^Before sharing/}).click();
  const elsewhere=await sam.request.put("/api/maps/"+mapId+"/stories/"+encodeURIComponent(first.id)+"?version="+now.version,
    {headers:{origin:new URL(sam.url()).origin},data:{story:{...now.story,title:"Changed elsewhere"}}});
  expect(elsewhere.status()).toBe(200);
  await writing.getByLabel("Title").fill("Sam's title");
  await expect(sam.locator(".ml-toast")).toContainText("Someone else changed “Sam's title”");
  await writing.getByRole("button",{name:"← All stories"}).click();
  await expect(writing.locator(".ml-story-list")).toContainText("Changed elsewhere");
  await expect(writing.locator(".ml-story-list")).toContainText("Sam's title (your version)");

  // The viewer reads and presents, but can't write.
  const lee=await person(browser);
  await lee.goto(await mail(viewer+".invite.txt"));
  await signIn(lee,viewer);
  await expect(lee.locator(".ml-shared-badge")).toContainText("view only");
  await openStories(lee);
  const reading=lee.getByRole("complementary",{name:"Stories"});
  await expect(reading.getByLabel("New story")).toHaveCount(0);
  await reading.getByRole("button",{name:/^Changed elsewhere/}).click();
  await expect(reading).toContainText("read and present its stories but not change them");
  await reading.getByRole("button",{name:"Present"}).click();
  await expect(lee.locator(".ml-story-card h2")).toHaveText("Where we started");
  await lee.keyboard.press("ArrowRight");
  await expect(lee.locator(".ml-story-card h2")).toHaveText("Ade's step");
  await axe(lee);

  // The server holds the line too.
  const id=mapId;
  const list=await lee.request.get("/api/maps/"+id+"/stories").then(x=>x.json());
  expect(list.canWrite).toBe(false);
  const story=await lee.request.get("/api/maps/"+id+"/stories/"+encodeURIComponent(list.stories[0].id)).then(x=>x.json());
  const put=await lee.request.put("/api/maps/"+id+"/stories/"+encodeURIComponent(story.story.id)+"?version="+story.version,
    {headers:{origin:new URL(lee.url()).origin},data:{story:story.story}});
  expect(put.status()).toBe(403);
});
