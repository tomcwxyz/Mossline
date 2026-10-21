import test from "node:test";
import assert from "node:assert/strict";
import {importFundingCsv,suggestFundingMapping} from "../src/funding.ts";
import {buildFundingFullAnalysis,buildFundingThemeClusters,identifyFundingThemes} from "../src/funding-clusters.ts";

const cols=["Identifier","Funding Org:Name","Funding Org:Identifier",
  "Recipient Org:Name","Recipient Org:Identifier","Recipient Individual Id",
  "Recipient Individual Name","Type of Recipient","Title","Description",
  "Amount Awarded","Currency","Recipient Region (additional data)"];
const line=(values:string[])=>values.map(v=>JSON.stringify(v)).join(",");
const rows=[
 cols.join(","),
 line(["G1","Trust One","F1","Food Hub","O1","","","Organisation",
  "Affordable meals","Community meals for families", "1500","GBP","North East"]),
 line(["G2","Trust Two","F2","Village Food Project","O2","","","Organisation",
  "Food redistribution","Supporting a community food pantry", "2500","GBP","North East"]),
 line(["G3","Trust Two","F2","Food Hub","O1","","","Organisation",
  "Food access","Food insecurity reduction", "1000","GBP","North East"]),
 line(["G4","Trust One","F1","","","private-id","Private Individual","Individual",
  "Sensitive private award","Personal sensitive description","5000","GBP","North East"]),
 line(["G5","Trust One","F1","Creative Workshop","O3","","","Organisation",
  "Theatre workshop","Community arts and theatre workshops", "750","GBP","North East"])
];
test("GrantNav recognises supplementary UK region not blanket best region",()=>{
 const m=suggestFundingMapping(cols);
 assert.equal(m.region,"Recipient Region (additional data)");
 assert.equal(m.funderId,"Funding Org:Identifier");
});
test("mixed individual/organisation grantnav export never creates personal recipient nodes",()=>{
 const data=importFundingCsv({name:"GrantNav-2025.csv",text:rows.join("\n")});
 assert.equal(data.counts.inputRows,5);
 assert.equal(data.counts.individualExcluded,1);
 assert.equal(data.counts.eligibleOrganisationRows,4);
 assert.equal(data.counts.importedGrants,4);
 assert.equal(data.graph!.nodes.some(n=>n.label==="Private Individual"),false);
 assert.equal(JSON.stringify(data.graph).includes("Personal sensitive description"),false);
 const hub=data.graph!.nodes.find(n=>n.label==="Food Hub");
 assert.equal(hub?.region,"North East");
});
test("cluster counts dedupe recipients, preserve separately sourced awards and funding overlap",()=>{
 const graph=importFundingCsv({name:"test.csv",text:rows.join("\n")}).graph!;
 const report=buildFundingThemeClusters(graph);
 const food=report.clusters.find(c=>c.title==="Food access");
 assert.ok(food);
 assert.equal(food.grantCount,3);
 assert.equal(food.funderCount,2);
 assert.equal(food.recipientCount,2);
 assert.deepEqual(food.awardsByCurrency,[{currency:"GBP",total:5000,knownAmounts:3}]);
 assert.ok(food.organisationBridges.some(b=>b.funderCount===2));
 assert.equal(food.evidence[0].reason,"phrase-rule");
 assert.equal(report.unclassifiedGrants,0);
 assert.equal(graph.edges.length,8); // analysis never creates graph links
});
test("source tags and matching phrases remain independent types of evidence",()=>{
 const award={grantId:"a",funderId:"f",recipientId:"r",amount:100,currency:"GBP",
  themes:["Health and Wellbeing"],description:"Community meals for older adults",
  title:"Food access",programme:"Local",date:"2025-03-01"};
 const themes=identifyFundingThemes(award);
 assert.ok(themes.some(t=>t.reason==="source-tag"&&t.title==="Health and Wellbeing"));
 assert.ok(themes.some(t=>t.reason==="phrase-rule"&&t.title==="Food access"));
});
test("a large GrantNav-style file gets a funder-balanced, explicit subset",()=>{
 const input=[cols.join(",")];
 for(let i=0;i<1400;i++){
   const id=i<120?"F1":"F2";
   input.push(line(["X"+i,id==="F1"?"Big Funder":"Small Funder",id,
     "Organisation "+i,"ORG"+i,"","","Organisation",
     "Community meals", "Food pantry for families","10","GBP","North East"]));
 }
 const result=importFundingCsv({name:"big.csv",text:input.join("\n")});
 assert.ok(result.graph);
 assert.equal(result.counts.eligibleOrganisationRows,1400);
 assert.equal(result.counts.importedGrants,120);
 assert.equal(result.counts.overflowExcluded,1280);
 assert.equal(result.fullGrantCount,1400);
 assert.equal(result.graph!.nodes.filter(n=>n.type==="project").length,120);
 assert.equal(result.analysisGraph!.nodes.filter(n=>n.type==="project").length,1400);
 const full=buildFundingFullAnalysis(result.analysisGraph!);
 assert.equal(full.grants,1400);
 assert.equal(full.funders,2);
 assert.deepEqual(full.amounts,[{currency:"GBP",total:14000,knownAmounts:1400}]);
 const food=full.themes.clusters.find(x=>x.title==="Food access");
 assert.equal(food?.grantCount,1400);
 assert.equal(full.themes.totalGrants,1400);
 assert.equal(full.themes.unclassifiedGrants,0);
 const names=result.graph!.nodes.filter(n=>n.type==="funder").map(n=>n.label);
 assert.ok(names.includes("Big Funder"));
 assert.ok(names.includes("Small Funder"));
 assert.match(result.graph!.description,/interactive network shows 120 of 1400/i);
});
test("grants without classification are counted explicitly, not turned into a fictitious gap",()=>{
 const data=[
 "Funder,Recipient,Title,Description",
 "Trust,Organisation A,General unrestricted award,supporting the charity purposes",
 "Trust,Organisation B,Trustee support,operational support"
 ].join("\n");
 const graph=importFundingCsv({name:"test.csv",text:data}).graph!;
 const report=buildFundingThemeClusters(graph);
 assert.equal(report.unclassifiedGrants,2);
 assert.equal(report.clusters.length,0);
});

