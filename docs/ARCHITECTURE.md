# Architecture

## One graph, many perspectives

GraphDocument is the portable canonical graph. Each view is a projection, not its own copy of entities and edges. View engine operations belong in graph-core; rendering is separate.

1. Canonical graph: validated IDs, typed entities, directed relationships and source references.
2. Graph projections: filtering, neighbours, paths and collaboration views with evidence IDs.
3. Renderer: Cytoscape now, MapLibre geography later.
4. MCP: read-only queries over the same graph-core functions.

Today the browser stores an imported JSON graph locally; MCP reads a file. These do not share a live database. Later: repository interface, Postgres/Drizzle persistence, stable source IDs, audit log, ownership and approval workflows.

## Security

Local stdio and read-only MCP for alpha. Remote access will require authenticated workspaces, scopes and audit trails. Agent suggestions must be proposals, not unreviewed edits.

## Open source

Apache-2.0 code; external assets and third-party data require their own rights clearance.

## Relationship explanations

`explainRelationship(canonicalGraph, projectedEdge)` lives in graph-core. It reads but never
mutates the canonical data. Direct edges remain **recorded assertions**; inferred edges
remain **associations**, never promoted to verified partnerships. Evidence is resolved
through matching source relationships, limited to direct hops or organisation→project→funder
patterns to prevent arbitrary graph paths from being presented as supporting evidence.
The UI can navigate to supporting projects and funders even if a collaboration projection
omits those entities. There is no claim of external verification at this stage.

## Tracing connections

`traceRecordedConnection` performs bounded breadth-first traversal of recorded source
edges only. It skips inferred edges, retains direction metadata per hop, and
returns null if either endpoint does not exist or no route is found within the
hop limit. The frontend highlights those records without mutating their source.
It remains an exploratory pathway rather than a proof of collaboration.

## Advanced connection analysis
`findRecordedRoutes` enumerates a bounded set of shortest-first simple
recorded-edge routes, with excluded relation types matched exactly. It does
not use projected inferred associations; returned routes are illustrative
candidates, not exhaustive searches. `findStructuralJunctions` finds
cut vertices with Tarjan DFS over the undirected recorded graph; it remains
view-independent and ignores inferred links. Rendering is opt-in and
read-only. Neither feature asserts causal significance.
