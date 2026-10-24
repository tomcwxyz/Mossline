import assert from "node:assert/strict";
import test from "node:test";
import {
  atlasFundingOverlap, confirmInferredRelationship, emptyAnnotationLayer,
  graphWithAnnotations, parseAnnotationLayer, projectAtlas,
  recordedCoordinates, recordedDegree, recordedTimeline,
  traceRecordedConnection, type GraphDocument
} from "../src/index";

const source:GraphDocument={
  version:1,title:"Atlas test",description:"",
  nodes:[
    {id:"f",type:"funder",label:"Fellside",tags:[]},
    {id:"p",type:"project",label:"Garden",tags:["Nature"],properties:{"Atlas location":"54.5,-1.5"}},
    {id:"a",type:"organisation",label:"Community",tags:["Nature"],region:"North East"},
    {id:"b",type:"organisation",label:"Other",tags:[]}
  ],
  edges:[
    {id:"fund",source:"f",target:"p",type:"funds",properties:{awardDate:"2023-05-02"}},
    {id:"delivers",source:"a",target:"p",type:"delivers",properties:{year:"2024"}},
    {id:"assoc",source:"a",target:"b",type:"possible association",inferred:true,evidenceNodeIds:["p"]}
  ]
};

test("atlas totals and routes never count inferred suggestions",()=>{
  const all=projectAtlas(source,{});
  assert.equal(all.recordedCount,2);
  assert.equal(all.inferredCount,1);
  assert.equal(recordedDegree(source,"a"),1);
  assert.equal(traceRecordedConnection(source,"a","b",5),null);
  assert.equal(atlasFundingOverlap(source)[0].grantLinks,1);
});
test("filters preserve provenance and expose counts excluded by date",()=>{
  const filtered=projectAtlas(source,{fromYear:2023,toYear:2023});
  assert.deepEqual(filtered.graph.edges.map(e=>e.id),["fund"]);
  assert.equal(filtered.hiddenEdges,2);
  assert.equal(filtered.graph.nodes.length,2);
  assert.equal(source.edges.length,3);
});
test("map uses coordinates supplied by sources and never guesses from place names",()=>{
  assert.deepEqual(recordedCoordinates(source.nodes[1]),{lat:54.5,lon:-1.5});
  assert.equal(recordedCoordinates(source.nodes[2]),null);
});
test("timeline groups dated and unknown recorded links only",()=>{
  assert.deepEqual(recordedTimeline(source),[
    {year:2023,count:1},{year:2024,count:1}
  ]);
});
test("a pencil item becomes ink only through a reviewer annotation",()=>{
  const layer=emptyAnnotationLayer("test-map");
  assert.throws(()=>confirmInferredRelationship(source,layer,"assoc",{
    relationship:"partnership",reviewer:"AB",reason:"short",now:"2026-10-24T10:00:00.000Z"
  }));
  const confirmed=confirmInferredRelationship(source,layer,"assoc",{
    relationship:"partnership",reviewer:"AB",
    reason:"Partners confirmed this relationship in writing.",
    now:"2026-10-24T10:00:00.000Z"
  });
  const projected=graphWithAnnotations(source,confirmed);
  assert.equal(projected.edges.length,3);
  assert.equal(projected.edges.filter(e=>e.inferred).length,0);
  assert.equal(projected.edges.find(e=>e.type==="partnership")?.origin?.system,"annotation");
  assert.equal(source.edges[2].inferred,true);
  assert.equal(traceRecordedConnection(projected,"a","b",5)?.steps.length,1);
  assert.throws(()=>confirmInferredRelationship(source,confirmed,"assoc",{
    relationship:"partnership",reviewer:"AB",reason:"One more confirmation reason.",
    now:"2026-10-24T10:00:00.000Z"
  }));
  assert.equal(parseAnnotationLayer(confirmed,"another-graph").entries.length,0);
});
