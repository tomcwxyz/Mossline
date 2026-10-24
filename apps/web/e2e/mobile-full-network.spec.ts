import {test,expect} from "@playwright/test";

// Preserve regression coverage of the existing full-network/advanced tools
// while the new Field Atlas becomes the default experience.
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem("mossline-workspace-v1","advanced");
  });
});


test("mobile without WebGL still displays every source node and edge",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{
    // Simulate a browser with no working GPU contexts, as on some handsets.
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(
      this:HTMLCanvasElement,type:string,...args:unknown[]
    ){
      if(type==="webgl"||type==="experimental-webgl"||type==="webgl2")
        return null;
      return Reflect.apply(original,this,[type,...args]);
    } as typeof original;
    const count=2800;
    const graph={
      version:1,title:"Mobile full network",description:"Source geometry regression",
      nodes:Array.from({length:count},(_,i)=>({
        id:"org-"+i,label:"Organisation "+i,type:"organisation",tags:[]
      })),
      edges:Array.from({length:count-1},(_,i)=>({
        id:"link-"+i,source:"org-"+i,target:"org-"+(i+1),type:"associated with"
      }))
    };
    const map={id:"mobile-full-graph",createdAt:Date.now(),
      title:graph.title,graph};
    localStorage.setItem("mossline-local-maps-v1",
      JSON.stringify({activeId:map.id,maps:[map]}));
  });
  await page.goto("/");
  await page.getByRole("button",{name:/Mobile full network/}).click();
  const explorer=page.getByRole("region",{name:"Explore the complete network"});
  await expect(explorer).toBeVisible();
  await expect(explorer.getByRole("img",{
    name:/Complete network compatibility view: 2800 source entities and 2799 original relationships/
  })).toBeVisible({timeout:30000});
  await expect(explorer.getByText(/2D compatibility mode/)).toBeVisible();
  await expect(explorer.getByText(/2,800 source nodes · 2,799 original relationships available/))
    .toBeVisible();
  await expect(explorer.getByRole("button",{name:"Full graph"}))
    .toHaveAttribute("aria-pressed","true");
  const canvas=explorer.getByRole("img",{name:/Complete network compatibility view/});
  const rendered=await canvas.evaluate((node:HTMLCanvasElement)=>{
    const ctx=node.getContext("2d");
    if(!ctx)return false;
    const {data}=ctx.getImageData(Math.round(node.width/2),Math.round(node.height/2),1,1);
    return data[3]>0;
  });
  expect(rendered).toBe(true);
  await explorer.getByRole("button",{name:"Zoom in"}).click();
  await explorer.getByRole("button",{name:"Zoom out"}).click();
  await explorer.getByRole("button",{name:"Fit whole network"}).click();
  expect(await page.evaluate(()=>JSON.parse(
    localStorage.getItem("mossline-local-maps-v1")??"{}"
  ).maps[0].graph.nodes.length)).toBe(2800);
});
