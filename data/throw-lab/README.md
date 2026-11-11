# Mossy Throw Lab

A deliberately awkward, completely fictional set of inputs that answers one question:

> Can somebody throw this at Mossy, see a useful and faithful result, and change the interpretation without starting again?

This is the executable companion to [the product decision](../../docs/THROW_SEE_EDIT.md).

## Larger, explorable datasets

The [eight richer examples](./rich-catalogue.json) are the **primary experiences** on the
[Throw Lab page](/throw-lab). They use the normal Mossy import worker and
the very same source CSV/JSON files available to download. They include
connected communities, geographical arts networks, six years of grants,
food supply routes, volunteer sessions, wildlife observations, thematic
project records and a mixed CSV/JSON network. Their patterns are intentional
and recorded in the source data: no decorative, disconnected mock diagrams.

The eight worlds now use **different geographical scopes** by design: UK-wide
community work, UK-wide events and themes, US-wide grant awards (USD and
recipient-centred map positions), European cultural connections, North American
food supply routes across Canada/the US/Mexico, global species observations,
and an international mixed-source programme network. Every relevant source
provides coordinates and a country; the generator uses illustrative
offsets near real city centres, never addresses of real organisations.
Cross-border lines are explicitly present in the relationship source files,
not inferred from proximity. Mossy's map frames the actual data extent.

The source assets live in `apps/web/public/throw-lab/` and are built
deterministically from `generate-rich.mjs`:

```sh
node data/throw-lab/generate-rich.mjs
npm run test
```

`packages/graph-core/test/throw-lab-rich.test.ts` checks imported record
counts, recorded links, provenance and linked geography (or deliberately
no links). The gallery's **Explore in Mossy** links open the actual source
files as a *new*, unsaved import review. The visitor must choose to create
the map; nothing is silently written.

## What is recorded

[`catalogue.json`](./catalogue.json) tracks **60 distinct cases in six structural families**:
- lists and rich tables;
- relationships, matrices and hierarchies;
- events, measurements and flows;
- geography and time;
- documents and qualitative material;
- mixed and messy bundles.

Each case describes its input, ideal first view, what the user should be able to edit, and one kind of mistake Mossy must never make. The current catalogue includes **24 small, executable text/JSON fixtures** and **36 explicitly unimplemented/untested scenarios**. Do not mistake the size of this catalogue for the number of capabilities shipped.

The original small executable cases are deliberately embedded in the manifest so a tester can inspect the input without generating a workbook or installing an external fixture package. They use wholly invented names and identifiers; never add real contact or confidential data to the repository.

## Run

From the repository root:

```bash
npm run test
```

The test file `packages/graph-core/test/throw-lab.test.ts` exercises the same `readDelimited`, `readJson`, `recogniseTable` and `applySources` functions used by Mossy's importer. It checks counts, resolved links, source receipts and the absence of invented semantic relationships.

This is **only the engine gate**. A passing test does *not* mean the intended first visualisation exists. For example, Mossy can currently read a quantity column as metadata; it cannot yet guarantee the useful stock-level bar chart described in the contract. The `idealFirstView` field is a target, not a claim.

## Add a fixture

1. Select a missing case or add a clearly distinct case to the catalogue.
2. Provide one or more tiny fictional source files, preserving troublesome formatting where relevant.
3. Describe what should be displayed, edited and never inferred.
4. Add `files` and `engineExpectation`, changing `actualStatus` to `engine-regression-added`, only once the real parser recognises it.
5. Add or extend a browser test for **throw → see → edit**; test actual displayed content, provenance and editing, not an SVG mock.
6. Only promote a case to complete when both the source interpretation and the actual first view are supported and tested.

## Priorities for the next slices

**First:** long tables with numeric measures and time, without fabricating networks; source-preserving bar/line charts.

**Next:** wide year/month data, matrices and hierarchies. Interpret the table's geometry before choosing a graph.

**Then:** GeoJSON/GPX and true lines/polygons, multiple tables per sheet, messy headings, nested arrays.

**Later:** documents, PDF, meeting notes and interview transcripts with opt-in extraction and explicit quotations/receipts.

The lab should eventually be available in the product: pick a case, throw its actual file in, inspect the proposed reading, explore the result, edit it and export. Its public examples must correspond to the same real regression fixtures.

## Safety and interpretation

A links-only file *does* tell us that Alice and Bob are named endpoints of a connection. It does **not** tell us whether they are people, organisations, verified identities or anything more. A project/funder/organisation appearing in the same row is a source-recorded co-occurrence, not proof of funding or delivery. Private data stays local by default. Inferred claims must be distinguished from recorded ones, and edits must preserve original evidence.
