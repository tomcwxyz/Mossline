/**
 * Whether a build should migrate the database, and which one. Kept apart
 * from the runner so it can be tested without a database.
 *
 * On Vercel, a production build migrates the production database before the
 * new code goes live. Preview builds don't, unless MOSSLINE_MIGRATE_PREVIEWS
 * is true (for previews with a database of their own, such as a Neon branch),
 * because a preview usually shares production's database and its migrations
 * may never be merged. Builds anywhere else (a laptop, CI) never migrate.
 */
export function deployMigrationPlan(env){
  if(env.VERCEL!=="1")return {run:false,reason:"Not a Vercel build: database left alone."};
  if(/^(false|0|no|off)$/i.test(env.MOSSLINE_MIGRATE_ON_DEPLOY??""))
    return {run:false,reason:"MOSSLINE_MIGRATE_ON_DEPLOY is off: database left alone. Run npm run db:migrate yourself before deploying."};
  const target=env.VERCEL_ENV??"";
  if(target!=="production"&&!(target==="preview"&&env.MOSSLINE_MIGRATE_PREVIEWS==="true"))
    return {run:false,reason:"A "+(target||"non-production")+" build: database left alone. Set MOSSLINE_MIGRATE_PREVIEWS=true if previews have their own database."};
  // A direct (unpooled) connection is better for migrations where there is one.
  const url=env.MOSSLINE_MIGRATION_DATABASE_URL||env.MOSSLINE_DATABASE_URL;
  if(!url)return {run:false,reason:"No database is configured, so there's nothing to migrate."};
  return {run:true,url,reason:"Migrating the "+target+" database before this build goes live."};
}