test("full dataset summary is detached from canvas subset and never contains private individual awards",()=>{
 const entries=[cols.join(",")];
 for(let i=0;i<1302;i++){
  entries.push(line(["Q"+i,"Funder "+(i%3),"F"+(i%3),
   "Nonprofit "+i,"ORG"+i,"","","Organisation",
   i%2?"Food access":"Repair and reuse",
   i%2?"Affordable community meals":"Repair and reuse workshops",
   "25","GBP","North East"]));
 }
 entries.push(line(["SENSITIVE","Trust","F4","","","an-individual-id",
   "Private recipient","Individual","Private award",
   "Personal details should not be imported","999999","GBP","North East"]));
 const imported=importFundingCsv({name:"GrantNav-realistic.csv",text:entries.join("\n")});
 assert.equal(imported.counts.individualExcluded,1);
 assert.equal(imported.fullGrantCount,1302);
 assert.equal(imported.counts.importedGrants,120);
 const full=buildFundingFullAnalysis(imported.analysisGraph!);
 assert.equal(full.grants,1302);
 assert.equal(full.amounts[0].total,1302*25);
 assert.equal(full.themes.classifiedGrants,1302);
 assert.equal(full.recipientRegions[0].region,"North East");
 assert.equal(JSON.stringify(full).includes("Private recipient"),false);
 assert.equal(JSON.stringify(full).includes("Personal details"),false);
 assert.equal(JSON.stringify(imported.graph).includes("Private recipient"),false);
});

test("latest modified version of a repeated grant ID wins independent of CSV order",()=>{
 const headers="Identifier,Funding Org:Name,Recipient Org:Name,Amount Awarded,Date Modified,Title,Description";
 const older='ID1,Foundation,Local Charity,13262,2025-11-28T00:00:00+00:00,Community meals,Supporting accessible food and community meals';
 const newer='ID1,Foundation,Local Charity,13345,2026-08-13T00:00:00+00:00,Community meals,Supporting accessible food and community meals';
 for(const order of [[older,newer],[newer,older]]){
   const result=importFundingCsv({name:"revisions.csv",text:[headers,...order].join("\n")});
   assert.equal(result.fullGrantCount,1);
   assert.equal(result.counts.duplicateExcluded,1);
   assert.equal(result.counts.importedGrants,1);
   const summary=buildFundingFullAnalysis(result.graph!);
   // Currency must be explicit rather than guessed from an unmarked amount.
   assert.equal(summary.amounts.length,0);
   const award=result.graph!.nodes.find(n=>n.type==="project");
   assert.equal(award?.properties?.amountAwarded,13345);
 }
});
test("multiple versions with an explicit currency count the latest award amount once",()=>{
 const csv="Identifier,Funding Org:Name,Recipient Org:Name,Amount Awarded,Currency,Date Modified,Title,Description\n"+
  "G100,Foundation,Charity,120,GBP,2025-01-01,Meals,Community meals for families\n"+
  "G100,Foundation,Charity,1275,GBP,2026-01-01,Meals,Community meals for families";
 const result=importFundingCsv({name:"revisions.csv",text:csv});
 assert.equal(result.fullGrantCount,1);
 assert.deepEqual(buildFundingFullAnalysis(result.graph!).amounts,
   [{currency:"GBP",total:1275,knownAmounts:1}]);
});
