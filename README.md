# Mossline

**A field atlas for connected work.** Explore the connections between
organisations, projects, funders, people, places and ideas, with a source
record behind each recorded relationship.

Mossline is an [Apache-2.0 licensed](LICENSE), local-first, general-purpose
technical alpha. It is **not** a product for one farming organisation: the
Progressive Farming Trust visual example and fictional neighbourhood network
are optional demonstrations.

## What you can do

- **Bring data:** one *Add data* flow for 360Giving grants, the Charity
  Commission register, Companies House, Kumu and any spreadsheet. Files join
  on registered numbers and other identifiers, never on names, and you check
  what each file adds before anything is saved. See [Getting data in](docs/DATA_IN.md).
- **Five lenses:** explore the same records through Network, Map, Themes,
  Funding and Timeline, with shared search, filters and selection.
- **Follow evidence:** inspect original source references and trace up to
  five steps through recorded relationships.
- **Keep claims honest:** solid *ink* is recorded in a source; dotted *pencil*
  is inference or suggestion; soft *wash* is only visual grouping.
  Sharing a funder is not evidence of collaboration.
- **Review suggestions:** confirm an inferred relationship with a reviewer,
  date and reason. The approval is a separate local annotation, not an edit
  to the original import.
- **Use complete data:** large network and full funding analysis continue to
  use the existing background workers. The older specialised studio remains
  available through **Detailed tools & full network**.
- **Back up and share:** export local maps, perspectives and full-dataset
  backups. Optional publishing needs a configured deployment and a privacy
  review. A copied atlas URL does not contain browser-local graph data.

### What is still changing

This is the **first implementation slice** of the Field Atlas proposal, not
the completed renderer migration. The Map lens plots **source-given
coordinates** with MapLibre, and approximate places from postcodes as hollow
marks. Themes groups by
**source tags**, not on-device semantic embeddings. Funding currently shows
recorded links rather than the proposed DuckDB-backed grant flows. The new
network uses the established worker/WebGL/Canvas implementation for large
graphs while a sigma.js comparison is prepared. Portable static stories,
reviewable community correction queues and live open-source profiles are
still planned.

See the [Field Atlas implementation and migration plan](docs/design/FIELD_ATLAS_IMPLEMENTATION.md)
for shipped boundaries and remaining work.

## Try it

Requires Node.js 22+ and npm.

```sh
git clone https://github.com/tomcwxyz/Mossline.git
cd Mossline
npm ci
npm run dev
```

Open <http://localhost:3000>, choose an example or import your data.
No hosted account, API key or model is needed for ordinary exploration.

## Validate a change

```sh
npm run test
npm run typecheck
npm run build
npm run test:e2e
```

Playwright tests require Chromium (`npx playwright install chromium`).
See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) for
contribution guidance.

## Data, trust and portability

Mossline is local-first. Browser-saved maps and full funding datasets use
**different storage layers** and are not synced to other devices. Keep source
exports and download backups before clearing browser storage; see
[Recovery](docs/RECOVERY.md).

The original graph is canonical: visual groups, inferred links, local
reviewer annotations and saved layouts must not silently rewrite it.
An inferred connection never increases a recorded degree or funding total.
A place name does not constitute coordinates; a postcode gives only an
approximate place, marked as such. Approximate places use the ONS Postcode
Directory: contains OS data © Crown copyright and database right 2026;
contains Royal Mail data © Royal Mail copyright and database right 2026;
source: Office for National Statistics, Open Government Licence v3.0. AI features, where
configured, are optional and require a deliberate decision to use them.

## Project references

[Architecture](docs/ARCHITECTURE.md) ·
[Getting data in](docs/DATA_IN.md) ·
[Field Atlas design implementation](docs/design/FIELD_ATLAS_IMPLEMENTATION.md) ·
[Recovery and backups](docs/RECOVERY.md) ·
[Hosted publishing](docs/HOSTED_PUBLISHING.md) ·
[Roadmap](docs/ROADMAP.md) ·
[Development history](docs/CHANGELOG.md)

**MCP:** `npm run mcp` starts a read-only local stdio server;
`MOSSLINE_DATA_FILE` can point it at an exported graph document.
See [Architecture](docs/ARCHITECTURE.md) before enabling external connections.

Licence: Apache-2.0. Source images and demonstration artworks may have
different rights and must be treated separately.
