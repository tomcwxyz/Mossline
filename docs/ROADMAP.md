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

## Alpha 0.5 — question-centred exploration
- [x] Follow connections between any two entities with bounded source-record traversals.
- [x] Show each recorded relationship, direction and evidence inspector entry.
- [x] Highlight a chosen pathway in the network without altering canonical records.
- [ ] Compare several alternative pathways and choose an evidence-strength threshold.

## Alpha 0.6 — alternative pathways and structural junctions
- [x] Bounded search for up to three alternative, distinct simple recorded paths.
- [x] Optional exact relationship-type exclusion; evidence and direction shown for each hop.
- [x] Tarjan articulation-point detection on recorded, undirected graph components.
- [x] Accessible structural-junction list and optional highlighting in the network.
- [ ] Authenticated browser smoke test and visual refinement on larger real datasets.
- [ ] Document stronger provenance and confidence measurements before claims of influence.

## Alpha 0.7 — import assurance, provenance, accessibility
- [x] Preserve import source filenames and logical record/array positions as optional provenance.
- [x] Warn about unusable source and image URLs while retaining raw custom fields.
- [x] Source coverage report before import acceptance and on the active map (not a quality score).
- [x] Surface unconnected records, duplicated labels, classification gaps and source-file counts.
- [x] Keyboard-focusable visible-entities browser as an alternative to canvas selection.
- [ ] Authenticated Vercel preview visual/browser review for desktop and mobile.
- [ ] Real representative, permissioned Kumu/Sheets fixture for import round-trip assurance.
- [ ] Future mapping of Kumu styles, positions and metadata with an explicit loss report.

## Alpha 0.8 — data discovery and schema-mapping assistant
- [x] Separate Kumu project configuration from embedded network records.
- [x] Detect externally linked Sheets without exposing or dereferencing source credentials.
- [x] Prevent configuration-only projects from overwriting a working map with an empty graph.
- [x] Suggest original Kumu fields, element categories, connection types and custom-attribute handling.
- [x] Profile arbitrary CSV columns and recommend entity/relationship roles.
- [x] User-approved multiple relationship rules, optional region/description mapping and staged previews.
- [x] Local provenance and explicit confirmation before replacing the current graph.
- [x] Preserve and exclude rows explicitly marked non-public in Kumu/CSV.
- [x] Synthetic regression fixtures based on the structure of a Kumu project with multiple attributes, perspectives and a linked source.
- [ ] Test with representative, rights-cleared populated Kumu and Google Sheets exports.
- [ ] Mapping recipes: save, version, reuse, compare transformations and export a mapping report.
- [ ] Map attributes that vary across rows (multi-region) without accidentally implying one fixed location.
- [ ] XLSX, pasted tables, direct Google Sheets/Excel connectors and synchronisation previews.
- [ ] Optional AI-assisted semantic suggestions, explainable and explicitly approved; privacy-first.
- [ ] Entity identity matching/deduplication with human review before importing into an existing graph.
- [ ] Public/private visibility governance, independent of styling/presentation.
- [ ] Authenticated browser interaction/keyboard/mobile testing behind Vercel protection.

## PFT live-source structure review (alpha 0.9)
- [x] Read the linked PFT Kumu feed read-only; confirmed 107 entities and 242
      valid recorded connections, with seven distinct source categories.
- [x] Add dedicated topic, methodology and outcome types and map Geography to Place.
- [x] Honour Atlas region as a separate higher-priority grouping than Geographic reach.
- [x] Exclude identified position/basemap/coastline helper CSV tabs from network import.
- [x] Add synthetic PFT-shaped importer regression tests; CI and preview build pass.
- [ ] Authenticated browser import of populated Elements + Connections CSVs.
- [ ] Preservation and controlled rendering of Kumu geographic basemap and layout details.
- [ ] Rights and distribution audit for photographic sources before public publishing.
- [ ] Live Sheets import with read-only OAuth, diff preview, mapping recipe versioning and safe sync.

