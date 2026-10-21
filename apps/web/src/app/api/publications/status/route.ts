import {apiResult} from "../../../../lib/hosted-response";
import {isHostedConfigured} from "../../../../lib/hosted-auth";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export function GET(){return apiResult({enabled:isHostedConfigured()});}
