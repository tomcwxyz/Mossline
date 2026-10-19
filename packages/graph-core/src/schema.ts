import { z } from "zod";

export const nodeTypeSchema = z.enum(["organisation", "project", "funder", "person", "place", "other"]);
export type NodeType = z.infer<typeof nodeTypeSchema>;

const webUrl = z.url().refine(value => /^https?:\/\//i.test(value), "Use an HTTP(S) URL");
export const graphNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: nodeTypeSchema,
  description: z.string().optional(),
  region: z.string().optional(),
  imageUrl: webUrl.optional(),
  tags: z.array(z.string()).default([]),
  sourceUrl: webUrl.optional()
});
export const graphEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.string().min(1),
  description: z.string().optional(),
  sourceUrl: webUrl.optional(),
  inferred: z.boolean().optional(),
  evidenceNodeIds: z.array(z.string()).optional()
});
export const graphDocumentSchema = z.object({
  version: z.literal(1),
  title: z.string().min(1),
  description: z.string().default(""),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema)
}).superRefine((graph, ctx) => {
  const nodeIds = new Set<string>();
  for (const [index, node] of graph.nodes.entries()) {
    if (nodeIds.has(node.id)) ctx.addIssue({ code: "custom", path: ["nodes", index, "id"], message: "Duplicate node ID" });
    nodeIds.add(node.id);
  }
  const edgeIds = new Set<string>();
  for (const [index, edge] of graph.edges.entries()) {
    if (edgeIds.has(edge.id)) ctx.addIssue({ code: "custom", path: ["edges", index, "id"], message: "Duplicate edge ID" });
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target))
      ctx.addIssue({ code: "custom", path: ["edges", index], message: "Relationship "+edge.id+" has missing endpoint" });
    for (const evidenceId of edge.evidenceNodeIds ?? []) {
      if (!nodeIds.has(evidenceId)) ctx.addIssue({ code: "custom", path: ["edges", index, "evidenceNodeIds"], message: "Unknown evidence node "+evidenceId });
    }
  }
});
export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export type GraphDocument = z.infer<typeof graphDocumentSchema>;
export function parseGraphDocument(value: unknown): GraphDocument {
  return graphDocumentSchema.parse(value);
}
