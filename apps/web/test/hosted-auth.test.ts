import test from "node:test";
import assert from "node:assert/strict";
import {makePublicationId,hashManagementKey,validPublicationId,readJsonBody,
  mayPublish,publisherRules,isHostedConfigured,signInMethods,sameOrigin,dailyPublishLimit} from "../src/lib/hosted-auth";

test("public IDs are random and old management keys are only ever compared by hash",()=>{
 const slug=makePublicationId();
 assert.equal(validPublicationId(slug),true);
 assert.notEqual(makePublicationId(),slug);
 assert.equal(hashManagementKey("x".repeat(43)).length,64);
 assert.equal(validPublicationId("../private"),false);
});

test("publishers are named addresses, whole domains or everyone",()=>{
 const rules=publisherRules({MOSSLINE_PUBLISHERS:" Tom@Example.org, @good.org.uk ,"});
 assert.deepEqual(rules,["tom@example.org","@good.org.uk"]);
 assert.equal(mayPublish("TOM@example.org",rules),true);
 assert.equal(mayPublish("sam@good.org.uk",rules),true);
 assert.equal(mayPublish("sam@notgood.org.uk",rules),false);
 assert.equal(mayPublish("sam@sub.good.org.uk",rules),false);
 assert.equal(mayPublish("someone@example.org",rules),false);
 assert.equal(mayPublish("@good.org.uk",rules),false);
 assert.equal(mayPublish(null,rules),false);
 assert.equal(mayPublish("anyone@anywhere.net",["*"]),true);
 assert.equal(mayPublish("anyone@anywhere.net",[]),false);
});

test("hosted publishing stays off until every part is configured",()=>{
 const full={MOSSLINE_HOSTED_PUBLISHING_ENABLED:"true",MOSSLINE_DATABASE_URL:"postgres://x",
  MOSSLINE_AUTH_SECRET:"s".repeat(32),MOSSLINE_BASE_URL:"https://mossline.example",
  MOSSLINE_PUBLISHERS:"@example.org",MOSSLINE_EMAIL_FROM:"maps@example.org",MOSSLINE_SMTP_URL:"smtps://u:p@mail.example"};
 assert.equal(isHostedConfigured(full),true);
 assert.deepEqual(signInMethods(full),{microsoft:false,google:false,email:true});
 for(const key of ["MOSSLINE_HOSTED_PUBLISHING_ENABLED","MOSSLINE_DATABASE_URL","MOSSLINE_BASE_URL","MOSSLINE_PUBLISHERS","MOSSLINE_SMTP_URL"])
  assert.equal(isHostedConfigured({...full,[key]:""}),false,key);
 assert.equal(isHostedConfigured({...full,MOSSLINE_AUTH_SECRET:"short"}),false);
 assert.equal(isHostedConfigured({...full,MOSSLINE_SMTP_URL:"",MOSSLINE_GOOGLE_CLIENT_ID:"id",MOSSLINE_GOOGLE_CLIENT_SECRET:"secret"}),true);
 assert.equal(dailyPublishLimit({}),20);
 assert.equal(dailyPublishLimit({MOSSLINE_PUBLISH_DAILY_LIMIT:"3"}),3);
});

test("changes are accepted only from Mossline's own pages",()=>{
 const from=(origin?:string)=>new Request("https://mossline.example/api/publications",
  {method:"POST",headers:origin?{origin}:{}});
 assert.equal(sameOrigin(from("https://mossline.example")),true);
 assert.equal(sameOrigin(from("https://evil.example")),false);
 assert.equal(sameOrigin(from()),false);
 assert.equal(sameOrigin(new Request("http://10.0.0.1/api/publications",{method:"POST",headers:{origin:"https://mossline.example"}}),
  "https://mossline.example"),true);
});

test("bounded JSON reader rejects oversized uploads",async()=>{
 const body=JSON.stringify({hello:"world"});
 assert.deepEqual(await readJsonBody(new Request("https://example.org",
   {method:"POST",body}),100),{hello:"world"});
 await assert.rejects(readJsonBody(new Request("https://example.org",
   {method:"POST",body}),2),/maximum request/);
});
