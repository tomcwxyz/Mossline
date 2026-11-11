import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {applySources,parseGraphDocument,readDelimited,readJson,recogniseTable,
  placedCoordinates,fundingFlows,type PlannedTable,type GraphDocument} from "../src/index.ts";

type RichExample={id:string;title:string;files:{name:string;path:string;rows:number}[];
 expectedRecords:number;expectedLinks:number;idealFirstView:string;stats:string};
const catalogue=JSON.parse(readFileSync(resolve("data/throw-lab/rich-catalogue.json"),"utf8")) as
  {version:number;examples:RichExample[]};

function interpret(item:RichExample){
  const plans:PlannedTable[]=[];
  let base:GraphDocument|null=null;
  for(const f of item.files){
    const contents=readFileSync(resolve("apps/web/public"+f.path),"utf8");
    if(f.name.endsWith(".json")){
      const parsed=readJson(f.name,contents);
      if(parsed.kind==="mossline")base=parseGraphDocument(parsed.graph);
      else for(const table of parsed.tables){
        assert.equal(table.rows.length,f.rows,item.id+": JSON rows "+f.name);
        plans.push({table,shape:recogniseTable(table)[0]!.shape,use:"records"});
      }
    }else{
      const table=readDelimited(f.name,contents);
      assert.equal(table.rows.length,f.rows,item.id+": CSV rows "+f.name);
      plans.push({table,shape:recogniseTable(table)[0]!.shape,use:"records"});
    }
  }
  return applySources(plans,base,item.title);
}

test("Throw Lab has eight genuinely rich, separate raw-data examples",()=>{
  assert.equal(catalogue.version,1);
  assert.equal(catalogue.examples.length,8);
  assert.equal(new Set(catalogue.examples.map(x=>x.id)).size,8);
  assert.ok(catalogue.examples.every(x=>x.files.length>0&&x.idealFirstView&&x.stats));
  assert.ok(catalogue.examples.every(x=>x.files.reduce((n,f)=>n+f.rows,0)>=190));
});

for(const item of catalogue.examples)test("Rich Throw Lab: "+item.id,()=>{
  const result=interpret(item),graph=result.graph;
  assert.equal(graph.nodes.length,item.expectedRecords,
    "Actual imported records must match the published sample count");
  assert.equal(graph.edges.length,item.expectedLinks,
    "Actual imported links must match the published sample count");
  assert.ok(result.tables.every(t=>t.unresolvedLinks===0),
    item.id+" has source records that could not be linked: "+
      result.tables.filter(t=>t.unresolvedLinks>0).map(t=>t.table+": "+t.unresolvedLinks).join(", "));
  assert.ok(graph.nodes.every(node=>node.origin?.fileName&&node.receipts?.length),
    "Every record needs its source receipt");
  assert.ok(graph.edges.every(edge=>!edge.inferred&&edge.origin?.fileName),
    "Every rendered link must be a recorded source fact with a receipt");
  assert.ok(graph.nodes.length>=150);
  if(item.id==="neighbourhood-connections"||item.id==="arts-across-places"||
    item.id==="food-supply-routes"){
    assert.ok(graph.nodes.filter(node=>placedCoordinates(node)).length>=145);
    const located=new Set(graph.nodes.filter(n=>placedCoordinates(n)).map(n=>n.id));
    assert.ok(graph.edges.filter(e=>located.has(e.source)&&located.has(e.target)).length>=150,
      "Geographic networks need source-recorded connections, not just pins");
  }
  if(item.id==="funding-in-motion"){
    assert.equal(fundingFlows(graph).length,720);
    assert.ok(graph.edges.every(e=>e.direction==="directed"));
  }
  if(item.id==="wildlife-sightings"){
    assert.equal(graph.edges.length,0,"observation lists must not generate fake relationships");
    assert.equal(graph.nodes.filter(n=>placedCoordinates(n)).length,510);
    assert.ok(new Set(graph.nodes.flatMap(n=>n.tags)).size>=6);
  }
  if(item.id==="themes-in-common"){
    assert.equal(graph.edges.length,0,"shared tags must not generate invented partnerships");
    assert.ok(new Set(graph.nodes.flatMap(n=>n.tags)).size>=8);
  }
  if(item.id==="mixed-programmes"){
    assert.ok(new Set(graph.nodes.flatMap(n=>(n.receipts??[]).map(r=>r.fileName))).size>=2,
      "Mixed examples must actually contain sources from distinct formats");
  }
});
