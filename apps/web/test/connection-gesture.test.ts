import test from "node:test";
import assert from "node:assert/strict";
import {CONNECT_DRAG_THRESHOLD,movedToConnect,dragConnection} from "../src/lib/connection-gesture";

test("a normal click or slight pointer wobble is not interpreted as a new relationship",()=>{
  assert.equal(movedToConnect({x:10,y:20},{x:10,y:20}),false);
  assert.equal(movedToConnect({x:10,y:20},{x:10+CONNECT_DRAG_THRESHOLD,y:20}),false);
  assert.equal(movedToConnect({x:10,y:20},{x:18,y:20}),true);
  assert.equal(dragConnection("a","b",false,true),null);
  assert.equal(dragConnection("a","b",true,false),null);
});
test("only distinct endpoints in Connect mode can propose a link",()=>{
  assert.equal(dragConnection("a","a",true,true),null);
  assert.equal(dragConnection("a",null,true,true),null);
  assert.deepEqual(dragConnection("a","b",true,true),{from:"a",to:"b"});
});
