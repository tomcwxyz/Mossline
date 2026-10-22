import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const grantCsv=[
 "Identifier,Funding Org:Name,Recipient Org:Name,Amount Awarded,Award Date",
 "360G-TEST-1,North Example Trust,Community Pantry,1200,2026-04-01",
 "360G-TEST-2,North Example Trust,Repair Co-operative,2200,2026-04-02"
].join("\n");

async function checkSeriousAccessibility(page:import("@playwright/test").Page){
 const result=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
 const significant=result.violations.filter(v=>["serious","critical"].includes(v.impact??""));
 expect(significant,JSON.stringify(significant,null,2)).toEqual([]);
}

test("landing and community network are accessible and graph-first on desktop",async({page})=>{
 await page.goto("/");
 await expect(page.getByRole("heading",{name:/See the relationships/i})).toBeVisible();
 await checkSeriousAccessibility(page);
 await page.getByRole("button",{name:/Or try an example network/i}).click();
 await expect(page.getByRole("navigation",{name:"Choose how to explore this network"})).toBeVisible();
 const panel=page.locator(".mossline-studio .map-panel");
 await expect(panel).toBeVisible();
 const box=await panel.boundingBox();
 expect(box).not.toBeNull();
 expect(box!.y).toBeLessThan(500);
 await expect(page.getByRole("button",{name:/Connections/i}).first()).toBeVisible();
 await checkSeriousAccessibility(page);
});

test("mobile opens network first and filters in an on-demand drawer",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/");
 await page.getByRole("button",{name:/Or try an example network/i}).click();
 const panel=page.locator(".mossline-studio .map-panel");
 await expect(panel).toBeVisible();
 const box=await panel.boundingBox();
 expect(box).not.toBeNull();
 expect(box!.y).toBeLessThan(600);
 await expect(page.locator("#studio-filters")).toBeHidden();
 const toggle=page.getByRole("button",{name:/Find, filter & tools/i});
 await toggle.click();
 await expect(page.locator("#studio-filters")).toBeVisible();
 await expect(toggle).toHaveAttribute("aria-expanded","true");
 await page.keyboard.press("Escape");
 await expect(page.locator("#studio-filters")).toBeHidden();
 await expect(toggle).toHaveAttribute("aria-expanded","false");
});

test("recovery exposes both complete general networks and funding backups",async({page})=>{
 await page.goto("/recover");
 await expect(page.getByRole("heading",{name:/Manage saved maps without loading the canvas/i})).toBeVisible();
 await expect(page.getByRole("region",{name:"Complete general network recovery"})).toBeVisible();
 await expect(page.getByRole("heading",{name:/funding/i}).first()).toBeVisible();
 await checkSeriousAccessibility(page);
});

test("generic CSV upload recognises real grants and preserves the file",async({page})=>{
 await page.goto("/");
 await page.locator('input[aria-label="Import a spreadsheet or Kumu network"]').setInputFiles({
   name:"synthetic-grants.csv",mimeType:"text/csv",buffer:Buffer.from(grantCsv,"utf8")
 });
 const funding=page.getByRole("region",{name:"Create a funding landscape"});
 await expect(funding).toBeVisible();
 await expect(funding.getByText("synthetic-grants.csv")).toBeVisible();
 await expect(funding.getByRole("button",{name:/Create funding landscape/i})).toBeEnabled();
});

test("share screen is accessible to open without a saved map",async({page})=>{
 const response=await page.goto("/share");
 expect(response?.status()).toBeLessThan(500);
 await expect(page.locator("body")).not.toBeEmpty();
});
