import {test,expect} from "@playwright/test";

// Preserve regression coverage of the existing full-network/advanced tools
// while the new Field Atlas becomes the default experience.
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem("mossline-workspace-v1","advanced");
  });
});


const widths=[{width:390,height:844},{width:360,height:700}];

for(const viewport of widths){
  test(`mobile first screen exposes the actual canvas at ${viewport.width}px`,async({page})=>{
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button",{name:/Or try an example network/i}).click();
    const panel=page.locator(".mossline-studio .graph-stage");
    await expect(panel).toBeVisible();
    const bounds=await panel.boundingBox();
    expect(bounds).not.toBeNull();
    // The earlier mobile acceptance only checked <600px and allowed the
    // network to be barely visible below multiple introductory rows.
    expect(bounds!.y).toBeLessThan(310);
    expect(Math.min(bounds!.y+bounds!.height,viewport.height)-bounds!.y)
      .toBeGreaterThan(300);
    await expect(page.locator("#studio-filters")).toBeHidden();
    await expect(page.getByRole("button",{name:"Map settings"})).toHaveAttribute("aria-expanded","false");
    await expect(page.getByRole("combobox",{name:"Network layout"})).toBeHidden();
    await page.getByRole("button",{name:"Map settings"}).click();
    await expect(page.getByRole("combobox",{name:"Network layout"})).toBeVisible();
    await page.getByRole("button",{name:"Hide map settings"}).click();
    const more=page.locator(".studio-action-menu");
    await more.locator("summary").click();
    await expect(more.getByRole("button",{name:"Previous importer: spreadsheet or Kumu network"})).toBeVisible();
    await more.locator("summary").click();
    await expect(page.getByRole("navigation",{name:"Choose how to explore this network"}))
      .toBeVisible();
    const about=page.locator(".mobile-map-description");
    await expect(about).toBeVisible();
    await about.locator("summary").click();
    await expect(about.locator("p")).toBeVisible();
  });
}

test("illustrated network story follows the canvas on mobile, not before it",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await page.locator(".studio-start-more summary").click();
  await page.getByRole("button",{name:"Explore the illustration showcase"}).click();
  const narrative=page.getByRole("region",{name:"Perspective story"});
  await expect(narrative).toBeVisible();
  const canvas=page.locator(".mossline-studio .map-panel");
  await expect(canvas).toBeVisible();
  const graphBounds=await canvas.boundingBox(),storyBounds=await narrative.boundingBox();
  expect(graphBounds).not.toBeNull();
  expect(storyBounds).not.toBeNull();
  expect(graphBounds!.y).toBeLessThan(310);
  expect(storyBounds!.y).toBeGreaterThan(graphBounds!.y+200);
});

test("large network starts with the complete source canvas on mobile",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{
    const n=2800;
    const graph={
      version:1,title:"Mobile network layout check",
      description:"A longer introduction should not push the graph down.",
      nodes:Array.from({length:n},(_,i)=>({
        id:"org-"+i,label:"Organisation "+i,type:"organisation",tags:[]
      })),
      edges:Array.from({length:n-1},(_,i)=>({
        id:"edge-"+i,source:"org-"+i,target:"org-"+(i+1),type:"connected to"
      }))
    };
    localStorage.setItem("mossline-local-maps-v1",JSON.stringify({
      activeId:"large-mobile-map",
      maps:[{id:"large-mobile-map",createdAt:Date.now(),
        title:graph.title,graph}]
    }));
  });
  await page.goto("/");
  await page.getByRole("button",{name:/Mobile network layout check/i}).click();
  const explorer=page.getByRole("region",{name:"Explore the complete network"});
  await expect(explorer).toBeVisible();
  const canvas=explorer.locator(".whole-graph-stage");
  await expect(canvas).toBeVisible({timeout:30000});
  const box=await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeLessThan(335);
  expect(Math.min(box!.y+box!.height,844)-box!.y).toBeGreaterThan(300);
  const intro=explorer.locator(".whole-graph-heading");
  const introBox=await intro.boundingBox();
  expect(introBox).not.toBeNull();
  expect(introBox!.y).toBeGreaterThan(box!.y+200);
});

test("desktop retains full map description and visible layout controls",async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto("/");
  await page.getByRole("button",{name:/Or try an example network/i}).click();
  await expect(page.locator(".mossline-studio .heading .subtitle")).toBeVisible();
  await expect(page.getByRole("button",{name:"↑ Add data"})).toBeVisible();
  await expect(page.getByRole("combobox",{name:"Network layout"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Map settings"})).toBeHidden();
});
