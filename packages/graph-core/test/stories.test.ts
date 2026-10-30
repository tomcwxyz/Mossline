import test from "node:test";
import assert from "node:assert/strict";
import {newStory,newStep,parseStory,parseGraphDocument,storyProblems,storyTextToHtml,stepRecords,describeStep,createPublishedSnapshot,parseHostedSnapshot,parsePublishedSnapshot,HOSTED_LIMITS} from "../src/index.ts";

const graph=parseGraphDocument({version:1,title:"Map",nodes:[{id:"a",label:"Allotments",type:"project"},{id:"b",label:"Food bank",type:"organisation"}],edges:[]});

test("a story is steps of views, words, media and marks, and round-trips",()=>{
  const story=newStory("How food moves");
  const step=newStep({lens:"network",record:"a"},"Where it starts");
  step.text="Growing **together**.";
  step.media.push({id:"m1",kind:"image",src:"https://example.org/plot.jpg",alt:"Raised beds",people:"none"});
  step.marks.push({id:"k1",kind:"arrow",targets:["a","b"],text:"surplus"},{id:"k2",kind:"number",targets:["b"],n:2});
  story.steps.push(step);
  const again=parseStory(JSON.parse(JSON.stringify(story)));
  assert.deepEqual(again,story);
  assert.deepEqual(stepRecords(step).sort(),["a","b"]);
  assert.throws(()=>parseStory({...story,steps:[{...step,marks:[{id:"x",kind:"arrow",targets:["a"]}]}]}));
  assert.throws(()=>parseStory({...story,steps:[{...step,media:[{id:"x",kind:"image",src:"javascript:alert(1)",alt:"x",people:"none"}]}]}));
  assert.throws(()=>parseStory({...story,steps:[{...step,view:{lens:"network",script:"x"}}]}));
});

test("accessibility and consent stop publishing; missing credits and records are notes",()=>{
  const story=newStory("Checks");
  assert.equal(storyProblems(story)[0].severity,"block");
  const step=newStep({lens:"network",record:"gone"});
  step.media.push({id:"i",kind:"image",src:"data:image/jpeg;base64,AAAA",alt:"",people:"unknown"},
    {id:"q",kind:"quote",text:"We share what we grow.",who:"Sam",consent:false});
  story.steps.push(step);
  const problems=storyProblems(story,graph);
  const blocks=problems.filter(p=>p.severity==="block").map(p=>p.message).join(" | ");
  assert.match(blocks,/description/); assert.match(blocks,/recognisable people/); assert.match(blocks,/Sam agreed to be quoted/);
  assert.ok(problems.some(p=>p.severity==="note"&&/isn't in the map/.test(p.message)));
  step.media=[{id:"i",kind:"image",src:"data:image/jpeg;base64,AAAA",alt:"Plot",people:"consented",credit:"Ash"},
    {id:"q",kind:"quote",text:"We share.",who:"Sam",consent:true}];
  step.view={lens:"network",record:"a"};
  step.title="Start";
  assert.deepEqual(storyProblems(story,graph),[]);
});

test("story text allows a little formatting and nothing that runs",()=>{
  assert.equal(storyTextToHtml("One **two** *three*\nfour\n\n[Link](https://example.org)"),
    '<p>One <strong>two</strong> <em>three</em><br>four</p><p><a href="https://example.org" target="_blank" rel="noopener noreferrer">Link</a></p>');
  assert.equal(storyTextToHtml("<script>alert(1)</script> [x](javascript:alert(1))"),
    "<p>&lt;script&gt;alert(1)&lt;/script&gt; [x](javascript:alert(1))</p>");
  assert.equal(storyTextToHtml('[a](https://x.org" onmouseover="y)'),"<p>[a](https://x.org&quot; onmouseover=&quot;y)</p>");
});

test("only server copies of a published map carry a story", () => {
  const graph = parseGraphDocument({ version: 1, title: "t", nodes: [{ id: "a", label: "Alder Hub", type: "organisation" }], edges: [] });
  const snapshot = createPublishedSnapshot(graph, { view: "landscape", layout: "organic", labels: "essential", illustrated: false,
    title: "Map", includeDescriptions: false, includeImages: false }, new Date("2026-10-29T00:00:00Z"), HOSTED_LIMITS);
  const story = { ...newStory("Walkthrough", new Date("2026-10-29T00:00:00Z")), steps: [newStep({ lens: "network", record: "a" }, "Start")] };
  assert.equal(parseHostedSnapshot({ ...snapshot, story }).story?.steps[0].title, "Start");
  assert.throws(() => parsePublishedSnapshot({ ...snapshot, story }));
});

test("a step's marks and pinned pictures can be read out in words",()=>{
  const step=newStep({lens:"network"},"Here");
  step.marks.push({id:"r",kind:"ring",targets:["a","b"],text:"growers"},{id:"c",kind:"callout",targets:["b"],text:"busy"},
    {id:"w",kind:"arrow",targets:["a","b"]},{id:"n",kind:"number",targets:["a"],n:1});
  step.media.push({id:"i",kind:"image",src:"https://example.org/x.jpg",alt:"Raised beds",people:"none",record:"a"});
  const names:Record<string,string>={a:"Allotments",b:"Food bank"};
  assert.equal(describeStep(step,id=>names[id]),"On the map: a ring around Allotments and Food bank labelled “growers”; a note on Food bank: “busy”; "+
    "an arrow from Allotments to Food bank; number 1 on Allotments; a picture beside Allotments (Raised beds).");
  assert.equal(describeStep(newStep({lens:"map"}),id=>id),"");
});

test("a cover picture is held to the same standard as any other",()=>{
  const story={...newStory("With a cover"),steps:[newStep({lens:"network"},"One")],
    cover:{src:"https://example.org/cover.jpg",alt:"",people:"unknown" as "none"|"consented"|"unknown"}};
  const messages=storyProblems(parseStory(story)).filter(p=>p.severity==="block").map(p=>p.message);
  assert.equal(messages.length,2);
  assert.match(messages[0],/cover picture needs a description/);
  story.cover={...story.cover,alt:"A field",people:"none"};
  assert.equal(storyProblems(parseStory(story)).filter(p=>p.severity==="block").length,0);
  assert.throws(()=>parseStory({...story,cover:{...story.cover,src:"http://example.org/insecure.jpg"}}));
});

test("an audio clip needs a transcript and the agreement of the people heard",()=>{
  const step=newStep({lens:"network"},"Listen");
  step.media.push({id:"au",kind:"audio",src:"data:audio/webm;codecs=opus;base64,GkXfo0AgQoaBAUL3gQFC8oEEQvOBCEKC",transcript:"",who:"",consent:false});
  const story=parseStory({...newStory("Voices"),steps:[step]});
  const blocks=storyProblems(story).filter(p=>p.severity==="block").map(p=>p.message);
  assert.deepEqual(blocks,["Step 1: an audio clip needs a transcript, for people who can't hear it.","Step 1: confirm the people heard agreed to the recording being used."]);
  assert.throws(()=>parseStory({...story,steps:[{...step,media:[{...step.media[0],src:"data:text/html;base64,PHNjcmlwdD4="}]}]}));
  assert.throws(()=>parseStory({...story,steps:[{...step,media:[{...step.media[0],src:"http://example.org/a.mp3"}]}]}));
});
