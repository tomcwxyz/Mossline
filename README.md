# Mossline

**Make sense of connected worlds.**

Mossline is an Apache-2.0 open-source **technical alpha** for exploring relationships
between organisations, projects, people, funders and places. It is a general-purpose
network mapping studio, not a PFT-specific product.

As of Alpha 2.3 (October 2026), Mossline offers guided CSV/Kumu imports, visual
perspectives, path/evidence exploration, a UK atlas, privacy-reviewed read-only
sharing and an optional funding-landscape workflow. Large organisational grant
datasets are analysed in a background worker and retained in browser IndexedDB;
the canvas displays only a focused page. Some optional AI discovery and hosted
publishing features require operator configuration and are disabled by default.

**Still an alpha:** no hosted multi-user workspace, live Google Sheets
synchronisation or complete Kumu project migration. Browser-saved maps and full
funding datasets are separate storage layers and are not automatically synced
to other devices. Do not rely on this alpha as your only copy of important data.
See [local backup and recovery](docs/RECOVERY.md) before importing real data.

## Built for any network — Alpha 1.4 preview

Mossline is **not a PFT product**. The farming imagery and network are a separately
owned, optional example showing one possible editorial treatment. A second fictional
**Neighbourhood Connections** example demonstrates organisations, projects, funders,
places, people, topics and outcomes without any PFT artwork or specialised schema.
Open **Explore example networks** to try either example without replacing your map.

The **Editorial / Classic** visual-style choice is available for *any* imported map.
Source images are retained; special PFT imagery is only matched for the relevant
dataset by original source IDs. The UK atlas works with explicit **Latitude** /
**Longitude**, **lat/lon**, **lat/lng** or **Atlas location** source fields. It
never geocodes names or uses Kumu visual-layout coordinates as geography, and
still has deliberately UK-only coverage.

**Arrange a network:** drag nodes in Landscape or Collaborations; select
**Save view** to store all on-screen positions together with filters, layout,
narrative and style in a named perspective. Reopening the perspective restores
the manually arranged positions. **Reset arrangement** recalculates the current
view without changing previously saved perspectives. The original graph,
source records and imported coordinates are never altered. Older perspectives
without saved node positions remain valid. Browser local storage is still the
only persistence mechanism; no hosted accounts, collaborative editing or map
publishing has been added yet.

The Alpha 1.4 work is a feature branch stacked on Alpha 1.3 and has passed automated CI but awaits
interactive browser acceptance. PFT-specific art attribution and licences are
still governed separately from Mossline's Apache-2.0 code licence.

## Run locally

Requires Node.js 22+ and npm 10+.

~~~bash
npm install
npm run test
npm run typecheck
npm run dev
~~~

Then open http://localhost:3000. You can inspect, search, filter and navigate entities and relationships; switch between Landscape and Collaborations; preview Kumu blueprint JSON or two Sheets CSV exports before replacing the current local map; and import or export a portable Mossline JSON graph; and select the collaboration basis (shared project, funder or explicitly recorded links). The inferred edges are **not** assertions of partnership.

Imported JSON is validated and stored in browser local storage. It is never uploaded to a server. Reset the demo from the sidebar.

## MCP

~~~bash
npm run mcp
~~~

MCP uses local stdio. It reads the fictional data/demo.json unless MOSSLINE_DATA_FILE points to another graph document. This is separate from browser storage; export the map if you want your MCP host to read the same graph.

Tools: list_maps, search_entities, get_entity, get_neighbourhood, find_paths, get_collaborations. MCP is **read-only** and not suitable for public exposure without auth, scopes and auditing.

## Data format

~~~json
{"version":1,"title":"My landscape","description":"","nodes":[{"id":"org-1","label":"Organisation A","type":"organisation"},{"id":"proj-1","label":"Project B","type":"project"}],"edges":[{"id":"rel-1","source":"org-1","target":"proj-1","type":"delivers"}]}
~~~

Types: organisation, project, funder, person, place, other. Nodes support description, region, tags and HTTP(S) image/source URLs. Edges support description, source URL, direction and inferred status. Imported nodes and edges also retain origin identifiers and custom source properties. Stable IDs are mandatory; duplicate IDs and dangling edges are rejected. Inferred collaboration edges include evidenceNodeIds for the supporting shared project or funder.

## Kumu / Sheets import (local preview)

Click **Import data**. For Kumu, choose a blueprint JSON file containing top-level
`elements` and `connections` arrays. For Sheets, download the Elements and Connections
tabs separately as CSV files, then select both CSV files in the picker.

The preview shows counts, unknown types, duplicated labels and missing/ambiguous
connection endpoints. Imports with errors cannot be applied. Confirmation replaces the
current browser-local graph; **export your previous map before confirming**. Your
source files are never uploaded to Mossline.

The importer retains Kumu element and connection IDs, custom fields, tags, and
recognised direction values. Unknown element categories become **Other**, retaining
their original type. Re-importing identical files yields stable IDs; importing is not
yet a merge or live sync. No source data is pushed back into Kumu or Sheets.

**Limitations:** full Kumu project backup envelopes, views, positions, loops,
attachments and live Sheets synchronisation are not yet translated. Where a blueprint
has additional top-level fields the preview warns rather than silently claiming
a complete migration. Real rights-cleared exports are required for compatibility
tests. Keep the existing Kumu project unchanged.

## Roadmap and contributing

See docs/ROADMAP.md, docs/ARCHITECTURE.md, CONTRIBUTING.md and AGENTS.md. Migration requires real representative, rights-cleared Kumu and Sheets exports first. Keep the existing working Kumu project unchanged throughout prototyping.

