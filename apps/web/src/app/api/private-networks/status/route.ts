import {NextResponse} from "next/server";
import {privateWorkspacesEnabled,privateWorkspaceUser}
  from "../../../../lib/private-workspace-auth";
import {noStoreHeaders} from "../../../../lib/hosted-response";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(){
  const enabled=privateWorkspacesEnabled();
  return NextResponse.json({enabled,
    authenticated:enabled?!!(await privateWorkspaceUser()):false},
    {headers:noStoreHeaders});
}
