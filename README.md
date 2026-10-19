# Mossline

**Make sense of connected worlds.**

Mossline is an Apache-2.0 open-source prototype for mapping relationships between organisations, projects, funders, people and places. The first version is a Next.js browser explorer, shared graph-core package and read-only MCP server.

> Alpha 0.1: local prototype, not production-ready. All included example entities and connections are fictional. No accounts, database, live Google Sheets sync, full Kumu backup import, geography, hosted MCP authentication or multi-user collaboration are implemented yet.

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
