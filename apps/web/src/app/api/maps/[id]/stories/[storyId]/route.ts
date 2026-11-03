import {parseStory} from "@mossline/graph-core";
import {reportError} from "../../../../../../lib/report";
import {apiResult} from "../../../../../../lib/hosted-response";
import {readJsonBody} from "../../../../../../lib/hosted-auth";
import {deleteMapStory,readMapStory,saveMapStory,STORIES_PER_MAP} from "../../../../../../lib/map-stories-db";
import {requireRole} from "../../../../../../lib/shared-maps-http";
import {usageFor} from "../../../../../../lib/orgs-db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{id:string;storyId:string}>};
const STORY_ID=/^story:[A-Za-z0-9]{4,60}$/;

export async function GET(request:Request,context:Ctx){
  const {id,storyId}=await context.params;
  const access=await requireRole(request,id,{write:false,needs:["owner","editor","viewer"]});
  if(access instanceof Response)return access;
  if(!STORY_ID.test(storyId))return apiResult({error:"Not found"},404);
  try{
    const found=await readMapStory(id,storyId);
    return found?apiResult(found):apiResult({error:"Not found"},404);
  }catch(error){reportError("maps/[id]/stories/[storyId]",error);return apiResult({error:"Stories are temporarily unavailable"},503);}
}

/** Saves a story over the version the writer last saw (?version=0 for a new one). A clash returns what's there now. */
export async function PUT(request:Request,context:Ctx){
  const {id,storyId}=await context.params;
  const access=await requireRole(request,id,{write:true,needs:["owner","editor"]});
  if(access instanceof Response)return access;
  if(!STORY_ID.test(storyId))return apiResult({error:"Not found"},404);
  const expected=Number(new URL(request.url).searchParams.get("version"));
  if(!Number.isSafeInteger(expected)||expected<0)return apiResult({error:"Say which version you're saving over"},400);
  let story;
  try{
    const limit=(await usageFor(access.user.id)).limits.uploadBytes;
    const body=await readJsonBody(request,limit) as {story?:unknown};
    story=parseStory(body?.story);
    if(story.id!==storyId)throw Error("Wrong story");
  }catch(e){
    const tooBig=e instanceof Error&&/exceeds|large|limit/i.test(e.message);
    return apiResult({error:tooBig?"This story is too large to keep with a shared map on your plan. Use fewer or smaller pictures."
      :"The story couldn't be read. Try again."},tooBig?413:400);
  }
  try{
    const result=await saveMapStory(id,access.user.id,story,expected);
    if(result.saved)return apiResult({version:result.version});
    if(result.reason==="full")return apiResult({error:"A map can keep up to "+STORIES_PER_MAP+" stories. Delete one first."},403);
    return apiResult({error:"Someone else saved this story first.",current:await readMapStory(id,storyId)},409);
  }catch(error){reportError("maps/[id]/stories/[storyId]",error);return apiResult({error:"Stories are temporarily unavailable"},503);}
}

export async function DELETE(request:Request,context:Ctx){
  const {id,storyId}=await context.params;
  const access=await requireRole(request,id,{write:true,needs:["owner","editor"]});
  if(access instanceof Response)return access;
  if(!STORY_ID.test(storyId))return apiResult({error:"Not found"},404);
  try{return apiResult({deleted:await deleteMapStory(id,storyId)});}
  catch(error){reportError("maps/[id]/stories/[storyId]",error);return apiResult({error:"Stories are temporarily unavailable"},503);}
}
