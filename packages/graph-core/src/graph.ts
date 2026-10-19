import type { GraphDocument, GraphEdge, GraphNode, NodeType } from "./schema.js";

export function neighbours(graph: GraphDocument, nodeId: string): GraphNode[] {
  const related = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.source === nodeId) related.add(edge.target);
    if (edge.target === nodeId) related.add(edge.source);
  }
  return graph.nodes.filter(node => related.has(node.id));
}

export function shortestPath(graph: GraphDocument, start: string, end: string): string[] | null {
  const ids = new Set(graph.nodes.map(n => n.id));
  if (!ids.has(start) || !ids.has(end)) return null;
  const previous = new Map<string, string | null>([[start, null]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (current === end) break;
    for (const next of neighbours(graph, current)) {
      if (previous.has(next.id)) continue;
      previous.set(next.id, current);
      queue.push(next.id);
    }
  }
  if (!previous.has(end)) return null;
  const path: string[] = [];
  for (let at: string | null = end; at !== null; at = previous.get(at) ?? null) path.push(at);
  return path.reverse();
}

export function searchNodes(graph: GraphDocument, query: string): GraphNode[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return graph.nodes;
  return graph.nodes.filter(n => [n.label, n.description ?? "", n.region ?? "", ...n.tags]
    .some(value => value.toLocaleLowerCase().includes(q)));
}

export interface FilterOptions {
  types: NodeType[];
  query?: string;
  includeNeighbours?: boolean;
  focusId?: string | null;
}
export interface FilteredGraph { graph: GraphDocument; contextNodeIds: string[]; }

/** Type filters match seed entities; optional context retains one-hop neighbours. */
export function filterGraph(graph: GraphDocument, opts: FilterOptions): FilteredGraph {
  const allTypesSelected = opts.types.length === 6;
  const ids = new Set(graph.nodes.filter(n => opts.types.includes(n.type)).map(n => n.id));
  const query = opts.query?.trim() ?? "";
  const matched = new Set(searchNodes(graph, query).map(n => n.id));
  for (const id of [...ids]) if (!matched.has(id)) ids.delete(id);
  if (opts.focusId && ids.has(opts.focusId)) {
    ids.clear(); ids.add(opts.focusId);
  }
  const context = new Set<string>();
  const needContext = !!opts.includeNeighbours && (!allTypesSelected || !!query || !!opts.focusId);
  if (needContext) {
    for (const edge of graph.edges) {
      if (ids.has(edge.source) && !ids.has(edge.target)) context.add(edge.target);
      if (ids.has(edge.target) && !ids.has(edge.source)) context.add(edge.source);
    }
  }
  const visible = new Set([...ids, ...context]);
  return {
    graph: { ...graph,
      nodes: graph.nodes.filter(n => visible.has(n.id)),
      edges: graph.edges.filter(e => visible.has(e.source) && visible.has(e.target))
    },
    contextNodeIds: [...context]
  };
}

export type CollaborationBasis = "all" | "project" | "funder" | "recorded";

/** Project recorded organisation links and explicitly inferred shared associations. */
export function collaborationGraph(graph: GraphDocument, basis: CollaborationBasis = "all"): GraphDocument {
  const organisations = graph.nodes.filter(n => n.type === "organisation");
  const organisationIds = new Set(organisations.map(n => n.id));
  const recorded: GraphEdge[] = graph.edges.filter(e => organisationIds.has(e.source) && organisationIds.has(e.target));
  if (basis === "recorded") return { ...graph, title: graph.title + " — collaborations", nodes: organisations, edges: recorded };

  const existing = new Set(recorded.map(e => [e.source, e.target].sort().join("|")));
  const associations = new Map<string, { ids: Set<string>; labels: Set<string> }>();
  for (const item of graph.nodes) {
    if (item.type !== "project" && item.type !== "funder") continue;
    if (basis !== "all" && item.type !== basis) continue;
    const directlyLinked = neighbours(graph, item.id);
    const linkedById = new Map(directlyLinked.filter(n => n.type === "organisation").map(n => [n.id, n]));
    // Funders often fund projects rather than organisations directly.
    // Follow funder -> project -> organisation as an association, not proof of collaboration.
    if (item.type === "funder") {
      for (const project of directlyLinked.filter(n => n.type === "project")) {
        for (const org of neighbours(graph, project.id).filter(n => n.type === "organisation")) {
          linkedById.set(org.id, org);
        }
      }
    }
    const linked = [...linkedById.values()];
    for (let i = 0; i < linked.length; i++) for (let j = i + 1; j < linked.length; j++) {
      const pair = [linked[i].id, linked[j].id].sort().join("|");
      if (!associations.has(pair)) associations.set(pair, { ids: new Set(), labels: new Set() });
      associations.get(pair)!.ids.add(item.id);
      associations.get(pair)!.labels.add(item.label);
    }
  }
  const inferred: GraphEdge[] = [];
  for (const [pair, shared] of associations) {
    if (existing.has(pair)) continue;
    const [source, target] = pair.split("|");
    inferred.push({ id: "shared:" + pair, source, target, type: "shared association", inferred: true,
      evidenceNodeIds: [...shared.ids].sort(),
      description: "Both linked to: " + [...shared.labels].sort().join(", ") + ". This is not a confirmed collaboration."
    });
  }
  return { ...graph, title: graph.title + " — collaborations", nodes: organisations, edges: [...recorded, ...inferred] };
}
