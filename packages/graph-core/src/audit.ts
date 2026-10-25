import type { SourceOrigin, GraphDocument, GraphNode } from "./schema";

/**
 * A descriptive coverage report, not a confidence, quality or accuracy score.
 * No source claims are independently checked.
 */
export interface GraphAudit {
  totals: { nodes: number; relationships: number; recorded: number; inferred: number };
  coverage: {
    nodesWithOrigin: number;
    relationshipsWithOrigin: number;
    nodesWithSourceUrl: number;
    relationshipsWithSourceUrl: number;
    nodesWithDescription: number;
    nodesWithRegion: number;
  };
  categories: Record<GraphNode["type"], number>;
  isolated: { id: string; label: string }[];
  duplicateLabels: { label: string; ids: string[] }[];
  sources: { system: SourceOrigin["system"]; fileName?: string; nodes: number; relationships: number }[];
}

export function auditGraph(graph: GraphDocument): GraphAudit {
  const categories: GraphAudit["categories"] = {
    organisation: 0, project: 0, funder: 0, person: 0, place: 0, topic: 0, methodology: 0, outcome: 0, other: 0
  };
  const connected = new Set<string>();
  for (const edge of graph.edges) {
    connected.add(edge.source);
    connected.add(edge.target);
  }
  const labels = new Map<string, string[]>();
  const sourceRecords = new Map<string, GraphAudit["sources"][number]>();
  function addSource(origin: { system: SourceOrigin["system"]; fileName?: string } | undefined, kind: "nodes" | "relationships") {
    if (!origin) return;
    const key = origin.system + "\u0000" + (origin.fileName ?? "");
    const entry = sourceRecords.get(key) ?? { system: origin.system, fileName: origin.fileName, nodes: 0, relationships: 0 };
    entry[kind]++;
    sourceRecords.set(key, entry);
  }
  for (const node of graph.nodes) {
    categories[node.type]++;
    labels.set(node.label, [...(labels.get(node.label) ?? []), node.id]);
    addSource(node.origin, "nodes");
  }
  for (const edge of graph.edges) addSource(edge.origin, "relationships");
  return {
    totals: {
      nodes: graph.nodes.length,
      relationships: graph.edges.length,
      recorded: graph.edges.filter(e => !e.inferred).length,
      inferred: graph.edges.filter(e => e.inferred).length
    },
    coverage: {
      nodesWithOrigin: graph.nodes.filter(n => !!n.origin).length,
      relationshipsWithOrigin: graph.edges.filter(e => !!e.origin).length,
      nodesWithSourceUrl: graph.nodes.filter(n => !!n.sourceUrl).length,
      relationshipsWithSourceUrl: graph.edges.filter(e => !!e.sourceUrl).length,
      nodesWithDescription: graph.nodes.filter(n => !!n.description).length,
      nodesWithRegion: graph.nodes.filter(n => !!n.region).length
    },
    categories,
    isolated: graph.nodes.filter(n => !connected.has(n.id)).map(n => ({ id: n.id, label: n.label })),
    duplicateLabels: [...labels].filter(([, ids]) => ids.length > 1)
      .map(([label, ids]) => ({ label, ids }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    sources: [...sourceRecords.values()].sort((a, b) =>
      a.system.localeCompare(b.system) || (a.fileName ?? "").localeCompare(b.fileName ?? ""))
  };
}
