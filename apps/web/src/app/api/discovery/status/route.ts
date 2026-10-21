import {NextResponse} from "next/server";
import {discoveryEnabled,explanationEnabled} from "../../../../lib/discovery-provider";
import {noStoreHeaders} from "../../../../lib/hosted-response";
export const dynamic="force-dynamic";export const runtime="nodejs";
export function GET(){
  return NextResponse.json({
    embeddings:discoveryEnabled(),
    explanations:explanationEnabled(),
    provider:"server-configured OpenAI-compatible provider",
    maxGrants:48
  },{headers:noStoreHeaders});
}
