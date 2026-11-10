import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {parseGraphDocument} from "@mossline/graph-core";
import {spatialConnections} from "../src/lib/spatial-connections";
test("Only recorded links between distinct positioned nodes are mapped",()=>{
  const graph=parseGraphDocument({version:1,title:"Test",nodes:[
    {id:"a",label:"A",type:"place",tags:[],properties:{latitude:54,longitude:-1}},
    {id:"b",label:"B",type:"place",tags:[],properties:{latitude:55,longitude:-2}},
    {id:"c",label:"C",type:"place",tags:[],properties:{latitude:54,longitude:-1}},
    {id:"d",label:"D",type:"organisation",tags:[]}
  ],edges:[
    {id:"one",source:"a",target:"b",type:"works with"},
    {id:"two",source:"a",target:"b",type:"works with"},
    {id:"three",source:"a",target:"c",type:"in"},
    {id:"four",source:"a",target:"d",type:"supports"},
    {id:"five",source:"b",target:"c",type:"suggested",inferred:true}
  ]});
  const value=spatialConnections(graph);
  assert.equal(value.recorded,4);
  assert.equal(value.plotted,2);
  assert.equal(value.unplaced,1);
  assert.equal(value.colocated,1);
  assert.equal(value.links.length,1);
  assert.equal(value.links[0].count,2);
  assert.deepEqual(value.links[0].from,[-1,54]);
});
test("The geography showcase actually has inter-venue map connections",()=>{
 const g=parseGraphDocument(JSON.parse(readFileSync(resolve("apps/web/public/examples/after-dark.json"),"utf8")));
 const map=spatialConnections(g);
 assert.ok(map.links.length>=95);
 assert.ok(map.plotted>=95);
 assert.equal(map.links.filter(x=>x.type==="hosts a touring programme with").length,16);
 const cities=new Set(g.nodes.filter(n=>n.type==="place").map(n=>n.region));
 assert.ok(cities.size>=16);
});
