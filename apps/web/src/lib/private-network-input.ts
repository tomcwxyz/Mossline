import {createHash} from "node:crypto";
import {z} from "zod";
import {parseGraphDocument,type GraphDocument} from "@mossline/graph-core";

export const PRIVATE_UPLOAD_MAX_BYTES=16_000_000;
export const PRIVATE_MAX_NODES=50_000;
export const PRIVATE_MAX_EDGES=100_000;
const uploadSchema=z.object({
  graph:z.unknown(),
  confirmedPrivateStorage:z.literal(true)
}).strict();
export type PrivateUpload={graph:GraphDocument;digest:string;title:string;
  nodeCount:number;edgeCount:number};
export function parsePrivateNetworkUpload(value:unknown):PrivateUpload{
  const payload=uploadSchema.parse(value);
  const graph=parseGraphDocument(payload.graph);
  if(graph.nodes.length>PRIVATE_MAX_NODES || graph.edges.length>PRIVATE_MAX_EDGES)
    throw Error("This network exceeds the private upload size limit.");
  const digest=createHash("sha256").update(JSON.stringify(graph)).digest("hex");
  return {graph,digest,title:graph.title.trim().slice(0,160),
    nodeCount:graph.nodes.length,edgeCount:graph.edges.length};
}
