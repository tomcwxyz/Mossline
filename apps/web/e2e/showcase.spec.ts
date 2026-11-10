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
