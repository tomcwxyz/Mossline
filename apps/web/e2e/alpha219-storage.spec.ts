import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";

test("existing saved maps open, switch and retain v1 library IDs",async({page})=>{
  await page.addInitScript(()=>{
    const graph=(title:string)=>({
      version:1,title,description:"Imported local network",
      nodes:[{id:title+"-1",label:"Community organisation",type:"organisation",tags:[]}],
      edges:[]
    });
    localStorage.setItem("mossline-local-maps-v1",JSON.stringify({
      activeId:"historic-second",maps:[
        {id:"historic-first",createdAt:1700000000000,title:"Map One",graph:graph("Map One")},
        {id:"historic-second",createdAt:1700000000001,title:"Map Two",graph:graph("Map Two")}
      ]
    }));
  });
  await page.goto("/");
  const savedMaps=page.locator(".studio-start-maplist");
  await expect(savedMaps.getByRole("button",{name:/Map One/})).toBeVisible();
  await expect(savedMaps.getByRole("button",{name:/Map Two/})).toBeVisible();
  await savedMaps.getByRole("button",{name:/Map One/}).click();
  await expect(page.getByRole("heading",{name:/Map One/})).toBeVisible();
  await page.getByRole("combobox",{name:/Switch between maps/}).selectOption("historic-second");
  await expect(page.getByRole("heading",{name:/Map Two/})).toBeVisible();
  const stored=await page.evaluate(()=>JSON.parse(
    localStorage.getItem("mossline-local-maps-v1")??"{}"
  ) as {activeId:string;maps:{id:string;graph:{nodes:unknown[]}}[]});
  expect(stored.activeId).toBe("historic-second");
  expect(stored.maps.map(m=>m.id)).toEqual(["historic-first","historic-second"]);
  expect(stored.maps.every(m=>m.graph.nodes.length===1)).toBe(true);
});

/** Exercise *existing* v1 browser databases through the unchanged recovery UI.
 * No production browser data is ever touched: Playwright creates a fresh context.
 */
test("existing general and funding v1 datasets remain readable and portable",async({page})=>{
  await page.goto("/recover");
  await page.evaluate(async()=>{
    const generalGraph={
      version:1,title:"Legacy general network",description:"Existing source evidence",
      nodes:[{id:"g1",label:"Organisation One",type:"organisation",tags:[]}],
      edges:[]
    };
    const fundingGraph={
      version:1,title:"Legacy funding network",description:"Original funder evidence",
      nodes:[
        {id:"f",label:"Existing Foundation",type:"funder",tags:[]},
        {id:"g",label:"Historical award",type:"project",tags:[],
          properties:{mosslineFundingGrant:true}},
        {id:"r",label:"Community Group",type:"organisation",tags:[]}
      ],
      edges:[
        {id:"e1",source:"f",target:"g",type:"awarded"},
        {id:"e2",source:"g",target:"r",type:"received by"}
      ]
    };
    async function seed(name:string,storeName:string,row:Record<string,unknown>){
      await new Promise<void>((resolve,reject)=>{
        const request=indexedDB.open(name,1);
        request.onupgradeneeded=()=>{
          if(!request.result.objectStoreNames.contains(storeName))
            request.result.createObjectStore(storeName,{keyPath:"id"});
        };
        request.onerror=()=>reject(request.error);
        request.onsuccess=()=>{
          const db=request.result,tx=db.transaction(storeName,"readwrite");
          tx.objectStore(storeName).put(row);
          tx.oncomplete=()=>{db.close();resolve();};
          tx.onabort=()=>{db.close();reject(tx.error);};
        };
      });
    }
    await seed("mossline-general-maps-v1","graphs",{
      id:"historical-general",graph:generalGraph,updatedAt:1710000000000
    });
    await seed("mossline-funding-datasets-v1","datasets",{
      id:"historical-funding",createdAt:1710000000000,
      sourceTitle:fundingGraph.title,grantCount:1,graph:fundingGraph
    });
  });
  await page.reload();
  const general=page.getByRole("region",{name:"Complete general network recovery"});
  const funding=page.getByRole("region",{name:"Funding dataset recovery"});
  await expect(general.getByText(/Legacy general network/)).toBeVisible();
  await expect(funding.getByRole("option",{name:/Legacy funding network/})).toBeAttached();

  const generalDownload=page.waitForEvent("download");
  await general.getByRole("button",{name:/Download all complete general networks/}).click();
  const generalFile=await generalDownload;
  const generalBackup=JSON.parse((await readFile(await generalFile.path())).toString());
  expect(generalBackup.format).toBe("mossline-general-graphs");
  expect(generalBackup.version).toBe(1);
  expect(generalBackup.datasets[0].id).toBe("historical-general");
  expect(generalBackup.datasets[0].graph.description).toBe("Existing source evidence");

  const fundingDownload=page.waitForEvent("download");
  await funding.getByRole("button",{name:/Download all full funding datasets/}).click();
  const fundingFile=await fundingDownload;
  const fundingBackup=JSON.parse((await readFile(await fundingFile.path())).toString());
  expect(fundingBackup.format).toBe("mossline-funding-datasets-backup");
  expect(fundingBackup.version).toBe(1);
  expect(fundingBackup.datasets[0].id).toBe("historical-funding");
  expect(fundingBackup.datasets[0].grantCount).toBe(1);
  expect(fundingBackup.datasets[0].graph.description).toBe("Original funder evidence");

  // A mixed backup containing an existing ID and a new ID must abort fully.
  const newDataset={...fundingBackup.datasets[0],id:"should-not-be-created"};
  const conflicting={...fundingBackup,datasets:[newDataset,fundingBackup.datasets[0]]};
  page.on("dialog",dialog=>{void dialog.accept();});
  await page.locator('input[aria-label="Choose funding dataset backup"]').setInputFiles({
    name:"conflicting.json",mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(conflicting))
  });
  await expect(funding.getByRole("alert")).toContainText(/nothing was replaced|already exists/i);
  const stored=await page.evaluate(async()=>{
    return await new Promise<{id:string;description:string}[]>((resolve,reject)=>{
      const request=indexedDB.open("mossline-funding-datasets-v1",1);
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const db=request.result,read=db.transaction("datasets","readonly")
          .objectStore("datasets").getAll();
        read.onerror=()=>reject(read.error);
        read.onsuccess=()=>{
          const rows=read.result as {id:string;graph:{description:string}}[];
          db.close();
          resolve(rows.map(row=>({id:row.id,description:row.graph.description})));
        };
      };
    });
  });
  expect(stored).toEqual([
    {id:"historical-funding",description:"Original funder evidence"}
  ]);
});


