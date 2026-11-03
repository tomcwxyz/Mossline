#!/usr/bin/env node
/**
 * Runs before `next build`. On a Vercel production build it applies pending
 * migrations, and a failed migration fails the build, so the new code never
 * goes live without the tables it needs (the previous deployment stays up).
 * Migrations only ever add things, so the code that's live keeps working
 * while they run. Everywhere else it does nothing. See docs/OPERATING.md.
 */
import {spawnSync} from "node:child_process";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {deployMigrationPlan} from "./deploy-migrations.mjs";

const plan=deployMigrationPlan(process.env);
console.log("[mossline] "+plan.reason);
if(plan.run){
  const runner=join(dirname(fileURLToPath(import.meta.url)),"migrate.mjs");
  const result=spawnSync(process.execPath,[runner],{stdio:"inherit",env:{...process.env,MOSSLINE_DATABASE_URL:plan.url}});
  if(result.status!==0){
    console.error("[mossline] The database migration failed, so this build stops here. The live site is unchanged.");
    process.exit(result.status||1);
  }
}
