import {NextResponse} from "next/server";
import {discoveryEnabled,explanationEnabled,embeddingModel} from "../../../../lib/discovery-provider";
import {noStoreHeaders} from "../../../../lib/hosted-response";
export const dynamic="force-dynamic";export const runtime="nodejs";
export function GET(){
  return NextResponse.json({
    embeddings:discoveryEnabled(),
    explanations:explanationEnabled(),
    provider:"server-configured OpenAI-compatible provider",
    embeddingModel:discoveryEnabled()?embeddingModel():null,
    maxBatch:48,
    maxGrants:48
  },{headers:noStoreHeaders});
}
