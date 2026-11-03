# Shifting Ground — The List in Mossline

An experimental, evidence-led atlas from [The List](https://the-list.uk/) and its public, editorially reviewed changes to UK grant-making. The List remains the authoritative publisher. Mossline is an exploratory representation, not a new source of grant intelligence.

## Use it

Open Mossline → **Shifting Ground · The List** → **Load public changes**. The application reads The List's paginated public API from a fixed server-side endpoint, converts approved/confirmed changes into a portable Mossline graph, and shows a normal import preview. Review the records and choose **Create a new map**. Your copy stays in your browser and can be backed up, explored, and used in a Mossline story.

Opening this again imports a **new snapshot**. It does not silently change maps, scheduled emails, The List, or existing local edits. There is no live synchronisation or 360Giving grants overlay yet.

## Data and claims

- **Funder → change**: The List published a change concerning the funder. This is a record of what was reported, not a grant or measured funding impact.
- **Change → change type, cause area, organisation type/size**: classifications supplied by The List. They are *not* evidence of who actually lost funding.
- Each change keeps its The List URL, reported date, change type, original evidence URL (where supplied), and a receipt carrying The List's stable change ID. Stable funder IDs prevent accidental name-based merges.
- Only published approved/confirmed records appear. Private context, contact details, reviewer identities and admin watch hits are not loaded.
- A funder's office address or constituency is **not** a location of funding impact. This adapter does not geocode these and does not plot made-up locations.
- Timeline dates belong only to recorded funder-change events with an explicit date of change. A submission timestamp is recorded separately but **never** treated as the date a funding policy changed. Categorical links remain undated. The Funding lens has no grant awards until actual award data are added separately.
- A rise in recorded changes may reflect **improved monitoring and reporting**, not a population-wide rise in changed funding behaviour.

## Data reuse and attribution

The List content is © The List, licensed **CC BY-NC**: attribution and non-commercial terms apply. Attribute The List, link back to the original publication, disclose that Mossline transformed it into a network, and verify whether any intended publishing or commercial use is permitted. Do not publish a shared map without checking data and rights.

## Design

`GET /api/sources/the-list` is a bounded server proxy to the fixed `https://the-list.uk/api/changes` public endpoint. It pages in groups, checks counts, refuses a truncated feed and passes the results to `theListChangesToGraph` in graph-core. The result goes through the existing Add Data preview and map storage. No API key or new database branch is required.

## Validation

`npm run typecheck`, `npm test`, `npm run build`. Smoke-test the import against the live public API, confirm that only approved/confirmed changes enter the map, compare record counts and dates against The List, inspect source receipts and a representative funder, and test import/save/reopen on a mobile browser.
