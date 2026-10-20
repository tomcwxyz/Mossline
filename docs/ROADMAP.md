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
