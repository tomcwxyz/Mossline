import {test,expect} from "@playwright/test";

// Preserve regression coverage of the existing full-network/advanced tools
// while the new Field Atlas becomes the default experience.
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem("mossline-workspace-v1","advanced");
  });
});


test("small and grouped Cytoscape networks share accessible zoom and fit controls",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:/Or try an example network/i}).click();
  const small=page.locator(".graph-stage .graph-tools");
  await expect(small.getByRole("button",{name:"Zoom in"})).toBeEnabled();
  await small.getByRole("button",{name:"Zoom in"}).click();
  await small.getByRole("button",{name:"Zoom out"}).click();
  await small.getByRole("button",{name:"Fit network to view"}).click();
  await expect(small.getByRole("button",{name:"Clear selection"})).toHaveCount(0);

  await page.getByRole("button",{name:"Explore full network"}).click();
  const explorer=page.getByRole("region",{name:"Explore the complete network"});
  await expect(explorer).toBeVisible();
  const grouped=explorer.getByRole("button",{name:"Grouped overview"});
  await expect(grouped).toBeEnabled();
  if(await grouped.getAttribute("aria-pressed")!=="true")await grouped.click();
  const controls=explorer.locator(".whole-graph-stage .graph-tools");
  await expect(controls.getByRole("button",{name:"Zoom in"})).toBeEnabled();
  await controls.getByRole("button",{name:"Zoom in"}).click();
  await controls.getByRole("button",{name:"Zoom out"}).click();
  await controls.getByRole("button",{name:"Fit network to view"}).click();
});

test("grouped network selection can be cleared by keyboard-accessible control",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:/Or try an example network/i}).click();
  await page.getByRole("button",{name:"Explore full network"}).click();
  const explorer=page.getByRole("region",{name:"Explore the complete network"});
  const grouped=explorer.getByRole("button",{name:"Grouped overview"});
  await expect(grouped).toBeEnabled();
  await grouped.click();
  await explorer.locator("#whole-network-search").fill("Neighbourhood Hub");
  await explorer.getByRole("button",{name:"Find",exact:true}).click();
  const results=explorer.getByRole("region",{name:"Full network search results"});
  await expect(results).toBeVisible();
  await results.getByRole("button",{name:/Neighbourhood Hub/}).first().click();
  const clear=explorer.locator(".whole-graph-stage .graph-tools")
    .getByRole("button",{name:"Clear selection"});
  await expect(clear).toBeEnabled();
  await clear.focus();
  await page.keyboard.press("Enter");
  await expect(clear).toHaveCount(0);
  await expect(explorer.getByText(/source entities accounted for/)).toBeVisible();
});
