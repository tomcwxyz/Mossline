import type { GraphDocument } from "./schema";
import type { ConnectionStep, ConnectionTrail } from "./relationships";

export interface RouteOptions {
  maxHops?: number;
  maxRoutes?: number;
  /** Exact relationship types omitted from the analysis. Not keyword matching. */
  excludeTypes?: string[];
}

/**
 * Return a small set of distinct simple routes (shortest first) through recorded
 * relationships. Edges are traversed both ways for discovery but retain their
 * original direction. Inferred associations are excluded by definition.
 *
 * Results are not exhaustive: candidate expansion is capped to keep browser
 * work bounded even for dense or malformed imported networks.
 */
export function findRecordedRoutes(
  graph: GraphDocument, from: string, to: string, options: RouteOptions = {}
): ConnectionTrail[] {
  const maxHops = options.maxHops ?? 5;
  const maxRoutes = options.maxRoutes ?? 3;
  if (!Number.isInteger(maxHops) || maxHops < 0 || maxHops > 8 ||
      !Number.isInteger(maxRoutes) || maxRoutes < 1 || maxRoutes > 10) return [];
  const ids = new Set(graph.nodes.map(n => n.id));
  if (!ids.has(from) || !ids.has(to)) return [];
  if (from === to) return [{ nodeIds: [from], steps: [] }];
  const blocked = new Set(options.excludeTypes ?? []);
  const adjacent = new Map<string, ConnectionStep[]>();
  for (const edge of graph.edges) {
    if (edge.inferred || blocked.has(edge.type)) continue;
    const direction = edge.direction ?? "directed";
    const forward: ConnectionStep = {
      edgeId: edge.id, fromId: edge.source, toId: edge.target,
      relation: edge.type, direction, forward: true
    };
    const reverse: ConnectionStep = { ...forward, fromId: edge.target, toId: edge.source, forward: false };
    adjacent.set(edge.source, [...(adjacent.get(edge.source) ?? []), forward]);
    adjacent.set(edge.target, [...(adjacent.get(edge.target) ?? []), reverse]);
  }
  // Stable output independent of CSV row ordering.
  for (const links of adjacent.values()) links.sort((a, b) =>
    a.toId.localeCompare(b.toId) || a.edgeId.localeCompare(b.edgeId));

  const pending: ConnectionTrail[] = [{ nodeIds: [from], steps: [] }];
  const results: ConnectionTrail[] = [];
  const seenRoutes = new Set<string>();
  const MAX_CANDIDATES = 20000;
  let expanded = 0;
  for (let i = 0; i < pending.length && expanded < MAX_CANDIDATES; i++, expanded++) {
    const route = pending[i];
    const end = route.nodeIds[route.nodeIds.length - 1];
    if (end === to) {
      const key = route.nodeIds.join("\u0000");
      if (!seenRoutes.has(key)) {
        seenRoutes.add(key);
        results.push(route);
      }
      if (results.length >= maxRoutes) break;
      continue;
    }
    if (route.steps.length >= maxHops) continue;
    for (const step of adjacent.get(end) ?? []) {
      if (route.nodeIds.includes(step.toId)) continue; // No loops through the same entity.
      pending.push({nodeIds: [...route.nodeIds, step.toId], steps: [...route.steps, step]});
    }
    // A graph can be highly connected: refuse runaway memory/time work.
    if (pending.length > MAX_CANDIDATES * 5) break;
  }
  return results;
}

export interface StructuralJunction {
  nodeId: string;
  degree: number;
  /** Number of groups left inside its original component if removed. */
  separatedGroups: number;
}

/**
 * Articulation points of the UNDIRECTED, recorded-only network.
 * Structural bottlenecks do not imply causal importance, leadership or trust.
 * Tarjan DFS is linear in vertices + edges, including disconnected graphs.
 */
export function findStructuralJunctions(graph: GraphDocument): StructuralJunction[] {
  const neighbours = new Map(graph.nodes.map(n => [n.id, new Set<string>()]));
  for (const edge of graph.edges) {
    if (edge.inferred || edge.source === edge.target) continue;
    neighbours.get(edge.source)?.add(edge.target);
    neighbours.get(edge.target)?.add(edge.source);
  }
  const entered = new Map<string, number>();
  const low = new Map<string, number>();
  const parent = new Map<string, string>();
  const result: StructuralJunction[] = [];
  let tick = 0;
  function visit(node: string): void {
    entered.set(node, ++tick);
    low.set(node, tick);
    let children = 0;
    let cutChildren = 0;
    for (const next of neighbours.get(node) ?? []) {
      if (!entered.has(next)) {
        parent.set(next, node);
        children++;
        visit(next);
        low.set(node, Math.min(low.get(node)!, low.get(next)!));
        if (low.get(next)! >= entered.get(node)!) cutChildren++;
      } else if (next !== parent.get(node)) {
        low.set(node, Math.min(low.get(node)!, entered.get(next)!));
      }
    }
    const isRoot = !parent.has(node);
    const separatedGroups = isRoot ? children : cutChildren + 1;
    if ((isRoot && children > 1) || (!isRoot && cutChildren > 0)) {
      result.push({ nodeId: node, degree: neighbours.get(node)?.size ?? 0, separatedGroups });
    }
  }
  for (const id of neighbours.keys()) if (!entered.has(id)) visit(id);
  return result.sort((a,b) => b.separatedGroups - a.separatedGroups ||
    b.degree - a.degree || a.nodeId.localeCompare(b.nodeId));
}