## Alpha 1.0 — repeatable mapping and changes-before-import
- [x] Schema-validated portable, browser-local field/relationship mapping recipes.
- [x] Save immutable revisions, reuse older revisions, import/export recipe JSON and delete local revisions.
- [x] Exact required-header compatibility checks before loading an old recipe.
- [x] Stable mapped relationship identity under spreadsheet row reorder.
- [x] Identity-based added/updated/removed graph summary in every import preview.
- [x] Additional explicit acknowledgement before replacing any currently stored entities/relationships.
- [x] Automated tests for recipe validation, schema drift, graph changes and stable IDs.
- [ ] Authenticated browser interaction review (including imported recipe file selection and destructive confirmation).
- [ ] More sophisticated identity resolution where names vary but external source IDs remain stable.
- [ ] Preserve entity-specific metadata from multiple relationship rows rather than first-row-wins.
- [ ] Merge rather than replace the existing graph, with conflict review and change provenance.
- [ ] Google Sheets read-only connections, sync proposals and schedule-aware change histories.

## Alpha 1.1 — discovery first, advanced mapping second
- [x] Show real source-derived example relationships before asking users to map tables.
- [x] Plain-language approve or adjust entry point; detailed mapping and recipes collapsed by default.
- [x] No synthetic links for spreadsheets that only contain entity name and region columns.
- [x] Keep location on the correct entity category across multi-relationship rules.
- [x] Validate ambiguous region/description reuse before building.
- [x] Create new maps by default; preserve existing local maps in a switchable browser library.
- [x] Reserve change reports, removal confirmation and destructive controls for explicit update actions.
- [x] Group findings into understandable explanations, with technical details available if requested.
- [x] Regression test fictional spreadsheet: 7 entities, 6 links, 1 private row excluded.
- [ ] Authenticated browser and mobile keyboard/screen-reader walkthrough of the whole import.
- [ ] Independent novice user test of a first map in 5 minutes, without graph terminology.
- [ ] Further polish of visual map preview for large/ambiguous source tables.
- [ ] Hosted named workspaces, proper map library and non-destructive database-backed sync.

## Alpha 1.2 — discoverable recorded connections and readability
- [x] Calculate reachable nodes within five recorded hops; exclude inferred-only links and source self.
- [x] Group destination choices by nearest route length; include entity category in each option.
- [x] Filter the destination selector by relationship-type exclusions.
- [x] Reset outdated destination and paths when start or exclusions change.
- [x] Guarantee a first shortest recorded route even where alternative-path search is bounded.
- [x] Select a node, then choose **Explore connections from here** in its inspector.
- [x] Offer one-click direct-connection options as alternatives to guessing endpoint names.
- [x] Fix low-contrast secondary actions and crowded connection panel labels.
- [x] Add tests for hop bounds, excluded types, direction, disconnected entities, inferred edges and duplicate links.
- [ ] Protected-preview authenticated browser and mobile keyboard/accessibility walkthrough.
- [ ] Typeahead/virtualised destination choices for very large imported maps.
- [ ] Offer a broader depth control and advanced directed-only exploration.

## Alpha 1.3 — owner-authored PFT visual companion (first stage)
- [x] Inspect PFT visual repository and map 82 exact image IDs to 107 PFT network records.
- [x] Keep the artwork in its owned repository; pin referenced asset revision.
- [x] General visual pack interface and pure presentation-only projection.
- [x] Apply owner-created illustration overrides without overwriting source image values.
- [x] PFT intro banner with original hero and evidence/prototype caveat.
- [x] Illustrated canvas palette and photographic circular nodes, with original-style switch.
- [x] Saved perspectives can include an authored title, introduction, cover HTTPS URL and style.
- [x] Schema and regression checks preserve older locally saved perspectives.
- [ ] Authenticated browser verification of imported PFT 107-node/242-edge preview and artwork.
- [ ] Illustrated UK atlas with tested geographic projection and separate custom positions.
- [ ] Geographical basemap and regional filters using explicit valid coordinates.
- [ ] Author-controlled node placement, edge styles, badges and per-perspective node display.
- [ ] Written explicit artwork-pack usage/licensing terms before public redistribution.

