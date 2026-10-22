import test from "node:test";
import assert from "node:assert/strict";
import {buildSmoothStrokeVertices,prominentNetworkIndices,STROKE_STRIDE}
 from "../src/graph-render-geometry.ts";

test("antialiased line mesh preserves original segment endpoints and edge count",()=>{
 const source=new Float32Array([0,0,10,10,10,10,20,0]);
 const original=source.slice();
 const mesh=buildSmoothStrokeVertices(source);
 assert.equal(mesh.length,2*4*6*STROKE_STRIDE);
 for(let i=0;i<mesh.length;i+=STROKE_STRIDE){
   assert.ok(Number.isFinite(mesh[i]));
   assert.equal(mesh[i]%10,0);
   assert.ok(mesh[i+4]>=0&&mesh[i+4]<=1);
   assert.ok(Math.abs(mesh[i+5])===1);
   assert.ok(Math.abs(mesh[i+6])===1);
 }
 assert.deepEqual(source,original);
 const sourceEdges=Uint32Array.of(7,8);
 const focus=buildSmoothStrokeVertices(source,sourceEdges);
 assert.equal(focus.length,mesh.length);
 assert.ok(focus.every(Number.isFinite));
 assert.notDeepEqual(focus,mesh,"Curve parity follows actual source edge IDs");
});
test("parallel, degenerate and isolated source records cannot create relationships",()=>{
 const strokes=new Float32Array([
   0,0,10,10,0,0,10,10,0,0,0,0
 ]);
 const mesh=buildSmoothStrokeVertices(strokes);
 assert.equal(mesh.length,2*4*6*STROKE_STRIDE);
 assert.deepEqual(buildSmoothStrokeVertices(new Float32Array()),new Float32Array());
 assert.throws(()=>buildSmoothStrokeVertices(new Float32Array([0,1,2])));
 assert.throws(()=>buildSmoothStrokeVertices(strokes,new Uint32Array([1,2])));
});
test("all dense source edges remain in bounded memory with fewer curve segments",()=>{
 const count=12000;
 const strokes=new Float32Array(count*4);
 for(let i=0;i<count;i++){
   strokes[4*i]=i;strokes[4*i+1]=2;
   strokes[4*i+2]=i+1;strokes[4*i+3]=4;
 }
 const mesh=buildSmoothStrokeVertices(strokes);
 assert.equal(mesh.length,count*3*6*STROKE_STRIDE);
 assert.ok(mesh.every(Number.isFinite));
});
test("prominent hubs reflect recorded degrees and never promote isolated nodes",()=>{
 const degrees=Uint32Array.from([14,1,0,4,12,0,3,1,1,1,1]);
 assert.deepEqual([...prominentNetworkIndices(degrees)],[0,4]);
 assert.deepEqual([...prominentNetworkIndices(new Uint32Array(2048))],[]);
 assert.deepEqual([...prominentNetworkIndices(Uint32Array.from(
   Array.from({length:100},()=>5)))],[]);
 const before=degrees.slice();
 prominentNetworkIndices(degrees);
 assert.deepEqual(degrees,before,"Prominence must not mutate source degrees");
});
