import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {test,expect} from "@playwright/test";

test("Showcase presents five explorable, downloadable fictional datasets",async({page})=>{
  await page.goto("/showcase");
  await expect(page.getByRole("heading",{name:"Five fictional worlds"})).toBeVisible();
  await expect(page.locator(".ml-start-example")).toHaveCount(5);
  await expect(page.locator(".ml-start-example-preview")).toHaveCount(5);
  const link=page.locator(".ml-start-example").filter({hasText:"After Dark"}).getByRole("link",{name:/Open in Mossy/});
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
  await expect(page.getByRole("heading",{name:"Here's how Mossy read your data"})).toBeVisible();
  await expect(page.locator(".ml-add-understanding-row")).toHaveCount(2);
  await page.getByRole("button",{name:/Check what this adds/}).click();
  await expect(page.getByRole("heading",{name:"Check before adding"})).toBeVisible();
  await expect(page.locator(".ml-add-totals")).toContainText("39");
  await page.getByRole("button",{name:"Create the map"}).click();
  await expect(page.locator(".ml-dataset summary strong")).toContainText("after dark");
  await expect(page.getByRole("heading",{name:"What Mossy found"})).toBeVisible();
});