## Alpha 1.3 — artwork visibility correction
- [x] Fix stale "alpha 1.1" header on the Alpha 1.3 branch.
- [x] Make the real PFT hero/artwork gallery visible without importing PFT network data.
- [x] Offer a separate 20-entity illustrated **synthetic** showcase map on one click.
- [x] Verify all 20 example IDs match files in the 82-asset manifest.
- [x] Mark all mock links inferred so they cannot masquerade as recorded source relationships.
- [x] Vercel preview and CI production build/tests pass.
- [ ] Authenticated browser confirmation that all images render and layout is attractive.
- [ ] Import the real PFT 107/242 graph in-browser, then visually compare against Kumu.

## Alpha 1.3 — UK atlas geographic exploration (second stage)
- [x] Exact source `Atlas location` parsing with strict latitude/longitude checks.
- [x] Shared UK projection for source points and simplified Natural Earth outlines.
- [x] New UK atlas tab, with source-only location counts and explicit unlocated records.
- [x] Approximate cluster aggregation for overlapping pins, with selectable member list.
- [x] Show source-recorded connection lines only on selection, preserving all graph edges.
- [x] Link markers to the existing Node and Relationship inspectors.
- [x] Show owner's original PFT UK basemap as an unaligned artistic reference, not false geography.
- [x] Allow atlas views to be saved with authored story headers and filters.
- [x] Regression tests for invalid locations, no fake Kumu coordinate fallback, projection and perspective schema.
- [ ] Authenticated desktop/mobile browser review of actual 70 placed PFT entities; adjust label and cluster legibility.
- [ ] Georeference the PFT illustrated UK basemap or migrate to a licensed vector/tiled base layer.
- [ ] Per-perspective manual node arrangement independent of immutable source geographic coordinates.
- [ ] Improved geographic bounds/selection for source networks beyond the UK.

## Alpha 1.3 — illustrated atlas refinements
- [x] Replace hand-rounded UK outline with geometry directly derived from Natural Earth public-domain data.
- [x] Add Illustrated projects and Explore places presentations within UK atlas.
- [x] Curate source-located projects with PFT artwork, paginated project cards and a selected-place location thread.
- [x] Make category filters and search available for located entities without displaying every possible relationship.
- [x] Clarify which lines indicate geographical placement versus source-recorded relationships.
- [x] Preserve atlas mode and category in browser-saved perspectives and validate the new presentation fields.
- [ ] Authenticate and visually inspect project cards/markers at desktop and mobile sizes.
- [ ] Full manual per-perspective node placement with a separate authored-position model.
- [ ] Genuine georeferencing of the PFT illustrated UK basemap, if wanted, with registration controls.
- [ ] Label collision and clustering improvements for screen size, zoom level and large datasets.

## Alpha 1.4 — general-purpose perspectives and layout authoring (development)
- [x] Treat PFT as an optional illustration pack and example, not the default product experience.
- [x] Add a wholly fictional community-network example with diverse entity types.
- [x] Expose Editorial and Classic presentation modes for every dataset.
- [x] Save and restore drag-adjusted coordinates separately from canonical graph records.
- [x] Allow layout reset without modifying previously saved perspectives.
- [x] Accept common explicit Latitude/Longitude and lat/lon pairs for the UK atlas.
- [x] Show PFT reference artwork only for compatible PFT data.
- [x] GitHub Actions tests, TypeScript checks and production build pass (run 39490750503).
- [ ] Protected-preview browser acceptance: restored positions on filters, across reloads, smaller screens.
- [ ] Consider per-node locks, drag undo and saved-layout export/import.
- [ ] General geography via a configurable MapLibre basemap rather than hard-coded UK bounds.
- [ ] A user-selected illustration pack, independent of any bundled example.
- [ ] Server-backed workspaces, sharing and user-controlled publication permissions.


