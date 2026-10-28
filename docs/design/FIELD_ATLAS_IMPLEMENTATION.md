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

## v2: the atlas as designed (`feat/field-atlas-v2`)

The shell and every lens were rebuilt against the guidance pack's look and feel.

| Area | What it is now | Where |
| --- | --- | --- |
| Shell | Full-bleed canvas, one header (dataset menu, lens pill, search, Night/Day, Share view), filter chips over the canvas, key bottom-left, time strip under the canvas, 380px record panel. Phone: chips behind **Refine results**, panel becomes a bottom sheet. One Night/Day choice for every lens and the front page, remembered on the device (`mossline:atlas-theme`). | `FieldAtlasWorkspace.tsx`, `field-atlas.css` |
| Network | Sigma 4 on a paper ground. Louvain groups, then ForceAtlas2 (LinLog) in a worker with links inside a group pulling harder than links between groups, then a short spacing pass. A d3-contour **wash** sits under the marks and each area is named by its dominant source tag (or "Around <hub>"). Bridging links are drawn quieter. Selecting a record draws its ink links, quiet pencil links and non-overlapping labels; a route is framed clear of the route panel. | `atlas/NetworkLens.tsx`, `atlas/layout.ts`, `workers/atlas-layout.worker.ts` |
| Map | MapLibre GL with a self-hosted Natural Earth 1:10m coastline (simplified, 971 KB) and water-lining. Small pale marks at rest; the selection and what it touches come forward in full colour, with a name card. Place records are drawn as dots with uppercase names; seas and uplands come from a small built-in gazetteer (`atlas/gazetteer.ts`, orientation only, never used to place records). Graticule with degree labels, an inset locator, funder arcs sized by recorded amount, a pill counting what is outside the view, a Points/Hexagons switch, and a margin card for records without coordinates (a pill on phones). Selecting a record frames it and what it touches. No tiles or third-party requests. | `atlas/MapLens.tsx`, `atlas/gazetteer.ts`, `scripts/build-basemap.mjs`, `public/geo/` |
| Themes | Source tags only: each record sits in its most widely shared tag, packed with d3-hierarchy. Never presented as semantic clustering. | `atlas/layout.ts#themeLayout` |
| Funding | d3-sankey funder → theme → region, by money where amounts are recorded (unvalued links disclosed, not counted as zero) or by links. Co-funding matrix with the "overlap is not coordination" caveat. | `atlas/FundingLens.tsx`, `graph-core/field-atlas.ts#fundingFlows` |
| Timeline | Swimlanes: rows by funder (grants sized by amount), by theme, or by relationship, with each dated record as a mark along a shared year axis. Year-only dates are spread across their year rather than given an invented day. The brushable year bars sit on the same axis and filter every lens. | `atlas/TimeLens.tsx` |
| Front page | Rebuilt in the atlas identity: line-mark logo and Newsreader wordmark, paper and ink tokens, a small drawn atlas showing ink, pencil and wash, and the same Night/Day choice. | `StartScreen.tsx`, `MapStudio.tsx` |
| Everywhere else | Advanced tools, the funding and import workbenches, recovery and shared views use the same tokens, fonts, wordmark and Night/Day choice. The atlas tokens are defined on `:root`; the theme is set on `<html data-theme>` before first paint. The legacy stylesheet's ~1,100 literal colours were moved onto tokens by `scripts/retheme-legacy-css.py` (by role and hue); the old graph canvases keep a dark plate because their renderers draw light marks. | `field-atlas.css`, `globals.css`, `atlas/theme.ts`, `atlas/Wordmark.tsx` |
| Example | A seeded, fictional northern food and farming network (383 records, 671 recorded links, 248 grants with amounts) opened from **Or try an example network**. The advanced tools keep the small community example. | `data/generators/northern-food-example.mjs` |

### Implementation notes worth keeping

- **Sigma 4 sizes:** set `itemSizesReference: "screen"`. The default sizes marks in graph units, so a ForceAtlas2 layout thousands of units wide draws pin-pricks.
- **Sigma 4 dashed edges:** `layerDashed({ dashSize: { attribute } })` reads the *display data*, so the edge reducer must copy `dashSize`/`gapSize` through. A zero gap draws nothing, so a recorded (solid) line is one very long dash with a token gap.
- **MapLibre worker:** MapLibre looks for its worker beside its own module, which the bundler moves. `apps/web/scripts/copy-maplibre-worker.mjs` (run by `predev`/`prebuild`) copies it to `public/vendor/` and `MapLens` calls `setWorkerUrl`. `maplibre-gl.css` sets `.maplibregl-map { position: relative }`, hence the doubled class on the map container.
- **Colour in WebGL:** Sigma and MapLibre cannot read CSS custom properties, so `atlas/palette.ts` mirrors the `--ml-*` tokens. Change both together.

