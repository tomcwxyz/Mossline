# Field Atlas redesign — implementation notes

This work follows the user-provided **Mossline design guidance pack (24 October 2026)**:
a field atlas for connected work, with one set of source records and five lenses.
The existing importer, local map library, full-funding datasets, discovery services
and advanced explorer stay available during the migration. This is a progressive
architecture change, **not** permission to discard existing capabilities.

## Core rules (must survive all future renderer and database changes)

1. Ink is a relationship recorded in source data, or a **separately identified,
   explicitly reviewed annotation**. Never classify a similarity or shared funder
   as a recorded relationship.
2. Pencil is suggested or inferred. It never contributes to recorded link
   counts, node size, funding totals, hubs or documented connection routes.
3. Wash is explanatory grouping, not a statement that a community exists.
4. Every visible record can be inspected. Every recorded relationship exposes
   its original receipt, where one was available.
5. Source records stay immutable. Local reviewer confirmations live in a
   separate dataset-keyed annotation layer with reviewer, time and reason.
   Confirming a suggestion never edits an imported CSV or Kumu export.
6. A location is only a location when the dataset supplies valid coordinates.
   Never geocode, position or assert an organisation's location from its name.
7. Filter state, time, selected record and lens are linkable. A shared URL
   does **not** upload or contain browser-local source data.
8. The graph remains local-first. No AI or embedding provider is contacted
   without user permission. Ordinary search must work without one.
9. Source/projection separation remains in `packages/graph-core`. Renderer
   libraries cannot own the canonical data model.

## Introduced

- `field-atlas.ts` — shared lens filter/projection, recorded-degree, source
  receipts, date, coordinates and direct funding-link summaries.
- `field-atlas-annotations.ts` — independent review/confirmation layer.
  Annotation origins are explicitly typed `annotation` in the graph schema.
- `FieldAtlasWorkspace` — one shared selected record, filter bar and five
  exploration lenses with accessible record browsing and a common inspector;
  URL state, mobile layout and a visible ink/pencil/wash grammar.
- `field-atlas.css` — day/night design tokens, paper canvas, type hierarchy,
  shape grammar and responsive shell.
- Existing import and specialised full-network workflows remain accessible
  under **Detailed tools & full network**.

## The next engineering migrations — not yet shipped

These are substantial enough to do in independent, measured changes rather
than quietly claiming a mock-up is a new graph engine.

1. **Network rendering:** benchmark graphology + ForceAtlas2 worker +
   sigma.js against the real 5,876-node / 7,560-edge map, including Android.
   Replace the transitional SVG detail renderer and retire redundant renderers
   only after selection, labels, touch, evidence styling and performance pass.
2. **World map:** MapLibre + a self-hosted PMTiles/Protomaps basemap, arcs,
   density and unplaced drawer. The first atlas provides honest worldwide
   source-coordinate positions, but **does not yet have the new basemap**.
3. **Themes:** opt-in **on-device** embeddings + UMAP, theme suggestions with
   accept/dismiss and evidence. Current Themes groups by **source tags only**;
   it must never be represented as semantic embedding.
4. **Funding scale:** DuckDB-WASM, streaming GrantNav import and Parquet
   export, with the existing full-funding analysis preserved during migration.
   Current funding lens counts **direct source links**, not monetary totals.
5. **Stories:** portable static HTML + tiles + Parquet, and a correction
   review queue. Keep publication safety review, including sensitive records.
6. **Accessibility and speed:** keyboard and screen-reader audits at
   200% zoom; virtualised all-record browser; move layout and expensive
   aggregations to workers; 44px tap targets, avoid canvas-specific-only UI.

## Data/model gaps

- Existing data may lack dates or coordinates. Show the gap; never invent.
- An inferred suggestion requires a human-supplied reviewer and reason to
  become an annotated recorded relationship. A correction request is **not**
  itself a confirmed assertion.
- A record's saved local annotation is keyed to the graph fingerprint. A
  refreshed data version must be re-reviewed rather than silently inheriting
  an assertion attached to an older dataset.
- Inferred/pencil associations are only shown where the source graph has
  them. New semantic proposals must go through the explicit suggestion layer.

## Verification

Run:

```sh
npm ci
npm run test
npm run typecheck
npm run build
npm run test:e2e
```

Use the newly added `field-atlas.test.ts` to guard provenance, date, route,
coordinate, and annotation semantics. Test real funding imports, a CSV/Kumu
import, desktop WebGL fallback, and Android selection before replacing the
advanced workspace. Do not treat a CI build alone as user acceptance.
