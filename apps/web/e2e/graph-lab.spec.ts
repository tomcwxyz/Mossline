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
  await page.locator("#size").selectOption("3000");
  await page.getByRole("button",{name:"Run comparison"}).click();
  await expect(page.locator("#message")).toContainText("Sigma initialisation");
  await page.getByRole("button",{name:"Reset views"}).click();
  await expect(page.locator("#baseline")).toBeVisible();
});

test("Sigma graph labels use the light-on-dark configuration",async({page})=>{
  await page.goto("/graph-lab.html");
  await expect(page.locator("#sigmaStats")).toContainText("Sigma.js", {timeout:20000});
  await expect.poll(()=>page.locator("#sigma").getAttribute("data-label-config"))
    .toContain("#e9f1e7");
});
