/// <reference lib="webworker" />
/** Layout is detached from rendering and only sees recorded connectivity. */
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
type Message={kind:"layout";nodes:string[];edges:[string,string][];initial:[string,number,number][]};
self.onmessage=(event:MessageEvent<Message>)=>{
  const msg=event.data;
  if(msg.kind!=="layout")return;
  try{
    const graph=new Graph({type:"undirected",multi:true});
    const connected=new Set(msg.edges.flat());
    for(const [id,x,y] of msg.initial)if(connected.has(id))graph.addNode(id,{x,y});
    for(const [source,target] of msg.edges)
      if(source!==target&&graph.hasNode(source)&&graph.hasNode(target))
        graph.addEdge(source,target);
    const positions=forceAtlas2(graph,{
      iterations:msg.nodes.length>10000?35:msg.nodes.length>3000?65:120,
      settings:{gravity:0.6,scalingRatio:2.3,slowDown:3,barnesHutOptimize:msg.nodes.length>600,
        barnesHutTheta:0.6,strongGravityMode:false}
    });
    self.postMessage({kind:"positions",
      positions:Object.entries(positions).map(([id,p])=>[id,p.x,p.y])});
  }catch(e){
    self.postMessage({kind:"error",message:e instanceof Error?e.message:"Layout failed"});
  }
};
