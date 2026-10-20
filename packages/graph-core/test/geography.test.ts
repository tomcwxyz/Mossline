import test from "node:test";
import assert from "node:assert/strict";
import {readAtlasLocation, projectUkLocation, buildUkAtlas, parseGraphDocument} from "../src/index.ts";
const node=(atlas:string,other:Record<string,string>={})=>({
  id:"entity",label:"Entity",type:"organisation" as const,tags:[],
  properties:{"Atlas location":atlas,...other}
});
test("use Atlas location, not unrelated Kumu geo, mapx or mapy",()=>{
  const a=readAtlasLocation(node("51.5, -0.1",{geo:"60, 8",mapx:"3000",mapy:"1200"}));
  assert.deepEqual(a,{latitude:51.5,longitude:-0.1});
  const without={...node(""),properties:{"geo":"55, -4","mapx":"53","mapy":"-5"}};
  assert.equal(readAtlasLocation(without),null);
});
test("reject unsupported geographic formats and invalid coordinates",()=>{
  for(const raw of ["","52; -2","invalid","51.5, -3, 5","91, -2",
    "-91, 0","55, 181","NaN, 2","0x33, -2","50, -Infinity"]){
    assert.equal(readAtlasLocation(node(raw)),null,raw);
  }
});
test("UK projection gives plausible coordinates and rejects out-of-area points",()=>{
  assert.deepEqual(projectUkLocation({latitude:60.5,longitude:-11.5}),{x:0,y:0});
  assert.deepEqual(projectUkLocation({latitude:49,longitude:4}),{x:960,y:720});
  const york=projectUkLocation({latitude:53.959,longitude:-1.082});
  const london=projectUkLocation({latitude:51.507,longitude:-0.127});
  assert.ok(york&&london);assert.ok(york.y<london.y);assert.ok(york.x<london.x);
  assert.equal(projectUkLocation({latitude:40,longitude:-2}),null);
  assert.equal(projectUkLocation({latitude:54,longitude:35}),null);
});
test("missing coordinates stay unplaced, including methodology/topic types",()=>{
 const graph=parseGraphDocument({version:1,title:"Source",nodes:[
   node("54.3, -2.2"),
   {...node(""),id:"unknown",label:"No place"},
   {...node("54.2, -2.1"),id:"method",type:"methodology"},
   {...node("40, -4"),id:"non-uk",type:"place"}
 ],edges:[]});
 const x=buildUkAtlas(graph);
 assert.deepEqual(x.placed.map(p=>p.nodeId),["entity","method"]);
 assert.deepEqual(x.withoutLocation.map(p=>p.id),["unknown"]);
 assert.deepEqual(x.outsideArea.map(p=>p.id),["non-uk"]);
 assert.equal(graph.nodes[1].properties?.["Atlas location"],"");
});

test("ordinary datasets can supply explicit latitude/longitude without PFT-specific fields",()=>{
  const dataset=parseGraphDocument({version:1,title:"Neighbourhood connections",nodes:[
    {id:"library",label:"Community library",type:"place",
      properties:{Latitude:"54.62",Longitude:"-1.57"}},
    {id:"hub",label:"Neighbourhood hub",type:"organisation",
      properties:{lat:54.61,lng:-1.58}},
    {id:"missing",label:"Needs a location",type:"organisation",
      properties:{region:"North East",geo:"54.6, -1.5"}},
    {id:"invalid",label:"Invalid coords",type:"project",
      properties:{latitude:"100",longitude:"-1.5"}}
  ],edges:[]});
  assert.deepEqual(readAtlasLocation(dataset.nodes[0]),{latitude:54.62,longitude:-1.57});
  assert.deepEqual(readAtlasLocation(dataset.nodes[1]),{latitude:54.61,longitude:-1.58});
  assert.equal(readAtlasLocation(dataset.nodes[2]),null);
  assert.equal(readAtlasLocation(dataset.nodes[3]),null);
  assert.equal(buildUkAtlas(dataset).placed.length,2);
  assert.deepEqual(dataset.nodes[0].properties,{Latitude:"54.62",Longitude:"-1.57"});
});
