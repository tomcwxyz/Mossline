import {Pool} from "pg";

/**
 * One small Postgres pool for accounts and publications. Plain Postgres, so
 * Mossline runs on any provider (Neon, Supabase, a server you run yourself).
 * Add `sslmode=require` to the connection string for hosted databases.
 */
const globalPool=globalThis as unknown as {__mosslinePool?:Pool};
export function pool():Pool{
  if(!process.env.MOSSLINE_DATABASE_URL)throw Error("No database configured");
  globalPool.__mosslinePool??=new Pool({
    connectionString:process.env.MOSSLINE_DATABASE_URL,
    max:Number(process.env.MOSSLINE_DATABASE_POOL_MAX)||5,
    idleTimeoutMillis:10_000,
    connectionTimeoutMillis:8_000
  });
  return globalPool.__mosslinePool;
}
