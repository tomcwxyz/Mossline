import test from "node:test";
import assert from "node:assert/strict";
import {canvasPixelRatio,pointDiameterPixels} from "../src/render-resolution.ts";

test("high-resolution atlas rendering uses enough pixels while bounding GPU load",()=>{
 assert.equal(canvasPixelRatio(1000,650,1),1.5,
   "A standard-resolution desktop gets modest supersampling");
 assert.equal(canvasPixelRatio(1000,650,2),2);
 assert.equal(canvasPixelRatio(380,720,3),2.5);
 const scale=canvasPixelRatio(2500,1600,3);
 assert.ok(scale<=2.5&&scale>=1);
 assert.ok(2500*1600*scale*scale<=4_200_000+1);
});
test("pixel ratio is bounded for invalid and unusually large viewports",()=>{
 for(const value of [0,-1,Infinity,NaN]){
   const ratio=canvasPixelRatio(980,560,value);
   assert.ok(Number.isFinite(ratio)&&ratio>=1&&ratio<=2.5);
 }
 assert.equal(canvasPixelRatio(20000,20000,3),1);
});
test("WebGL points grow proportionally with DPR without exceeding CSS size bounds",()=>{
 assert.equal(pointDiameterPixels(8,1),8);
 assert.equal(pointDiameterPixels(8,2),16);
 assert.equal(pointDiameterPixels(8,2.5),20);
 assert.equal(pointDiameterPixels(0,2),4);
 assert.equal(pointDiameterPixels(500,2),48);
 assert.equal(pointDiameterPixels(12,NaN),12);
});