## Alpha 1.5 — network appearance authoring (development)
- [x] Validated per-node appearance overlays independent of the canonical graph.
- [x] Generic inspector: per-node label, size, emphasis and HTTPS image.
- [x] Save/restore node appearance in browser-local named perspectives.
- [x] Preserve original images, graph identifiers and recorded relationships.
- [ ] CI tests/typecheck/build and protected-preview browser acceptance.
- [x] Undo/redo manual positioning in the active view.
- [ ] Node locking and more complex authoring controls.
- [ ] User-managed asset library with attribution and licence information.
- [ ] Shareable public perspectives and hosted workspace permissions.


- [x] Undo and redo up to 20 manual node movements per active map/layout.
- [x] Restore saved perspectives without treating layout replay as a new user movement.


## Alpha 1.6 — portability and reuse of visual authoring
- [x] Versioned, schema-validated, graph-scoped export of saved perspectives without source graph records.
- [x] Import preview and explicit confirmation; append views with new IDs rather than overwrite.
- [x] Browser artwork library with creator, rights declaration, attribution and source URL.
- [x] Reuse library pictures for node styling and saved perspective covers.
- [x] Include rights metadata alongside perspective export/import, without copying image binaries.
- [x] Refuse cross-dataset import, unknown entity IDs and malformed or oversized files.
- [ ] End-to-end protected-preview tests for import/save/refresh across browsers and phone widths.
- [ ] Interactive licence/attribution display in published/public maps.
- [ ] Portable full-project format with canonical source rows, visual settings and editable assets.
- [ ] Hosted workspaces with publication and permissions.


## Alpha 1.7 — read-only snapshot sharing
- [x] Build strict minimal published graph schema: no raw source properties, import provenance or evidence payloads.
- [x] Keep recorded/inferred relationship distinction; explicit opt-ins for descriptions/images.
- [x] Review visible entities before generating public link; no automatic upload.
- [x] Browser-only compressed URL fragment with bounded decode and snapshot size.
- [x] Separate /share viewer with interactive read-only graph/atlas and accessible entity browser.
- [x] Source-privacy and malformed-payload regression tests.
- [ ] Authenticated preview browser test: generate, open and navigate a link; mobile keyboard and touch review.
- [ ] Hosted publication with real storage, revocation, durable short URLs and workspace permissions.
- [ ] Expiry controls, public attribution and provenance policy, redaction review and controlled updates.
- [ ] Handle larger networks beyond bounded URL-sharing prototype.


- [x] Require author approval after full list of disclosed entities and relationships.
- [x] Explicit opt-in for introductory story text, default off.
- [x] Compressed fragment round-trip and invalid-token tests in CI.


## Alpha 1.8 — controlled hosted publishing (draft)
- [x] Feature-gated separate Neon public snapshot store, with additive SQL migration.
- [x] Strong publisher authorisation for creating snapshots; distinct owner management keys stored hashed.
- [x] Stable public URLs and dynamic no-store, noindex public reader.
- [x] Owner-key authenticated atomic revision update and withdrawal.
- [x] Source-minimised snapshot schema reused from Alpha 1.7.
- [x] Studio controls with complete disclosure review, publishing, update and unpublish.
- [x] No browser storage of author or management secrets.
- [ ] Isolated development DB setup, migration application and live read/update/withdraw acceptance.
- [ ] Preview browser/mobile QA and independent public domain without Vercel preview SSO.
- [ ] Rate limiting, audit trail, abuse reporting, automatic expiry and operational monitoring.
- [ ] Real user accounts, team roles, invitations and restricted/private publications.


