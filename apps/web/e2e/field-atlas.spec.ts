import {test,expect} from "@playwright/test";

test("Field Atlas keeps selection and filters across five lenses and in the URL",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:/Or try an example network/i}).click();
  const atlas=page.locator(".ml-atlas");
  await expect(atlas).toBeVisible();
  const lenses=page.getByRole("navigation",{name:"Atlas lenses"});
  await expect(lenses.getByRole("button",{name:/Network/})).toHaveAttribute("aria-current","page");
  await page.getByRole("button",{name:/Browse records/}).click();
  const first=page.locator(".ml-browse-list button").first();
  const name=await first.locator("strong").innerText();
  await first.click();
  await expect(page.locator(".ml-inspector h2")).toHaveText(name);
  const url=new URL(page.url());
  expect(url.searchParams.get("record")).toBeTruthy();
  for(const lens of ["Map","Themes","Funding","Timeline","Network"]){
    await lenses.getByRole("button",{name:new RegExp("^"+lens)}).click();
    await expect(page.locator(".ml-inspector h2")).toHaveText(name);
  }
  await page.keyboard.press("Escape");
  await expect(page.locator(".ml-empty-panel")).toBeVisible();
  await page.keyboard.press("/");
  await expect(page.locator(".ml-search input")).toBeFocused();
});

test("Map never geocodes records from names and keeps the unplaced margin",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:/Or try an example network/i}).click();
  await page.getByRole("navigation",{name:"Atlas lenses"})
    .getByRole("button",{name:/^Map/}).click();
  await expect(page.locator(".ml-unplaced")).toContainText(/Not placed/);
  await expect(page.locator(".ml-drawing-caption")).toContainText("Coordinate plot");
});

test("the Field Atlas uses mobile-first filters and retains advanced tools",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await page.getByRole("button",{name:/Or try an example network/i}).click();
  await expect(page.locator(".ml-atlas")).toBeVisible();
  await expect(page.locator(".ml-search input")).toBeVisible();
  const filter=page.getByRole("button",{name:"Filters"});
  await expect(filter).toBeVisible();
  await expect(page.getByRole("combobox",{name:"Type"})).toBeHidden();
  await filter.click();
  await expect(page.getByRole("combobox",{name:"Type"})).toBeVisible();
  await page.getByRole("button",{name:/Detailed tools & full network/}).click();
  await expect(page.locator(".mossline-studio .workspace")).toBeVisible();
  await page.getByRole("button",{name:/Field atlas/}).click();
  await expect(page.locator(".ml-atlas")).toBeVisible();
});
