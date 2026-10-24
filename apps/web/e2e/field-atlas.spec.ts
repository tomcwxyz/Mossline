import {test,expect,type Page} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// The landing example opens the fictional northern food and farming network
// (data/northern-food-example.json): 383 records, 671 recorded links, 248 grants.
async function openExample(page:Page){
  await page.goto("/");
  await page.getByRole("button",{name:/Or try an example network/i}).click();
  await expect(page.locator(".ml-atlas")).toBeVisible();
}
const lens=(page:Page,name:string)=>page.getByRole("navigation",{name:"Atlas lenses"})
  .getByRole("button",{name:new RegExp("^"+name)});
async function choose(page:Page,name:string){
  await page.locator(".ml-search input").fill(name);
  await page.getByRole("button",{name:/Browse records/}).click();
  await page.locator(".ml-browse-list").getByRole("button",{name:new RegExp(name)}).first().click();
  await page.getByRole("button",{name:"Close list"}).click();
  await page.getByRole("button",{name:"Clear search"}).click();
}

test("Field Atlas keeps selection and filters across five lenses and in the URL",async({page})=>{
  await openExample(page);
  await expect(lens(page,"Network")).toHaveAttribute("aria-current","page");
  await page.getByRole("button",{name:/Browse records/}).click();
  const first=page.locator(".ml-browse-list button").first();
  const name=await first.locator("strong").innerText();
  await first.click();
  await expect(page.locator(".ml-inspector h2")).toHaveText(name);
  const url=new URL(page.url());
  expect(url.searchParams.get("record")).toBeTruthy();
  for(const next of ["Map","Themes","Funding","Timeline","Network"]){
    await lens(page,next).click();
    await expect(page.locator(".ml-inspector h2")).toHaveText(name);
  }
  await page.keyboard.press("Escape");
  await expect(page.locator(".ml-empty-panel")).toBeVisible();
  await page.keyboard.press("/");
  await expect(page.locator(".ml-search input")).toBeFocused();
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
  await expect(page.locator(".ml-unplaced")).toContainText(/Not placed · \d+/);
  await expect(page.locator(".ml-drawing-caption")).toContainText(/\d+ plotted · \d+ without coordinates/);
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText("Natural Earth");
  // A funder's recorded grants are drawn as arcs; the key explains them.
  await choose(page,"Fellside Fund");
  await expect(page.locator(".ml-key")).toContainText("Arc · a recorded grant");
  await expect(page.locator(".ml-map-label--selected")).toHaveText("Fellside Fund");
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
  await page.getByRole("combobox",{name:"From year"}).first().selectOption("2020");
  await expect(page).toHaveURL(/from=2020/);
  await lens(page,"Network").click();
  await expect(page.getByRole("region",{name:"Time"})).toContainText(/showing \d+ of 671/);
});

test("the Field Atlas uses mobile-first filters and retains advanced tools",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await openExample(page);
  await expect(page.locator(".ml-search input")).toBeVisible();
  await expect(page.getByRole("button",{name:/Browse records/})).toBeVisible();
  const filter=page.getByRole("button",{name:"Refine results"});
  await expect(filter).toBeVisible();
  await expect(page.getByRole("combobox",{name:"Type"})).toBeHidden();
  await filter.click();
  await expect(page.getByRole("combobox",{name:"Type"})).toBeVisible();
  await page.locator(".ml-dataset summary").click();
  await page.getByRole("button",{name:/Advanced tools/}).click();
  await expect(page.locator(".mossline-studio .workspace")).toBeVisible();
  await page.getByRole("button",{name:/Field atlas/}).click();
  await expect(page.locator(".ml-atlas")).toBeVisible();
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

test("the atlas has no detectable WCAG A/AA issues on its main views",async({page})=>{
  await openExample(page);
  await expect(page.locator(".ml-area-label").first()).toBeAttached();
  for(const view of ["Network","Funding","Timeline"]){
    await lens(page,view).click();
    const result=await new AxeBuilder({page}).include(".ml-atlas")
      .withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
    expect(result.violations.map(v=>view+": "+v.id+" "+v.nodes.length)).toEqual([]);
  }
});
