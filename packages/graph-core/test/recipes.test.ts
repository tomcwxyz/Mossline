import test from "node:test";
import assert from "node:assert/strict";
import {
  makeMappingRecipe, parseMappingRecipe, parseMappingRecipes,
  checkRecipeColumns, compareGraphDocuments, parseGraphDocument,
  discoverData, buildMappedGraph
} from "../src/index.ts";
const original={name:"PFT-like export",text:
  "Organisation,Project,Funder,Region\nGrowers,Soil trial,Fund A,North\nNetwork,Soil trial,Fund A,South\n"};
const discovered=discoverData({...original,name:"sample.csv"});
if(discovered.kind!=="csv-table")throw Error("Fixture should be CSV");
const mapping=discovered.mapping;
const id="77777777-7777-4777-8777-777777777777";
const secondId="88888888-8888-4888-8888-888888888888";
const columns=discovered.columns.map(x=>x.name);

test("a portable recipe stores reviewed mappings but no user rows",()=>{
  const r=makeMappingRecipe(" Farming network ",columns,mapping,undefined,id,123456);
  assert.equal(r.name,"Farming network");
  assert.equal(r.version,1);
  assert.equal(r.revision,1);
  assert.equal(r.familyId,id);
  assert.deepEqual(parseMappingRecipe(JSON.parse(JSON.stringify(r))),r);
  assert.equal(JSON.stringify(r).includes("Growers"),false);
  assert.equal(JSON.stringify(r).includes("Fund A"),false);
});

test("revision creates an independently preserved recipe in the same family",()=>{
  const a=makeMappingRecipe("Farming network",columns,mapping,undefined,id,10);
  const b=makeMappingRecipe("Farming network",columns,
    {...mapping,regionTarget:"target"},a,secondId,20);
  assert.equal(b.revision,2);
  assert.equal(b.familyId,a.familyId);
  assert.notEqual(b.id,a.id);
  assert.equal(a.mapping.regionTarget,"source");
  assert.deepEqual(parseMappingRecipes([a,b]),[a,b]);
});

test("rejects unknown recipe versions, row payloads and invalid mapping semantics",()=>{
  const recipe=makeMappingRecipe("Valid",columns,mapping,undefined,id,123);
  assert.throws(()=>parseMappingRecipe({...recipe,version:2}));
  assert.throws(()=>parseMappingRecipe({...recipe,rawRows:[{name:"PRIVATE"}]}));
  assert.throws(()=>parseMappingRecipe({...recipe,mapping:{...mapping,rules:[]}}));
  assert.throws(()=>parseMappingRecipe({...recipe,columns:["Project","Project"]}));
  assert.throws(()=>parseMappingRecipe({...recipe,mapping:{
    ...mapping,rules:[{...mapping.rules[0],toColumn:mapping.rules[0].fromColumn}]
  }}));
});

test("column matching is order-independent but refuses silently renamed required fields",()=>{
  const recipe=makeMappingRecipe("Good",columns,mapping,undefined,id,1);
  const reordered=checkRecipeColumns(recipe,["Region","Funder","Project","Organisation"]);
  assert.equal(reordered.usable,true);
  assert.deepEqual(reordered.missing,[]);
  const extra=checkRecipeColumns(recipe,[...columns,"Notes"]);
  assert.equal(extra.usable,true);
  assert.deepEqual(extra.added,["Notes"]);
  const renamed=checkRecipeColumns(recipe,["Region","Funder","Project","Organisation renamed"]);
  assert.equal(renamed.usable,false);
  assert.deepEqual(renamed.missing,["Organisation"]);
});

test("stable IDs and descriptive delta ignore source row ordering",()=>{
  const source1={name:"old.csv",text:original.text};
  const source2={name:"new.csv",text:"Organisation,Project,Funder,Region\nNetwork,Soil trial,Fund A,South\nGrowers,Soil trial,Fund A,North\n"};
  const before=buildMappedGraph(source1,mapping).graph!;
  const after=buildMappedGraph(source2,mapping).graph!;
  assert.ok(before && after);
  const diff=compareGraphDocuments(before,after);
  assert.equal(diff.nodes.added,0);
  assert.equal(diff.nodes.removed,0);
  assert.equal(diff.edges.added,0);
  assert.equal(diff.edges.removed,0);
  assert.equal(diff.nodes.updated,0);
  assert.equal(diff.edges.updated,0);
});

test("descriptive delta catches added, removed and changed records",()=>{
  const original=parseGraphDocument({version:1,title:"A",nodes:[
    {id:"a",label:"Growers",type:"organisation",tags:[]},
    {id:"b",label:"Soil trial",type:"project",tags:[]}
  ],edges:[{id:"r1",source:"a",target:"b",type:"delivers"}]});
  const next=parseGraphDocument({version:1,title:"B",nodes:[
    {id:"a",label:"Growers",type:"organisation",description:"Expanded",tags:[]},
    {id:"c",label:"New funder",type:"funder",tags:[]}
  ],edges:[{id:"r2",source:"c",target:"a",type:"funds"}]});
  const diff=compareGraphDocuments(original,next);
  assert.deepEqual([diff.nodes.added,diff.nodes.removed,diff.nodes.updated],[1,1,1]);
  assert.deepEqual([diff.edges.added,diff.edges.removed,diff.edges.updated],[1,1,0]);
  assert.deepEqual(diff.nodes.removedExamples,["Soil trial"]);
});

test("semantic changes to a recorded edge are not masked by stable identity",()=>{
  const before=parseGraphDocument({version:1,title:"A",nodes:[
    {id:"a",label:"Org",type:"organisation",tags:[]},
    {id:"b",label:"Project",type:"project",tags:[]}
  ],edges:[{id:"one",source:"a",target:"b",type:"supports"}]});
  const after=parseGraphDocument({...before,edges:[{...before.edges[0],type:"delivers"}]});
  const diff=compareGraphDocuments(before,after);
  assert.equal(diff.edges.updated,1);
});
