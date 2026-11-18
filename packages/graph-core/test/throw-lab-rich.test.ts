import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {applySources,parseGraphDocument,readDelimited,readJson,recogniseTable,
  placedCoordinates,readAtlasLocation,fundingFlows,recordedYear,type PlannedTable,type GraphDocument} from "../src/index.ts";

type RichExample={id:string;title:string;files:{name:string;path:string;rows:number}[];
 expectedRecords:number;expectedLinks:number;idealFirstView:string;stats:string;
 geography:{label:string;cities:number;countries:string[]}};
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
  assert.ok(catalogue.examples.every(x=>x.geography?.cities>=10));
  assert.ok(catalogue.examples.some(x=>x.geography.label==="United States-wide"));
  assert.ok(catalogue.examples.filter(x=>x.geography.countries.length>2).length>=4);
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
  // Test actual imported geography, not just text on a gallery card.
  {
    const positioned=graph.nodes.map(node=>({node,place:readAtlasLocation(node)}))
      .filter((entry):entry is {node:GraphDocument["nodes"][number];place:{latitude:number;longitude:number}}=>!!entry.place);
    assert.ok(positioned.length>=Math.min(150,item.expectedRecords-40),
      item.id+": its source coordinates must survive import");
    const countries=new Set(positioned.map(entry=>entry.node.properties?.Country)
      .filter((value):value is string=>typeof value==="string"));
    for(const expected of item.geography.countries)
      assert.ok(countries.has(expected),item.id+": no plotted source records in "+expected);
    const longitudes=positioned.map(entry=>entry.place.longitude);
    const span=Math.max(...longitudes)-Math.min(...longitudes);
    const required=item.id==="wildlife-sightings"||item.id==="mixed-programmes"?150:
      item.id==="arts-across-places"?25:
      item.id==="food-supply-routes"||item.id==="funding-in-motion"?40:4;
    assert.ok(span>required,item.id+": map still spans only "+span.toFixed(1)+"° of longitude");
    if(item.geography.countries.length>1&&graph.edges.length>0){
      const byId=new Map(graph.nodes.map(node=>[node.id,node]));
      const crossBorder=graph.edges.filter(edge=>{
        const from=byId.get(edge.source)?.properties?.Country;
        const to=byId.get(edge.target)?.properties?.Country;
        return typeof from==="string"&&typeof to==="string"&&from!==to;
      });
      assert.ok(crossBorder.length>15,item.id+": connections should cross country borders");
    }
  }
  if(item.id==="funding-in-motion"){
    assert.equal(fundingFlows(graph).length,720);
    assert.ok(graph.edges.every(e=>e.direction==="directed"));
    // A financial dataset need not invent map coordinates to show US coverage.
    const csv=readDelimited("awards.csv",readFileSync(resolve("apps/web/public/throw-lab/funding-in-motion/awards.csv"),"utf8"));
    const col=csv.headings.indexOf("Region"),currency=csv.headings.indexOf("Currency");
    assert.ok(new Set(csv.rows.map(r=>r[col])).size>=10,"awards must span many US cities");
    assert.ok(csv.rows.every(r=>r[currency]==="USD"),"US grant values need their correct currency");
    const recipientColumn=csv.headings.indexOf("Recipient");
    assert.ok(csv.rows.every(row=>{
      const match=row[recipientColumn]?.match(/^(.+?) [^ ]+ Project Organisation \d+$/);
      return !!match&&row[col]===match[1]+", United States";
    }),"Every grant locality must agree with the city named in its recipient");
    assert.ok(graph.nodes.filter(n=>readAtlasLocation(n)).length>=700,
      "Grant awards need meaningful US-wide mapped source positions");
  }
  if(item.id==="volunteer-calendar"){
    assert.equal(graph.edges.filter(edge=>recordedYear(edge)!==null).length,320,
      "All dated events must carry their source dates into the timeline");
    assert.equal(new Set(graph.edges.map(recordedYear)).size,4);
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
