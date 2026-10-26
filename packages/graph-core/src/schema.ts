import { z } from "zod";

export const nodeTypeSchema = z.enum(["organisation", "project", "funder", "person", "place", "topic", "methodology", "outcome", "other"]);
export type NodeType = z.infer<typeof nodeTypeSchema>;

const webUrl = z.url().refine(value => /^https?:\/\//i.test(value), "Use an HTTP(S) URL");
/** Where a record or link came from: the file, the row, and the shape that read it. */
export const originSchema = z.object({
  system: z.enum(["kumu", "csv", "annotation", "tsv", "json", "xlsx", "edit"]),
  recordId: z.string(),
  fileName: z.string().min(1).optional(),
  recordNumber: z.number().int().positive().optional(),
  /** Name of the source shape that read this row, e.g. "360Giving grants". */
  shape: z.string().optional(),
  /** The row's own values, kept when a second source fills in an existing record. */
  fields: z.record(z.string(), z.string()).optional()
});
export type SourceOrigin = z.infer<typeof originSchema>;
export const graphNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: nodeTypeSchema,
  description: z.string().optional(),
  region: z.string().optional(),
  imageUrl: webUrl.optional(),
  tags: z.array(z.string()).default([]),
  sourceUrl: webUrl.optional(),
  origin: originSchema.optional(),
  /** Every source row that describes this record, in the order they were added. */
  receipts: z.array(originSchema).optional(),
  /** Stable identifiers such as GB-CHC-1234567 or GB-COH-01234567, used to join sources. */
  identifiers: z.array(z.string()).optional(),
  properties: z.record(z.string(),z.unknown()).optional()
});
export const graphEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.string().min(1),
  description: z.string().optional(),
  sourceUrl: webUrl.optional(),
  inferred: z.boolean().optional(),
  evidenceNodeIds: z.array(z.string()).optional(),
  direction: z.enum(["directed","undirected","mutual"]).optional(),
  origin: originSchema.optional(),
  properties: z.record(z.string(),z.unknown()).optional()
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
