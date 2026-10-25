import {test,expect,type Page} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

// Invented files in the real layouts of 360Giving, the Charity Commission
// register, Companies House and Kumu (data/generators/source-samples.mjs).
const SAMPLES=resolve(__dirname,"../public/samples")+"/";
const file=(name:string,mimeType="text/plain")=>({name,mimeType,buffer:readFileSync(SAMPLES+name)});
const axe=(page:Page)=>new AxeBuilder({page}).include(".ml-add").withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();

test("one way in: grants, register and Kumu files join on identifiers into a new map",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:/Map your own data/}).click();
  await expect(page.getByRole("heading",{name:"Bring in your data"})).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);
  await page.locator(".ml-add-drop input[type=file]").setInputFiles([
    file("360giving-grants.csv","text/csv"),file("publicextract.charity.txt"),
    file("publicextract.charity_classification.txt"),file("companies-house.csv","text/csv"),
    file("kumu-map.xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")]);
  await expect(page.getByRole("heading",{name:"What each file adds"})).toBeVisible();
  const card=(name:string)=>page.locator(".ml-add-table").filter({has:page.getByText(name,{exact:true})});
  await expect(card("360giving-grants.csv").getByRole("combobox",{name:"Read as"})).toHaveValue("0");
  await expect(card("360giving-grants.csv").locator("select option:checked")).toHaveText("360Giving grants");
  await expect(card("companies-house.csv").getByRole("radio",{name:/Fill in/})).toBeChecked();
  await expect(card("kumu-map.xlsx · Connections").locator("select option:checked")).toHaveText("Kumu connections");
  expect((await axe(page)).violations).toEqual([]);
  await page.getByLabel("Map name").fill("Upper dale (test)");
  await page.getByRole("button",{name:/Check what this adds/}).click();
  await expect(page.getByRole("heading",{name:"Check before adding"})).toBeVisible();
  await expect(page.locator(".ml-add-joins")).toContainText("360giving-grants.csv ↔ companies-house.csv");
  await expect(page.locator(".ml-add-ledger")).toContainText("Grants to individuals are left out · 1");
  // Same name without a shared identifier is listed, unticked.
  const pair=page.locator(".ml-add-same li").filter({hasText:"Hexmoor Youth Project"});
  await expect(pair.getByRole("checkbox")).not.toBeChecked();
  await expect(page.locator(".ml-add-places")).toContainText("approximately");
  expect((await axe(page)).violations).toEqual([]);
  await page.getByRole("button",{name:"Create the map"}).click();

  const atlas=page.locator(".ml-atlas:not(.ml-home):not(.ml-add)");
  await expect(atlas).toBeVisible();
  await expect(page.locator(".ml-dataset summary strong")).toHaveText("Upper dale (test)");
  await expect(page.locator(".ml-toast")).toContainText("Created ‘Upper dale (test)’");
  await page.locator(".ml-search input").fill("Allendale Larder");
  await page.getByRole("button",{name:/Browse records/}).click();
  await page.locator(".ml-browse-list button").first().click();
  const panel=page.locator(".ml-inspector");
  await expect(panel.locator("h2")).toHaveText("Allendale Larder");
  await expect(panel.locator(".ml-identifiers")).toContainText("Charity 1990001 (England and Wales)");
  await expect(panel.locator(".ml-identifiers")).toContainText("Company 99000001");
  await expect(panel.locator(".ml-receipt-list")).toContainText("companies-house.csv · #2");
  await expect(panel.locator(".ml-approx-note")).toContainText("postcode sector NE47 9");
  await expect(panel.locator(".ml-tags")).toContainText("The prevention or relief of poverty");
});

test("adding to the open map fills in records it already has",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:/Map your own data/}).click();
  await page.locator(".ml-add-drop input[type=file]").setInputFiles([file("360giving-grants.csv","text/csv")]);
  await page.getByLabel("Map name").fill("Grants only (test)");
  await page.getByRole("button",{name:/Check what this adds/}).click();
  await page.getByRole("button",{name:"Create the map"}).click();
  await expect(page.locator(".ml-dataset summary small")).toContainText("9 records");

  await page.locator(".ml-dataset summary").click();
  await page.getByRole("button",{name:"Add data…"}).click();
  await expect(page.locator(".ml-add-title")).toHaveText("Add data to Grants only (test)");
  await page.locator(".ml-add-drop input[type=file]").setInputFiles([file("companies-house.csv","text/csv")]);
  await expect(page.getByRole("radio",{name:/Add to Grants only \(test\)/})).toBeChecked();
  await expect(page.getByRole("radio",{name:/Fill in/})).toBeChecked();
  await page.getByRole("button",{name:/Check what this adds/}).click();
  await expect(page.locator(".ml-add-totals")).toContainText("2filled in");
  await expect(page.locator(".ml-add-totals")).toContainText("0new records");
  await expect(page.locator(".ml-add-ledger")).toContainText("Not about a record you already have · 1");
  await page.getByRole("button",{name:"Add to Grants only (test)"}).click();
  await expect(page.locator(".ml-dataset summary small")).toContainText("9 records");
  await expect(page.locator(".ml-toast")).toContainText("2 filled in");
});
