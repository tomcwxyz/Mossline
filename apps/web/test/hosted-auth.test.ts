import test from "node:test";
import assert from "node:assert/strict";
import {makePublicationId,makeManagementKey,hashManagementKey,
  validPublicationId,readBearer,readJsonBody} from "../src/lib/hosted-auth";

test("stable public IDs and secret owner keys are distinct random capabilities",()=>{
 const slug=makePublicationId(),management=makeManagementKey();
 assert.equal(validPublicationId(slug),true);
 assert.notEqual(makePublicationId(),slug);
 assert.notEqual(makeManagementKey(),management);
 assert.equal(management.length>=40,true);
 assert.equal(hashManagementKey(management).length,64);
 assert.equal(hashManagementKey(management).includes(management),false);
 assert.equal(validPublicationId("../private"),false);
});
test("management credentials are accepted only in an explicit bearer header",()=>{
 assert.equal(readBearer(new Request("https://example.org",{headers:{
   Authorization:"Bearer abcdefghijklmnopqrstuvwxyzABCDEF"}})),
  "abcdefghijklmnopqrstuvwxyzABCDEF");
 assert.equal(readBearer(new Request("https://example.org?token=abcdef")),"");
 assert.equal(readBearer(new Request("https://example.org",{headers:{
   Authorization:"Basic dXNlcjpwYXNz"}})),"");
});
test("bounded JSON reader rejects oversized uploads",async()=>{
 const body=JSON.stringify({hello:"world"});
 assert.deepEqual(await readJsonBody(new Request("https://example.org",
   {method:"POST",body}),100),{hello:"world"});
 await assert.rejects(readJsonBody(new Request("https://example.org",
   {method:"POST",body}),2),/maximum request/);
});
