import { fundingFlows, type FundingFlow } from "./field-atlas";
import type { GraphDocument, GraphEdge } from "./schema";

/**
 * A map of grants has one record per award, so thousands of grants bury the
 * funders and organisations they connect. This view draws each funder →
 * recipient pair once, as a recorded link carrying how many grants and how
 * much money it stands for. Nothing is invented: every link summarises
 * recorded grants, and the grants stay in the map, the record panel and
 * Browse records.
 */
export interface GrantLinksView {
  graph: GraphDocument;
  /** Grant record → the funder and recipient it now draws between. */
  grantEnds: Map<string, { funderId: string; recipientId: string }>;
  grants: number; pairs: number;
}

export function grantsAsLinks(graph: GraphDocument, flows: FundingFlow[] = fundingFlows(graph)): GrantLinksView {
  const grantFlows = flows.filter(f => f.grantId);
  const grantIds = new Set(grantFlows.map(f => f.grantId!));
  const grantEdges = new Set(grantFlows.flatMap(f => f.edgeIds));
  // A grant record with other recorded links (to a project, say) stays drawn.
  const keep = new Set<string>();
  for (const e of graph.edges) {
    if (grantEdges.has(e.id)) continue;
    if (grantIds.has(e.source)) keep.add(e.source);
    if (grantIds.has(e.target)) keep.add(e.target);
  }
  const pairs = new Map<string, { funderId: string; recipientId: string; flows: FundingFlow[] }>();
  const grantEnds = new Map<string, { funderId: string; recipientId: string }>();
  for (const f of grantFlows) {
    if (keep.has(f.grantId!)) continue;
    const key = f.funderId + "\u0000" + f.recipientId;
    const p = pairs.get(key) ?? { funderId: f.funderId, recipientId: f.recipientId, flows: [] };
    p.flows.push(f); pairs.set(key, p);
    grantEnds.set(f.grantId!, { funderId: f.funderId, recipientId: f.recipientId });
  }
  const byEdge = new Map(graph.edges.map(e => [e.id, e]));
  const summary: GraphEdge[] = [...pairs.values()].map(p => {
    const currencies = new Set(p.flows.map(f => f.currency).filter(Boolean));
    const valued = p.flows.filter(f => f.amount !== null);
    const years = p.flows.map(f => f.year).filter((y): y is number => y !== null).sort((a, b) => a - b);
    const first = byEdge.get(p.flows[0].edgeIds[0] ?? "");
    return {
      id: "grants:" + p.funderId + ">" + p.recipientId, source: p.funderId, target: p.recipientId,
      // One kind of link ("funded"), so the key and filters stay short; the count travels with it.
      type: "funded", direction: "directed", description: p.flows.length === 1 ? "1 grant" : p.flows.length + " grants",
      ...(first?.origin ? { origin: first.origin } : {}),
      properties: {
        grants: p.flows.length,
        ...(currencies.size === 1 && valued.length ? { amountAwarded: valued.reduce((s, f) => s + (f.amount ?? 0), 0), currency: [...currencies][0] } : {}),
        ...(years.length ? { awardDate: String(years[years.length - 1]), firstYear: years[0] } : {})
      }
    };
  });
  const nodes = graph.nodes.filter(n => !grantEnds.has(n.id));
  const edges = [...graph.edges.filter(e => !grantEnds.has(e.source) && !grantEnds.has(e.target)), ...summary];
  return { graph: { ...graph, nodes, edges }, grantEnds, grants: grantEnds.size, pairs: summary.length };
}
