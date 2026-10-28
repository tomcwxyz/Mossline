import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// The invented cause-and-effect map in apps/web/public/samples/kumu-systems-map.json.
test("a systems map shows direction, signs, feedback loops and routes that follow the arrows",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:/Map your own data/}).click();
  await page.getByRole("button",{name:"Try a cause-and-effect map"}).click();
  await page.getByRole("button",{name:/Check what this adds/}).click();
  await page.getByRole("button",{name:"Create the map"}).click();
  const loops=page.getByRole("complementary",{name:"Feedback loops"});
  await expect(loops).toContainText("Feedback loops · 4");
  await expect(page.locator(".ml-key-links")).toContainText("+ more leads to more");
  await expect(page.locator(".ml-key")).toContainText("Arrows point the way a link is recorded");
  await loops.getByRole("button",{name:/R1/}).click();
  await expect(loops).toContainText("R1 is a reinforcing loop");
  await expect(page.locator(".ml-sign-layer .ml-sign")).toHaveCount(3);
  expect((await new AxeBuilder({page}).include(".ml-atlas").withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
  await loops.getByRole("button",{name:/R1/}).click();

  // Hiding a kind of link takes it out of every lens.
  await page.locator(".ml-key-links").getByRole("button",{name:/decreases/}).click();
  await expect(loops).toContainText("Feedback loops · 2");
  await page.getByRole("button",{name:"Show every kind"}).click();

  await page.locator(".ml-search input").fill("Grant funding");
  await page.getByRole("button",{name:/Browse records/}).click();
  await page.locator(".ml-browse-list button").first().click();
  await page.getByRole("button",{name:"Close list"}).click();
  await page.getByRole("button",{name:/Follow a recorded connection/}).click();
  await page.getByLabel(/Follow arrows only/).check();
  await page.locator(".ml-follow-route-form input[placeholder]").fill("insecurity");
  await page.locator(".ml-follow-choices button").first().click();
  await page.getByRole("button",{name:/Find recorded route/}).click();
  const steps=page.locator(".ml-route-steps li");
  await expect(steps.first()).toContainText("→ increases");
  await expect(page.locator(".ml-route-steps .ml-sign--minus")).toHaveCount(1);
});
