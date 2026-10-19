# Roadmap

## Alpha 0.1: local vertical slice
- [x] Next.js + Cytoscape explorer.
- [x] Validated portable graph model and queries.
- [x] Search, local JSON import/export, typed filtering and one-hop context.
- [x] Collaboration perspective with project/funder/recorded basis and explicit inferred status.
- [x] Read-only MCP on stdio with six graph tools.
- [x] Graph-core unit tests.
- [ ] Install dependencies, run tests/build/typecheck and browser accessibility checks in CI.

## Alpha 0.2: real data
- [ ] Obtain sanitised Kumu JSON and Google Sheets examples with permission.
- [ ] Dedicated importers and reports for unknown fields and missing connections.
- [ ] Record provenance, source IDs, data quality and modification history.
- [ ] Shared Postgres/Drizzle workspace storage and safe Sheets synchronisation.
- [ ] Stable layouts, named views and theme presets.

## Later
- [ ] MapLibre geography and regional clusters.
- [ ] Photographic nodes, rich profiles and right-cleared imagery.
- [ ] Relationship queries, bridge detection and time comparisons.
- [ ] Workspace auth, permissions, publishing and embeds.
- [ ] Remote MCP with least-privilege OAuth, rate limits and auditing.
- [ ] Agent-suggested change proposal and review workflow.

Deliberately excluded initially: simulations, causal loops and automatic agent writes.

## Alpha 0.3 — visual polish and local perspectives
- [x] Named perspectives store filters, layout, search and labels separately from canonical graph data.
- [x] Dataset-scoped saved views with schema validation and local delete/restore.
- [x] Richer original CSS botanical profile covers, optional source-provided photographs and relationship counts.
- [x] Region-labelled grouping as a visual-only network layout.
- [ ] Persist manually adjusted node positions across reloads.
- [ ] Rights-cleared photograph selection and attribution.
- [ ] Authenticated browser interaction review of the protected preview.

## Alpha 0.4 — explainable relationships
- [x] Click-to-inspect relationship lines and accessible **Why?** buttons in the entity inspector.
- [x] Separate recorded source assertions from inferred shared associations in the interface.
- [x] Trace project and funder paths using actual canonical relationship IDs and names.
- [x] Explicitly indicate when supporting records cannot be established.
- [ ] Add persistent, independently verified provenance and confidence metadata.
- [ ] Browser review of line hit targets and inspector keyboard accessibility on protected preview.
