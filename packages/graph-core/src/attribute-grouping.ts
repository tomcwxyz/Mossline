import type { GraphDocument, GraphNode } from "./schema";

/**
 * Reusable attribute grouping for any imported graph.
 * A grouping is a read-only projection, NEVER a relationship assertion.
 */
export type GroupingField = "type" | "region" | "tags" | `properties.${string}`;
export type AttributeGroup = {
  key: string;
  label: string;
  nodeIds: string[];
  count: number;
};
export type AttributeGrouping = {
  field: GroupingField;
  groups: AttributeGroup[];
  unclassifiedCount: number;
  overlapping: boolean;
};
const MAX_CATEGORIES = 250;
const normalise = (value: unknown): string[] => {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (typeof value === "number" && Number.isFinite(value)) return [String(value)];
  if (typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return [...new Set(value.flatMap(normalise))];
  return [];
};
export function valuesForGrouping(node: GraphNode, field: GroupingField): string[] {
  if (field === "type") return [node.type];
  if (field === "region") return normalise(node.region);
  if (field === "tags") return normalise(node.tags);
  if (field.startsWith("properties.")) {
    const key = field.slice("properties.".length);
    return key ? normalise(node.properties?.[key]) : [];
  }
  return [];
}
export function availableGroupingFields(graph: GraphDocument): GroupingField[] {
  const keys = new Set<string>();
  for (const node of graph.nodes) {
    for (const [key, value] of Object.entries(node.properties ?? {})) {
      if (key && normalise(value).length) keys.add(key);
    }
  }
  return ["type", "region", "tags", ...[...keys].sort().map(
    key => `properties.${key}` as GroupingField
  )];
}
export function groupByAttribute(graph: GraphDocument, field: GroupingField): AttributeGrouping {
  const buckets = new Map<string, {label: string; ids: Set<string>}>();
  let unclassifiedCount = 0;
  let overlapping = false;
  for (const node of graph.nodes) {
    const values = [...new Set(valuesForGrouping(node, field))];
    if (!values.length) { unclassifiedCount++; continue; }
    if (values.length > 1) overlapping = true;
    for (const label of values) {
      const key = label.toLocaleLowerCase("en-GB");
      const bucket = buckets.get(key) ?? {label, ids: new Set<string>()};
      bucket.ids.add(node.id);
      buckets.set(key, bucket);
      if (buckets.size > MAX_CATEGORIES) throw new Error(
        "Too many distinct groups for this field; choose a lower-cardinality field or apply a filter"
      );
    }
  }
  const groups = [...buckets.entries()].map(([key, value]) => ({
    key, label: value.label, nodeIds: [...value.ids], count: value.ids.size
  })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return {field, groups, unclassifiedCount, overlapping};
}
