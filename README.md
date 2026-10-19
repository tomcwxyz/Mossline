# Mossline

**Make sense of connected worlds.**

Mossline is an Apache-2.0 open-source prototype for mapping relationships between organisations, projects, funders, people and places. The first version is a Next.js browser explorer, shared graph-core package and read-only MCP server.

> Alpha 0.1: local prototype, not production-ready. All included example entities and connections are fictional. No accounts, database, Google Sheets sync, Kumu import, geography, hosted MCP authentication or multi-user collaboration are implemented yet.

## Run locally

Requires Node.js 22+ and npm 10+.

~~~bash
npm install
npm run test
npm run typecheck
npm run dev
~~~

Then open http://localhost:3000. You can inspect, search, filter and navigate entities and relationships; switch between Landscape and Collaborations; import or export a portable Mossline JSON graph; and select the collaboration basis (shared project, funder or explicitly recorded links). The inferred edges are **not** assertions of partnership.

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

Types: organisation, project, funder, person, place, other. Nodes support description, region, tags and HTTP(S) image/source URLs. Edges support description, source URL and inferred status. Stable IDs are mandatory; duplicate IDs and dangling edges are rejected. Inferred collaboration edges include evidenceNodeIds for the supporting shared project or funder.

## Roadmap and contributing

See docs/ROADMAP.md, docs/ARCHITECTURE.md, CONTRIBUTING.md and AGENTS.md. Migration requires real representative, rights-cleared Kumu and Sheets exports first. Keep the existing working Kumu project unchanged throughout prototyping.

License: Apache-2.0. No mandatory proprietary AI service or database is required for the prototype.
