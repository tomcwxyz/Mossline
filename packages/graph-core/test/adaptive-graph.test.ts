import test from "node:test";
import assert from "node:assert/strict";
import {buildAdaptiveGraphIndex,projectAdaptiveGraph} from "../src/adaptive-graph.ts";
import {parseGraphDocument} from "../src/schema.ts";
import {collaborationGraph} from "../src/graph.ts";

const make=(n:number)=>parseGraphDocument({
  version:1,title:"Complete network",description:"",
  nodes:[
    {id:"f",label:"Funder",type:"funder",tags:[]},
    ...Array.from({length:n},(_,i)=>({
      id:"org-"+i,label:"Organisation "+String(i).padStart(4,"0"),
      type:"organisation",region:i%2?"North East":"Yorkshire",tags:[]
    }))
  ],
  edges:Array.from({length:n},(_,i)=>({
    id:"link-"+i,source:"f",target:"org-"+i,type:"funds",direction:"directed"
  }))
});

test("whole-graph overview preserves all nodes and source edge counts, even when collapsed",()=>{
 const index=buildAdaptiveGraphIndex(make(2400));
 const overview=projectAdaptiveGraph(index);
 assert.equal(overview.totalNodes,2401);
 assert.equal(overview.representedNodes,2401);
 assert.equal(overview.totalEdges,2400);
 assert.equal(overview.representedEdges,2400);
 assert.ok(overview.visibleNodes<10);
 assert.ok(overview.graph.edges.some(e=>e.properties?.mosslineAdaptiveSummary===true));
 assert.equal(overview.graph.nodes.find(n=>n.properties?.mosslineAdaptiveCluster===true)?.description?.includes("not a source entity"),true);
});
test("repeated expanding reaches every original node and original edge without pagination",()=>{
 const index=buildAdaptiveGraphIndex(make(130));
 const expanded:string[]=[];
 let projection=projectAdaptiveGraph(index,expanded);
 // Expansion is intentionally local: at each step select the first visible
 // cluster until an individual organisation is exposed.
 for(let step=0;step<8&&projection.clusterCount;step++){
   const next=projection.availableGroups.find(g=>!expanded.includes(g.id));
   if(!next)break;
   expanded.push(next.id);
   projection=projectAdaptiveGraph(index,expanded);
   assert.equal(projection.representedNodes,131);
   assert.equal(projection.representedEdges,130);
   if(projection.graph.nodes.some(n=>n.id==="org-0"))break;
 }
 assert.ok(projection.graph.nodes.some(n=>n.id==="org-0"));
});
test("fully expanded small graph retains original edge IDs and no invented recorded links",()=>{
 const graph=make(5);const index=buildAdaptiveGraphIndex(graph);
 const ids=[...index.groups.keys()];
 const expanded=projectAdaptiveGraph(index,ids);
 assert.equal(expanded.clusterCount,0);
 assert.deepEqual(expanded.graph.edges.map(e=>e.id).sort(),graph.edges.map(e=>e.id).sort());
 assert.equal(expanded.representedEdges,5);
});
test("high-degree internal cluster connections are counted, not silently dropped",()=>{
 const graph=parseGraphDocument({version:1,title:"Internal",description:"",
  nodes:Array.from({length:120},(_,i)=>({id:String(i),label:"Same "+i,type:"organisation",tags:[]})),
  edges:Array.from({length:119},(_,i)=>({id:"e"+i,source:String(i),target:String(i+1),type:"knows"}))});
 const overview=projectAdaptiveGraph(buildAdaptiveGraphIndex(graph));
 assert.equal(overview.graph.edges.length,0);
 assert.equal(overview.graph.nodes[0].properties?.mosslineInternalConnections,119);
 assert.equal(overview.representedEdges,119);
});
test("expansion budget refuses a dense fully expanded hairball rather than hiding edges",()=>{
 const graph=parseGraphDocument({version:1,title:"Dense",description:"",
  nodes:Array.from({length:50},(_,i)=>({id:String(i),label:"Node "+i,type:"organisation",tags:[]})),
  edges:Array.from({length:900},(_,i)=>({
    id:"e"+i,source:String(Math.floor(i/49)),target:String((i%49)+1),type:"related"
  }))});
 const index=buildAdaptiveGraphIndex(graph);
 const partial=projectAdaptiveGraph(index);
 assert.equal(partial.representedEdges,900);
 assert.throws(()=>projectAdaptiveGraph(index,[...index.groups.keys()]),/visible connections/);
});