## Alpha 1.9 — funding landscapes and potential thematic connections
- [x] Funding-specific CSV importer for grant records, with common 360Giving-style field autodetection and manual field review.
- [x] Directed funder → grant → organisation edges retaining multiple grants and amounts.
- [x] Preserve organisation/grant IDs; exclude source-marked private rows; keep amount and currency disaggregated.
- [x] Funding summary of grants, recipients, funders, award totals by currency and multi-funded organisations.
- [x] Three clearly labelled candidate theme sources: recorded source themes, reviewable topic phrase rules and provisional word overlaps.
- [x] Every candidate can show source evidence and links to entities, but never creates an inferred graph edge automatically.
- [x] Synthetic mixed-funder test fixture, mapping preview and standalone example CSV.
- [ ] Test against multiple real, rights-cleared large 360Giving publisher CSV datasets (including missing data, alias drift and non-standard dates).
- [ ] Optional, consent-driven embeddings across grant descriptions, with per-record provenance and model/version metadata.
- [ ] Optional LLM labelling of candidate clusters and question suggestions grounded solely in retrieved grants.
- [ ] Human-reviewed network annotations, theme curation and gap/hypothesis exploration.
- [ ] Identity-resolution review for mixed aliases, identifier schemes and funder/recipient dual roles.
- [ ] Multi-file grant import, UK place grouping and temporal / programme filters.


## Alpha 2 — semantic discovery and human review
- [x] Prepare short, bounded award excerpts without raw properties, contact details or monetary amounts.
- [x] Provider-agnostic, server-configured OpenAI-compatible embeddings API, disabled unless configured.
- [x] Explicit author opt-in and shared access key before any external transmission.
- [x] Pairwise cosine candidate ranking with separate grant evidence, IDs, model and score.
- [x] Compare and explain a pair using an optional LLM (strict two-grant context; no independent graph changes).
- [x] Human review: worth exploring / dismissed, browser-local decision memory and portable shortlist export.
- [x] Fully local keyword and explicit-theme matching remain available without models or network calls.
- [ ] Publisher-linked authentication instead of a temporary operator access code.
- [ ] User-selected local model adapter or hosted embedding settings with per-provider consent.
- [ ] Evaluate human relevance and false-positive rates on multiple UK grant datasets.
- [ ] Multi-grant evidence clustering, theme editing and question-led exploration.
- [ ] Cost controls, usage reporting, rate limiting and provider fallbacks before general public rollout.


## Alpha 2.1 — mixed GrantNav imports and funding theme clusters
- [x] Handle 2025 GrantNav-style CSV fields including supplementary recipient region.
- [x] Filter individual recipient grants and prevent their personal descriptions from reaching the organisational map.
- [x] Explain skipped and excluded rows and the sampling limit explicitly.
- [x] Funder-balanced detail subset for files with more than 1,200 eligible organisation grants.
- [x] Aggregate themes from explicit source tags and matching title/description phrases, without creating graph edges.
- [x] Theme-specific funders, recipients, multi-funded organisational bridges, amount totals by currency and inspectable grant evidence.
- [x] Classify only when there is an explicit tag or phrase match; show unclassified coverage.
- [x] Synthetic large/mixed-input tests. No upload of user grant data.
- [ ] Full-dataset analysis and scalable stored maps for many thousands of awards, without sample truncation.
- [ ] Named geographic and date/programme filters with source-to-beneficiary vs organisation-location distinctions.
- [ ] Human-managed theme vocabulary and manual override/review of theme membership.
- [ ] Embedding-based cluster enrichment and clearly sourced explanatory questions after provider configuration.
- [ ] Network viewport level-of-detail clustering / virtualisation for very large imports.


## Alpha 2.2 — analysis/rendering separation
- [x] Analyse every eligible organisational grant without discarding rows simply because the canvas is capped.
- [x] Reconcile repeated grant IDs using latest valid `Date Modified`; independent of CSV row order.
- [x] Distinct full-source coverage and smaller, funder-balanced network-detail indicators.
- [x] Full-source theme clusters, award totals, recipient/funder overlap and regional recipient-organisation location counts.
- [x] Persist only compact aggregate report plus detailed reduced graph in browser-local maps.
- [x] Explain grant evidence that is outside the canvas, rather than linking to a nonexistent rendered node.
- [x] Full-data vs reduced-network regression tests with over 1,000 synthetic grant records.
- [ ] User-selected theme filters that regenerate a more relevant detailed network subset without re-uploading the whole CSV.
- [ ] Move large-scale graph processing into a Web Worker for very large multi-year exports.
- [ ] Dedicated durable workspace storage for full source data; avoid assuming browser localStorage is a database.
- [ ] Clear beneficiary vs recipient vs grant funder location comparisons.
- [ ] Quality review tooling for conflicting grant revisions or missing source metadata.
- [ ] Scalable embeddings over the full dataset, with privacy review, budget caps and clearly documented selection.

