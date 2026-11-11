import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {test,expect} from "@playwright/test";

test("Showcase presents five explorable, downloadable fictional datasets",async({page})=>{
  await page.goto("/showcase");
  await expect(page.getByRole("heading",{name:"Five fictional worlds"})).toBeVisible();
  await expect(page.locator(".ml-start-example")).toHaveCount(5);
  await expect(page.locator(".ml-start-example-preview")).toHaveCount(5);
  const link=page.locator(".ml-start-example").filter({hasText:"After Dark"}).getByRole("link",{name:/Explore this map view/});
  await link.click();
  await expect(page.locator(".ml-dataset summary strong")).toContainText("After Dark");
  await expect(page.getByRole("navigation",{name:"Atlas lenses"}).getByRole("button",{name:"Map"}))
    .toHaveAttribute("aria-current","page");
});
test("No signed-out visitor can submit a map to Showcase",async({request,baseURL})=>{
  const response=await request.post("/api/showcase",{headers:{"Origin":baseURL!},
    data:{slug:"AAAAAAAAAAAAAAAA",description:"An invented map for testing the submission review guard.",credit:"Test author"}});
  expect(response.status()).toBe(401);
});

test("The two raw CSVs for After Dark produce a usable, editable map",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:"Add your data"}).click();
  const files=["after-dark-records.csv","after-dark-relationships.csv"].map(name=>({
    name,mimeType:"text/csv",buffer:readFileSync(resolve("apps/web/public/examples",name))
  }));
  await page.locator(".ml-add-drop input[type=file]").setInputFiles(files);
  // Both CSVs are understood in one go; the user still approves the review.
  await expect(page.getByRole("heading",{name:"Check before adding"})).toBeVisible();
  await expect(page.locator(".ml-add-ledger li")).toHaveCount(2);
  await expect(page.locator(".ml-add-totals")).toContainText("334");
  await page.getByRole("button",{name:"Create the map"}).click();
  await expect(page.locator(".ml-dataset summary strong")).toContainText("after dark");
  await expect(page.getByRole("heading",{name:"What Mossy found"})).toBeVisible();
});

test("Five examples each open their own distinct lens",async({page})=>{
  const cases=[["After Dark","Map"],["The Village Web","Network"],["Common Threads","Themes"],
    ["Follow the Money","Funding"],["Changing Tides","Timeline"]] as const;
  for(const [title,lens] of cases){
    await page.goto("/showcase");
    const example=page.locator(".ml-start-example").filter({hasText:title});
    await example.getByRole("link",{name:/Explore this .* view/}).click();
    await expect(page.locator(".ml-dataset summary strong")).toContainText(title,{timeout:20_000});
    await expect(page.getByRole("navigation",{name:"Atlas lenses"}).getByRole("button",{name:lens}))
      .toHaveAttribute("aria-current","page");
  }
});
test("Geography has a real map with a substantial number of plotted places",async({page})=>{
  await page.goto("/?example=after-dark");
  await expect(page.getByRole("navigation",{name:"Atlas lenses"}).getByRole("button",{name:"Map"}))
    .toHaveAttribute("aria-current","page");
  await expect(page.locator(".ml-map-pill")).toContainText("122 plotted",{timeout:20_000});
});

test("Geography remains a connected map, with recorded links shown by default",async({page})=>{
  await page.goto("/?example=after-dark");
  await expect(page.getByRole("navigation",{name:"Atlas lenses"}).getByRole("button",{name:"Map"}))
    .toHaveAttribute("aria-current","page");
  const card=page.getByRole("region",{name:"Connections on the map"});
  await expect(card).toContainText("146 recorded mapped links",{timeout:30_000});
  const controls=page.getByRole("group",{name:"Show connections"});
  const all=controls.getByRole("button",{name:"All"});
  const off=controls.getByRole("button",{name:"Off"});
  await expect(all).toHaveAttribute("aria-pressed","true");
  await off.click();
  await expect(off).toHaveAttribute("aria-pressed","true");
  await all.click();
  await expect(all).toHaveAttribute("aria-pressed","true");
});

test("Throw Lab makes raw fictional inputs and unsupported cases visible",async({page})=>{
  await page.goto("/throw-lab");
  await expect(page.getByRole("heading",{level:1,name:"What can you throw at Mossy?"})).toBeVisible();
  await expect(page.getByText(/24 small engine-tested input cases/)).toBeVisible();
  await expect(page.getByText(/36 tracked gaps/)).toBeVisible();
  await expect(page.locator(".ml-throw-rich-card")).toHaveCount(8);
  await expect(page.locator(".ml-throw-rich-card").filter({hasText:"The Neighbourhood Web"})).toContainText("UK-wide");
  await expect(page.locator(".ml-throw-rich-card").filter({hasText:"After Hours"})).toContainText("Europe-wide");
  await expect(page.locator(".ml-throw-rich-card").filter({hasText:"Six Years of Community Funding"})).toContainText("United States-wide");
  await expect(page.locator(".ml-throw-rich-card").filter({hasText:"How Food Moves"})).toContainText("Canada, United States and Mexico");
  await expect(page.locator(".ml-throw-rich-card").filter({hasText:"Living Places"})).toContainText("15 countries");
  await expect(page.locator(".ml-throw-small .ml-start-example")).toHaveCount(24);
  await page.locator(".ml-throw-small > summary").click();
  const bare=page.locator(".ml-throw-small .ml-start-example").filter({hasText:"Only From, To and Relationship"});
  await expect(bare).toHaveCount(1);
  await bare.locator("summary").click();
  await expect(bare.getByRole("link",{name:"connections.csv"})).toHaveAttribute("download","connections.csv");
  await expect(page.getByRole("heading",{name:"What Mossy can't do properly yet"})).toBeVisible();
});

test("rich Throw Lab data opens the actual sources in an editable review",async({page})=>{
  test.setTimeout(90_000);
  await page.goto("/throw-lab");
  const example=page.locator(".ml-throw-rich-card").filter({hasText:"The Neighbourhood Web"});
  await expect(example).toContainText("350 recorded links");
  await example.getByRole("link",{name:/Explore in Mossy/}).click();
  await expect(page.getByRole("heading",{name:"Check before adding"})).toBeVisible({timeout:40_000});
  await expect(page.locator(".ml-add-totals")).toContainText("191new records");
  await expect(page.locator(".ml-add-totals")).toContainText("350new recorded links");
  await page.getByRole("button",{name:/Change how files are read or where they go/}).click();
  await expect(page.getByRole("heading",{name:"Here's how Mossy read your data"})).toBeVisible();
});
