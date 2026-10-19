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


/** A path through recorded source relationships, never inferred shortcuts. */
export interface ConnectionStep {
  edgeId: string;
  fromId: string;
  toId: string;
  relation: string;
  direction: "directed" | "undirected" | "mutual";
  /** A directed assertion was followed from its stored source towards its target. */
  forward: boolean;
}
export interface ConnectionTrail {
  nodeIds: string[];
  steps: ConnectionStep[];
}

/**
 * Find a shortest documented connection using breadth-first search.
 * Traversal is direction-agnostic for exploration; step metadata retains direction.
 * Paths containing inferred associations are deliberately excluded.
 * The maximum hop count bounds both cost and how far an interpretation can stretch.
 */
export function traceRecordedConnection(
  graph: GraphDocument, startId: string, endId: string, maxHops = 5
): ConnectionTrail | null {
  const ids = new Set(graph.nodes.map(node => node.id));
  if (!ids.has(startId) || !ids.has(endId) || !Number.isInteger(maxHops) || maxHops < 0) return null;
  if (startId === endId) return { nodeIds: [startId], steps: [] };
  const adjacent = new Map<string, ConnectionStep[]>();
  for (const edge of graph.edges) {
    if (edge.inferred) continue;
    const direction = edge.direction ?? "directed";
    for (const step of [
      {edgeId:edge.id,fromId:edge.source,toId:edge.target,relation:edge.type,direction,forward:true},
      {edgeId:edge.id,fromId:edge.target,toId:edge.source,relation:edge.type,direction,forward:false}
    ]) adjacent.set(step.fromId,[...(adjacent.get(step.fromId)??[]),step]);
  }
  const previous = new Map<string, ConnectionStep>();
  const distance = new Map<string, number>([[startId,0]]);
  const queue = [startId];
  for(let i=0;i<queue.length;i++){
    const current=queue[i];
    const hops=distance.get(current)!;
    if(hops>=maxHops) continue;
    for(const step of adjacent.get(current)??[]){
      if(distance.has(step.toId)) continue;
      previous.set(step.toId,step);
      distance.set(step.toId,hops+1);
      if(step.toId===endId){
        const steps:ConnectionStep[]=[];
        for(let at=endId;at!==startId;){
          const part=previous.get(at);
          if(!part) return null;
          steps.push(part);
          at=part.fromId;
        }
        steps.reverse();
        return {nodeIds:[startId,...steps.map(part=>part.toId)],steps};
      }
      queue.push(step.toId);
    }
  }
  return null;
}
