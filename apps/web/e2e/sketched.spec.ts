import {test,expect,type Page} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const axe=async(page:Page)=>expect((await new AxeBuilder({page}).include(".ml-atlas")
  .withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
const lens=(page:Page,name:string)=>page.getByRole("navigation",{name:"Atlas lenses"}).getByRole("button",{name:new RegExp("^"+name)});

test("the Sketched trial: watercolour washes and handwritten names in Themes, remembered, nothing else changed",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:/Or try an example network/i}).click();
  await lens(page,"Themes").click();
  const style=page.getByRole("group",{name:"Drawing · trial"});
  await expect(style.getByRole("button",{name:"Clean"})).toHaveAttribute("aria-pressed","true");
  await expect(page.locator(".ml-watercolour")).toHaveCount(0);

  await style.getByRole("button",{name:"Sketched"}).click();
  await expect(page.locator(".ml-network.is-sketched")).toBeVisible();
  // One wash per named area; the groups card and key still read the same.
  await expect(page.locator(".ml-watercolour").first()).toBeAttached();
  expect(await page.locator(".ml-watercolour").count()).toBeGreaterThan(4);
  await expect(page.locator(".ml-area-label span").first()).toHaveCSS("font-family",/Kalam/);
  await axe(page);

  // Remembered on this device; the Network lens stays clean for now.
  await page.reload();
  await page.getByRole("button",{name:/Or try an example network/i}).click().catch(()=>{});
  await lens(page,"Themes").click();
  await expect(page.locator(".ml-network.is-sketched")).toBeVisible();
  await lens(page,"Network").click();
  await expect(page.locator(".ml-network--network")).toBeVisible();
  await expect(page.locator(".ml-network.is-sketched")).toHaveCount(0);
  await lens(page,"Themes").click();
  await page.getByRole("group",{name:"Drawing · trial"}).getByRole("button",{name:"Clean"}).click();
  await expect(page.locator(".ml-watercolour")).toHaveCount(0);
});
