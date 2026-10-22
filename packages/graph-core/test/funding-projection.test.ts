import test from "node:test";
import assert from "node:assert/strict";
import {importFundingCsv} from "../src/funding.ts";
import {projectFundingGraph,MAX_FUNDING_CANVAS_GRANTS} from "../src/funding-projection.ts";
import {buildFundingFullAnalysis} from "../src/funding-clusters.ts";
import {layoutFullNetwork} from "../src/full-network-layout.ts";

const rows=["Identifier,Funding Org:Name,Recipient Org:Name,Title,Description,Amount Awarded,Currency,Recipient Region"];
for(let i=0;i<520;i++)rows.push(
 ["G"+i,"Trust "+(i%8),"Organisation "+(i%130),i%2===0?"Community meals":"Repair and reuse",
 i%2===0?"Community meals for households":"Repair and reuse workshops",
 "100","GBP",i%3===0?"North East":"North West"].join(","));
const imported=importFundingCsv({name:"many.csv",text:rows.join("\n")});
const full=imported.analysisGraph??imported.graph!;
test("full dataset remains complete independent of every network projection",()=>{
 assert.equal(full.nodes.filter(n=>n.type==="project").length,520);
 assert.equal(buildFundingFullAnalysis(full).grants,520);
 for(const page of [1,2,3,4,5,6]){
   const detail=projectFundingGraph(full,{page,pageSize:90});
   assert.equal(detail.matchingGrants,520);
   assert.ok(detail.graph.nodes.filter(n=>n.type==="project").length<=MAX_FUNDING_CANVAS_GRANTS);
   assert.ok(detail.graph.edges.length<=180);
 }
 assert.equal(buildFundingFullAnalysis(full).amounts[0].total,52000);
});
test("page-wise exploration reaches records not in initial 120-grant sample",()=>{
 const ids=new Set<string>();
 for(let page=1;page<=6;page++){
   const subset=projectFundingGraph(full,{page,pageSize:90});
   for(const node of subset.graph.nodes.filter(n=>n.type==="project"))ids.add(node.id);
 }
 assert.equal(ids.size,520);
});
test("select a theme or funder from all records, never only first canvas page",()=>{
 const theme=projectFundingGraph(full,{theme:"phrase:food access",pageSize:75});
 assert.equal(theme.matchingGrants,260);
 assert.ok(theme.graph.nodes.every(n=>n.type!=="project"||n.label==="Community meals"));
 const target=full.nodes.find(n=>n.label==="Trust 3")!;
 const byFunder=projectFundingGraph(full,{funderId:target.id,pageSize:100});
 assert.equal(byFunder.matchingGrants,65);
 const byRegion=projectFundingGraph(full,{region:"North East",pageSize:65});
 assert.ok(byRegion.matchingGrants>100);
 const notFound=projectFundingGraph(full,{search:"utterly-unmatched-phrase"});
 assert.equal(notFound.matchingGrants,0);
 assert.equal(notFound.graph.nodes.length,0);
});
test("out-of-range pages clamp and never exceed the canvas limit",()=>{
 const projection=projectFundingGraph(full,{page:999,pageSize:10000});
 assert.equal(projection.page,5);
 assert.equal(projection.pageSize,120);
 assert.equal(projection.pages,5);
});

test("full-funding graph has drawable geometry for every grant and original connection",()=>{
 const geometry=layoutFullNetwork(full);
 assert.equal(geometry.nodeCount,full.nodes.length);
 assert.equal(geometry.edgeCount,full.edges.length);
 assert.equal(geometry.segments.length,full.edges.length*4);
 assert.equal(full.nodes.filter(n=>n.type==="project").length,520);
 assert.ok(!imported.issues.some(issue=>/not represented|omitted from the detailed network canvas|Large GrantNav extract/i.test(issue.message)),
   "The smaller legacy editing graph must not be presented as a limit on the complete map");
});
