import {NextResponse,type NextRequest} from "next/server";
import {privateAuthServer} from "../../../../lib/private-workspace-auth";
import {noStoreHeaders} from "../../../../lib/hosted-response";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function handler(req:NextRequest,context:{params:Promise<{path:string[]}>}){
  const auth=privateAuthServer();
  if(!auth)return NextResponse.json({error:"Private workspaces are not enabled"},
    {status:404,headers:noStoreHeaders});
  const routes=auth.handler();
  return req.method==="POST"?routes.POST(req,context):routes.GET(req,context);
}
export const GET=handler;
export const POST=handler;