## Browser responsiveness and GrantNav imports
- [x] Background worker for expensive CSV parsing, eligibility filters and full-source aggregation.
- [x] Cancellable analysis with progress notices and explicit manual remapping.
- [x] Cap the initial interactive funding graph to 120 grants without limiting full-source totals.
- [x] Never ship the full raw grant CSV/graph back to React or persist it in the browser's map library.
- [x] Avoid synchronous full-grant parsing during initial interface render.
- [x] Offer backup + explicit reset for overly large saved browser map libraries.
- [ ] Benchmark actual browser responsiveness and memory on multiple low-memory devices.
- [ ] Per-theme and per-funder network selection to replace static 120-grant overview.
- [ ] IndexedDB-backed datasets and efficient incremental processing for much larger multi-year files.


## Large dataset architecture
- [x] Separate full eligible organisation records from the rendered graph.
- [x] Store the complete eligible graph in IndexedDB (browser-local), not in localStorage.
- [x] Run dataset persistence and arbitrary full-dataset grant queries in Web Workers.
- [x] Regenerate focused network views by theme, funder, region, text and page from all records.
- [x] Page through *all* matching grants; avoid a permanently inaccessible "first 120".
- [x] Keep source analytics unchanged while swapping the visual selection.
- [x] Unit-test complete record reachability and filter correctness on larger synthetic files.
- [ ] Store full aggregates/indexes only in IndexedDB, reducing localStorage summaries for much larger data.
- [ ] Incremental/streaming CSV parsing and indexed award records for 100k+ / GB-scale sources.
- [ ] Datasets management and export/import/backup (including IndexedDB), storage usage and clean deletion.
- [ ] Aggregate/cluster-based canvas rendering, rather than many individual grant-event nodes.
- [ ] Fine-grained saved filters and multi-dimensional drilldowns; benchmark real low-memory devices.
- [ ] Optional server workspace persistence for collaborative/synchronised or very large datasets.

## Alpha 2.4 — reliable local recovery (development)

- [x] Export complete browser-local funding datasets separately from map-library backups.
- [x] Add-only, collision-safe IndexedDB restore, preserving dataset identities.
- [x] Map-library backup restore with validation and explicit replace confirmation.
- [x] Guard deletion of funding datasets referenced by saved maps.
- [x] Keep recovery independent of large canvas and network rendering.
- [x] Document the two-file backup workflow and sensitive data caveats.
- [ ] Manually verify backup/restore/delete on Chrome, Firefox and small-memory devices.
- [ ] Fully portable single-file workspace backup including views, art, recipes and funding data.
- [ ] Streaming/archive export and incremental import for very large datasets.
- [ ] Assess more intuitive filtering and clustered views with real users before widening the interface.

## Whole-graph adaptive exploration — initial implementation

- [x] Reusable source-agnostic graph aggregation in graph-core (not tied to grant records).
- [x] Every entity represented once, every relationship counted either directly,
      across groups or within one group; group totals are not inferred partnerships.
- [x] Deterministic nested groups, expandable to original source records without paging.
- [x] Background-worker whole-network view for complete funding data in IndexedDB.
- [x] Group-aware Cytoscape overview, click-to-expand and keyboard-accessible list.
- [x] Guard a crowded viewport rather than discarding connections or silently sampling.
- [ ] Browser-level performance and usability acceptance against real GrantNav data.
- [ ] Integrate adaptive overview as the default large-network canvas for **all**
      Kumu, CSV and other generic graph imports, not just saved funding datasets.
- [ ] Incremental/streamed general-purpose source storage rather than localStorage.
- [ ] Stable hierarchical layout/semantic zoom and focus-neighbourhood transitions
      with preserved user-authored positions.
- [ ] More meaningful grouping recipes (community detection, geography, funding,
      themes), with explicit provenance and no invented links.

