import {test,expect} from "@playwright/test";

/** Exercise the complete-network GPU path on desktop rather than only Canvas 2D. */
test("desktop full-network WebGL initialisation reports a real failure and recovers",async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){
      const context=Reflect.apply(original,this,[type,...args]);
      if(type==="webgl"&&context){
        // A real context exists, but shader compilation fails: distinguishes
        // renderer errors from an unsupported-browser fallback.
        return new Proxy(context,{
          get(target,property){
            if(property==="getShaderParameter")return ()=>false;
            if(property==="getShaderInfoLog")return ()=>"Injected shader failure";
            const value=Reflect.get(target,property,target);
            return typeof value==="function"?value.bind(target):value;
          }
        });
      }
      return context;
    } as typeof original;
    const nodes=Array.from({length:300},(_,i)=>({
      id:"org-"+i,label:"Organisation "+i,type:"organisation",tags:[]
    }));
    const edges=Array.from({length:299},(_,i)=>({
      id:"edge-"+i,source:"org-"+i,target:"org-"+(i+1),type:"connected"
    }));
    const graph={version:1,title:"Desktop WebGL regression",description:"GPU path",nodes,edges};
    const map={id:"webgl-desktop-test",createdAt:Date.now(),title:graph.title,graph};
    localStorage.setItem("mossline-local-maps-v1",
      JSON.stringify({activeId:map.id,maps:[map]}));
  });
  const errors:string[]=[];
  page.on("console",message=>{
    if(message.type()==="error"&&message.text().includes("[Mossline WebGL]"))
      errors.push(message.text());
  });
  await page.goto("/");
  await page.getByRole("button",{name:/Desktop WebGL regression/}).click();
  const explorer=page.getByRole("region",{name:"Explore the complete network"});
  await expect(explorer).toBeVisible();
  await expect(explorer.getByText(/2D compatibility mode/)).toBeVisible({timeout:30000});
  await expect.poll(()=>errors.join("\n")).toContain("Injected shader failure");
});
