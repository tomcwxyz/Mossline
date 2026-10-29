import {editSchema} from "@mossline/graph-core";
import {apiResult} from "../../../../../lib/hosted-response";
import {readJsonBody} from "../../../../../lib/hosted-auth";
import {addEdits,editsSince,setEditUndone} from "../../../../../lib/shared-maps-db";
import {requireRole} from "../../../../../lib/shared-maps-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{id:string}>};
const EDIT_ID=/^[A-Za-z0-9:_-]{1,120}$/;

/** Everything changed since a version the browser already has. */
export async function GET(request:Request,context:Ctx){
  const {id}=await context.params;
  const access=await requireRole(request,id,{write:false,needs:["owner","editor","viewer"]});
  if(access instanceof Response)return access;
  const since=Math.max(0,Number(new URL(request.url).searchParams.get("since"))||0);
  try{return apiResult(await editsSince(id,since));}
  catch{return apiResult({error:"Shared maps are temporarily unavailable"},503);}
}

/**
 * New changes. Each is stamped with who made it and when, from the account and
 * the server's clock, so receipts can't claim someone else's name.
 */
export async function POST(request:Request,context:Ctx){
  const {id}=await context.params;
  const access=await requireRole(request,id,{write:true,needs:["owner","editor"]});
  if(access instanceof Response)return access;
  let entries;
  try{
    const body=await readJsonBody(request,2_000_000) as {edits?:unknown};
    if(!Array.isArray(body?.edits)||body.edits.length>500)throw Error();
    entries=body.edits.map(e=>editSchema.parse(e));
    if(entries.some(e=>!EDIT_ID.test(e.id)))throw Error();
  }catch{return apiResult({error:"Those changes couldn't be read"},400);}
  const by=(access.user.name||access.user.email).slice(0,80);
  const at=new Date().toISOString();
  try{
    await addEdits(id,access.user.id,entries.map(e=>({...e,by,at})));
    return apiResult(await editsSince(id,Math.max(0,Number(new URL(request.url).searchParams.get("since"))||0)));
  }catch{return apiResult({error:"Shared maps are temporarily unavailable"},503);}
}

/** Undo or redo one change, for everyone. */
export async function PATCH(request:Request,context:Ctx){
  const {id}=await context.params;
  const access=await requireRole(request,id,{write:true,needs:["owner","editor"]});
  if(access instanceof Response)return access;
  let editId="",undone=false;
  try{
    const body=await readJsonBody(request,2_000) as {id?:unknown;undone?:unknown};
    if(typeof body?.id!=="string"||!EDIT_ID.test(body.id)||typeof body.undone!=="boolean")throw Error();
    editId=body.id;undone=body.undone;
  }catch{return apiResult({error:"Say which change to undo or redo"},400);}
  try{
    if(!await setEditUndone(id,editId,undone))return apiResult({error:"Not found"},404);
    return apiResult({ok:true});
  }catch{return apiResult({error:"Shared maps are temporarily unavailable"},503);}
}
