import type { GraphDocument, GraphEdge, GraphNode } from "./schema";

/** A pathway follows source records; it is not evidence of a partnership by itself. */
export interface EvidencePath {
  nodeIds: string[];
  edgeIds: string[];
}

export interface RelationshipSupport {
  nodeId: string;
  label: string;
  type: GraphNode["type"];
  fromSource: EvidencePath | null;
  fromTarget: EvidencePath | null;
}

export interface RelationshipExplanation {
  status: "recorded" | "inferred";
  summary: string;
  supports: RelationshipSupport[];
  source: GraphNode | null;
  target: GraphNode | null;
  /** Direct record if present; an inferred projection has no direct source record. */
  record: GraphEdge | null;
}

function directPath(graph: GraphDocument, start: string, finish: string): EvidencePath | null {
  const edge = graph.edges.find(e =>
    (e.source === start && e.target === finish) || (e.target === start && e.source === finish));
  if (!edge) return null;
  return { nodeIds: [start, finish], edgeIds: [edge.id] };
}

/** Only a direct relation, or org -> project -> funder. Never search arbitrary hops. */
function pathToEvidence(graph: GraphDocument, organisationId: string, via: GraphNode): EvidencePath | null {
  const direct = directPath(graph, organisationId, via.id);
  if (direct) return direct;
  if (via.type !== "funder") return null;
  for (const project of graph.nodes) {
    if (project.type !== "project") continue;
    const first = directPath(graph, organisationId, project.id);
    const second = directPath(graph, project.id, via.id);
    if (first && second) return {
      nodeIds: [organisationId, project.id, via.id],
      edgeIds: [first.edgeIds[0], second.edgeIds[0]]
    };
  }
  return null;
}

/**
 * Explain an edge in a projected view against the canonical graph.
 * An inferred link is never upgraded to an independently verified partnership.
 */
export function explainRelationship(graph: GraphDocument, edge: GraphEdge): RelationshipExplanation {
  const source = graph.nodes.find(n => n.id === edge.source) ?? null;
  const target = graph.nodes.find(n => n.id === edge.target) ?? null;
  const record = graph.edges.find(e => e.id === edge.id) ?? null;
  if (!edge.inferred) {
    return {
      status: "recorded", source, target, record,
      summary: "This relationship is recorded in the source dataset. Mossline has not independently verified it.",
      supports: []
    };
  }
  const supports = (edge.evidenceNodeIds ?? []).flatMap(id => {
    const via = graph.nodes.find(n => n.id === id);
    if (!via || !source || !target) return [];
    return [{
      nodeId: id, label: via.label, type: via.type,
      fromSource: pathToEvidence(graph, source.id, via),
      fromTarget: pathToEvidence(graph, target.id, via)
    }];
  });
  return {
    status: "inferred", source, target, record: null, supports,
    summary: "These entities share a recorded association through the items below. This is not proof that they collaborate."
  };
}
