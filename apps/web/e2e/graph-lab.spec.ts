import {test,expect} from "@playwright/test";

test("Graph Lab keeps its experimental tools isolated from the studio",async({page})=>{
  await page.goto("/graph-lab.html");
  await expect(page.getByRole("heading",{name:/Mossline · Graph Lab/})).toBeVisible();
  await expect(page.locator("#baseline")).toBeVisible();
  await expect(page.locator("#sigma")).toBeVisible();
  await expect(page.locator("#layout option")).toHaveCount(3);
  await expect(page.locator("#message")).toContainText("300 entities");
  await page.locator("#size").selectOption("1500");
  await page.getByRole("button",{name:"Load same sample"}).click();
  await expect(page.locator("#message")).toContainText("1,500 entities");
  await page.locator("#layout").selectOption("radial");
  await expect(page.locator("#message")).toContainText("1,500 entities");
  await page.getByRole("button",{name:"Reset views"}).click();
  await expect(page.locator("#baseline")).toBeVisible();
});
