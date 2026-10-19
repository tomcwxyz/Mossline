# Instructions for coding agents working on Mossline

Mossline is a question-centred, open-source platform for navigating networks and relationships, intended for people who do not necessarily write code.

## Structure

- apps/web: Next.js browser explorer with Cytoscape.js.
- apps/mcp: local read-only MCP server via the official TypeScript SDK v2.
- packages/graph-core: portable graph schema, projections, graph queries and tests.
- data/demo.json: fictional example entities and relationships.

## Rules

1. Do not introduce a proprietary hosted dependency into the core.
2. Never represent an inferred relationship as confirmed; retain evidence and provenance.
3. Keep data storage, graph logic, presentation and MCP adapters independent.
4. No autonomous write tools without explicit permissions, auditing and human approval.
5. Never commit secrets, sensitive personal data or private client exports.
6. Inspect actual Kumu export shapes before implementing an importer.
7. Prefer small, keyboard-accessible components and targeted tests.
8. Work on feature branches; review diffs before merging.

## Verify before merge

~~~bash
npm install
npm run test
npm run typecheck
npm run build
~~~

A browser smoke test and accessibility check are also required. Previous authoring environment could not download packages from npm; do not claim the full build passes until it has run in CI.
