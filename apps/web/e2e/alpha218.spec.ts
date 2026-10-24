import {test,expect} from "@playwright/test";

// Preserve regression coverage of the existing full-network/advanced tools
// while the new Field Atlas becomes the default experience.
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem("mossline-workspace-v1","advanced");
  });
});

import AxeBuilder from "@axe-core/playwright";
import {readFile} from "node:fs/promises";

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

test("large general maps can be backed up and recovered in a new browser profile",async({browser})=>{
 const source=await browser.newContext({acceptDownloads:true});
 const sourcePage=await source.newPage();
 await sourcePage.goto("/recover");
 await sourcePage.evaluate(async()=>{
   const datasetId="synthetic-general-recovery";
   const count=2_800;
   const graph={
     version:1,title:"Large recovery fixture",description:"Synthetic browser recovery test",
     nodes:Array.from({length:count},(_,i)=>({
       id:"org-"+i,label:"Example "+i,type:"organisation",tags:[]
     })),
     edges:Array.from({length:count-1},(_,i)=>({
       id:"link-"+i,source:"org-"+i,target:"org-"+(i+1),type:"connected to"
     }))
   };
   await new Promise<void>((resolve,reject)=>{
     const request=indexedDB.open("mossline-general-maps-v1",1);
     request.onupgradeneeded=()=>{
       request.result.createObjectStore("graphs",{keyPath:"id"});
     };
     request.onerror=()=>reject(request.error);
     request.onsuccess=()=>{
       const db=request.result,transaction=db.transaction("graphs","readwrite");
       transaction.objectStore("graphs").put({id:datasetId,graph,updatedAt:Date.now()});
       transaction.oncomplete=()=>{db.close();resolve();};
       transaction.onerror=()=>reject(transaction.error);
     };
   });
   const entry={
     id:"fixture-map",createdAt:Date.now(),title:graph.title,
     graph:{version:1,title:graph.title,description:graph.description,nodes:[],edges:[]},
     generalDatasetId:datasetId,sourceCounts:{nodes:graph.nodes.length,edges:graph.edges.length}
   };
   localStorage.setItem("mossline-local-maps-v1",
     JSON.stringify({activeId:entry.id,maps:[entry]}));
 });
 await sourcePage.reload();
 const general=sourcePage.getByRole("region",{name:"Complete general network recovery"});
 await expect(general.getByText(/Large recovery fixture/)).toBeVisible();
 const generalDownload=sourcePage.waitForEvent("download");
 await general.getByRole("button",{name:/Download all complete general networks/i}).click();
 const generalFile=await generalDownload;
 const generalBytes=await readFile(await generalFile.path());
 const libraryDownload=sourcePage.waitForEvent("download");
 await sourcePage.getByRole("button",{name:/Download map-library backup/i}).click();
 const libraryFile=await libraryDownload;
 const libraryBytes=await readFile(await libraryFile.path());
 await source.close();

 const target=await browser.newContext({acceptDownloads:true});
 const targetPage=await target.newPage();
 targetPage.on("dialog",dialog=>{void dialog.accept();});
 await targetPage.goto("/recover");
 // Restore controls become available only after the background worker has
 // finished inspecting this browser's empty IndexedDB. Do not bypass the UI.
 const generalTarget=targetPage.getByRole("region",{name:"Complete general network recovery"});
 await expect(generalTarget.getByRole("button",{name:/Restore general network backup/i}))
   .toBeEnabled();
 await targetPage.locator('input[aria-label="Choose full general network backup"]').setInputFiles({
   name:"general.json",mimeType:"application/json",buffer:generalBytes
 });
 await expect(targetPage.getByText(/Restored 1 complete networks/i)).toBeVisible();
 await expect(generalTarget.getByText(/2,800 entities/)).toBeVisible();
 await expect(targetPage.getByRole("button",{name:/Restore map-library backup/i})).toBeEnabled();
 await targetPage.locator('input[aria-label="Choose map-library backup JSON"]').setInputFiles({
   name:"library.json",mimeType:"application/json",buffer:libraryBytes
 });
 await expect(targetPage.getByText(/Map backup restored in this browser/i)).toBeVisible();
 await targetPage.goto("/");
 await expect(targetPage.getByText("Large recovery fixture")).toBeVisible();
 await targetPage.getByRole("button",{name:/Large recovery fixture/i}).click();
 await expect(targetPage.getByRole("heading",{name:/Large recovery fixture/i})).toBeVisible();
 // Assert the full network is genuinely present, not merely a stub list entry.
 const verified=await targetPage.evaluate(async()=>{
   return await new Promise<{nodes:number;edges:number}>((resolve,reject)=>{
     const request=indexedDB.open("mossline-general-maps-v1");
     request.onerror=()=>reject(request.error);
     request.onsuccess=()=>{
       const db=request.result,read=db.transaction("graphs").objectStore("graphs")
         .get("synthetic-general-recovery");
       read.onsuccess=()=>{
         const graph=read.result?.graph;
         db.close();
         if(!graph)return reject(Error("Restored source dataset is missing"));
         resolve({nodes:graph.nodes.length,edges:graph.edges.length});
       };
       read.onerror=()=>reject(read.error);
     };
   });
 });
 expect(verified).toEqual({nodes:2800,edges:2799});
 await target.close();
});

test("share screen is accessible to open without a saved map",async({page})=>{
 const response=await page.goto("/share");
 expect(response?.status()).toBeLessThan(500);
 await expect(page.locator("body")).not.toBeEmpty();
});
