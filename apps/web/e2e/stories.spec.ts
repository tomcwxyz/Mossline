import {test,expect,type Page} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {readFile,rm} from "node:fs/promises";
import {join} from "node:path";
import {createServer} from "node:http";
import type {AddressInfo} from "node:net";

const axe=async(page:Page)=>expect((await new AxeBuilder({page}).include(".ml-atlas")
  .withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
/** A 4×3 PNG, made up here. */
const PNG=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAEElEQVR4nGM4UWEDRww4OQBiHhHR6R4GfQAAAABJRU5ErkJggg==","base64");

async function openExample(page:Page){
  await page.goto("/");
  await page.getByRole("button",{name:/Map your own data/}).click();
  await page.getByRole("button",{name:"Try a cause-and-effect map"}).click();
  await page.getByRole("button",{name:/Check what this adds/}).click();
  await page.getByRole("button",{name:"Create the map"}).click();
  await page.locator(".ml-toast button").click();
}
/** Chooses a record from the keyboard-accessible list, as people without a mouse do. */
async function choose(page:Page,name:string){
  await page.locator(".ml-search input").fill(name);
  await page.getByRole("button",{name:/Browse records/}).click();
  await page.locator(".ml-browse-list").getByRole("button",{name:new RegExp("^"+name)}).first().click();
  await page.getByRole("button",{name:"Close list"}).click();
  await page.locator(".ml-search-clear").click();
}

test("a story: steps from views, words, a picture, a quote and marks; read, presented, and kept",async({page})=>{
  await openExample(page);
  await page.locator(".ml-dataset summary").click();
  await page.getByRole("button",{name:/^Stories/}).click();
  const editor=page.getByRole("complementary",{name:"Writing a story"});
  await editor.getByLabel("New story").fill("How cooking spreads");
  await editor.getByRole("button",{name:"Start a story"}).click();

  // Step 1: the whole map.
  await editor.getByRole("button",{name:"Add a step from this view"}).click();
  await editor.getByLabel("Heading").fill("The whole picture");
  await editor.getByLabel(/^Text/).fill("Everything **we know** so far.\n\nRead [the method](https://example.org/method).");

  // Step 2: one record, ringed with another, and a numbered mark.
  await choose(page,"Cooking skills");
  await editor.getByRole("button",{name:"Add a step from this view"}).click();
  await expect(editor.locator(".ml-story-view")).toContainText("Cooking skills");
  await editor.getByLabel("Heading").fill("Where skills come in");
  await editor.getByRole("group",{name:"Draw a mark"}).getByRole("button",{name:"Ring"}).click();
  await expect(page.locator(".ml-pick-banner")).toContainText("Click each record to ring");
  await choose(page,"Cooking skills");
  await choose(page,"Meals served");
  await expect(page.locator(".ml-pick-banner")).toContainText("2 chosen");
  await page.locator(".ml-pick-banner").getByRole("button",{name:"Finish"}).click();
  await editor.getByRole("group",{name:"Draw a mark"}).getByRole("button",{name:"Note"}).click();
  await choose(page,"Meals served");
  const marks=editor.locator(".ml-story-marks li");
  await expect(marks).toHaveCount(2);
  await marks.nth(1).getByLabel("Note text").fill("Where it shows");
  // Drawn on the map in the author's colour, anchored to the records.
  await expect(page.locator(".ml-marks .ml-mark--ring")).toBeVisible();
  await expect(page.locator(".ml-marks .ml-mark--callout text")).toHaveText("Where it shows");

  // A picture and a quote: both hold publishing until described and agreed.
  await editor.getByLabel("Choose pictures").setInputFiles({name:"kitchen.png",mimeType:"image/png",buffer:PNG});
  await expect(editor.locator(".ml-story-media-edit .ml-story-thumb")).toBeVisible();
  await editor.getByRole("button",{name:"Add a quote"}).click();
  await editor.getByLabel("Quote",{exact:true}).fill("We started cooking together and kept going.");
  await editor.getByLabel("Who said it").fill("A volunteer cook");
  const checklist=editor.getByRole("region",{name:"Before publishing"});
  await expect(checklist.locator(".is-block")).toHaveCount(3);
  await editor.getByLabel("Description for people who can't see it").fill("A shared kitchen with people cooking");
  await editor.getByLabel("Recognisable people").selectOption("none");
  await editor.getByLabel("Credit").fill("Example Kitchen Group");
  await editor.getByLabel(/They agreed to be quoted/).check();
  await expect(checklist.locator(".is-block")).toHaveCount(0);

  // A cover picture, held to the same standard; and a picture from a link, which says where it comes from.
  const cover=editor.locator(".ml-story-cover-edit");
  await cover.locator("input[type=file]").setInputFiles({name:"cover.png",mimeType:"image/png",buffer:PNG});
  await expect(checklist).toContainText("The cover picture needs a description");
  await cover.getByLabel("Description for people who can't see it").fill("A kitchen table");
  await cover.getByLabel("Recognisable people").selectOption("none");
  await expect(checklist.locator(".is-block")).toHaveCount(0);
  await editor.getByRole("button",{name:"Picture from a link…"}).click();
  await editor.getByLabel("Picture's web address").fill("http://example.org/plot.jpg");
  await editor.getByRole("button",{name:"Add picture"}).click();
  await expect(editor.getByRole("alert")).toContainText("starting https://");
  await editor.getByLabel("Picture's web address").fill("https://example.org/plot.jpg");
  await editor.getByRole("button",{name:"Add picture"}).click();
  await expect(editor).toContainText("Shown from example.org");
  await editor.locator(".ml-story-media-edit").last().getByRole("button",{name:"Remove picture"}).click();
  await axe(page);

  // Reading: a column of steps beside the map, which follows along.
  await editor.getByRole("button",{name:"Read",exact:true}).click();
  const reader=page.getByLabel("Story: How cooking spreads").first();
  await expect(reader.getByRole("heading",{name:"How cooking spreads"})).toBeVisible();
  await expect(reader.locator("strong")).toHaveText("we know");
  await expect(reader.getByRole("link",{name:"the method"})).toHaveAttribute("rel",/noopener/);
  await expect(reader.getByRole("img",{name:"A shared kitchen with people cooking"})).toBeVisible();
  await expect(reader.locator("blockquote")).toContainText("A volunteer cook");
  await axe(page);
  await reader.getByRole("heading",{name:/Where skills come in/}).scrollIntoViewIfNeeded();
  await expect(page.locator(".ml-story-section.is-current h2")).toContainText("Where skills come in");
  await expect(page.locator(".ml-inspector--story")).toBeVisible();

  // Presenting: a title card, then one step at a time, by keyboard.
  await page.getByRole("button",{name:"Present"}).click();
  const card=page.locator(".ml-story-card");
  await expect(card).toHaveClass(/is-presenting/);
  await expect(card.locator("h2")).toHaveText("How cooking spreads");
  await page.keyboard.press("ArrowLeft");
  await expect(card.locator("h2")).toHaveText("The whole picture");
  await page.keyboard.press("ArrowRight");
  await expect(card.locator("h2")).toHaveText("Where skills come in");
  await expect(page.locator(".ml-marks .ml-mark--ring")).toBeVisible();
  // A picture opens full size; Esc closes it, not the presentation.
  await card.getByRole("button",{name:"Show full size: A shared kitchen with people cooking"}).click();
  const big=page.locator("dialog.ml-lightbox[open]");
  await expect(big).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(big).toHaveCount(0);
  await expect(card).toHaveClass(/is-presenting/);
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);

  // Printing pictures each step's map, lays the story out for paper, and comes back to where it was.
  await page.evaluate(()=>{ const w=window as unknown as {printed:number}; w.printed=0;
    window.print=()=>{ w.printed++; setTimeout(()=>window.dispatchEvent(new Event("afterprint")),500); }; });
  await page.locator(".ml-story-reader").getByRole("button",{name:"Print or PDF"}).click();
  await page.waitForFunction(()=>(window as unknown as {printed:number}).printed>0,undefined,{timeout:60_000});
  await expect(page.locator(".ml-print-step")).toHaveCount(2);
  await expect(page.locator(".ml-print-map img")).toHaveCount(2);
  expect(await page.locator(".ml-print-map img").first().getAttribute("src")).toMatch(/^data:image\/jpeg;base64,/);
  await expect(page.locator(".ml-print")).toContainText("A volunteer cook");
  await expect(page.locator(".ml-print")).toHaveCount(0);
  await expect(page.locator(".ml-story-reader")).toBeVisible();

  // Kept in this browser with the map.
  await page.getByRole("button",{name:"Back to writing"}).first().click();
  await page.reload();
  await page.getByRole("button",{name:/Invented systems map/}).first().click();
  await page.locator(".ml-dataset summary").click();
  await page.getByRole("button",{name:/^Stories · 1/}).click();
  await page.getByRole("button",{name:/How cooking spreads/}).click();
  await expect(page.getByRole("complementary",{name:"Writing a story"}).locator(".ml-story-steps li")).toHaveCount(2);

  // On a phone: a title card, then a card per step that folds away to show the map.
  await page.setViewportSize({width:390,height:844});
  await page.getByRole("complementary",{name:"Writing a story"}).getByRole("button",{name:"Read",exact:true}).click();
  const phone=page.locator(".ml-story-card");
  await expect(phone.locator("h2")).toHaveText("How cooking spreads");
  await phone.getByRole("button",{name:"Begin →"}).click();
  await expect(phone.locator("h2")).toHaveText("The whole picture");
  await phone.getByRole("button",{name:"Hide text"}).click();
  await expect(phone.locator(".ml-story-card-body")).toHaveCount(0);
  await phone.getByRole("button",{name:"Next →"}).click();
  await expect(phone.locator("h2")).toHaveText("Where skills come in");
  await phone.getByRole("button",{name:"Show text"}).click();
  await expect(phone.locator(".ml-story-card-body")).toBeVisible();
  await axe(page);
});

test("a published story opens on the story, and the map can still be explored",async({page,request})=>{
  const mailDir=process.env.MOSSLINE_TEST_MAIL_DIR;
  const status=await (await request.get("/api/publications/status")).json();
  test.skip(!status.enabled||!mailDir,"Hosted publishing is not configured for this server");
  const email="story."+Date.now()+"@example.net";
  await rm(join(mailDir!,email+".txt"),{force:true});
  await openExample(page);
  await page.locator(".ml-dataset summary").click();
  await page.getByRole("button",{name:/^Stories/}).click();
  const editor=page.getByRole("complementary",{name:"Writing a story"});
  await editor.getByLabel("New story").fill("A short tour");
  await editor.getByRole("button",{name:"Start a story"}).click();
  await choose(page,"Meals served");
  await editor.getByRole("button",{name:"Add a step from this view"}).click();
  await editor.getByLabel("Heading").fill("Meals first");
  await editor.getByRole("button",{name:"Add a quote"}).click();
  await editor.getByLabel("Quote",{exact:true}).fill("Lunch brings people in.");
  await editor.getByLabel("Who said it").fill("A regular");


  // Signing in comes back to this map.
  await page.locator(".ml-share summary").click();
  await page.getByRole("button",{name:"Publish online…"}).click();
  await page.getByRole("link",{name:"Sign in to publish"}).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button",{name:"Email me a sign-in link"}).click();
  let link="";
  for(let i=0;i<40&&!link;i++){try{link=(await readFile(join(mailDir!,email+".txt"),"utf8")).trim();}catch{await page.waitForTimeout(250);}}
  await page.goto(link);

  // A story that isn't ready can't go out.
  await page.locator(".ml-share summary").click();
  await page.getByRole("button",{name:"Publish online…"}).click();
  const card=page.getByRole("complementary",{name:"Publish online"});
  await card.getByLabel("Story").selectOption({label:"“A short tour” · 1 step"});
  await expect(card).toContainText("The story isn't ready to publish");
  await expect(card.getByRole("button",{name:"Publish",exact:true})).toHaveCount(0);
  await card.getByRole("button",{name:"Close publishing"}).click();
  await page.locator(".ml-dataset summary").click();
  await page.getByRole("button",{name:/^Stories/}).click();
  await page.getByRole("button",{name:/A short tour/}).click();
  await page.getByRole("complementary",{name:"Writing a story"}).getByLabel(/They agreed to be quoted/).check();
  await page.locator(".ml-share summary").click();
  await page.getByRole("button",{name:"Publish online…"}).click();
  await expect(card.getByLabel("Story")).toHaveValue(/story:/);
  await card.getByLabel("Title").fill("A short tour of the kitchen map");
  await card.getByLabel(/I've checked this/).check();
  await card.getByRole("button",{name:"Publish",exact:true}).click();
  await expect(card).toContainText("Published.");
  const slug=(await card.getByLabel("Link to the published map").inputValue()).split("/p/")[1];

  const published=await page.context().newPage();
  await published.goto("/p/"+slug);
  const reader=published.locator(".ml-story-reader");
  await expect(reader.getByRole("heading",{name:"A short tour"})).toBeVisible();
  await expect(reader.locator("blockquote")).toContainText("Lunch brings people in.");
  // A step's address opens on it.
  await expect(published).toHaveURL(/[?&]step=1/);
  await expect(reader.getByRole("button",{name:"Copy a link to this step"})).toBeVisible();
  await expect(published.getByRole("button",{name:"Edit",exact:true})).toHaveCount(0);
  await axe(published);
  // A shared link shows the story's title and a picture.
  const html=await (await published.request.get("/p/"+slug)).text();
  expect(html).toContain('<meta property="og:title" content="A short tour"');
  expect(html).toContain('<meta name="twitter:card" content="summary_large_image"');
  const ogImage=/<meta property="og:image" content="([^"]+)"/.exec(html)?.[1];
  expect(ogImage).toBeTruthy();
  const picture=await published.request.get(new URL(ogImage!).pathname+new URL(ogImage!).search);
  expect(picture.status()).toBe(200);
  expect(picture.headers()["content-type"]).toBe("image/png");
  expect((await picture.body()).length).toBeGreaterThan(10_000);

  // Embedding: the code, a frame that works on another page, and every other page still refusing to be framed.
  await published.getByRole("button",{name:"Embed"}).click();
  const code=await published.getByLabel("Embed code").inputValue();
  expect(code).toContain("/p/"+slug+"/embed");
  const embedHeaders=(await published.request.get("/p/"+slug+"/embed")).headers();
  expect(embedHeaders["content-security-policy"]).toBe("frame-ancestors *");
  expect(embedHeaders["x-frame-options"]).toBeUndefined();
  const pageHeaders=(await published.request.get("/p/"+slug)).headers();
  expect(pageHeaders["content-security-policy"]).toBe("frame-ancestors 'self'");
  expect(pageHeaders["x-frame-options"]).toBe("SAMEORIGIN");
  const host=await page.context().newPage();
  // A page on another site, served by the test from its own little web server.
  const site=createServer((_q,r)=>{r.setHeader("content-type","text/html");r.end(`<h1>Someone's website</h1>${code}`);});
  await new Promise<void>(done=>site.listen(0,"127.0.0.1",()=>done()));
  await host.goto("http://localhost:"+(site.address() as AddressInfo).port+"/");
  const framed=host.frameLocator("iframe");
  await expect(framed.locator(".ml-story-reader h1")).toHaveText("A short tour");
  await expect(framed.getByRole("link",{name:"Open full page ↗"})).toHaveAttribute("target","_blank");
  await host.close(); site.close();
  await published.getByRole("button",{name:"Close embed"}).click();

  await reader.getByRole("button",{name:"Explore the map"}).first().click();
  await expect(reader).toHaveCount(0);
  await expect(published.getByRole("button",{name:"Read the story"})).toBeVisible();
  await axe(published);
});