## Generic large-network integration (development)

- [x] Use the adaptive complete-graph viewport for general Kumu/CSV studio views
      when more than 260 entities or 650 connections would be rendered.
- [x] Send the active full graph to a dedicated worker once; expand groups
      without rebuilding the entire studio on the main thread.
- [ ] Move large generic graph storage and filtering off the main thread too
      (currently browser localStorage and synchronous source filtering).
- [ ] Preserve authored node positioning when switching between small-graph
      canvas and group-based overview.

## Alpha 2.5 — simpler start and exploration (development)

- [x] A focused first-run entry with saved maps, CSV/Kumu and funding imports, examples.
- [x] Promote one primary network workspace and three recognisable view choices.
- [x] Disclose saved views, sharing, appearance and connection tools progressively.
- [x] Put full indexed funding-network exploration in the primary map.
- [x] Move evidence and advanced analysis out of the initial scan path.
- [ ] Check imported funding dataset counts and exports are labelled accurately.
- [ ] Manually test workflows and mobile/keyboard accessibility.
- [ ] Replace current main-thread generic graph filtering and layout with
      scalable, source-agnostic full-graph rendering.

## Alpha 2.6 — connected exploration (development)

- [x] Search every source entity, including those currently inside collapsed groups.
- [x] Inspect actual recorded source relationships through a background worker.
- [x] Navigate from any entity to a linked entity with automatic group reveal.
- [x] Preserve an entity-to-entity back trail, show connection filters and counts.
- [x] Highlight a selected node and nearby relationships without changing source data.
- [ ] Test navigation with large real networks and low-powered devices.
- [ ] Persist stable authored layouts through drilling and add full-graph GPU renderer.
- [ ] Refactor the ordinary small-network inspector onto the same navigation model.

## Alpha 2.7 — original full-graph renderer and semantic exploration (in development)
- [x] Optional raw WebGL mode: each source node and each recorded source edge is drawn,
      with deterministic, worker-calculated positions rather than the grouped projection.
- [x] Source-agnostic semantic preparation across **all eligible** entities (no 48-record sampling).
- [x] Embeddings in 48-item batches, resumable locally cached batches, progress and cancellation.
- [x] Source-backed question retrieval and an optional strictly evidence-limited LLM answer.
- [x] Explicit permission before remote model calls; explicitly private records are excluded.
- [ ] CI/build validation and real browser/WebGL and provider smoke tests.
- [ ] Real-dataset GPU performance benchmark and fallback for unsupported GPUs.
- [ ] Budget limits, auth, model audit, user-level quotas and comprehensive privacy review.
- [ ] True layout persistence and semantic zoom / organisation clusters with meaningful positioning.
- [ ] Add relationship descriptions to the embedding index under a separately approved policy.

## Alpha 2.8 — one entry route and complete funding graph by default

- [x] Replace ambiguous "Explore your data" launch button with the actual two
      import choices at the top: general CSV/Kumu/JSON and funding awards.
- [x] Remove duplicate import choices further down the welcome page.
- [x] Open funded datasets directly in the all-node/all-edge WebGL view;
      the grouped summary stays available as an explicit alternative.
- [x] Stop creating a default 75-grant network projection during funding import.
      Complete source grants are persisted to IndexedDB; a bounded detailed
      editing graph remains only as a compatibility companion.
- [x] Replace misleading "not represented" and small-canvas warning text with
      accurate full-dataset totals and a quiet explanation of the old detail view.
- [x] Add regression coverage for exact source-network GPU geometry and no
      misleading sample-limit warnings.
- [ ] Manual Android and desktop browser acceptance on real 2k+ award import.

## Alpha 2.9 — general networks at funding-import scale

- [x] Read general CSV/Kumu/native JSON File objects inside a Web Worker.
- [x] Run CSV discovery and all full-file mapped previews in the worker,
      preserving guided adjustments and advanced mapping recipes.
- [x] Store original large non-funding graphs in browser IndexedDB, not the
      synchronous 2.6-million-character map-library restoration path.
