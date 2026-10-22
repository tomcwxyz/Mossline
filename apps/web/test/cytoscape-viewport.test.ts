import test from "node:test";
import assert from "node:assert/strict";
import {nextViewportZoom,centreViewportPan,VIEWPORT_BUTTON_ZOOM_FACTOR}
  from "../src/lib/cytoscape-viewport";

test("zoom controls respect each renderer's bounds and remain reversible",()=>{
  const up=nextViewportZoom(1,VIEWPORT_BUTTON_ZOOM_FACTOR,0.18,3.5);
  assert.ok(up>1);
  assert.ok(Math.abs(nextViewportZoom(up,1/VIEWPORT_BUTTON_ZOOM_FACTOR,0.18,3.5)-1)<1e-9);
  assert.equal(nextViewportZoom(3.4,2,0.18,3.5),3.5);
  assert.equal(nextViewportZoom(0.19,0.1,0.18,3.5),0.18);
  assert.equal(nextViewportZoom(1,0.01,0.15,4),0.15);
});
test("centre selected node using rendered viewport coordinates",()=>{
  assert.deepEqual(centreViewportPan({x:20,y:30},1000,600,2),{
    x:460,y:240
  });
  assert.deepEqual(centreViewportPan({x:0,y:0},400,300,1),{
    x:200,y:150
  });
});
test("invalid zoom levels are rejected, not passed to Cytoscape",()=>{
  for(const factor of [0,-1,NaN,Infinity]){
    assert.throws(()=>nextViewportZoom(1,factor,0.15,4));
  }
  assert.throws(()=>nextViewportZoom(1,1.2,5,4));
  assert.throws(()=>nextViewportZoom(NaN,1.2,0.15,4));
});