License: Apache-2.0. No mandatory proprietary AI service or database is required for the prototype.

## Saved perspectives (alpha 0.3)
Name and save filters, search, layout and label choices in the sidebar. These are local browser
preferences, scoped to a fingerprint of graph topology, and do not create duplicate graph records.
They are not hosted, shared, or exposed to MCP. Export your graph separately. Profile artwork
is generated with CSS; an imported image URL can optionally replace it. Use only images you
have permission to publish; there is not yet an attribution management workflow.

### Grouped regional layout
Choose **Layout → Regions** to group records by the region text in the dataset. Groups
are decorative Cytoscape compound nodes: they are not persisted to the graph and they
do not imply proximity, collaboration or precise geography. Nodes without a region appear
in **Across the landscape**. Regional grouping is distinct from the future MapLibre basemap.

## Why are these connected? (alpha 0.4)

Click a relationship line on the network, or select **Why?** beside an entity's connection.
The evidence inspector differentiates source-recorded relationships from inferred associations.
For inferred links, it shows the supporting projects or funders and the **actual recorded path**
from each organisation to that item. Shared funders may be reached through funded projects.
When there is no suitable direct or two-hop source path, the inspector says so rather than
inventing a connection. Select **Explore in the landscape** to see a supporting node in context.
These are explanations of what the source dataset says, *not independent verification*.
No source data is changed by exploring evidence.

## Trace a connection (alpha 0.5)

Use **Follow a connection** to choose two entities and find a pathway of up to five
**recorded source relationships**. The canvas highlights the route, and each step
has a **Why?** link to its underlying relationship record. Traversal can run
against a directed assertion in either direction for exploration, but the
arrow beside each step preserves the recorded direction. Inferred connections
are never used as shortcuts. No path within five steps is **not** proof that
there is no relationship. An example links fictional North Fields Collective to
Riverbank Trust through a project and funder. This remains browser-local and
read-only. The MCP's separate path tool remains unchanged.

## Alternative routes and structural junctions (alpha 0.6)
The connection explorer can display up to three **distinct simple paths** using
recorded links (shortest candidates first) and exclude an exact relationship
type. The results are bounded and **not exhaustive**, and path arrows retain
the source edge direction even when traversed in reverse. Select an alternative
to highlight it and open its original records.

**Structural junctions** use cut-vertex (articulation-point) analysis of the
undirected recorded graph, across all connected components. A junction is a
node whose removal would separate part of its component; this is not a
claim that it is influential, trustworthy or essential to an organisation.
Inferred edges are excluded and changing perspectives does not mutate source
data. Optional outlines highlight junctions in the network.

## Data health and import provenance (alpha 0.7)

Before confirming an import, Mossline shows a **coverage report** with entity and
relationship counts, missing descriptions and regions, unconnected entities,
duplicate labels, and record provenance. The sidebar also has an expandable
**Data health & provenance** report for the current dataset.

This is descriptive coverage, **not a quality, truth, accuracy, trust, or impact score**.
A record without a URL or description may be perfectly legitimate. Kumu views,
layout positions, styles, attachments and full project backups remain unsupported.

For CSV imports, `origin.fileName` and `origin.recordNumber` identify the
original CSV file and **logical data record** (including the header as record 1,
not the physical text line where a multiline CSV cell begins). Kumu blueprint
arrays use their element/connection **array position** starting from 1. Those
source references remain optional for old maps and survive portable JSON exports.
Invalid HTTP(S) source/image URL values are reported and retained as original
properties rather than silently discarded.

The **Browse entities** expander makes visible nodes selectable through ordinary
keyboard-focusable buttons. It is an alternative to canvas clicking; no server
upload, database write or access to the user's existing Kumu project occurs.

## Bring your data as it is — guided mapping (alpha 0.8)

**Discover your data** accepts a Kumu project JSON or a CSV file. It separates
source inspection from import acceptance: no network data is changed until a
populated, validated graph is previewed and explicitly confirmed.

### Kumu configuration
A Kumu project export can define attributes, perspectives, styles and
externally connected data even with **zero embedded elements and connections**.
For this case Mossline shows:
- the number of defined fields and Kumu perspectives
- candidate entity types and relationship vocabulary
- field-by-field recommendations (mapped, needs review, preserve as custom)
- whether a linked Google Sheets source was referenced
- a clear blocker explaining that the spreadsheet rows must be supplied separately

A configuration-only Kumu file **cannot replace the current map with an empty
graph**. The linked Sheets source is not fetched by Mossline and its connection
identifier is not displayed in the mapping panel. Full Kumu CSS/styles,
geographic overlays, asset management and view recreation are future work.

When a Kumu blueprint **does contain** embedded records, the importer understands
`Element Type`, `Connection Type`, `Topics`, `Geographic reach`, and
`Website` alongside earlier Mossline/CSV headings. Unmapped source attributes
remain available as custom properties.

### Ordinary spreadsheet columns
For a single CSV with familiar headings (e.g. `Organisation`,
`Project`, `Funder`, `Region`), the guided workbench:

1. Profiles headers, populated/distinct counts and a few sample values.
2. Suggests entity and relationship column roles (not facts).
3. Lets you choose an **entity list** or **relationships between columns**.
4. Allows multiple relationship rules, with editable entity types, direction
   through source/target columns, and user-approved relationship labels.
5. Lets you map description and region, including which side of a relationship
   a region refers to, before building a graph preview.
6. Shows errors and skipped rows, followed by the existing provenance/coverage
   report and an explicit confirmation to replace the current browser map.

