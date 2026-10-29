import test from "node:test";
import assert from "node:assert/strict";
import {deployMigrationPlan} from "../scripts/deploy-migrations.mjs";

type Plan={run:boolean;url?:string;reason:string};
const plan=(env:Record<string,string>)=>deployMigrationPlan(env) as Plan;
const db={MOSSLINE_DATABASE_URL:"postgres://example.invalid/prod"};

test("only a Vercel production build migrates, by default",()=>{
  assert.equal(plan({...db}).run,false);
  assert.equal(plan({...db,VERCEL:"1",VERCEL_ENV:"preview"}).run,false);
  assert.equal(plan({...db,VERCEL:"1",VERCEL_ENV:"development"}).run,false);
  const prod=plan({...db,VERCEL:"1",VERCEL_ENV:"production"});
  assert.equal(prod.run,true);
  assert.equal(prod.url,db.MOSSLINE_DATABASE_URL);
});

test("previews migrate only when they have a database of their own, and it can be switched off",()=>{
  assert.equal(plan({...db,VERCEL:"1",VERCEL_ENV:"preview",MOSSLINE_MIGRATE_PREVIEWS:"true"}).run,true);
  assert.equal(plan({...db,VERCEL:"1",VERCEL_ENV:"production",MOSSLINE_MIGRATE_ON_DEPLOY:"false"}).run,false);
  assert.match(plan({VERCEL:"1",VERCEL_ENV:"production"}).reason,/No database/);
});

test("a direct connection for migrations is preferred over the pooled one",()=>{
  const p=plan({...db,VERCEL:"1",VERCEL_ENV:"production",MOSSLINE_MIGRATION_DATABASE_URL:"postgres://example.invalid/direct"});
  assert.equal(p.url,"postgres://example.invalid/direct");
});
