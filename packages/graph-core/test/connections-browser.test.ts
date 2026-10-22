import test from "node:test";
import assert from "node:assert/strict";
import {parseGraphDocument} from "../src/schema.ts";
import {collaborationGraph} from "../src/graph.ts";
import {buildConnectionDirectory} from "../src/connections-browser.ts";

test("Connections browser separates confirmed links from shared funder evidence",()=>{
 const source=parseGraphDocument({version:1,title:"Shared funder",description:"",
  nodes:[
   {id:"a",label:"Alpha Charity",type:"organisation",tags:[]},
   {id:"b",label:"Beta Charity",type:"organisation",tags:[]},
   {id:"c",label:"Community Group",type:"organisation",tags:[]},
   {id:"f",label:"North East Community Fund",type:"funder",tags:[]}
  ],
  edges:[
   {id:"fa",source:"f",target:"a",type:"funds"},
   {id:"fb",source:"f",target:"b",type:"funds"},
   {id:"ab",source:"a",target:"c",type:"partners with"}
  ]});
 const derived=collaborationGraph(source,"all");
 const directory=buildConnectionDirectory(derived,source);
 assert.equal(directory.totalOrganisations,3);
 assert.equal(directory.recordedLinks,1);
 assert.equal(directory.sharedAssociations,1);
 const alpha=directory.byId.get("a")??[];
 assert.equal(alpha.length,2);
 assert.equal(alpha[0].inferred,false);
 assert.equal(alpha[0].other.label,"Community Group");
 assert.equal(alpha[1].inferred,true);
 assert.deepEqual(alpha[1].evidenceLabels,["North East Community Fund"]);
 assert.equal(alpha[1].evidenceCount,1);
 assert.equal(alpha[1].other.label,"Beta Charity");
 assert.equal(source.edges.length,3,"Evidence in original source remains unchanged");
});
test("Connections reader indexes large derived networks without omitting associations",()=>{
 const size=250;
 const graph=parseGraphDocument({version:1,title:"Dense associations",description:"",
  nodes:Array.from({length:size},(_,i)=>({id:"org"+i,label:"Organisation "+i,
   type:"organisation",tags:[]})),
  edges:Array.from({length:6000},(_,i)=>({
   id:"link"+i,source:"org"+(i%size),target:"org"+((i*7+13)%size),
   type:"shared association",inferred:true,
   description:"Shared link is not confirmed collaboration."}))});
 const directory=buildConnectionDirectory(graph,graph);
 assert.equal(directory.totalOrganisations,size);
 assert.equal(directory.sharedAssociations,6000);
 assert.equal(directory.ranked.reduce((n,x)=>n+x.links,0),12000);
 assert.equal(directory.ranked.length,size);
 assert.ok(directory.ranked[0].links>=directory.ranked.at(-1)!.links);
});