The basic mapping is deterministic and browser-local. **It does not use AI, read
your Google account, infer trust or causality, or send uploaded rows to a server.**
Users must review relationship semantics; appearing in the same row alone does
not establish a partnership or funding relationship.

Rows explicitly marked `Public=FALSE`, `No`, `0`, or `Private` are excluded
from both Kumu and guided CSV imports by default, including Kumu relationships
that point to hidden elements. Retained raw custom fields and imports are
still browser-local, **not guaranteed suitable for public publication**:
review permissions and data-sharing rights before sharing exports.

**Current limits:** CSV and Kumu-project JSON discovery only, no XLSX,
no direct Sheets/Excel connection, no reusable mapping recipes, no semantic
LLM suggestions, no source merge/sync, and no full project-level Kumu migration.
A real populated source export and authenticated browser interaction test are
still required before this branch is ready to merge.

### Try the mapper without another file
Click **Try sample spreadsheet** to load a wholly fictional farming
Organisation/Project/Funder/Region CSV in the local discovery workspace.
The sample deliberately includes a `Public=FALSE` row so its exclusion is
visible in the preview. Suggested relationship rules are editable; no import
takes place until you build a preview and confirm replacing the browser map.

## PFT feed compatibility review (alpha 0.9)

We checked the user-provided Kumu project configuration against a **separately
connected PFT Google Sheets feed**, without modifying either source. The
project JSON contains attribute definitions and perspectives but no embedded
graph records. The linked spreadsheet supplies two actual network tabs:

- **Elements:** 107 populated rows (30 organisations, 25 projects,
  10 funders, 16 geographies, 12 topics, 5 theory-of-change
  methodologies and 9 theory-of-change outputs).
- **Connections:** 242 populated relationship rows, all resolving
  against an element ID in this snapshot.

All rows in this particular feed are marked public, but explicitly labelled
**prototype/demonstration and unverified**. The feed is a snapshot, not a
verified directory. Do not interpret connections as endorsements or confirmed
partnerships.

The importer now maps the seven categories to dedicated canonical types
(`Geography` → `place`, `ToC Methodology` → `methodology`,
`ToC Output` → `outcome`). `Atlas region` takes precedence over
`Geographic reach` for the visible regional grouping, while original
columns remain in properties. This distinction was caught by a
PFT-shaped regression test, which now passes.

Four visual-only helper tabs — `Positions (ignore)`, `Basemap`,
`Coast points`, `Coast lines` — are explicitly skipped with warnings
during multi-CSV network import. They are **not discarded from the original
Sheet**: their geographic overlay/placement rendering is simply outside
this alpha. To import via the UI, download only the **Elements** and
**Connections** tabs as CSV (or use the separately prepared portable
Mossline JSON snapshot). No raw client spreadsheet or actual records have
been committed to the public repository.

This compatibility check covers structure and source references. A protected
preview browser smoke test, verification of image rights, map recreation
and shared/live Google Sheets synchronisation remain outstanding.

## Alpha 1.0 — mapping recipes and reviewed refreshes

The **Discover your data** CSV mapping workbench can save the currently reviewed
field/relationship interpretation as a local recipe, then **use**, **revise**,
**delete**, **export JSON** or **import JSON** for reuse. Each save of a selected
recipe name creates a new revision in the same family and retains its earlier
revisions. A recipe is versioned and schema-validated; it stores **column names
and user-approved mapping rules only**, not spreadsheet rows, values, source
credentials or the user's graph. Browser-local storage holds at most 40
revisions. JSON export makes the recipe portable across browsers.

When applied to a newer CSV, a recipe checks for *required exact column names*.
Reordered columns are compatible; additional columns produce a review notice;
renamed or missing required columns block use until the mapping is revised.
Matching headings do not guarantee that the meaning of the new rows is unchanged.

Before any import replaces the currently displayed graph, Mossline now
shows an identity-based change summary: added, removed and changed entities and
relationships, with examples of differences. Source row numbers are excluded
from semantic comparisons. Proposed removals require **explicit additional
confirmation**. The user can always export the existing graph first.

Guided-mapping relationship IDs now depend on the entity pair, relationship
semantics and duplicate occurrence, rather than spreadsheet row position.
This reduces false changes when rows are reordered. Distinct identical duplicate
rows remain indistinguishable and should be reviewed if source evidence differs.

**No live sync, background monitoring or automatic writes are performed.**
A review is required for every replacement. Existing paired Kumu Elements/
Connections CSV import still uses its dedicated importer; saved recipes
currently apply to single generic CSV discovery/mapping only.

## Alpha 1.1 — show the network before asking users to model it

**Discover your data** now begins with a visual, source-derived sample of
the possible entities and relationships. Users can select **Yes — show me
the network** or **Not quite — help me adjust it**. The latter offers
plain-language corrections to which columns describe connections, regions
and descriptions. Full entity-type/rule editing and the Alpha 1.0 saved
mapping recipes remain available under **Advanced mapping and saved recipes**.

Suggestions use **deterministic, local heuristics**, not an AI model.
Mossline does not infer a relationship merely from unrelated Name and Region
columns. For ordinary Organisation/Project/Funder rows, it suggests plausible
relationships while always requiring review. If a region applies to an
organisation, the same row no longer assigns that location to its project
or funder. Choosing Region as both the region and description field raises
a clear error instead of producing contradictory output.

**Create a new map** is now the default after preview. The current map is
saved in a small browser-local **Your maps** collection, and users can
switch back without export/re-import. The browser currently supports eight
saved maps; localStorage limits can be smaller, so export important work as
JSON. The previous **update current map** path remains available explicitly,
with a descriptive change report and additional consent for removals.
Warnings are summarised in normal language; original detailed findings are
available behind a technical disclosure.