test("saved perspectives survive reload and export without changing graph records",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:/Or try an example network/i}).click();
  const saved=page.locator("details.studio-tool-group")
    .filter({has:page.locator("summary", {hasText:"Saved views"})});
  await saved.locator("summary").click();
  await saved.getByRole("button",{name:"+ Save"}).click();
  await page.locator("#save-view-name").fill("Test evidence perspective");
  await saved.getByRole("button",{name:"Save view",exact:true}).click();
  await expect(saved.getByText("Test evidence perspective")).toBeVisible();
  const before=await page.evaluate(()=>({
    graph:localStorage.getItem("mossline-local-maps-v1"),
    saved:localStorage.getItem("mossline-perspectives-v1")
  }));
  expect(before.saved).toContain("Test evidence perspective");
  await page.reload();
  await page.locator(".studio-start-maplist button")
    .filter({hasText:"Neighbourhood Connections"}).click();
  const restored=page.locator("details.studio-tool-group")
    .filter({has:page.locator("summary",{hasText:"Saved views"})});
  await restored.locator("summary").click();
  await expect(restored.getByText("Test evidence perspective")).toBeVisible();
  const download=page.waitForEvent("download");
  await restored.getByRole("button",{name:/Export views/}).click();
  const file=await download;
  const json=JSON.parse((await readFile(await file.path())).toString());
  expect(JSON.stringify(json)).toContain("Test evidence perspective");
  expect(await page.evaluate(()=>localStorage.getItem("mossline-local-maps-v1")))
    .toBe(before.graph);
});

test("a damaged saved-view cache is not silently deleted",async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem("mossline-perspectives-v1","{unrecoverable-old-data");
  });
  await page.goto("/");
  await expect(page.getByRole("status").filter({
    hasText:/Saved perspectives could not be read/
  })).toHaveCount(1);
  expect(await page.evaluate(()=>localStorage.getItem("mossline-perspectives-v1")))
    .toBe("{unrecoverable-old-data");
});

test("generic source import can be reviewed and cancelled without replacing saved maps",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:/Or try an example network/i}).click();
  const before=await page.evaluate(()=>localStorage.getItem("mossline-local-maps-v1"));
  const csv=[
    "Organisation,Project,Funder,Region,Public",
    "Moorland Co-operative,Living Soil Trials,Common Acre Fund,North East,TRUE",
    "River Network,Living Soil Trials,Common Acre Fund,North West,TRUE"
  ].join("\n");
  await page.locator('input[aria-label="Discover data from a Kumu JSON export or a CSV spreadsheet"]')
    .setInputFiles({name:"relationships.csv",mimeType:"text/csv",buffer:Buffer.from(csv)});
  const preview=page.getByRole("region",{name:"Data discovery and import preview"});
  await expect(preview).toBeVisible();
  await expect(preview.getByText(/Map your existing data|Import preview/)).toBeVisible();
  await expect(page.getByRole("region",{name:"Create a funding landscape"})).toHaveCount(0);
  await preview.getByRole("button",{name:"Close"}).click();
  await expect(preview).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem("mossline-local-maps-v1")))
    .toEqual(before);
});
