import { z } from "zod";
import { nodeTypeSchema, type GraphDocument } from "./schema";

/** Pure presentation state, never a second copy of graph data. */
export const perspectiveSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(60),
  graphKey: z.string().min(1).max(100),
  view: z.enum(["landscape", "collaborations", "atlas"]),
  basis: z.enum(["all", "project", "funder", "recorded"]),
  region: z.string().max(150),
  query: z.string().max(200),
  types: z.array(nodeTypeSchema),
  context: z.boolean(),
  layout: z.enum(["organic", "radial", "regions"]),
  labels: z.enum(["essential", "all"]),
  /** Dataset-scoped canvas coordinates; never written into source node properties. */
  positions: z.record(z.string().min(1).max(200), z.object({
    x: z.number().finite().min(-1000000).max(1000000),
    y: z.number().finite().min(-1000000).max(1000000)
  }).strict()).refine(value => Object.keys(value).length <= 2000,
    "A saved layout may contain up to 2,000 node positions").optional(),
  /** Optional authoring overlay, completely separate from the source graph. */
  presentation: z.object({
    title: z.string().trim().max(100),
    introduction: z.string().trim().max(1200),
    coverUrl: z.string().url().refine(url=>/^https:\/\//.test(url)).optional(),
    illustrated: z.boolean(),
    atlasMode: z.enum(["stories","places"]).optional(),
    atlasKind: z.enum(["all","project","organisation","funder","place"]).optional()
  }).strict().optional(),
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
