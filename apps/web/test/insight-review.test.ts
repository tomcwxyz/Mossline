import test from "node:test";
import assert from "node:assert/strict";
import {insightReviewKey,parseInsightReviewLedger,
 setInsightReviewDecision} from "../src/lib/insight-review";

const hash="b".repeat(64);
test("review history is scoped to an exact network version and model",()=>{
 const key=insightReviewKey(hash,"alibaba/qwen3-embedding-0.6b");
 assert.ok(key.includes(hash));
 assert.notEqual(key,insightReviewKey("a".repeat(64),"alibaba/qwen3-embedding-0.6b"));
 assert.notEqual(key,insightReviewKey(hash,"different/embed"));
 assert.equal(insightReviewKey("unknown","test/model"),"");
});
test("review decisions are reversible and never store source descriptions",()=>{
 const saved=setInsightReviewDecision({},"semantic:a-b","saved");
 assert.deepEqual(saved,{"semantic:a-b":"saved"});
 const dismissed=setInsightReviewDecision(saved,"semantic:a-b","dismissed");
 assert.deepEqual(dismissed,{"semantic:a-b":"dismissed"});
 assert.deepEqual(saved,{"semantic:a-b":"saved"});
 assert.deepEqual(setInsightReviewDecision(dismissed,"semantic:a-b",null),{});
});
test("malformed and oversized review history is safely rejected",()=>{
 assert.deepEqual(parseInsightReviewLedger("{not-json"),{});
 assert.deepEqual(parseInsightReviewLedger('["saved"]'),{});
 assert.deepEqual(parseInsightReviewLedger(JSON.stringify({
   a:"saved",b:"dismissed",c:"confirmed",d:0
 })),{a:"saved",b:"dismissed"});
 const all=Object.fromEntries(Array.from({length:100},(_,i)=>["s"+i,"saved"])) as Record<string,"saved">;
 assert.throws(()=>setInsightReviewDecision(all,"extra","saved"),/100/);
 assert.throws(()=>setInsightReviewDecision({},"","saved"),/Invalid/);
});