- [x] Persist metadata/reference and exact counts while keeping the complete
      graph available to the existing network, analysis and mapping tools.
- [x] Automatically hydrate large generic maps on browser reopen or map switch.
- [x] Add all-dataset generic IndexedDB backup/restore and recovery status.
- [x] Preserve the original simple localStorage route for small maps.
- [ ] Manual Android acceptance with 2k/10k rows and malformed/multi-file Kumu
      imports, including browser reload and separate backup/restore.
- [ ] Benchmark worker memory, transfer time, IndexedDB quotas, and large graph
      visualisation and analytics on devices with limited RAM.
- [ ] Incremental streamed CSV parsing for files beyond the 60 MB local budget.

## Alpha 2.10 — scale after import (large general networks)

- [x] Avoid eager duplicate `filterGraph`/decorated graph creation while the
      complete general network is displayed in the worker-backed full explorer.
- [x] Open large general networks in WebGL Full graph by default; keep the
      grouped overview as a selectable alternate.
- [x] Preserve the original detailed mapping, appearance and filtering tools
      through an explicit **Detailed mapping tools** opt-in for large maps.
      Large Cytoscape layouts may be slow and are not the default on Android.
- [x] Defer costly geographic atlas preparation until Places is selected.
- [x] Defer relationship drop-down sorting and accessible trace preparation
      until Follow a connection is open.
- [x] Defer structural-junction analysis until its section is opened.
- [x] Replace recursive structural junction DFS with an iterative Tarjan
      implementation; regression test includes a 25,000-node chain.
- [x] Coalesce WebGL canvas updates to animation frames rather than drawing
      once per incoming pointermove/scroll event.
- [ ] Validate on real mobile browser 2,000/10,000-row datasets (memory,
      navigation, reload and touch gesture performance).
- [ ] Benchmark computed cross-project collaborations and Places view on
      exceptionally dense graphs; move expensive projections to workers if
      real-world tests warrant it.

## Alpha 2.11 — consistent map interaction

- [x] Full-source WebGL nodes highlight exact original recorded one-hop relationships
      and neighbours, dimming unrelated nodes and lines rather than hiding them.
- [x] Keep inferred associations out of the recorded-connection highlight.
- [x] Node selection in the full graph smoothly pans to focus and zooms enough
      for inspection; clicking empty canvas clears selection.
- [x] Native non-passive wheel handling confines mouse/trackpad zoom to the
      canvas instead of accidentally scrolling the whole page.
- [x] Two-pointer pinch, pinch-centre pan, single-pointer drag, anchored mouse
      zoom and zoom-fit buttons in full-source mode.
- [x] Consistent selected-node camera focus in standard and grouped Cytoscape
      map modes, preserving recorded neighbour emphasis.
- [x] Keyboard/mouse search and source inspector remain alternatives to precise
      touch selection in dense areas.
- [x] Regression tests distinguish recorded source edges, parallel edges,
      inferred associations and isolated entities.
- [ ] Manual desktop Chrome/Firefox/Edge and Android/touch browser gesture QA.

### Future — one upload entry point, extensible dataset discovery
The homepage should eventually open one **Bring your data** journey, not force
the user to guess the network semantics first. Initial browser-local sniffing
will classify data by structural signals (CSV headers, sample rows, file pairs,
JSON shape, Kumu metadata, record types and known schema signatures).
Candidate adapters will return **proposed** import plans with confidence and
rationale: funding awards, general entity lists, relationship tables, Kumu
elements/connections, spatial data, survey flows and future formats.
- Prefer rules and evidence to mandatory hosted AI classification.
- For ambiguous or mixed-schema inputs, show two or more interpretations and
  offer field mapping correction. Never silently discard unknown data columns.
- Require explicit confirmation of entity identifiers, relationship direction,
  private-record exclusions and aggregation rules before import.
- Once understood, route the approved plan through the existing worker/IndexedDB
  infrastructure. Preserve full source provenance; no first-N projection.
- Treat provider-specific import adapters as extensions, not a growing nest of
  special cases in the home page.