test("grants expand by their recorded funder before showing individual awards",()=>{
 const graph=parseGraphDocument({version:1,title:"Funding",description:"",
 nodes:[{id:"a",label:"Amber Trust",type:"funder",tags:[]},
   {id:"b",label:"Blue Trust",type:"funder",tags:[]},
   ...Array.from({length:50},(_,i)=>({id:"g"+i,label:"Grant "+i,
     type:"project",tags:[],properties:{mosslineFundingGrant:true,
       funderId:i%2?"a":"b"}}))],
 edges:Array.from({length:50},(_,i)=>({
   id:"award"+i,source:i%2?"a":"b",target:"g"+i,type:"awarded"}))});
 const index=buildAdaptiveGraphIndex(graph);
 const first=projectAdaptiveGraph(index);
 const awardsRoot=first.availableGroups.find(g=>g.label==="Projects and grants");
 assert.ok(awardsRoot);
 const expanded=projectAdaptiveGraph(index,[awardsRoot!.id]);
 assert.ok(expanded.availableGroups.some(g=>g.label==="Funded by Amber Trust"));
 assert.ok(expanded.availableGroups.some(g=>g.label==="Funded by Blue Trust"));
 assert.equal(expanded.representedEdges,50);
});

test("Connections projection accepts source-backed inferred evidence that is not a visible organisation",()=>{
 const source=parseGraphDocument({version:1,title:"Funders",description:"",
 nodes:[{id:"org:a",label:"A",type:"organisation",tags:[]},
   {id:"org:b",label:"B",type:"organisation",tags:[]},
   {id:"entity:id%3Agb-chc-200051",label:"Charity funder",type:"funder",tags:[]}],
 edges:[{id:"a",source:"org:a",target:"entity:id%3Agb-chc-200051",type:"funded by"},
   {id:"b",source:"org:b",target:"entity:id%3Agb-chc-200051",type:"funded by"}]});
 const collaborators=collaborationGraph(source,"funder");
 assert.deepEqual(collaborators.edges[0].evidenceNodeIds,["entity:id%3Agb-chc-200051"]);
 // This previously crashed when the full-graph renderer validated the
 // organisation-only projection against absent supporting funder nodes.
 const index=buildAdaptiveGraphIndex(collaborators);
 const projection=projectAdaptiveGraph(index,[...index.groups.keys()]);
 assert.equal(projection.graph.nodes.length,2);
 assert.equal(projection.graph.edges.length,1);
 assert.deepEqual(projection.graph.edges[0].evidenceNodeIds,[]);
 assert.deepEqual(projection.graph.edges[0].properties?.mosslineSourceEvidenceNodeIds,
   ["entity:id%3Agb-chc-200051"]);
 assert.deepEqual(collaborators.edges[0].evidenceNodeIds,
   ["entity:id%3Agb-chc-200051"],"Original evidence must remain intact");
});
test("expanded overview validates inferred evidence in a hidden source group",()=>{
 const source=parseGraphDocument({version:1,title:"Projects",description:"",
 nodes:[{id:"org:a",label:"A",type:"organisation",tags:[]},
   {id:"org:b",label:"B",type:"organisation",tags:[]},
   ...Array.from({length:30},(_,i)=>({id:"p"+i,label:"Project "+i,type:"project",tags:[]}))],
 edges:[{id:"shared",source:"org:a",target:"org:b",type:"similar",inferred:true,
   evidenceNodeIds:["p0"]}]});
 const index=buildAdaptiveGraphIndex(source);
 const organisationGroups=[...index.groups.values()].filter(group=>
   group.members.length>0&&group.members.every(id=>id.startsWith("org:")))
   .map(group=>group.id);
 assert.ok(organisationGroups.length>0);
 const expanded=projectAdaptiveGraph(index,organisationGroups);
 assert.equal(expanded.representedEdges,1);
 assert.equal(expanded.graph.edges.length,1);
 assert.equal(expanded.graph.edges[0].properties?.mosslineSourceEvidenceNodeIds?.[0],"p0");
});
