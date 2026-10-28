# Instructions for coding agents working on Mossline

Mossline is a question-centred, open-source platform for navigating networks and relationships, intended for people who do not necessarily write code.

## Structure

- apps/web: Next.js Field Atlas with Sigma.js 4 / Graphology; legacy specialised tools remain behind Advanced.
- apps/mcp: local read-only MCP server via the official TypeScript SDK v2.
- packages/graph-core: portable graph schema, projections, graph queries and tests.
- data/demo.json: fictional example entities and relationships.
- apps/web/public/samples: invented files in real source layouts (data/generators/source-samples.mjs).

## Rules

1. Do not introduce a proprietary hosted dependency into the core.
2. Never represent an inferred relationship as confirmed; retain evidence and provenance.
3. Keep data storage, graph logic, presentation and MCP adapters independent.
4. No autonomous write tools without explicit permissions, auditing and human approval.
5. Never commit secrets, sensitive personal data or private client exports.
6. Inspect actual export shapes before supporting a source, and support it as a shape read by the one engine in `packages/graph-core/src/sources` (see `docs/DATA_IN.md`), not as a separate importer. Join records on identifiers, never on names.
7. Prefer small, keyboard-accessible components and targeted tests.
8. Work on feature branches; review diffs before merging.
9. Changes people make in Mossline are edit-list entries applied over imported records (`graph-core/src/edits.ts`). Never write them into imported data; keep the receipt and the previous value.

## Verify before merge

~~~bash
npm install
npm run test
npm run typecheck
npm run build
~~~

A browser smoke test and accessibility check are also required. Previous authoring environment could not download packages from npm; do not claim the full build passes until it has run in CI.

## Field Atlas design contract

The supplied design guidance calls this a **field atlas for connected work**, not a collection of dashboards. Before adding a rendering layer or control, first check whether the existing lens and shared inspector can support the task.

- **One canonical source graph, five lenses**: Network, Map, Themes, Funding, Timeline. Share the current selection, filters and source receipts. Renderer state cannot mutate source records.
- **Ink, pencil, wash**: ink is recorded evidence or separately disclosed human-confirmed annotation; pencil is a reversible hypothesis; wash is a navigation aid. Never use pencil to compute recorded totals, award sums, node size or documented routes.
- **Only Sigma inside Network**: Sigma v4 primitives and styles, Graphology and worker layout. Do not embed WholeGraphExplorer or revive the handmade network SVG. The old explorer belongs in Advanced only. In v4 use `visibility`, `labelVisibility` and `sigma/rendering` primitives, not v3 options. Keep `itemSizesReference: "screen"`, and pass per-edge `dashSize`/`gapSize` through the edge reducer (see `docs/design/FIELD_ATLAS_IMPLEMENTATION.md`).
- **Geography is sourced**: use real source coordinates and a fitting projection/basemap. Show unplaced records. Never guess locations from text. Preserve source coordinate accuracy. A record's own postcode may give an approximate place: keep it under `Approximate location`, draw it distinctly and say so. Send postcodes off the device only after the person agrees.
- **Honest scale**: never silently display a truncated graph or label a subset as full coverage. Prefer IndexedDB-backed full datasets and worker aggregation; disclose any staged feature/limit.
- **Review and recovery**: annotations must identify reviewer, reason and dataset version. Keep them outside source imports, include them in recovery/export planning, and never auto-confirm suggestions.
- **Typography and colour**: use locally served Newsreader, IBM Plex Sans and IBM Plex Mono, and the `ml-` token family in `field-atlas.css`. Tokens live on `:root` and every page follows one Night/Day choice (`atlas/theme.ts`); do not add literal colours to `globals.css`. All primary actions need WCAG AA contrast in day and night themes. Funder values use the funder-blue semantic token; hypotheses use a distinct pencil treatment.
- **Progressive UI**: start with find/select/follow/evidence, not renderer choices or technical menus. Keep tools accessible through Advanced; avoid duplicate navigation/controls on mobile.
- **Tests must exercise actual interaction**: run core, typecheck, build, browser, mobile and accessibility checks. Add coverage for complete-source restoration, inferred review, selection and map extent as work evolves.
