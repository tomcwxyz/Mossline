# Getting data in

Mossline has one way in for every kind of file: **Add data**, from the atlas
menu, the front page or Advanced tools. A 360Giving download, the Charity
Commission register, a Companies House extract, a Kumu export and an ordinary
spreadsheet all go through the same engine. There are no separate importers.

## How it works

1. **Files become tables.** CSV, tab-separated text, Excel (`.xlsx`) and JSON
   are read into plain tables: headings and rows of text. A workbook gives a
   table per sheet; a JSON file gives a table per array of objects, with nested
   values flattened to dotted keys (`recipientOrganization.0.name`).
   (`packages/graph-core/src/sources/tables.ts`, `xlsx.ts`)
2. **A shape says what a row means.** A shape is plain data (`shape.ts`): which
   records a row names, which columns are identifiers, places, tags or grant
   details, and which links it records. Built-in shapes (`builtin.ts`) cover
   360Giving, the Charity Commission register tables, Companies House and Kumu.
   Anything else gets a suggested shape from its headings (`recognise.ts`):
   grants, a list of records, rows naming several records, or a links table.
   The person can pick another reading, change the name column and type, or
   leave a table out.
3. **Records join on identifiers, never on names** (`engine.ts`). Charity and
   company numbers are normalised to [org-id](https://org-id.guide) form
   (`GB-CHC-`, `GB-SC-`, `GB-NIC-`, `GB-COH-`; `identifiers.ts`), so a recipient
   in a 360Giving file, the same organisation in the register and its company
   record become one record with three receipts. Records with the same name
   but no shared identifier are listed for the person to merge or keep apart;
   people are never listed this way.
4. **Two ways to use a table.** *Add as records* brings every row in. *Fill in*
   uses only rows about records already in the map or added from another file
   in the same batch: themes from the register's classification table, company
   status, trustees of organisations you have. Register tables default to fill
   in when there are other records to fill.
5. **Grants** become funder → grant → recipient, the form the Funding lens
   reads (`mosslineFundingGrant`, `amountAwarded`, `awardDate`; edges
   `awarded` and `awarded to`). Grants to individuals are left out.
6. **Receipts.** Every record keeps one receipt per source row it came from
   (file, row number, shape and the row's values), and its identifiers. The
   record panel lists them under *Where this comes from*.
7. **Check, then save.** Nothing is saved until the person has seen what each
   file adds, what joined, what was skipped and why, and where it goes: added
   to the open map or a new map.

Very large text files (over 40 MB, such as the full register) are streamed in
the worker and only rows naming one of the map's identifiers are kept
(`stream.ts`). An 84 MB register file fills in a map in about five seconds.

## Places

A record's own coordinates always win. Otherwise its postcode gives an
**approximate** place at the middle of its postcode sector (or district),
from `apps/web/public/geo/postcode-sectors.json`. Approximate places are
stored apart from source data (`Approximate location`), drawn as hollow
marks on the map, and described in the record panel. A grant is never placed
at its recipient's postcode; only a record's own postcode places it.

Exact positions are available from [postcodes.io](https://postcodes.io), but
only when the person asks and agrees: the postcodes (nothing else) leave the
device.

The sector file is built from the ONS Postcode Directory by
`scripts/build-postcode-sectors.mjs` (input: the `uk-address-lookup` npm
package's data file, February 2026 edition). Northern Ireland (BT) postcodes
are left out because their positions are not openly licensed for
redistribution. Attribution, shown wherever approximate places are used:

> Contains OS data © Crown copyright and database right 2026. Contains Royal
> Mail data © Royal Mail copyright and database right 2026. Contains National
> Statistics data © Crown copyright and database right 2026. Source: Office
> for National Statistics licensed under the Open Government Licence v.3.0.

## Sample files

`apps/web/public/samples/` holds small files in the real layouts of each
source, written by `data/generators/source-samples.mjs`. Every organisation,
person, number and grant in them is invented; charity numbers (`199xxxx`,
`SC0999xx`) and company numbers (`990000xx`) are outside the ranges the
registers have issued. *Try it with sample files* in Add data uses them, as do
`packages/graph-core/test/sources.test.ts` and `apps/web/e2e/add-data.spec.ts`.

## Adding a source

Write a shape, not an importer. Add it to `BUILT_IN_SHAPES` with `match`
headings that recognise the table, a sentence saying what a row is, and tests
using an invented sample in the source's real layout. If a shape cannot say
what the source means, extend the shape schema and engine so every source
benefits.

## Not yet

- Live lookups from the Charity Commission or Companies House APIs.
- Saving a person's adjusted shape for reuse.
- Merging same-name records after saving (the review happens before saving).
- Older `.xls` workbooks (save as `.xlsx` or CSV).
