import {test,expect,type Page} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// The landing example opens the fictional northern food and farming network
// (data/northern-food-example.json): 383 records, 671 recorded links, 248 grants.
async function openExample(page:Page){
  await page.goto("/");
  await page.getByRole("button",{name:/Or try an example network/i}).click();
  await expect(page.locator(".ml-atlas:not(.ml-home)")).toBeVisible();
}
const lens=(page:Page,name:string)=>page.getByRole("navigation",{name:"Atlas lenses"})
  .getByRole("button",{name:new RegExp("^"+name)});
async function choose(page:Page,name:string){
  await page.locator(".ml-search input").fill(name);
  await page.locator(".ml-data-toggle").click();
  await page.locator(".ml-data-table tbody tr").filter({hasText:name}).first().locator(".ml-data-locate").click();
  await page.getByRole("button",{name:"Close data table"}).click();
  await page.getByRole("button",{name:"Clear search"}).click();
}

test("Field Atlas keeps selection and filters across five lenses and in the URL",async({page})=>{
  await openExample(page);
  await expect(lens(page,"Network")).toHaveAttribute("aria-current","page");
  await page.locator(".ml-data-toggle").click();
  const first=page.locator(".ml-data-table tbody tr").first();
  const name=(await first.locator(".ml-data-locate").getAttribute("aria-label"))!
    .replace(/^Show /,"").replace(/ in the graph$/,"");
  await first.locator(".ml-data-locate").click();
  await expect(page.locator(".ml-inspector h2")).toHaveText(name);
  const url=new URL(page.url());
  expect(url.searchParams.get("record")).toBeTruthy();
  for(const next of ["Map","Themes","Funding","Timeline","Network"]){
    await lens(page,next).click();
    await expect(page.locator(".ml-inspector h2")).toHaveText(name);
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading",{name:"What Mossy found"})).toBeVisible();
  await page.keyboard.press("/");
  await expect(page.locator(".ml-search input")).toBeFocused();
});

test("discoveries remain accessible after following an interesting record",async({page})=>{
  await openExample(page);
  const panel=page.getByLabel("What Mossy found");
  await expect(panel.getByRole("heading",{name:"What Mossy found"})).toBeVisible();
  await expect(panel.locator(".ml-findings-recommend h3")).toBeVisible();
  // The recommended Funding view may not pick a record. Select a finding
  // that explicitly has one, then verify that the way back is visible.
  await panel.getByRole("button",{name:"Explore this record"}).click();
  await expect(page.locator(".ml-inspector h2")).not.toHaveText("What Mossy found");
  await page.getByRole("button",{name:"Back to findings"}).click();
  await expect(panel.getByRole("heading",{name:"What Mossy found"})).toBeVisible();
});
test("geography-first datasets lead with recorded mapped connections",async({page})=>{
  await page.goto("/?example=after-dark");
  const panel=page.getByLabel("What Mossy found");
  await expect(panel.locator(".ml-findings-recommend")).toContainText("recorded relationships connect mapped places");
  await expect(panel.locator(".ml-findings-list")).not.toContainText("A picture of where things happen");
  await panel.locator(".ml-findings-recommend button").click();
  await expect(page.getByRole("navigation",{name:"Atlas lenses"}).getByRole("button",{name:"Map"}))
    .toHaveAttribute("aria-current","page");
});

test("sharing clearly distinguishes published copies from local view addresses",async({page})=>{
  await openExample(page);
  await page.locator(".ml-share summary").click();
  const share=page.getByRole("group",{name:"Share"});
  await expect(share.getByRole("button",{name:"Copy local view address"})).toBeVisible();
  await expect(share).toContainText("does not publish or transfer your dataset");
  const publish=share.getByRole("button",{name:"Publish a shareable copy…"});
  if(await publish.count()){
    await expect(publish).toBeVisible();
    await expect(share).toContainText("Anyone with the resulting link can explore that copy");
  }
});

test("Network lens draws every record with named areas and the ink/pencil key",async({page})=>{
  await openExample(page);
  const stage=page.getByRole("region",{name:"Complete Sigma network"});
  await expect(stage).toContainText("383 records · 671 recorded links");
  await expect(page.locator(".ml-sigma-viewport canvas").first()).toBeVisible();
  // Areas are named once the layout worker returns; names are source tags or "Around …".
  await expect(page.locator(".ml-area-label").first()).toBeAttached();
  await expect(page.locator(".ml-area-label--unlinked")).toContainText("No recorded links");
  const key=page.locator(".ml-key");
  await expect(key).toContainText("Ink · recorded in a source");
  await expect(key).toContainText("Pencil · inferred, not confirmed");
  // Selecting a funder shows its receipts and award summary.
  await choose(page,"Fellside Fund");
  const panel=page.locator(".ml-inspector");
  await expect(panel.locator("h2")).toHaveText("Fellside Fund");
  await expect(panel).toContainText("grants");
  await expect(panel.locator(".ml-receipt").first()).toContainText(/grants-\d{4}\.csv/);
});

test("Map never geocodes records from names and keeps the unplaced margin",async({page})=>{
  await openExample(page);
  await lens(page,"Map").click();
  await expect(page.locator(".ml-unplaced")).toContainText(/\d+ records have no location/);
  await expect(page.locator(".ml-unplaced")).toContainText("rather than guessed from a name or region");
  await expect(page.locator(".ml-drawing-caption")).toContainText(/\d+ plotted · \d+ positioned connections.*\d+ without a place/);
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText("Natural Earth");
  // Place names come from place records in the source, drawn as a map would.
  await expect(page.locator(".ml-map-place").filter({hasText:"Durham"})).toBeAttached();
  // A funder's recorded grants are drawn as arcs, with a name card and a count of what is out of view.
  await choose(page,"Fellside Fund");
  await expect(page.locator(".ml-map-callout")).toContainText("Fellside Fund");
  await expect(page.locator(".ml-map-callout")).toContainText(/\d+ grants/);
  await expect(page.locator(".ml-map-show")).toContainText("Arcs are recorded grants");
  await page.getByRole("group",{name:"Show places as"}).getByRole("button",{name:"Hexagons"}).click();
  await expect(page.getByRole("group",{name:"Show places as"}).getByRole("button",{name:"Hexagons"})).toHaveAttribute("aria-pressed","true");
});

test("Themes, Funding and Timeline read the same records",async({page})=>{
  await openExample(page);
  await lens(page,"Themes").click();
  await expect(page.getByRole("region",{name:"Records grouped by source tags"})).toBeVisible();
  await expect(page.locator(".ml-tag-card")).toContainText("Food justice");

  await lens(page,"Funding").click();
  await expect(page.getByRole("heading",{level:2,name:/across 248 grants/})).toBeVisible();
  await page.getByRole("group",{name:"Measure"}).getByRole("button",{name:"Links"}).click();
  await expect(page.locator(".ml-chart-page")).toContainText("Band widths are numbers of recorded links");
  await expect(page.locator(".ml-chart-page")).toContainText("Overlap means the same organisations, not coordinated funding");

  await lens(page,"Timeline").click();
  // Swimlanes: one row per funder, with its grants along time.
  const fellside=page.locator(".ml-lane").filter({hasText:"Fellside Fund"});
  await expect(fellside).toContainText(/\d+ grants · £/);
  await page.getByRole("group",{name:"Rows by"}).getByRole("button",{name:"Themes"}).click();
  await expect(page.locator(".ml-lane").filter({hasText:"Food justice"})).toBeVisible();
  await expect(page.locator(".ml-lanes-note")).toContainText("not given an invented day");
  await page.getByRole("combobox",{name:"From year"}).first().selectOption("2020");
  await expect(page).toHaveURL(/from=2020/);
  await lens(page,"Network").click();
  await expect(page.getByRole("region",{name:"Time"})).toContainText(/showing \d+ of 671/);
});

test("the Field Atlas uses mobile-first filters and retains advanced tools",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await openExample(page);
  await expect(page.locator(".ml-search input")).toBeVisible();
  await expect(page.locator(".ml-data-toggle")).toBeVisible();
  const filter=page.getByRole("button",{name:"Refine results"});
  await expect(filter).toBeVisible();
  await expect(page.getByRole("combobox",{name:"Type"})).toBeHidden();
  await filter.click();
  await expect(page.getByRole("combobox",{name:"Type"})).toBeVisible();
  await page.locator(".ml-dataset summary").click();
  await page.getByRole("button",{name:/Advanced tools/}).click();
  await expect(page.locator(".mossline-studio .workspace")).toBeVisible();
  await page.getByRole("button",{name:/Field atlas/}).click();
  await expect(page.locator(".ml-atlas:not(.ml-home)")).toBeVisible();
});

