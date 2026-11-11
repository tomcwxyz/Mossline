# Mossy product direction: throw → see → edit
**Decision recorded: 11 November 2026.** This is the governing product premise, not a speculative feature list.

> People throw whatever data they have at Mossy. Mossy helps them see what is actually there, what it might mean, and what they can do with it. They can then edit the interpretation, the data beside its sources, and the visual result.

## The promise
**Throw it in. See something useful. Change it. Share it.**

Mossy is a general-purpose, local-first tool for discovering the structure, relationships, patterns and meaning in data. It is *not* primarily a graph builder, a funding tool, a map builder or an AI chatbot. Exceptionally good connected visualisations remain a core strength, but forcing everything into nodes and edges is a failure.

A new person should not have to decide whether their file represents funding, places, organisations, events or connections, and should not have to understand a schema before seeing a result. Their first view should be useful and faithful to the source. Interpretation is reversible. The interface keeps the complicated work out of the way until a person wants to change it.

## Three verbs
1. **Throw.** Files in any combination; pasted rows, copied text and eventually URLs and connected sources. Recognise *structure*, not just file extension. Support lists, rich tables, paired entity and relationship tables, adjacency/participation matrices, trees, transaction/flow records, time series, spatial geometries, nested structures, documents and heterogeneous bundles. Treat unreadable parts as partial failures: show useful parts rather than a blank screen.
2. **See.** Immediately profile the source, name what was recognised, choose an appropriate view and show a small number of evidence-backed discoveries. Sometimes that is a connected network or geographic map with drawn links. Sometimes it is a chart, hierarchy, matrix, trend, flow, distribution or readable catalogue. Do not invent edges merely to make an impressive graph. Recommend other views based on what the data can support.
3. **Edit.** Correct what a column/row means, joins, identities, types, groups, dates, places, measures, filters, chart choice and presentation; add and amend records or relationships. Keep a clear distinction between source facts, editorial changes and suggested interpretations. An edit to the interpretation must be reusable when new data arrives.

**Sharing** comes after reviewing what is included. A local view URL does not share its source data; a published copy does.

## Seven useful building blocks (projection, not mandatory user forms)
- **Record/entity**: a named thing, organisation, person, place, project, topic, asset, etc.
- **Recorded relationship**: explicit relationship between entities, with meaning, direction, optional weight, evidence and time.
- **Event/transaction**: something that happened (award, meeting, referral, payment, observation) with participants, date, units and amounts.
- **Measurement**: a quantity observed or aggregated for a subject/place/time, with units, missing values and denominators.
- **Place/geometry**: sourced point, route, polygon, boundary, area or region; approximate/geocoded locations are marked as such.
- **Document/evidence**: an identifiable source, a statement, a passage or a row, with a navigable citation and confidence about extraction.
- **Classification/hierarchy**: categories, memberships, taxonomies and parent-child structures, distinguishing explicit membership from similarity.

These may coexist within a dataset. Retain original files and row/page provenance. Do not prematurely translate measurements, documents and polygons into fake "network links"; the graph is one *projection* of a broader source model.

## Non-negotiables
- **No invented evidence.** Ink = source-recorded or separately reviewed assertion. Pencil = proposed/inferred. Grouping/visual proximity is not proof of collaboration. A source-mentioned endpoint in a links-only file is a *minimal record*, not verified identity or added biographical detail.
- **Source first.** Preserve original values, file, sheet, row/page, types and omissions. Every finding can show its supporting data. Correcting an interpretation does not silently rewrite a source.
- **Appropriately cautious joins.** Authoritative identifiers join automatically when valid. Matching names lead to review unless the source itself defines their identity within its own scope. Never conflate two people because they share a name.
- **Missing is missing.** Do not manufacture coordinates, dates, amounts, causality, associations, denominators, units or confidence.
- **Local first.** Parsing, recognition and ordinary analysis work without an account, API key or model. Any data sent to AI, geocoding or remote lookup is an intentional, visible choice.
- **Graceful uncertainty.** Say "I think these columns are..." and let people change it. If the input has only relationships, draw their source-mentioned endpoints rather than rejecting it; if it has only numbers, show a chart rather than pretending it is a network.
- **One doorway.** No specialist import wizard before the result. Advanced controls appear only to address ambiguity or after the user wants to change something. No extra permanent lens tabs just because a chart exists.
- **Trustworthy sharing.** Separate local view addresses from genuinely published copies, require privacy review, and never publish source material or personal details unexpectedly.

## Product contract
**Input**: files, paste or link → source bundle with optional partial failures.
**Understand**: detect tables, nested objects, headers, joins, entities, relationships, event/time/value fields, geometry, measures, possible evidence; record confidence and alternative readings.
**See**: first useful result + 2–4 grounded discoveries + scope/coverage notes + suggested next view. No blocked UI just because one secondary file failed.
**Edit**: re-interpret, rejoin, change view, correct data beside source, save an interpretation recipe, undo/reapply and re-import.
**Keep/share**: export an open, portable representation, or publish a carefully reviewed snapshot.

A good first-run can be summarised in plain language: "I found 83 organisations, 17 projects and 126 recorded connections. Here is the network. I can also place 54 records on a map. Two joins need checking." That is a *result*, not a tutorial.

## The Throw Lab
Build a regression and exploratory lab of at least **60 realistic, wholly fictional inputs** across:
1. Lists and rich tables
2. Relationships, matrices and hierarchies
3. Events, measurements and flows
4. Geography and time
5. Documents and qualitative data
6. Mixed, messy and difficult exports

For every case, record:
- what was thrown in, shape, format and deliberate mess;
- expected interpretation, *first visual result*, grounded insight and source receipts;
- which interpretations are uncertain, what must **not** be inferred, and how to edit;
- actual support: working, partial, blocked or future; no green marks for unsupported formats;
- unit/worker/browser checks for import → inspect → edit, ideally at narrow-mobile and large-data scales.

The lab is an executable product contract and public demonstration, not a collection of synthetic charts that do not correspond to data. Make the raw files reusable in Showcase. Start with small, verifiable cases; expand to 60 and beyond. Keep every example fictional, while using real-world-like formats.

## Delivery sequence
**Slice A — foundations (now):** Write this promise; establish the Throw Lab manifest and test harness; fix source-mentioned endpoint imports; audit what already works versus gaps.
**Slice B — beyond graphs:** First-class time-series and measurable-value detection with simple charts; matrices, hierarchies, events and their native views.
**Slice C — messy real inputs:** Wide/pivot tables; workbooks with non-first-row headings; multi-value cells; nested JSON; GeoJSON, GPX and geometry; partial parse results.
**Slice D — source-grounded text:** Opt-in extraction for PDFs, documents and qualitative inputs, with quotations and page references, suggested not asserted.
**Slice E — reusable interpretations:** Save/adjust/import recipes, multi-source reconciliation, publishing and gallery.

At each slice, change the *real importer*, show an actual visual result, and add Throw Lab cases before polishing the interface. Never hide a failing parser behind an attractive preview.

## Release question
Can somebody who has never built a network upload an ordinary, odd or messy dataset, get something faithful and interesting quickly, recognise what Mossy has assumed, and alter it without starting over? If not, the slice is incomplete.
