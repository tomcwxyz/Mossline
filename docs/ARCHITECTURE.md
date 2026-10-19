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