test("Follow a connection uses recorded steps with source receipts, not inferred shortcuts",async({page})=>{
  await openExample(page);
  await choose(page,"Larkhope Food Partnership");
  await page.getByRole("button",{name:/Follow a recorded connection/}).click();
  const follow=page.getByRole("region",{name:"Follow a recorded connection"});
  await expect(follow).toBeVisible();
  await follow.getByRole("textbox",{name:"To"}).fill("Cragend");
  await follow.getByRole("button",{name:/Cragend Land Trust/}).click();
  await follow.getByRole("button",{name:/Find recorded route/}).click();
  await expect(follow.getByRole("region",{name:"Documented route"}))
    .toContainText("4 source-recorded steps");
  await expect(follow).toContainText(/(projects|grants-\d{4})\.csv · #\d+/);
  await expect(follow).toContainText("not proof of a partnership");
});

test("the front page uses the atlas identity and follows Night/Day",async({page})=>{
  await page.goto("/");
  await expect(page.locator(".ml-home .ml-wordmark")).toContainText("Mossy");
  await expect(page.getByRole("heading",{level:1})).toHaveText("See the relationships, not just the parts.");
  await page.getByRole("button",{name:"Use night colours"}).click();
  await expect(page.locator(".ml-home")).toHaveAttribute("data-theme","night");
  const home=await new AxeBuilder({page}).include(".ml-home").withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
  expect(home.violations.map(v=>"home: "+v.id+" "+v.nodes.length)).toEqual([]);
  // The atlas opens in the same colours, on every lens.
  await page.getByRole("button",{name:/Or try an example network/i}).click();
  await expect(page.locator(".ml-atlas:not(.ml-home)").first()).toHaveAttribute("data-theme","night");
  await lens(page,"Themes").click();
  await expect(page.locator(".ml-atlas:not(.ml-home)").first()).toHaveAttribute("data-theme","night");
  await page.getByRole("button",{name:"Use day colours"}).click();
  await lens(page,"Themes").click();
  await expect(page.locator(".ml-atlas:not(.ml-home)").first()).toHaveAttribute("data-theme","day");
});

test("the atlas has no detectable WCAG A/AA issues on its main views",async({page})=>{
  await openExample(page);
  await expect(page.locator(".ml-area-label").first()).toBeAttached();
  for(const view of ["Network","Map","Funding","Timeline"]){
    await lens(page,view).click();
    const result=await new AxeBuilder({page}).include(".ml-atlas")
      .withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
    expect(result.violations.map(v=>view+": "+v.id+" "+v.nodes.length)).toEqual([]);
  }
});


test("a mapped point follows explicit coordinate edits and undo keeps its source",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:/Add your data/}).click();
  await page.locator(".ml-add-drop input[type=file]").setInputFiles({
    name:"points.csv",mimeType:"text/csv",
    buffer:Buffer.from("Name,Latitude,Longitude\nPlot A,54.97830,-1.61780\nPlot B,54.52530,-1.55900\n")
  });
  await expect(page.getByRole("heading",{name:"Check before adding"})).toBeVisible();
  await page.getByRole("button",{name:"Create the map"}).click();
  await page.locator(".ml-data-toggle").click();
  const records=page.getByRole("region",{name:"Records table"});
  await expect(records).toContainText("Plot A");
  await records.getByRole("button",{name:/Edit map position of Plot A/}).click();
  const input=records.getByRole("textbox",{name:/map position of Plot A/});
  await input.fill("54.57420, -1.23500");
  await input.press("Enter");
  await expect(records).toContainText("54.57420, -1.23500");
  await expect(records).toContainText("points.csv");
  await page.getByRole("button",{name:"Undo last change"}).click();
  await expect(records).toContainText("54.97830, -1.61780");
  // Invalid latitude must not create a change.
  await records.getByRole("button",{name:/Edit map position of Plot A/}).click();
  const invalid=records.getByRole("textbox",{name:/map position of Plot A/});
  await invalid.fill("95, -1.2");
  await invalid.press("Enter");
  await expect(records.getByRole("alert")).toContainText("valid latitude and longitude");
  await expect(records).toContainText("54.97830, -1.61780");
});