This is a real UI implementation and automated model/build test, **not yet
a completed authenticated browser usability or accessibility trial**.
No hosted multi-user workspaces, server data storage or model/API inference
have been added.

## Alpha 1.2 — follow only real recorded connections

**Follow a connection** now starts with one selected entity, then limits the
second dropdown to destinations reachable within **five recorded links**.
Destinations are grouped by minimum hop count and sorted by name within each
group. Inferred shared associations are not used to calculate reachability.
Choosing a destination immediately opens its shortest recorded route and can
display alternative routes and original source relationship direction.

The optional relationship-type exclusion updates this list immediately.
Changing the start or filter clears the old destination, preventing stale or
impossible route selections. Unreachable, disconnected, self, and inferred-only
destinations never appear. No options means no path *within this limit and
these settings*, not that the entities have no relationship at all.

The entity inspector includes **Explore connections from here**, and the
sidebar offers quick links to up to four directly connected entities. Users
do not have to know destination names in advance.

The import screen has also received contrast/focus and spacing fixes: light
background secondary/close buttons have dark accessible text, and the
connection sidebar uses more readable labels, inputs and responsive widths.
These styles and controls need a protected-preview desktop/mobile visual
review before the branch is approved for merge.

## Alpha 1.3 — source-ID visual packs and narrated perspectives

The **PFT illustrated farming landscape** is a separate visual companion to
source records. When at least five node SOURCE IDs match the curated manifest,
Mossline offers an **illustrated** visual style and uses up to 82 original
owner-created illustrations. Images are served from a commit-pinned public
asset repository, not copied into Mossline's source code. Any prior `Image`
or `imageUrl` value remains unchanged in imported JSON and exports.

The companion includes the original PFT front-page hero, introductory text,
and a reference to the UK basemap for a future geographic perspective.
Illustrations only depict subject matter; they are not evidence that the
fictional/prototype entities or relationships exist in reality.
Unmatched entities retain their original images or category symbols.

The **Save view** form now also offers a story title, introductory paragraph
and an optional HTTPS cover illustration. This narrative and visual style are
saved as optional *presentation* properties on a browser-local perspective.
Older saved perspectives remain valid; no entity or relationship changes
when opening a saved story. All saved views remain scoped to the exact
network and are local to this browser.

**Artwork ownership:** the user confirmed ownership of
`tomcwxyz/pft-network-images`, but the repository doesn't yet publish a
machine-readable reuse licence. The Mossline implementation references
the separately hosted original files rather than bundling/relicensing them
under the Mossline code licence. No generic right to redistribute this
companion pack is implied. Future distribution should have its own explicit
terms, independent of the open-source software licence.

**Next:** a proper geographic layer using validated Atlas location (lat/lon)
separately from Kumu's authored `mapx/mapy` positions; configurable
perspective positioning; mobile visual and authenticated browser review.
The included basemap is registered as an asset but not yet geo-referenced
or rendered as a geographical network background.

### Alpha 1.3 — visible artwork smoke test

The initial Alpha 1.3 preview appeared unchanged because the visible header
still said "alpha 1.1" and the PFT visual pack only activated **after** a
PFT graph containing at least five exact source IDs had been loaded. This
made the feature impossible to evaluate on the built-in non-PFT demo.

The header now correctly reads **alpha 1.3**. A conspicuous **PFT artwork
preview** is visible on the first screen even with a non-PFT map open:
it shows the real owner-created hero, a browseable artwork gallery and
**Open illustrated example map**. The button creates a separate map with
20 illustrated entity examples, without overwriting any existing local maps.

**The example is deliberately synthetic**. Its 20 connections are
`inferred=true` so source-record searches and evidence inspectors do
not present them as actual PFT relationships. To test the real PFT
network, use **Discover your data** with the separate PFT Elements +
Connections CSVs or the previously prepared portable Mossline JSON.
The images should then appear automatically wherever source IDs match.

This is a testable preview, not a claim of a completed authenticated visual
browser walkthrough. The owner-hosted images load from a public, revision-
pinned GitHub raw URL, and are not packaged under Mossline's code licence.

## Alpha 1.3 — UK geographic atlas (second stage)

The studio now provides a third **UK atlas** view alongside Landscape and
Collaborations. Atlas positions come **only** from the entity's original
`Atlas location` property, parsed as `latitude, longitude`. No
geocoding is guessed from names, region labels, Kumu `geo`,
`mapx` or `mapy`. Records without this field stay unlocated.

The map uses public-domain simplified Natural Earth outlines of Great Britain
and Ireland, projected with exactly the same UK-bounded equirectangular
transform as the plotted source locations. This is an **approximate
geographic exploration**, not a survey-grade map or licensed base-map tiles.
Any records outside this regional viewport are counted separately rather
than moved to invented border coordinates.

To reduce clutter, nearby entities are grouped into selectable clusters;
click a cluster to choose the exact entity and see its source links.
Relationship lines appear when an entity is selected, for source-recorded
connections whose endpoints also have locations. Unlocated entities and
relationships remain accessible via Landscape and the inspector. The original
PFT UK basemap illustration is available **as an artistic reference only**,
explicitly not aligned to the coordinate frame.

**Test with real PFT data:** Select **Discover your data**, upload the
PFT-Mossline-network.json snapshot (or Elements/Connections CSVs) and
**Create a new map**. Select **UK atlas** in the left navigation. With the
currently supplied PFT snapshot, 70 of 107 nodes have valid `Atlas location`
coordinates and 37 remain unlocated. The 242 original network relationships
are preserved. The smaller 20-entity illustration showcase intentionally
has no geographic coordinates and should show the atlas empty state.

