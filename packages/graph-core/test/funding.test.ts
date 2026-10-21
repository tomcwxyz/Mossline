import test from "node:test";
import assert from "node:assert/strict";
import {analyseFundingLandscape,importFundingCsv,suggestFundingMapping}
  from "../src/funding.ts";

const columns=["Identifier","Funding Org:Name","Funding Org:Identifier",
 "Recipient Org:Name","Recipient Org:Identifier","Title","Description",
 "Amount Awarded","Currency","Award Date","Grant Programme:Title","Themes","Public"];
const row=(cells:string[])=>cells.map(x=>'"'+x.replaceAll('"','""')+'"').join(",");
const sample=[columns.join(","),
 row(["360G-EX-A","Green Futures Trust","GB-00001","Town Food Link","GB-10001",
  "Neighbourhood food hubs","Community meals and food access for families","12000","GBP","2025-02-20","Local Resilience","Food access; Cost of living","TRUE"]),
 row(["360G-EX-B","Riverside Fund","GB-00002","Community Fridge","GB-10002",
  "Food pantry project","Food distribution and community meals in estates","8000","GBP","2025-05-20","Wellbeing","Food access","TRUE"]),
 row(["360G-EX-C","Riverside Fund","GB-00002","Town Food Link","GB-10001",
  "Voluntary sector kitchens","Community meals and nutrition outreach","4500","GBP","2025-04-01","Wellbeing","Food access","TRUE"]),
 row(["360G-EX-D","Housing Renewal Trust","GB-00003","Neighbourhood Workshop","GB-10003",
  "Skills for community","Training in repair and practical learning skills","7000","GBP","2025-04-01","Skills","Skills","TRUE"]),
 row(["360G-EX-E","Green Futures Trust","GB-00001","Sensitive Project","GB-10004",
  "Do not share","Hidden work","9999","GBP","2025-04-01","Skills","Food access","FALSE"])
].join("\n");

test("detects common 360Giving flat CSV field names",()=>{
 const m=suggestFundingMapping(columns);
 assert.equal(m.funder,"Funding Org:Name");
 assert.equal(m.recipient,"Recipient Org:Name");
 assert.equal(m.amount,"Amount Awarded");
 assert.equal(m.programme,"Grant Programme:Title");
});
test("keeps grant events separate, preserves identities and excludes non-public rows",()=>{
 const result=importFundingCsv({name:"grants.csv",text:sample});
 assert.ok(result.graph);
 assert.equal(result.counts.importedGrants,4);
 assert.equal(result.counts.funders,3);
 assert.equal(result.counts.recipients,3);
 assert.equal(result.counts.skipped,1);
 assert.equal(result.graph!.edges.length,8);
 assert.equal(result.graph!.nodes.filter(n=>n.type==="project").length,4);
 assert.equal(result.graph!.nodes.find(n=>n.label==="Town Food Link")?.properties?.organisationIdentifier,"GB-10001");
 assert.equal(JSON.stringify(result.graph).includes("Sensitive Project"),false);
 assert.equal(JSON.stringify(result.graph).includes("9999"),false);
});
test("funding summaries never mix currencies or count excluded awards",()=>{
 const result=importFundingCsv({name:"grants.csv",text:sample});
 const facts=analyseFundingLandscape(result.graph!);
 assert.equal(facts.awardCount,4);
 assert.equal(facts.multiFunded.length,1);
 assert.equal(facts.multiFunded[0].name,"Town Food Link");
 assert.deepEqual(facts.amounts,[{currency:"GBP",total:31500,count:4}]);
});
test("theme connections are candidates only, with distinct evidence and no invented edges",()=>{
 const result=importFundingCsv({name:"grants.csv",text:sample});
 const originalEdgeCount=result.graph!.edges.length;
 const {insights}=analyseFundingLandscape(result.graph!);
 assert.ok(insights.some(i=>i.kind==="recorded-themes"&&i.differentFunders===false));
 assert.ok(insights.every(i=>i.evidenceA&&i.evidenceB&&i.recipientA!==i.recipientB));
 assert.equal(result.graph!.edges.length,originalEdgeCount);
});
test("invalid inputs cannot silently become funding records",()=>{
 const none=importFundingCsv({name:"invalid.csv",text:"Person,Income\nAda,100"});
 assert.equal(none.graph,null);
 assert.ok(none.issues.some(i=>i.severity==="error"));
 const invalid=importFundingCsv({name:"invalid.csv",
  text:"Funder,Recipient,Amount,Public\nBig Fund,Group,-200,TRUE\nBig Fund,Private Group,9,FALSE"});
 assert.equal(invalid.counts.importedGrants,1);
 assert.ok(invalid.issues.some(i=>/invalid amount/i.test(i.message)));
 assert.equal(analyseFundingLandscape(invalid.graph!).amounts.length,0);
});
test("stable funder IDs and grant IDs under row permutation",()=>{
 const file={name:"awards.csv",text:sample};
 const reordered={name:"awards.csv",text:[columns.join(","),...sample.split("\n").slice(1).reverse()].join("\n")};
 const a=importFundingCsv(file).graph!,b=importFundingCsv(reordered).graph!;
 assert.deepEqual(new Set(a.nodes.map(n=>n.id)),new Set(b.nodes.map(n=>n.id)));
 assert.deepEqual(new Set(a.edges.map(e=>e.id)),new Set(b.edges.map(e=>e.id)));
});
