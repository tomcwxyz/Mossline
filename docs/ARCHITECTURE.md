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

## Import provenance and coverage (alpha 0.7)

`GraphNode.origin` and `GraphEdge.origin` optionally include `fileName` and
`recordNumber`. These are *source location hints*, not identity guarantees.
For CSV the record number counts logical records from 1 (header) even when
quoted values span physical lines; Kumu uses 1-based array positions. Original
source IDs, preserved custom fields, and cross-record references remain
part of the existing schema.

`auditGraph` computes descriptive data coverage and disconnected entities,
but does not infer accuracy, data quality, legal rights or confidence. The
import preview reuses this report, without writing a graph until users confirm.
A separate keyboard-focusable visible-entities list complements the
Cytoscape canvas.

## Guided discovery and mapping (alpha 0.8)

`discoverData(file)` inspects a single Kumu JSON export or CSV locally.
Kumu configuration is modelled separately from populated graph records:
attribute definitions, accepted values, perspective names and linked Sheets
metadata do **not** count as imported entities or relationships. The importer
refuses to apply Kumu exports that contain no embedded graph records.

For CSV, the discovery layer profiles columns and returns **suggested mapping
rules**. `buildMappedGraph(file, mapping)` converts a deliberately reviewed
entity-list or relationship-rule configuration into a portable graph preview.
Multiple rules may map different pairs of columns into one canonical graph.
Generated IDs are deterministic by source column plus value. Source rows,
file names and logical record numbers are retained as provenance.
No semantic claim is auto-approved and no uploaded content is sent to an AI
service. A same-row value is not itself proof of a specific relationship.

A `Public` field explicitly equal to false/no/0/private causes the input
record to be excluded; relationships referencing hidden Kumu elements are
also excluded. This is a migration safety default, not a full permissions
system. Public publication and workspace-level access control must have
independent enforcement.

The demo/source Google Sheets connection indicated inside a Kumu configuration
file is not dereferenced. Users must provide separately exported rows if the
project's `elements` and `connections` arrays are empty. Styling, views,
positions, attachments and full Kumu backups are not converted.

## PFT feed reconciliation

A Kumu configuration backup with zero elements/connections must not be treated
as the complete network. The PFT network's rows are supplied by Google
Sheets and use separate `Elements` / `Connections` tabs. The canonical
model now preserves the original category semantics (including topics,
methodologies, outcomes and places), and the source connection IDs.
`Atlas region` is the preferred visual group; `Geographic reach` remains
part of original source properties and is not silently conflated.

The sheet also contains coordinate and geometry support tabs. They are not
network entities, so the CSV importer excludes them with a warning instead
of adding hundreds of spurious basemap nodes or coastline connections.
Future geography rendering should use a separately modelled display layer,
never append synthetic geometry into the source relationship network.

This is a read-only snapshot compatibility exercise. No live data has been
committed to the repository, and no Kumu or Sheets configuration was updated.

## Recipes, source identity and refresh review

`recipes.ts` defines a strict version-1 recipe format with explicit
mapping semantics, source column names, recipe family, revision and
creation timestamp; it contains no row data. Recipes are validated on
read and can be exported/imported as independent JSON files. Browser storage
is a local convenience, not a multi-user workspace or a synchronisation system.

`checkRecipeColumns` checks *exact required fields*, not heuristic aliases,
before allowing a stored mapping to be applied. This avoids silent drift when
source headings change. Reusing a recipe still requires a fresh preview and
explicit user confirmation.

`compareGraphDocuments` compares graph records by stable IDs and semantic
properties, excluding source record positions. If any IDs would disappear,
the user must additionally acknowledge that loss before replacing the graph.
The comparison is a descriptive change proposal, not verified provenance.
The generic CSV mapping path now emits identity-stable relationship IDs
rather than row-index IDs. Identical duplicate relation instances cannot be
distinguished without a user-supplied row-level stable identifier; this is
explicitly a future identity resolution task.

## Alpha 1.1 — novice discovery boundary

`GuidedDiscovery` presents small actual example paths from
`buildMappedGraph` with an explicit heuristic/verification caveat. It
separates user-facing interpretation from advanced field/graph modelling.
No network is created until the user previews and accepts the import.
A beginner's first import uses `createNewMap`; replacement is a
deliberate alternative with change review and removal confirmation.

The `regionEntityColumn` optional mapping field gives regional
metadata one specific entity column, preventing shared projects/funders
from inheriting regional values across multiple relationship rules.
Older mapping recipes without it still use the previous `regionTarget`
semantics, and can be updated through the review workflow.
Generic spreadsheets are conservatively classified as entity lists
unless known relation-column patterns or explicit endpoints are present.

