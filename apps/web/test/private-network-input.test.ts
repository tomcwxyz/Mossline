import test from "node:test";
import assert from "node:assert/strict";
import {parsePrivateNetworkUpload} from "../src/lib/private-network-input";
const graph={version:1,title:"Example network",description:"",
 nodes:[{id:"a",label:"Example 1",type:"organisation",tags:[]},
 {id:"b",label:"Example 2",type:"project",tags:[]}],
 edges:[{id:"ab",source:"a",target:"b",type:"recorded"}]};
test("upload requires an explicit approval flag",()=>{
 assert.throws(()=>parsePrivateNetworkUpload({graph}),/Invalid input/);
});
test("same source records produce same content digest",()=>{
 const one=parsePrivateNetworkUpload({graph,confirmedPrivateStorage:true});
 const two=parsePrivateNetworkUpload({graph,confirmedPrivateStorage:true});
 assert.equal(one.digest,two.digest);
 assert.equal(one.nodeCount,2);
 assert.equal(one.edgeCount,1);
});
test("changed source records produce a distinct digest",()=>{
 const one=parsePrivateNetworkUpload({graph,confirmedPrivateStorage:true});
 const two=parsePrivateNetworkUpload({graph:{...graph,title:"Changed"},
   confirmedPrivateStorage:true});
 assert.notEqual(one.digest,two.digest);
});