Saved browser-local perspectives now support `view: "atlas"`, including
the custom title, narrative and selected categories. Existing perspectives
continue to load.

**Out of scope for this phase:** true georeferencing of the original PFT
illustrated basemap, a live tile-map view, advanced map projections, persistent
per-view manual positioning, and authenticated hands-on/mobile visual QA.

## Alpha 1.3 — refined illustrated UK atlas

The UK atlas offers two complementary ways of seeing the *same* source data:

- **Illustrated projects:** starts with projects that have an original
  `Atlas location`. It shows the owner's illustrations as a curated,
  paginated editorial strip under the UK outline. Select a project to
  highlight its exact source location using a gold location thread.
  This thread represents **position, not a relationship**. Related entities
  and evidence links appear in the adjacent inspector.
- **Explore places:** zooms conceptually back out to the source-located
  network. Filter to projects, organisations, funders, places or all,
  search by entity name, and inspect clustered locations and selectively
  revealed original source relationships.

The country outlines were regenerated directly from Natural Earth
1:110m public-domain feature coordinates, using the *same bounding
transform* as the pins rather than hand-positioned illustrative silhouettes.
They remain appropriately labelled as regional/approximate.

The atlas avoids showing all possible relationship lines at once, and
keeps 37 currently unlocated PFT entities accessible in Landscape.
The current PFT source snapshot has 20 located projects among 70
located entities; **none are geocoded by guessing place names**.
Saved perspectives retain the illustrated/places choice and selected
entity category alongside the existing narrative and filters.

The authored PFT illustration repository is still referenced as an
externally owned asset pack. The original PFT basemap is visible for
artistic comparison but is not silently used as a georeferenced map.

Known limits: project cards are a responsive editorial presentation,
not saved Kumu `mapx/mapy` coordinates; the geographic rendering
still needs authenticated desktop/mobile/browser acceptance.


## Alpha 1.5 — authoring individual node appearance (draft)

Mossline now supports per-node presentation overrides **for any network**.
In Landscape or Collaborations select a node, then choose **How should this
appear?** Set the label to automatic/always visible/hidden, change its size
to compact or featured, highlight it, or apply an HTTPS image URL.
Save a named perspective to retain these choices alongside manual positions,
filters, labels and story settings. Reopening the perspective restores them.

Visual overrides never update the canonical graph, source-provided images,
relationships or exported data. HTTPS image links are display-only, not uploads
or licences, and users must have rights to use the artwork. Existing saved
perspectives without overrides remain readable. The feature is deliberately
available for all graph entity types, not only farming datasets; geographic
source coordinates cannot be adjusted through this editor.

This draft requires CI and manual protected-preview desktop/mobile usability
review before merge.


### Undo and redo for arranged nodes

Dragging a node now records a bounded arrangement history for the active map
and layout. Use **Undo** and **Redo** above the canvas; new movements clear
redo history. Reset arrangement recalculates the layout without editing any
saved perspective or underlying source data. Undo/redo is session-local,
available for up to 20 manual movements, and is intentionally separate
from the names and versions of saved perspectives.


## Alpha 1.6 — portable perspectives and a reusable artwork library

Mossline's authoring remains local-first, but your saved views needn't be trapped
in a single browser. Under **Saved perspectives**, use **Export views** to download
a strict versioned JSON bundle that contains the saved perspectives for the
current map, including labels, arrangement, styles, story and external artwork
references. The bundle contains **no canonical graph records or relationships**.
Use **Import views** on the same dataset in another browser; Mossline validates
the package and confirms the number and names of incoming views before appending
them. Existing views are never replaced. Export and import the underlying Mossline
map separately when moving to another browser.

The **Artwork library** holds up to 60 reusable HTTPS picture *references* with
a title, creator, declared licence, optional source URL and attribution note.
An author can choose a saved image when styling an entity or a story cover.
The library is browser-local. Imported/exported perspective bundles include its
referenced artwork metadata and image URLs, but **never the image binaries**.
Mossline does not verify claimed licences; choose rights-cleared artwork and
review external URLs before sharing. Remote images may contact their host when
shown, including after importing a bundle. Removing a library entry never silently
alters already-saved perspectives.

A bundle is scoped to a matching graph fingerprint and currently known entity
IDs. It cannot be imported onto arbitrary other datasets and does not attempt to
merge, relabel or invent relationships. Fingerprints are convenience identifiers,
**not cryptographic access controls**. Import is limited to 1 MB, 40 perspectives
and 60 artwork references; browser storage limits still apply.


## Alpha 1.7 — read-only share links for small network views (draft)

Choose **Share a view** in the studio to generate a **self-contained,
read-only snapshot link**. This is an explicitly confirmed publication
action, separate from saving local working perspectives. Its default
disclosure is minimal: it contains labels, types, visible relationship
assertions with their inferred flags, and the author's current layout.
It strips all raw source properties (except explicit atlas coordinates in
the UK atlas view), file provenance, source URLs, evidence data, internal
notes, descriptions and external pictures. The author can separately opt
to include descriptions or external image URLs and sees the number and
sample names of the entities included before generating a link.

The viewer is a distinct `/share` page: it displays only the shared
snapshot, never local saved maps, local artwork libraries or editing
controls. It offers a network or atlas view, entity browser and
relationship inspection. The content is compressed into a URL **fragment**
(`#s=…`), so it is not uploaded or sent as part of an HTTP request to
the Mossline web server. The complete shareable content is *inside the
URL*. Anyone with that URL can decode, copy, archive and redistribute
the included data. **These links cannot be revoked, permissions cannot
be restricted, and subsequent edits do not update them**. Do not share
confidential, personal or unauthorised information through this feature.
External images, when opted in, may contact their own servers when
loaded. Inferred links are visibly labelled as inferred, not certified.

