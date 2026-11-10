import {test} from "node:test";
import {strict as assert} from "node:assert";
import {missingColumns,readDelimited,recogniseTable} from "@mossline/graph-core";
import type {MapFile,TableInfo} from "../src/workers/add-data.worker";
import {canReviewDirectly} from "../src/lib/import-journey";

function table(name:string,csv:string):TableInfo {
  const parsed=readDelimited(name,csv);
  return {name:parsed.name,file:name,format:parsed.format,headings:parsed.headings,
    rows:parsed.rows.length,bytes:csv.length,large:false,sample:parsed.rows.slice(0,5),
    matches:recogniseTable(parsed).map(m=>({...m,missing:missingColumns(m.shape,parsed)}))};
}
const plan=(tables:TableInfo[],use:"records"|"fill"="records")=>
  Object.fromEntries(tables.map(t=>[t.name,{include:true,use}]));

test("an ordinary record spreadsheet can go directly to the reversible review",()=>{
  const tables=[table("ideas.csv","Name,Organisation,Theme\nFood club,Neighbourhood Trust,Food\n")];
  assert.equal(canReviewDirectly(tables,[],[],plan(tables),false),true);
  assert.equal(tables[0].matches[0].builtIn,false);
});

test("record and relationship tables are interpreted as one dataset",()=>{
  const tables=[
    table("records.csv","Name,Theme\nAlice,Food\nBob,Health\n"),
    table("links.csv","From,To,Relationship\nAlice,Bob,works with\n")
  ];
  assert.equal(canReviewDirectly(tables,[],[],plan(tables),false),true);
});

test("links without a matching record table cannot create an empty map",()=>{
  const tables=[table("links.csv","From,To,Relationship\nAlice,Bob,works with\n")];
  assert.equal(canReviewDirectly(tables,[],[],plan(tables),false),false);
  assert.equal(canReviewDirectly(tables,[],[],plan(tables),true),true);
});

test("problems, missing shapes and ambiguous recognised readings keep the mapping step",()=>{
  const tables=[table("people.csv","Name\nAlice\n")];
  assert.equal(canReviewDirectly(tables,[],[{file:"bad.csv",message:"Unreadable"}],plan(tables),false),false);
  const noMatch=[{...tables[0],matches:[]}];
  assert.equal(canReviewDirectly(noMatch,[],[],plan(noMatch),false),false);
  const top=tables[0].matches[0];
  const ambiguous=[{...tables[0],matches:[{...top,builtIn:true,score:10},{...top,builtIn:true,score:10}]}];
  assert.equal(canReviewDirectly(ambiguous,[],[],plan(ambiguous),false),false);
});

test("a valid standalone Mossy map can go straight to review; empty input cannot",()=>{
  const maps:MapFile[]=[{file:"atlas.json",title:"Atlas",nodes:2,edges:1}];
  assert.equal(canReviewDirectly([],maps,[],{},false),true);
  assert.equal(canReviewDirectly([],[],[],{},false),false);
});
