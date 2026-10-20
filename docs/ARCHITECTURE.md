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
