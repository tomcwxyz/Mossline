import {test,expect} from "@playwright/test";

test("Sigma experiment preserves recorded totals and full browser dataset",async({page})=>{
  await page.addInitScript(()=>{
    const count=2800;
    const graph={
      version:1,title:"Sigma test source graph",description:"Synthetic local-only test",
      nodes:Array.from({length:count},(_,i)=>({
        id:"org-"+i,label:"Organisation "+i,type:"organisation",tags:[]
      })),
      edges:[
        ...Array.from({length:count-1},(_,i)=>({
          id:"edge-"+i,source:"org-"+i,target:"org-"+(i+1),type:"records"
        })),
        {id:"pencil",source:"org-0",target:"org-2799",type:"suggestion",inferred:true}
      ]
    };
    localStorage.setItem("mossline-local-maps-v1",JSON.stringify({
      activeId:"large-sigma",maps:[{
        id:"large-sigma",title:graph.title,createdAt:Date.now(),graph
      }]
    }));
  });
  await page.goto("/");
  await page.getByRole("button",{name:/Sigma test source graph/}).click();
  await expect(page.getByRole("group",{name:"Network rendering engine"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Proven fallback"})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"Sigma.js experimental"}).click();
  const stage=page.getByRole("region",{name:"Complete Sigma network"});
  await expect(stage).toBeVisible();
  await expect(stage).toContainText("2,799 recorded links");
  await expect(stage).toContainText("1 suggestions");
  // GPU is optional: the complete source list and fallback remain accessible.
  await page.getByRole("button",{name:"Proven fallback"}).click();
  await expect(page.getByRole("region",{name:"Explore the complete network"})).toBeVisible();
  const source=await page.evaluate(()=>{
    const maps=JSON.parse(localStorage.getItem("mossline-local-maps-v1")||"{}");
    return {nodes:maps.maps[0].graph.nodes.length,edges:maps.maps[0].graph.edges.length};
  });
  expect(source).toEqual({nodes:2800,edges:2800});
});