The browser-local map collection (`mossline-local-maps-v1`) stores
named graph snapshots in localStorage; a legacy single-map snapshot is
bootstrapped once on first load. This is not shared, hosted, synced,
encrypted or production durability. Eight stored maps is an initial cap.

## Separately licensed visual asset packs and narrative overlays

`VisualAssetPack` is a manifest that references an external revision-pinned
asset repository. `matchAssetPack` only considers exact source record IDs;
`applyAssetPack` returns a disposable, image-enriched projection of the
canonical graph, never changing source records or exports. Unknown assets
fall back to source pictures and category symbols. An automatic PFT option
is shown only if at least five source IDs match the curated manifest.
No asset files are included in the open-source code repository.

A `SavedPerspective` optionally carries `presentation`: story heading,
introduction, HTTPS cover URL and illustrated-mode flag. It remains scoped
by the existing graph fingerprint. This is local browser persistence, not
published editorial content or a hosted multi-user permissions system.
Older perspectives without presentation retain backwards compatibility.

PFT image filenames match 82 of 107 current network element IDs. The PFT
feed's `Atlas location` field contains latitude/longitude strings, while
`mapx/mapy` and `geo` are different Kumu layout/geography metadata and
must not be silently used interchangeably. The asset pack registers the
original basemap but no geographic overlay is claimed until coordinates
are properly projected and independently tested.

## UK geographic projection (Alpha 1.3)

`geography.ts` strictly parses an original node property called
`Atlas location` as `latitude, longitude` and checks the regional UK
viewport. It intentionally does not use Kumu `geo`, `mapx`/`mapy`,
regional labels or geocoding guesses. `buildUkAtlas` returns located,
unlocated and outside-viewport records separately, preserving graph data.

The client renders public-domain Natural Earth simplified land outlines
in the same equirectangular projection as source-derived pins. Nearby
points are grouped by screen-cell for readability; underlying coordinates
remain unchanged in the graph. Only edges originally recorded in the
graph, with two plotted endpoints, become highlighted connection lines
on node selection. A standalone PFT basemap is shown as decoration and
is **not** georeferenced; compositing it directly behind the coordinate
overlay without registration would introduce false spatial claims.

Atlas view and narrative are user-saved presentation state, never written
into or substituted for original source records. The full PFT source
dataset remains outside this public code repository.

## Two ways of exploring geographic source records

The UK atlas separates *editorial display* from the source's geographic
facts. Illustrated projects show PFT artwork from source-matched entity
IDs, with a selected-location thread. These threads are **not**
network edges and never alter source records. Explore places shows
category-filtered source pins and projects recorded relationships
between selected visible endpoints. Missing source locations are not
created from labels, region names or Kumu layout coordinates.

Land-outline SVG paths are projected from Natural Earth 1:110m
United Kingdom and Ireland public-domain boundary features, using
the same equirectangular transform as points. Approximate rendering
does not replace proper cartographic projection or survey boundaries.

Saved perspective `presentation` optionally includes `atlasMode`
(stories/places) and `atlasKind` (all/project/organisation/funder/place).
Existing saved views without these optional fields remain valid.


## Network intelligence: notice, inspect, decide (experimental)

Mossline should offer discovery prompts before asking people to compose a question.
The first implementation computes local, source-backed signals (recorded
connectors, repeated source tags, region labels, and disconnected entities)
and, after optional semantic indexing, presents bounded similar-description
pairs as **unverified leads**. People can inspect original records from
each insight. Insights do not modify `GraphDocument`.

A durable visual model has four strictly separated evidence layers:

1. **Original source**: imported entities, attributes and recorded relationships.
2. **Source-derived**: calculated summaries and groupings, with their original IDs
   and counting method; not assertions about external reality.
3. **AI-suggested**: candidate themes and possible similarities, explicitly
   labelled as hypotheses and kept outside the canonical graph.
4. **User-confirmed** (future): reviewed and attributed annotations, only saved
   following an explicit authoring action with provenance.

Future visual interaction should let a person toggle thematic arrangements,
inspect highlighted evidence for a suggestion, and compare possible links
as visually *distinct dashed overlays*, never as ordinary source edges. Neither
similarity nor an LLM answer is sufficient to create a partnership edge.
Geographical suggestions must never silently manufacture coordinates.

Indexing is opt-in and browser-local. The network worker sends bounded text
batches, spaces requests to leave capacity under the observed free-tier
provider cap, retries 429s with a provider cooldown, and stores each completed
batch in IndexedDB so interrupted work can resume. It must not treat a
provider limit as a data or model validity error. The web API must preserve
a safe 429 status and retry delay. Multiple simultaneous browsers still
share provider quotas, so backoff remains necessary even with pacing.

The bounded lexical shortlist used for semantic candidate pairs is a
**discovery heuristic**, not exhaustive nearest-neighbour search, and must
not be presented as comprehensive evidence of missing connections.
