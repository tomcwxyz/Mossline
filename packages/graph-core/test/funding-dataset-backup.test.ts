import test from "node:test";
import assert from "node:assert/strict";
import {makeFundingDatasetBackup,parseFundingDatasetBackup}
  from "../src/funding-dataset-backup.ts";
const graph={
  version:1,title:"Sample awards",description:"",
  nodes:[
    {id:"award-1",label:"Award",type:"project",tags:[],
      properties:{mosslineFundingGrant:true}},
    {id:"funder",label:"Funder",type:"funder",tags:[]}
  ],edges:[{id:"edge",source:"funder",target:"award-1",type:"funded"}]
};
const dataset={id:"one",createdAt:17,sourceTitle:"Sample awards",grantCount:1,graph};
test("portable funding archive validates and keeps original dataset IDs",()=>{
 const backup=makeFundingDatasetBackup([dataset as never]);
 const restored=parseFundingDatasetBackup(JSON.parse(JSON.stringify(backup)));
 assert.equal(restored.datasets[0].id,"one");
 assert.equal(restored.datasets[0].graph.edges[0].source,"funder");
});
test("rejects format changes, duplicate IDs, broken graphs and mismatched counts",()=>{
 const backup=makeFundingDatasetBackup([dataset as never]);
 assert.throws(()=>parseFundingDatasetBackup({...backup,version:2}),/supported/);
 assert.throws(()=>parseFundingDatasetBackup({...backup,datasets:[dataset,dataset]}),/duplicate/);
 assert.throws(()=>parseFundingDatasetBackup({...backup,datasets:[{...dataset,grantCount:2}]}),/totals/);
 assert.throws(()=>parseFundingDatasetBackup({...backup,datasets:[{
   ...dataset,graph:{...graph,edges:[{id:"broken",source:"none",target:"funder",type:"funded"}]}
 }]}));
});
