import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";

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
