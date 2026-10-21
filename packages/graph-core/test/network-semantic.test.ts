import test from "node:test";
import assert from "node:assert/strict";
import {parseGraphDocument} from "../src/schema.ts";
import {prepareNetworkSemanticDocuments,rankNetworkSemanticHits,
 sourceRelationsAmong} from "../src/network-semantic.ts";
const graph=parseGraphDocument({version:1,title:"Mixed",description:"",
 nodes:[{id:"o",label:"Community food",type:"organisation",tags:["Food justice"],
   description:"Provides fresh meals",properties:{telephone:"DO NOT TRANSMIT",amount:500}},
  {id:"f",label:"Trust",type:"funder",tags:[]},
  {id:"s",label:"Private",type:"person",tags:[],properties:{visibility:"private"}},
  {id:"r",label:"Restricted",type:"project",tags:[],properties:{public:false}}],
 edges:[{id:"e",source:"f",target:"o",type:"funds"},
   {id:"e2",source:"o",target:"s",type:"inferred",inferred:true}]});
test("generic semantic preparation considers every public entity without raw properties",()=>{
 const docs=prepareNetworkSemanticDocuments(graph);
 assert.equal(docs.totalNodes,4);assert.equal(docs.excludedPrivate,2);
 assert.deepEqual(docs.documents.map(x=>x.id),["o","f"]);
 assert.equal(JSON.stringify(docs).includes("DO NOT TRANSMIT"),false);
 assert.equal(JSON.stringify(docs).includes("500"),false);
});
test("semantic hits are scores only and never create edges",()=>{
 const docs=prepareNetworkSemanticDocuments(graph).documents;
 const copy=JSON.stringify(graph);
 const hits=rankNetworkSemanticHits(docs,[[1,0],[0,1]],[1,0]);
 assert.equal(hits[0].id,"o");assert.equal(hits[0].score,1);
 assert.equal(JSON.stringify(graph),copy);
 assert.throws(()=>rankNetworkSemanticHits(docs,[[1],[1]],[1,0]),/dimensions/);
});
test("citations include only original edges connecting retrieved records",()=>{
 const all=sourceRelationsAmong(graph,["o","f"]);
 assert.deepEqual(all.map(x=>x.id),["e"]);
 assert.equal(all[0].inferred,false);
 assert.equal(sourceRelationsAmong(graph,["o","s"])[0].inferred,true);
});
