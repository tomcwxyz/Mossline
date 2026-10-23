import {createNeonAuth} from "@neondatabase/auth/next/server";

/** All private-network handlers fail closed until auth, SQL and an explicit
 * deployment flag have been configured. Public publication keys never qualify.
 */
export function privateWorkspacesEnabled():boolean{
  return process.env.MOSSLINE_PRIVATE_WORKSPACES_ENABLED==="true" &&
    !!process.env.MOSSLINE_DATABASE_URL &&
    !!process.env.NEON_AUTH_BASE_URL &&
    (process.env.NEON_AUTH_COOKIE_SECRET?.length??0)>=32;
}
let cached:ReturnType<typeof createNeonAuth>|undefined;
export function privateAuthServer(){
  if(!privateWorkspacesEnabled())return null;
  return cached??=createNeonAuth({
    baseUrl:process.env.NEON_AUTH_BASE_URL!,
    cookies:{secret:process.env.NEON_AUTH_COOKIE_SECRET!}
  });
}
export async function privateWorkspaceUser():Promise<string|null>{
  const auth=privateAuthServer();
  if(!auth)return null;
  try{
    const {data}=await auth.getSession();
    const id=data?.user?.id;
    return typeof id==="string" && id.length>=6 && id.length<=256?id:null;
  }catch{return null;}
}
