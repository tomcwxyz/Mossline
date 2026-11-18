import {test,expect,type Page} from "@playwright/test";

const source=[
  "Name,Type,Latitude,Longitude",
  "Harbour Workshop,Organisation,54.9783,-1.6178",
  "Community Kitchen,Organisation,54.5253,-1.559",
  "Shared Garden,Project,54.5742,-1.235"
].join("\n")+"\n";

async function previewMap(page:Page){
  await page.goto("/");
  await page.getByRole("button",{name:/Add your data/}).click();
  await page.locator(".ml-add-drop input[type=file]").setInputFiles({
    name:"local-projects.csv",mimeType:"text/csv",buffer:Buffer.from(source)
  });
  await expect(page.getByRole("heading",{name:"Ready to explore"})).toBeVisible();
  await page.getByRole("button",{name:"Preview my map"}).click();
  await expect(page.getByRole("region",{name:"Unsaved map preview"})).toBeVisible();
}

const storedMapAndEdits=()=>Object.fromEntries(
  Array.from({length:window.localStorage.length},(_,i)=>window.localStorage.key(i))
    .filter((key):key is string=>!!key&&/mossline:edits:v1:|mossline:map-library|mossline:atlas-annotations|mossline-maps/i.test(key))
    .sort().map(key=>[key,window.localStorage.getItem(key)])
);

test("a person can edit an imported map before keeping it, without persisting a preview",async({page})=>{
  await page.goto("/");
  const before=await page.evaluate(storedMapAndEdits);
  await previewMap(page);
  await page.locator(".ml-data-toggle").click();
  const table=page.getByRole("region",{name:"Records table"});
  const row=table.locator("tbody tr").filter({hasText:"Harbour Workshop"}).first();
  await row.getByRole("button",{name:"Edit name of Harbour Workshop"}).click();
  const cell=table.getByRole("textbox",{name:"name of Harbour Workshop"});
  await cell.fill("Harbour Skills Workshop");
  await cell.press("Enter");
  await expect(table).toContainText("Harbour Skills Workshop");
  const after=await page.evaluate(storedMapAndEdits);
  expect(after).toEqual(before);

  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"Discard preview"}).click();
  await expect(page.getByRole("region",{name:"Unsaved map preview"})).toHaveCount(0);
  await expect(page.getByRole("heading",{name:"See the relationships, not just the parts."})).toBeVisible();
  expect(await page.evaluate(storedMapAndEdits)).toEqual(before);
});

test("keeping a preview preserves original source and reversible changes on reopening",async({page})=>{
  await previewMap(page);
  await page.locator(".ml-data-toggle").click();
  const table=page.getByRole("region",{name:"Records table"});
  await table.getByRole("button",{name:"Edit name of Harbour Workshop"}).click();
  await table.getByRole("textbox",{name:"name of Harbour Workshop"}).fill("Harbour Skills Workshop");
  await table.getByRole("textbox",{name:"name of Harbour Workshop"}).press("Enter");
  await expect(table).toContainText("Harbour Skills Workshop");
  await page.getByRole("button",{name:"Keep this map"}).click();
  await expect(page.getByRole("region",{name:"Unsaved map preview"})).toHaveCount(0);
  await expect(page.locator(".ml-toast")).toContainText("Kept");
  await expect(page.locator(".ml-data-table")).toContainText("Harbour Skills Workshop");
  await page.reload();
  await page.getByRole("button",{name:/local projects/i}).click();
  await expect(page.getByRole("heading",{name:"What Mossy found"})).toBeVisible();
  await page.locator(".ml-data-toggle").click();
  await expect(page.getByRole("region",{name:"Records table"})).toContainText("Harbour Skills Workshop");
  // The original CSV remains available: undo works even after a full reload.
  await page.getByRole("button",{name:"Undo last change"}).click();
  await expect(page.getByRole("region",{name:"Records table"})).toContainText("Harbour Workshop");
  await page.getByText("What Mossy knows about this data",{exact:true}).click();
  await expect(page.getByText("local-projects.csv")).toBeVisible();
});