Compression is bounded to 7,500 fragment characters and 150 KB of
decompressed JSON. The graph is additionally limited to 150 entities
and 300 links. Larger networks should be filtered first; share links
are not a substitute for full-project export or hosted controlled
publishing. Fragment links also require a publicly accessible viewer:
if a Vercel preview is protected by team sign-in, recipients will not
be able to use it anonymously. Hosted publishing with permissions,
revocation, audit and durable short URLs remains a later release.


### Publication review safeguard
Before producing a share link, Mossline lists every included entity and
relationship assertion (not just a preview subset) and requires explicit
confirmation of permission to share. The map's narrative introduction is a
separate opt-in, **off by default**, alongside descriptions and external
images. Sharing a snapshot is a disclosure event even though it doesn't
upload data to the Mossline server; the link cannot be revoked.
The web compression codec is exercised by a browser-API-compatible
round-trip and malformed-link regression test in CI.


## Alpha 1.8 — controlled hosted publishing (development)

The **Publish online** panel provides a stable, read-only URL under `/p/<slug>`,
rather than a large embedded fragment link. A source-minimised snapshot is
deliberately reviewed before being stored. The publisher receives an
independent secret management key to update or unpublish the public view.

**Not enabled by default.** This branch includes additive SQL migration and
the server-only configuration requirements, but no Neon Mossline database or
Vercel publishing credentials have been configured or migrated. Consult
[Hosted publishing setup](docs/HOSTED_PUBLISHING.md) for an isolated development
rollout and security limitations. This does not implement team logins, private
publishing, or fine-grained reader permissions. Anyone with the URL can access
the current publication; withdrawal cannot recall redistributed copies.


## Alpha 1.9 — Funding landscapes and emerging themes

Mossline now provides a purpose-built **Map funding landscape** workflow for
flat grant award CSV files, including standard field names from common
360Giving exports. Awards remain distinct **project** entities, with two
directed recorded links: **funder → award → recipient**. This keeps repeated
grants, dates, amounts and programme descriptions separately inspectable
without collapsing multiple awards into one line. Funders and recipients are
deduplicated by their provided official identifier when available, otherwise
by a normalised name (which should be reviewed for collisions/variants).
People receiving individual grants are not imported by this workflow.

The **funding insight** panel summarises documented funders, organisation
recipients, awards, currency-specific amount totals, and organisations
receiving awards from several funders. It suggests **potential thematic
connections** by two transparent mechanisms:

1. Matching explicit source-assigned theme tags across recipients.
2. Interpretable topic-bridge phrase patterns (such as food insecurity and
   community meals), separately labelled as candidate themes.
3. Shared significant words in award descriptions and programmes,
   labelled as provisional keyword overlap — not semantic embeddings.

Every suggestion names both recipients, notes whether they have different
recorded funders, and reveals the texts that triggered the suggestion.
These candidate insights are never added as graph relationships. A
funder jointly financing two recipients is not proof of a partnership
between them. Awarded amounts are financial commitments, not evidence
of project impact, actual payments or local unmet need.

**Try it:** choose **Map funding landscape → Try fictional funding
landscape**. Inspect the detected field mappings and preview; create a
separate local map, then explore the themed connections. Downloadable
synthetic CSV: `apps/web/public/funding-landscape-example.csv`.

CSV processing is local in the browser, and the source import is not
sent to AI or LLM services. The workflow respects rows marked
`Public=FALSE` or `Private`. Raw grant details are retained within
the user's browser-local graph and need review before any online
publication. Share/publish retain the separate, deliberately minimised
snapshot schema and author consent.

### AI path: hybrid candidate discovery (design, not enabled)

A future optional model-assisted stage will use:

- Rules: preserve award identity, source evidence, co-funding
  and source-assigned themes as authoritative *records*.
- Embedding retrieval: rank grants with semantically similar summaries
  even when their word choices do not overlap, with model/version,
  retrieval scores and per-grant source IDs.
- A constrained, citation-oriented LLM: propose a limited number of
  questions or draft theme labels **only for retrieved grant records**,
  always showing those records for review.
- Deterministic constraints/decisions: privacy filtering, thresholds,
  contradictions, confidence calibration, audit and explicit human
  approval before any newly created connection enters a graph.

This approach is provider-agnostic (e.g. local Ollama embeddings or a
server-configured external model), strictly opt-in before transmitting
grant descriptions. Neither an LLM nor an embedding model may silently
create a *recorded* connection, claim a partnership, infer causation or
certify a funding gap. Empty/low-quality descriptions should yield
"insufficient evidence", not invented suggestions. Publishing any
model output requires separate confirmation.


## Alpha 2 — Discover connections in funding landscapes

In a funding landscape, open **Connections worth exploring** underneath
the funding facts. Mossline now provides a **reviewable, evidence-linked
discovery workflow**, even without a model provider: inspect candidate pairs
of recipients, their grant descriptions, and the reason for each suggestion.
Mark a pair **Worth exploring** or **Dismiss**, and export an evidence-bearing
JSON shortlist. Review decisions persist in this browser against the exact
source network fingerprint, and **never** create or modify recorded graph edges.

An optional model-assisted route can embed selected grant descriptions and
rank semantically similar awards across recipients. The **text similarity**
value is a ranking aid, not a probability of meaningful collaboration. An
optional LLM can offer a short evidence-bound interpretation of a matched pair.
AI results are clearly labelled as hypotheses and always link to the two
underlying grant records. On first use, the author explicitly approves
sending up to 48 short summaries to the configured remote provider.

