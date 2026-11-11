import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {applySources,parseGraphDocument,readDelimited,readJson,recogniseTable,
  type PlannedTable,type GraphDocument} from "../src/index.ts";

type FileCase={name:string;content:string};
type Scenario={
  id:string;family:string;title:string;format:string;idealFirstView:string;
  edit:string;mustNot:string;actualStatus:string;
  files?:FileCase[];
  engineExpectation?:{records:number;recordedLinks:number};
  missing?:string;
};
type Catalogue={schemaVersion:number;caseCount:number;cases:Scenario[]};

const path=fileURLToPath(new URL("../../../data/throw-lab/catalogue.json",import.meta.url));
const catalogue=JSON.parse(readFileSync(path,"utf8")) as Catalogue;

test("Throw Lab is a deliberately broad sixty-case product contract",()=>{
  assert.equal(catalogue.schemaVersion,1);
  assert.equal(catalogue.caseCount,60);
  assert.equal(catalogue.cases.length,60);
  assert.equal(new Set(catalogue.cases.map(c=>c.id)).size,60);
  assert.equal(new Set(catalogue.cases.map(c=>c.family)).size,6);
  for(const scenario of catalogue.cases){
    assert.ok(scenario.title&&scenario.idealFirstView&&scenario.mustNot&&scenario.edit,scenario.id);
    if(scenario.actualStatus==="engine-regression-added"){
      assert.ok(scenario.files?.length&&scenario.engineExpectation,scenario.id);
    }else{
      assert.equal(scenario.actualStatus,"not-implemented",scenario.id);
      assert.ok(scenario.missing,scenario.id+" must disclose the gap");
    }
  }
});

/** One way in: the SAME core readers, recogniser and engine as Add data. */
function importThrown(files:FileCase[]):GraphDocument{
  const plans:PlannedTable[]=[];
  let existing:GraphDocument|null=null;
  for(const file of files){
    if(file.name.endsWith(".json")){
      const result=readJson(file.name,file.content);
      if(result.kind==="mossline"){
        existing=parseGraphDocument(result.graph);
      }else for(const table of result.tables){
        const reading=recogniseTable(table)[0];
        assert.ok(reading?.shape,"Cannot recognise "+table.name);
        plans.push({table,shape:reading.shape,use:"records"});
      }
    }else{
      const table=readDelimited(file.name,file.content);
      const reading=recogniseTable(table)[0];
      assert.ok(reading?.shape,"Cannot recognise "+table.name);
      plans.push({table,shape:reading.shape,use:"records"});
    }
  }
  const result=applySources(plans,existing,"Throw Lab fixture");
  assert.ok(result.tables.every(t=>t.unresolvedLinks===0),
    "A link was silently discarded: "+JSON.stringify(result.tables.filter(t=>t.unresolvedLinks)));
  return result.graph;
}

for(const scenario of catalogue.cases.filter(c=>c.actualStatus==="engine-regression-added")){
  test("Throw Lab: "+scenario.id+" ("+scenario.family+")",()=>{
    const graph=importThrown(scenario.files!);
    const expected=scenario.engineExpectation!;
    assert.equal(graph.nodes.length,expected.records,"record count for "+scenario.id);
    assert.equal(graph.edges.length,expected.recordedLinks,"link count for "+scenario.id);
    const sources=new Set(scenario.files!.map(f=>f.name));
    for(const n of graph.nodes){
      assert.ok(n.origin&&n.origin.fileName&&sources.has(n.origin.fileName),
        "Missing or unknown node evidence: "+n.label);
    }
    for(const e of graph.edges){
      assert.ok(e.origin&&e.origin.fileName&&sources.has(e.origin.fileName),
        "Missing source row for link "+e.type);
      assert.ok(!e.inferred,"A source fact was treated as AI inferred");
      assert.ok(graph.nodes.some(n=>n.id===e.source)&&graph.nodes.some(n=>n.id===e.target));
    }
    if(scenario.id==="bare-links"){
      assert.ok(graph.nodes.every(n=>n.type==="other"),"bare endpoints aren't identified people or organisations");
      assert.ok(graph.nodes.every(n=>n.id.startsWith("src:mentioned:")));
    }
    if(scenario.id==="project-organisation-rows"||scenario.id==="contacts"||scenario.id==="volunteer-sessions"){
      assert.ok(graph.edges.every(e=>e.type==="listed together in source"),
        "Neighbouring columns must not imply delivery, funding or partnership");
    }
  });
}
