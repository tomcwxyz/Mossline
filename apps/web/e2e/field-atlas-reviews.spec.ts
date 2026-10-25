import {test,expect} from "@playwright/test";

test("Field Atlas exposes independent review backup controls",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:/Or try an example network/i}).click();
  // Review backups live in the dataset menu beside the map title.
  await page.locator(".ml-dataset summary").click();
  await expect(page.getByRole("button",{name:"Restore reviews"})).toBeVisible();
  await expect(page.getByRole("button",{name:/Export reviews/})).toBeDisabled();
  // A mismatched dataset backup is rejected instead of silently inserted.
  const file=page.locator('input[aria-label="Restore review backup"]');
  await file.setInputFiles({name:"wrong-map.json",mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify({
      kind:"mossline-atlas-annotation-backup",version:1,
      layer:{version:1,graphKey:"other-map",entries:[]}
    }))});
  await expect(page.getByRole("status").filter({hasText:"This backup belongs to another version"})).toBeVisible();
});