**Important:** remote embeddings and explanations remain disabled without
server-side provider and access-code configuration. No user map is
automatically sent to a model, and no AI service is required for local
discovery. See [Discovery setup](docs/DISCOVERY_MODELS.md) for configuration,
limits and acceptance tests.


## Alpha 2.1 — clusters from real 360Giving/GrantNav exports

Funding Landscapes now surfaces **theme clusters** across awards. Each
cluster shows how many grants, recipient organisations and funders have a
matching source theme or an explicitly labelled, reviewable phrase rule.
Each has independent source grant examples, funder/recipient identities,
and a list of recipients supported by several funders *within that theme*.
The totals are reported separately by currency. As individual grants may
belong to several themes, **never add thematic totals together**.

The new GrantNav mixed-recipient CSV handling recognises
`Recipient Region (additional data)`, and excludes rows containing
`Recipient Individual Id`, `Recipient Individual Name` or
`Type of Recipient = Individual` from organisational maps. It does not
expose these individual recipients in nodes, graph relationships or
network exports. Source rows marked private are also excluded.

To avoid crashing a browser or exceeding its local storage, this release
allows CSV uploads up to **12 MB** but limits *detailed map*
representation to **120 organisation grants**. For a larger source
file, it chooses a funder-balanced exploratory subset and clearly
reports the number of eligible source rows that were not mapped.
**The resulting map, amounts and theme insights cover the subset only,
not the whole CSV.** They are not representative estimates. For a
complete landscape or further analysis, filter the export by programme,
funding geography or date and import the relevant section.

The multi-thousand-award test behind this change came from a
user-provided 2025 North East GrantNav CSV. **The actual user dataset was
not committed or deployed, nor transmitted to a model provider.**
Tests use a fully synthetic data fixture with equivalent field names.

Themes are deliberately cautious: the source tag, the phrase that matched,
and whether any grant remains *unclassified* are always available.
Missing classifications are not proof of gaps in funding or unmet need.
This is a starting point for question-led exploration, not a definitive
subject classification or causal model.


## Alpha 2.2 — full-data funding analysis, reduced network view

**Alpha 2.2 replaces Alpha 2.1's subset-only analytical limitation.**
The importer now assembles *all eligible organisational grant records* in
a temporary in-browser graph, reconciles duplicate grant identifiers by
their latest valid `Date Modified` version, and calculates compact
**full-source funding analytics** before creating the reduced interactive
canvas graph.

All eligible, unique grants contribute to:
- Overall award totals, separately by currency; distinct funder/recipient
  counts and the count of recipients supported by multiple funders.
- Ranked funders and repeated recipients across the source export.
- Counts by **recipient organisation region** (not beneficiary location).
- Source theme and phrase-rule clusters, each with amount, funder,
  organisation and evidence coverage; explicitly unclassified grants.

The network canvas remains a **funder-balanced, non-representative
selection of up to 120 grants**, keeping the view navigable. Full-data
theme cards label their scope prominently. Where a complete-data grant
is absent from the selection, its evidence remains readable, but it is
not falsely offered as an interactive canvas node.

The full raw graph is **not persisted**, sent to a model or uploaded
to Neon. Only the compact aggregate results and reduced network are
stored in the browser's map library. The aggregate survives switching
between local maps. Editing/replacing source graph data invalidates
the old aggregate to prevent stale full-source conclusions.

### Real-world verification (user-provided GrantNav format)

An uploaded 7,757-row 2025 GrantNav extract was inspected locally:
3,971 individual-recipient awards were excluded; 3,786
organisation-recipient rows resolved to **3,780 unique grant IDs**
after six repeated grant IDs were reconciled using their 2026 modified
versions, including one changed amount. These records cover 90 unique
funder identifiers and 2,009 recipient identifiers. The user's
original file **was not committed to GitHub, deployed or sent to an AI
provider**. Automated integration tests use synthetic GrantNav-format CSV.

This full-data analysis is still a snapshot of the *supplied export*.
It does **not** correct unknown data completeness, infer locality of
beneficiaries, account for inflation, or establish need, impact,
partnership or public spending. Optional semantic embeddings remain
capped at 48 grant excerpts selected from the **detail network** and
must not be represented as having analysed every award.

## Browser responsiveness fix for large funding files

Large GrantNav CSVs are now parsed, deduplicated and analysed in a
**cancellable Web Worker**, not synchronously in the React render phase.
Changing a mapped column requires an explicit **Apply mapping and
reanalyse** action; ordinary typing does not repeatedly process the CSV.
Import progress is surfaced in the interface, and file contents remain
browser-local. This avoids blocking the main interface during the full
analysis of multi-thousand-award extracts.

The interactive graph now contains up to **120 grants** (plus selected
funders and recipients). The **full funding totals and theme clusters
continue to use all eligible, unique organisation awards** and remain
separately labelled. This initial graph is exploratory, not a complete or
statistically representative network.

Saved map collections exceeding the safe automatic-restore size are not
parsed on page load; instead a backup export and explicitly confirmed
local cache reset are offered. The original cache is retained until the
user chooses to reset it. New local map writes no longer redundantly
store the same graph twice under legacy keys.

A small alpha should still treat browser storage as a convenience, not
as a database for large grant landscapes. See the roadmap for durable
workspace storage and user-controlled ways to regenerate network views
from the full source.


### Independent browser map recovery