test("on the Map lens, marks sit on places and pictures are pinned beside records",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:/Or try an example network/i}).click();
  await page.getByRole("navigation",{name:"Atlas lenses"}).getByRole("button",{name:/^Map/}).click();
  await page.locator(".ml-dataset summary").click();
  await page.getByRole("button",{name:/^Stories/}).click();
  const editor=page.getByRole("complementary",{name:"Writing a story"});
  await editor.getByLabel("New story").fill("Along the Tyne");
  await editor.getByRole("button",{name:"Start a story"}).click();
  await choose(page,"Hexham");
  await editor.getByRole("button",{name:"Add a step from this view"}).click();
  // A selection left over from exploring can be dropped from the step.
  const shows=editor.getByRole("group",{name:"What this step shows"});
  await expect(shows).toContainText("Hexham selected");
  await shows.getByRole("button",{name:"Stop showing Hexham selected"}).click();
  await expect(shows).not.toContainText("Hexham selected");
  await editor.getByLabel("Heading").fill("Two towns");
  await expect(editor).toContainText("On the Map, marks show for records that have a place.");
  await editor.getByRole("group",{name:"Draw a mark"}).getByRole("button",{name:"Ring"}).click();
  await choose(page,"Hexham");
  await choose(page,"Newcastle");
  await page.locator(".ml-pick-banner").getByRole("button",{name:"Finish"}).click();
  await expect(page.locator(".ml-map .ml-marks .ml-mark--ring")).toBeVisible();

  // A picture pinned beside a record shows as a postcard on the map.
  await editor.getByLabel("Choose pictures").setInputFiles({name:"bridge.png",mimeType:"image/png",buffer:PNG});
  await editor.getByRole("button",{name:"Pin beside a record on the map…"}).click();
  await expect(page.locator(".ml-pick-banner")).toContainText("Click the record to pin the picture beside.");
  await choose(page,"Newcastle");
  await expect(editor.locator(".ml-story-pin")).toContainText("Pinned beside Newcastle");
  await expect(page.locator(".ml-map .ml-pin")).toBeVisible();
  await editor.getByLabel("Description for people who can't see it").fill("A bridge over a river");
  await editor.getByLabel("Recognisable people").selectOption("none");

  // Presenting frames the step's places, with marks and the pin.
  await editor.getByRole("button",{name:"Present"}).click();
  await expect(page.locator(".ml-story-card h2")).toHaveText("Along the Tyne");
  await page.getByRole("button",{name:"Begin →"}).click();
  await expect(page.locator(".ml-story-card h2")).toHaveText("Two towns");
  // The marks are in words too, for people who can't see the map.
  await expect(page.locator(".ml-story-card .ml-visually-hidden")).toHaveText(
    "On the map: a ring around Hexham and Newcastle; a picture beside Newcastle (A bridge over a river).");
  await expect(page.locator(".ml-map .ml-mark--ring")).toBeVisible();
  await expect(page.locator(".ml-map .ml-pin")).toBeVisible();
  await axe(page);
});
