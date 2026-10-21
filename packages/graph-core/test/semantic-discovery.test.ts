import test from "node:test";
import assert from "node:assert/strict";
import {importFundingCsv} from "../src/funding.ts";
import {cosineSimilarity,prepareFundingDiscovery,rankSemanticSuggestions,
  reviewKey} from "../src/semantic-discovery.ts";

const sample=[
"Identifier,Funding Org:Name,Recipient Org:Name,Title,Description,Public",
"G001,Trust A,Group A,Community meals,Healthy food and meals for families,TRUE",
"G002,Trust B,Group B,Food resilience,Improving access to community kitchens,TRUE",
"G003,Trust A,Group C,Young makers,Young people learning practical skills,TRUE",
"G004,Trust A,Group D,Private project,Unpublished personal details,FALSE"
].join("\n");
const graph=importFundingCsv({name:"sample.csv",text:sample}).graph!;

test("prepare documents uses grant text only and excludes withheld grant",()=>{
  const docs=prepareFundingDiscovery(graph);
  assert.equal(docs.length,3);
  assert.ok(docs.every(d=>!d.text.includes("Trust A")&&!d.text.includes("Group A")));
  assert.equal(JSON.stringify(docs).includes("Unpublished"),false);
  assert.ok(docs.every(d=>d.grantId&&d.recipientId&&d.excerpt));
});
test("cosine handles mismatched dimensions, zero vectors and nonfinite values",()=>{
  assert.equal(cosineSimilarity([1,0],[0,1]),0);
  assert.equal(cosineSimilarity([1,0],[2,0]),1);
  assert.equal(cosineSimilarity([0,0],[2,0]),0);
  assert.equal(cosineSimilarity([1],[1,0]),0);
  assert.equal(cosineSimilarity([NaN],[1]),0);
});
test("rank retains justifiable source grants and never modifies source graph",()=>{
  const docs=prepareFundingDiscovery(graph);
  const before=JSON.stringify(graph);
  const matches=rankSemanticSuggestions(docs,[
    [1,0,0],[0.99,0.1,0],[0,1,0]
  ],"test-embedding-v0",0.8);
  assert.equal(matches.length,1);
  assert.equal(matches[0].method,"embedding");
  assert.equal(matches[0].differentFunders,true);
  assert.equal(matches[0].model,"test-embedding-v0");
  assert.equal(matches[0].recipientA!==matches[0].recipientB,true);
  assert.equal(JSON.stringify(graph),before);
});
test("multiple awards for a recipient become one best-evidence suggestion",()=>{
 const docs=prepareFundingDiscovery(graph);
 const repeated=[...docs,{...docs[0],grantId:"grant:another-award"}];
 const ranked=rankSemanticSuggestions(repeated,[
   [1,0],[0.9,0.1],[0,1],[0.99,0.02]
 ],"model",0.7);
 assert.equal(ranked.length,1);
 assert.ok(ranked[0].grantA&&ranked[0].grantB);
});
test("bad embedding responses are rejected rather than assigned to wrong grants",()=>{
 const docs=prepareFundingDiscovery(graph);
 assert.throws(()=>rankSemanticSuggestions(docs,[[1,0]],"model"),/did not match/);
 assert.throws(()=>rankSemanticSuggestions(docs,[[1,0],[1,0],[1]],"model"),/did not match/);
 assert.throws(()=>rankSemanticSuggestions(docs,[[1],[1],[1]],"model",1.5),/threshold/);
});
test("review keys are separate for different maps",()=>{
 assert.notEqual(reviewKey("graph-a","candidate-1"),reviewKey("graph-b","candidate-1"));
});
