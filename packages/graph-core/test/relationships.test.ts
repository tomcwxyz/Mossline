import test from "node:test";
import assert from "node:assert/strict";
import { collaborationGraph, explainRelationship, parseGraphDocument } from "../src/index.ts";

const graph = parseGraphDocument({ version:1, title:"Evidence tests",
  nodes:[
    {id:"a",label:"A",type:"organisation"}, {id:"b",label:"B",type:"organisation"},
    {id:"p",label:"Project",type:"project"}, {id:"q",label:"Second project",type:"project"},
    {id:"f",label:"Funder",type:"funder"}],
  edges:[
    {id:"ap",source:"a",target:"p",type:"delivers"},
    {id:"bp",source:"b",target:"p",type:"supports"},
    {id:"af",source:"f",target:"p",type:"funds"},
    {id:"bq",source:"b",target:"q",type:"supports"},
    {id:"qf",source:"f",target:"q",type:"funds"}]
});

test("recorded relationship remains a source record rather than verified evidence",()=>{
  const explained=explainRelationship(graph,graph.edges[0]);
  assert.equal(explained.status,"recorded");
  assert.equal(explained.record?.id,"ap");
  assert.deepEqual(explained.supports,[]);
  assert.match(explained.summary,/not independently verified/i);
});

test("shared project association has genuine links to each endpoint",()=>{
  const edge=collaborationGraph(graph,"project").edges.find(e=>e.inferred);
  assert.ok(edge);
  const explained=explainRelationship(graph,edge);
  assert.equal(explained.status,"inferred");
  const via=explained.supports.find(s=>s.nodeId==="p");
  assert.deepEqual(via?.fromSource,{nodeIds:["a","p"],edgeIds:["ap"]});
  assert.deepEqual(via?.fromTarget,{nodeIds:["b","p"],edgeIds:["bp"]});
  assert.match(explained.summary,/not proof/i);
  assert.equal(explained.record,null);
});

test("shared funder can be supported through separate recorded projects",()=>{
  const edge=collaborationGraph(graph,"funder").edges.find(e=>e.inferred);
  assert.ok(edge);
  const explained=explainRelationship(graph,edge);
  const via=explained.supports.find(s=>s.nodeId==="f");
  assert.deepEqual(via?.fromSource?.nodeIds,["a","p","f"]);
  assert.deepEqual(via?.fromTarget?.nodeIds,["b","p","f"]);
  assert.deepEqual(via?.fromSource?.edgeIds,["ap","af"]);
});

test("missing paths are shown as missing, not invented",()=>{
  const orphan= { id:"inferred:test",source:"a",target:"b",type:"association",
    inferred:true,evidenceNodeIds:["q"] };
  const explained=explainRelationship(graph,orphan);
  assert.equal(explained.supports[0]?.fromSource,null);
  assert.deepEqual(explained.supports[0]?.fromTarget?.edgeIds,["bq"]);
});

test("unsupported evidence refs do not result in fabricated support",()=>{
  const explained=explainRelationship(graph,{id:"other",source:"a",target:"b",
    type:"association",inferred:true,evidenceNodeIds:["absent"]});
  assert.deepEqual(explained.supports,[]);
});