If a large map makes the studio slow or difficult to navigate, open
[`/recover`](https://mossline-omega.vercel.app/recover) directly. It does
not mount the graph visualiser or automatically restore any saved networks.
Map-library JSON is parsed in a Web Worker, with only map names and small
counts sent to the interface. Choose **Download complete saved-map backup**,
check that it exists on your computer, and select **Remove selected map**.
You can also deliberately clear the local map cache after backing it up.
Both operations only affect the current browser's local saved maps, not
hosted publications, other workspaces or Neon data.

The studio's map switcher now links to **Manage saved maps**.
Recovery backups include the raw saved-map keys, which may contain private
grant descriptions or contact data: handle these backup files accordingly.


## Large grant landscapes: persistent full dataset + query-driven network

Funding Landscape workspaces no longer stop at a static 120-award canvas
selection. Mossline analyses all eligible organisation grants in a background
worker, then **stores the complete eligible organisational graph in IndexedDB**
after the user explicitly creates the landscape. The raw CSV and
individual-recipient awards are **not** saved to that dataset store.

The browser map collection retains a lightweight first projection. A new
**Full-dataset explorer** panel provides search across award descriptions,
titles, programme and organisation names, plus filters for funder, theme
and recipient-organisation region. The explorer queries the full stored dataset
in a separate Worker and returns only a page of matched grants (75 by default,
120 maximum) to the Cytoscape canvas. Page forward/backward until every
matching grant can be reached. Filtering does **not** change the underlying
full-source figures, and each canvas page states exactly what it represents.

This approach means the graphical network is a **view** of the data, not a
hard limit on how many grants Mossline can hold. It remains browser-local and
doesn't need a login, a server database or API credentials. An independent
IndexedDB store handles datasets larger than localStorage can sensibly hold.

**Current limits:** This alpha uses an in-memory CSV parser and full-graph
schema validation in a Web Worker, and restricts upload files to 60 MB.
It is not yet a streaming 1 GB / million-record implementation. Large
imports may still require substantial worker memory and available browser
storage. A browser storage quota error will be shown explicitly rather
than silently losing the full dataset. The full grant graph is available
only in the browser where it was imported, not automatically backed up to
Neon or the hosted publishing service.

Existing older maps with only a compact summary and a preselected canvas
graph must be **reimported** once to gain a persistent complete dataset.
Editing or replacing a map's source graph invalidates its previous full-data
analysis; moving between query views keeps the full dataset and analysis intact.

## Alpha 2.7 — full-network exploration and model-assisted questions

**Full graph:** In the network workspace, choose **Full graph + AI**, then
**Full graph** to render every original entity as a GPU point and every original
source edge as a GPU line. This view is independent of the earlier grouped
overview, which remains available for a more readable summary. WebGL is required
for ungrouped GPU rendering; unsupported browsers fall back to the overview.
Initial coordinates are deterministic, computed in a worker. They are not
yet a stable, authorable ForceAtlas layout. Labels are selective and graph
legibility/performance on large real datasets still need acceptance testing.

**Semantic network questions:** Open **Ask this network**. With an approved,
server-configured OpenAI-compatible model provider, the operator can consent
to indexing every eligible source entity, not only the older first 48 grants.
Indexing runs in batches of 48; completed batches and model-version-specific
vectors are cached in this browser's IndexedDB for reuse/resumption.
Do not send confidential records or personal information without appropriate
authority. Explicitly private graph records are excluded, but free-text
descriptions can still contain sensitive information.

The subsequent question stage embeds the question, ranks source descriptions
by cosine similarity, retrieves original edges among the eight leading source
entities, and optionally asks the configured LLM to explain those excerpts.
Model answers remain hypotheses tied to supplied record identifiers. This is
not a verified finding, global graph pathfinding answer or independently
validated analysis of the entire network.

To enable the models, configure the existing server-only
`MOSSLINE_DISCOVERY_*` settings as described in
[Discovery setup](docs/DISCOVERY_MODELS.md). Do not place secrets in
`NEXT_PUBLIC_*` variables. The public app works with AI disabled.
Before enabling broad access, implement quotas, rate limiting, privacy
governance, costs and provider-health monitoring.

## Alpha 2.9 — general-purpose large-network imports

The **Map your own data** route now reads CSV, Kumu JSON, native Mossline JSON
and multi-file Kumu CSV exports using a browser Web Worker. The original
general-purpose column discovery, editable rules, map-versus-relationship
choices, provenance handling and reusable recipes remain supported.
Re-mapping the **complete** CSV also runs in the worker, not in React.

Current import budget is **60 MB total per upload**. This is not a streamed
parser; particularly wide/complex source files may still require substantial
browser memory. Files do not leave the browser. Native JSON and multi-file
elements/connections are not treated as funding datasets.

When an imported graph is too large to store safely in the small browser
`localStorage` map library, Mossline stores the **entire original graph**
in IndexedDB first. The map library retains a reference, title and exact node/
edge counts. Opening or switching back to a map hydrates the complete graph,
including its original properties and relationship evidence. It does not
substitute a first-N record selection. Smaller maps retain the existing
straightforward localStorage flow.

**Backup matters:** IndexedDB is browser- and device-local. For large generic
maps, visit **Recover browser data** and download both the map-library backup
**and** the **complete general networks** backup before clearing browser storage
or switching devices. A map-library JSON backup alone contains pointers, not
the underlying large graphs. The ordinary **Export this map** action in the
studio also exports the currently opened complete native graph.

The first release is optimised for preserving large uploads and background
parsing; other advanced graph analytics and visual layouts can still require
significant memory on low-powered devices. Benchmarking and streaming parsing
for files larger than 60 MB remain future work.
