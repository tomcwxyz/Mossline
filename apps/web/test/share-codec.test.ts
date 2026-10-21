import test from "node:test";
import assert from "node:assert/strict";
import {parseGraphDocument,createPublishedSnapshot} from "@mossline/graph-core";
import {decodeShareSnapshot,encodeShareSnapshot,MAX_FRAGMENT_LENGTH}
  from "../src/lib/share-codec";

const source=parseGraphDocument({version:1,title:"Fictional example",
  nodes:[{id:"a",label:"Neighbourhood Hub",type:"organisation",properties:{secret:"not in link"}},
    {id:"b",label:"Community Workshop",type:"project"}],
  edges:[{id:"ab",source:"a",target:"b",type:"runs",direction:"directed"}]});
const setting={title:"Shared map",view:"landscape" as const,layout:"organic" as const,
  labels:"essential" as const,illustrated:false,includeDescriptions:false,
  includeImages:false,positions:{a:{x:55,y:75}}};

test("gzip fragment round-trips a real snapshot without the working source data",async()=>{
  const published=createPublishedSnapshot(source,setting,new Date("2026-10-21T00:00:00Z"));
  const encoded=await encodeShareSnapshot(published);
  assert.match(encoded,/^[A-Za-z0-9_-]+$/);
  assert.ok(encoded.length<MAX_FRAGMENT_LENGTH);
  const decoded=await decodeShareSnapshot(encoded);
  assert.deepEqual(decoded,published);
  assert.equal(JSON.stringify(decoded).includes("not in link"),false);
});
test("reject broken, suspicious and oversized fragments before attempting to render",async()=>{
  await assert.rejects(decodeShareSnapshot(""),/too large|missing/);
  await assert.rejects(decodeShareSnapshot("!".repeat(5)),/too large|missing/);
  await assert.rejects(decodeShareSnapshot("a".repeat(MAX_FRAGMENT_LENGTH+1)),/too large|missing/);
  await assert.rejects(decodeShareSnapshot("abcdefg"));
});
