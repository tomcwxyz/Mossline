import { z } from "zod";
import { nodeTypeSchema, type GraphDocument } from "./schema";

/** Pure presentation state, never a second copy of graph data. */
export const perspectiveSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(60),
  graphKey: z.string().min(1).max(100),
  view: z.enum(["landscape", "collaborations"]),
  basis: z.enum(["all", "project", "funder", "recorded"]),
  region: z.string().max(150),
  query: z.string().max(200),
  types: z.array(nodeTypeSchema),
  context: z.boolean(),
  layout: z.enum(["organic", "radial", "regions"]),
  labels: z.enum(["essential", "all"]),
  createdAt: z.number().int().nonnegative()
}).strict();
export type SavedPerspective = z.infer<typeof perspectiveSchema>;
export const parsePerspectives = (value: unknown): SavedPerspective[] =>
  z.array(perspectiveSchema).max(40).parse(value);

/** Non-cryptographic scoping key: stable across label/image edits, changes with topology. */
export function graphFingerprint(graph: GraphDocument): string {
  const ids = [...graph.nodes.map(n=>"n:"+n.id),...graph.edges.map(e=>"e:"+e.id+":"+e.source+":"+e.target)].sort().join("|");
  let h=2166136261;
  for(let i=0;i<ids.length;i++){h=Math.imul(h^ids.charCodeAt(i),16777619)>>>0;}
  return graph.nodes.length+"-"+graph.edges.length+"-"+h.toString(16);
}
