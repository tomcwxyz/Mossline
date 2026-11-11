import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("a map can be built and changed in place, with receipts, undo and a Kumu export",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:/Add your data/}).click();
  await page.getByRole("button",{name:"Try a cause-and-effect map"}).click();
  await expect(page.getByRole("heading",{name:"Check before adding"})).toBeVisible();
  await page.getByRole("button",{name:"Create the map"}).click();
  await page.locator(".ml-toast button").click();
  await page.getByRole("button",{name:"Edit",exact:true}).click();
  await page.getByLabel("Your name on changes").fill("Sam");
  const add=page.getByRole("form",{name:"Add a record"});
  await add.getByLabel("Name").fill("Community kitchen space");
  await add.getByLabel("Type").selectOption("outcome");
  await add.getByRole("button",{name:"Add record"}).click();
  const panel=page.locator(".ml-inspector");
  await expect(panel.locator("h2")).toHaveText("Community kitchen space");
  await expect(panel.locator(".ml-receipt-list")).toContainText("Added here by Sam");
  expect((await new AxeBuilder({page}).include(".ml-atlas").withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);

  // A link drawn from the panel, its other end chosen from the list.
  await panel.getByRole("button",{name:"Add a link"}).click();
  const form=page.getByRole("form",{name:/New link from/});
  await form.getByLabel("Link to").fill("Cooking");
  await form.getByRole("button",{name:/Cooking skills/}).click();
  await form.getByLabel("Kind of link").fill("increases");
  await form.getByLabel("Cause and effect").selectOption("+");
  await form.getByRole("button",{name:"Add link"}).click();
  await expect(panel.locator(".ml-link-list")).toContainText("Cooking skills");
  await expect(panel.locator(".ml-link-list .ml-receipt").first()).toContainText("Entered by Sam");

  // Quick entry closes a new loop.
  await page.getByRole("group",{name:"Editing"}).getByRole("button",{name:"Quick entry"}).click();
  await page.getByLabel("One link per line").fill("Community kitchen space + Meals served\nMeals served + Cooking skills");
  await page.getByRole("button",{name:"Add 2 links"}).click();
  await expect(page.getByRole("complementary",{name:"Feedback loops"})).toContainText("Feedback loops · 5");

  // Change what a record says; the file's value is kept and can be restored.
  await page.locator(".ml-search input").fill("Grant funding");
  await page.getByRole("button",{name:/Browse records/}).click();
  await page.locator(".ml-browse-list button").first().click();
  await page.getByRole("button",{name:"Close list"}).click();
  await page.locator(".ml-search-clear").click();
  await panel.getByRole("button",{name:"Edit details"}).click();
  await panel.getByLabel("Name").fill("Grant and donated funding");
  await panel.getByRole("button",{name:"Save changes"}).click();
  await expect(panel.locator("h2")).toHaveText("Grant and donated funding");
  await page.getByRole("group",{name:"Editing"}).getByRole("button",{name:/Changes/}).click();
  const changes=page.locator(".ml-edit-changes li");
  await expect(changes.first()).toContainText("Changed label of Grant and donated funding");
  await changes.first().getByRole("button",{name:"Undo"}).click();
  await expect(panel.locator("h2")).toHaveText("Grant funding");

  const download=page.waitForEvent("download");
  await page.getByRole("button",{name:/Kumu, Excel/}).click();
  expect((await download).suggestedFilename()).toMatch(/-kumu\.xlsx$/);

  // Changes are kept with the map in this browser.
  await page.reload();
  await page.getByRole("button",{name:/Invented systems map/}).click();
  await expect(page.locator(".ml-dataset summary small")).toContainText("13 records");
  await expect(page.getByRole("button",{name:/Edit · 4/})).toBeVisible();
});


test("one editable data view changes the graph, and a graph connection appears in the data",async({page})=>{
  test.setTimeout(100_000);
  await page.goto("/");
  await page.getByRole("button",{name:/Add your data/}).click();
  await page.getByRole("button",{name:"Try a cause-and-effect map"}).click();
  await expect(page.getByRole("heading",{name:"Check before adding"})).toBeVisible();
  await page.getByRole("button",{name:"Create the map"}).click();
  await page.getByRole("button",{name:"Data table"}).click();
  const records=page.getByRole("region",{name:"Records table"});
  const funding=records.locator("tr").filter({hasText:"Grant funding"});
  await funding.getByRole("button",{name:"Edit name of Grant funding"}).click();
  await records.getByRole("textbox",{name:"name of Grant funding"}).fill("Funder support");
  await records.getByRole("textbox",{name:"name of Grant funding"}).press("Enter");
  await expect(records).toContainText("Funder support");
  await funding.getByRole("button",{name:"Show Funder support in the graph"}).click();
  await expect(page.locator(".ml-inspector h2")).toHaveText("Funder support");
  // The change is not a separate table copy: undo restores the graph and the table.
  await page.getByRole("button",{name:"Undo last change"}).click();
  await expect(records).toContainText("Grant funding");
  await expect(page.locator(".ml-inspector h2")).toHaveText("Grant funding");
  // No global Edit mode is needed to create a connection.
  await page.getByRole("button",{name:"Connect",exact:true}).click();
  await page.getByRole("button",{name:/Browse records/}).click();
  const candidates=page.locator(".ml-browse-list button");
  await candidates.filter({hasText:"Cooking skills"}).first().click();
  const connection=page.getByRole("complementary",{name:"Draw a connection"});
  await expect(connection).toContainText("Connect two records");
  await connection.getByLabel("Kind of link").fill("strengthens");
  await connection.getByRole("button",{name:"Add link"}).click();
  const links=page.getByRole("region",{name:"Connections table"});
  await expect(links).toContainText("strengthens");
  await expect(page.locator(".ml-inspector .ml-link-list")).toContainText("strengthens");
  const row=links.locator("tr").filter({hasText:"strengthens"});
  await row.getByRole("button",{name:/Edit relationship from/}).click();
  await links.getByRole("textbox",{name:/relationship from/}).fill("supports");
  await links.getByRole("textbox",{name:/relationship from/}).press("Enter");
  await expect(links).toContainText("supports");
  await expect(page.locator(".ml-inspector .ml-link-list")).toContainText("supports");
  await page.getByRole("button",{name:"Undo last change"}).click();
  await expect(links).toContainText("strengthens");
});