### Still to do

1. **Real-device performance.** The network is laid out in a worker before Sigma is created, so a large map is drawn once, at its final positions. Layouts are cached per dataset and lens, so switching lens or Night/Day does not lay out again. Above 3,000 records the layout takes fewer, coarser steps and links are straight rather than curved. Measured on a synthetic 5,876-record / 7,560-link map, production build, in this sandbox (software WebGL, so slower than any real GPU): about 23 s to settle before, about 8 s after. Still to measure on a mid-range laptop and an Android phone.
2. **Basemap detail.** The coastline is enough for national and regional views. Street-level context would need self-hosted PMTiles/Protomaps.
3. **Themes by meaning.** Opt-in, on-device embeddings + UMAP with accept/dismiss and evidence. Until then Themes stays source-tag only.
4. **Funding scale.** DuckDB-WASM, streaming GrantNav import and Parquet export.
5. **Stories.** Portable static HTML + Parquet, and a correction review queue.
6. **Accessibility.** axe passes on Network, Funding and Timeline in day and night themes; a screen-reader pass at 200% zoom is still owed.

## Getting data in

One *Add data* flow (`apps/web/src/components/AddData.tsx`, worker
`add-data.worker.ts`) replaces separate importers in the atlas and on the
front page: tables are read by shapes, joined on org-id identifiers and
checked before saving. Approximate places from postcodes are hollow marks
on the Map and are described in the record panel. The previous importers
remain in Advanced tools. Details: [Getting data in](../DATA_IN.md).

## Relationships: direction, kinds, signs and loops

Relationship and systems maps (as people draw them in Kumu) read in the
Network lens:

- **Direction.** Directed links carry arrowheads, mutual links point both
  ways, undirected links have none. The record panel and Follow a connection
  show → ← ↔ —. Follow can be limited to arrows only, so routes run cause →
  effect or activity → outcome (`findRecordedRoutes(…, { followDirection })`).
- **Kinds of link.** The key lists each kind with its count and hides or
  shows it across every lens (`hiddenLinkTypes`). A map with up to eight kinds
  colours links by kind.
- **Signs.** A link's `Polarity` (from a Kumu polarity/effect/sign field, a
  links table's column, or a type that is only "+" or "−") marks cause and
  effect: + more leads to more, − more leads to less. A map where most links
  are signed colours by sign; signs show as badges on the links in focus.
- **Feedback loops.** `feedbackLoops` finds simple cycles along recorded,
  directed links only, bounded in length, number and search effort (and says
  when it stopped early). A loop is reinforcing (R) with an even number of −
  links, balancing (B) with an odd number, and unknown (L) if any sign is
  missing. Loops are listed beside the network, highlighted as a route, and
  listed on each record they pass through.
- **Small maps** (80 records or fewer) are laid out as one drawing with room
  for every name, and without the wash or area names.

`apps/web/public/samples/kumu-systems-map.json` is an invented
cause-and-effect map for trying this (*Try a cause-and-effect map* in Add data).

## Editing a map in place

**Edit** in the atlas header lets a person build and change a map inside
Mossline, as in Kumu, without touching what their files said
(`packages/graph-core/src/edits.ts`, `apps/web/src/components/atlas/Editing.tsx`).

- **Changes beside imports.** Every change (add, change or remove a record or
  link) is an entry in an edit list saved in this browser under the map's ID
  (`mossline:edits:v1:<mapId>`). `applyEdits` lays them over the imported map;
  adding data again refreshes the imported part and the changes reapply. A
  change whose record is no longer present waits rather than vanishing.
- **Receipts.** A changed record keeps its file receipts and gains one for the
  change (who, when, why). A link entered here reads "Entered by …". An
  overridden value keeps what the file said (`was`), shown in the change list
  and restored by Undo.
- **What you can do.** Add a record; edit its name, type, description, tags,
  region and postcode; remove it (its links go with it). Add a link from the
  record panel, choosing the other end by name or on the map, with its kind,
  direction and sign; edit or remove any link. **Quick entry** turns typed
  lines into records and links (`Volunteers + Meals served`,
  `Trust -> funds -> Project`, `A <-> partners <-> B`).
- **Undo and export.** Each change can be undone and redone. Export the map
  with its changes (Mossline JSON), as Elements and Connections sheets that
  Kumu imports (with a Source column for each item), or the changes alone as a
  backup.
- **One person, one browser for now.** Sharing an edit list between people
  would need storage outside the browser; the list is designed so it could be
  merged later.

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
