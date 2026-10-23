import {test,expect} from "@playwright/test";

// This intentionally exercises the real renderer, not a mocked failure.
test("desktop full network renders with WebGL when GPU context is available",async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.addInitScript(()=>{
    const nodes=Array.from({length:300},(_,i)=>({
      id:"org-"+i,label:"Organisation "+i,type:"organisation",tags:[]
    }));
    const edges=Array.from({length:299},(_,i)=>({
      id:"edge-"+i,source:"org-"+i,target:"org-"+(i+1),type:"connected"
    }));
    const graph={version:1,title:"WebGL success case",description:"GPU regression",nodes,edges};
    const map={id:"webgl-success",createdAt:Date.now(),title:graph.title,graph};
    localStorage.setItem("mossline-local-maps-v1",JSON.stringify({activeId:map.id,maps:[map]}));
  });
  await page.goto("/");
  const available=await page.evaluate(()=>{
    const c=document.createElement("canvas");
    return Boolean(c.getContext("webgl"));
  });
  test.skip(!available,"This runner does not provide WebGL; requires GPU-enabled acceptance");
  await page.getByRole("button",{name:/WebGL success case/}).click();
  const explorer=page.getByRole("region",{name:"Explore the complete network"});
  await expect(explorer).toBeVisible();
  const gpu=explorer.getByRole("img",{name:/Full graph: 300 source entities/});
  await expect(gpu).toBeVisible({timeout:30000});
  await expect(explorer.getByText(/2D compatibility mode/)).toHaveCount(0);
  const ok=await gpu.evaluate((node:HTMLCanvasElement)=>{
    const gl=node.getContext("webgl");
    return Boolean(gl&&!gl.isContextLost()&&node.width>0&&node.height>0);
  });
  expect(ok).toBe(true);
  // GPU-backed full graph must not emit the shader programme linking error.
  await expect(explorer.getByText(/could not start WebGL/i)).toHaveCount(0);
});
