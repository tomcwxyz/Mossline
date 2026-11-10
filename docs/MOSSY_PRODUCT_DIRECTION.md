# Mossy: product direction and first public pilot

Decision: 10 November 2026. Product name **Mossy**. Technical identifiers, persisted local-storage keys, data formats, package scopes, environment variables, API routes, database schema, existing published links and the GitHub repository remain unchanged until separately migrated. Never strand a saved map or link for the sake of a rename.

## Product promise

Give Mossy your data. It helps you discover the people, places, relationships and patterns in it, and make something worth exploring and sharing.

Mossy is not a graph-modelling workbench with a welcoming front page. It should feel like an intelligent field atlas that starts with what people have, guides them to what is interesting, and gives them enough control to make it their own.

## Golden path for new users

1. **Bring something.** One or many CSV, Excel, JSON, Kumu or supported structured exports. File picker and drop zone are enough for the first pilot; pasted tables and URL-based imports are desirable follow-ups, not a launch blocker. Show sample data when the user has nothing to try.
2. **Understand automatically.** Existing local shape recognition is the first pass. Use opt-in AI where it materially helps interpret unfamiliar column names, mixed tables or unclear relationships. The result is a structured and validated proposal, not an unreviewed rewrite. Show a plain-language summary, not the mapping wizard by default.
3. **Confirm what matters.** Display what was recognised, what was omitted and what remains uncertain. Ask only consequential questions: e.g. which date field matters, whether two candidates are the same organisation, or which column connects two records. Offer 'Adjust how Mossy reads this' for detailed controls. Never make a false recorded link.
4. **Show something useful.** Start with a suitable view and a short, source-grounded 'What Mossy found' section. E.g. strongest recorded connections, places, change over time or funding flows. If data lacks coordinates, amounts or dates, say so and offer to add them; do not manufacture values.
5. **Explore and enrich.** Search, select, follow evidence, ask a question, add missing records, links, places, dates and amounts. Keep original data and user amendments distinct. Suggest optional enrichments only when they would improve the current view.
6. **Make and share.** One clear route to a saved view, story, export or published link. Explain local-only versus shared/hosted storage. Review any private or personal data before publishing.

## Simplification decisions

- **One front door:** 'Add your data'; example as a secondary choice. Funding, The List and other specialist journeys become sample/source choices within this experience, not competing home-page routes.
- **One import:** keep the existing source engine and import safety; do not resurrect parallel import paths.
- **One exploration workspace:** the same canonical graph, one recommended visual and a restrained set of controls. The five existing lenses are available but should not demand a decision before the user has seen a result.
- **One editing language:** 'Add or correct' instead of separate advanced data-model concepts. Preserve immutable source records and separately tracked edits and reviewed annotations.
- **One sharing route:** save/publish/share, with clear consequences and privacy status. Advanced workbenches, debugging, manual mapping recipes, full-network and full-funding tools can remain under 'More' or 'Advanced'.
- **No new major lens or specialist engine before the pilot.** Consolidation, discoverability, robustness and presentation take priority over breadth.

## AI boundaries

- Deterministic parsing, built-in shapes, identity matching and graph calculations remain the foundation. AI proposes schema interpretations and explanations when needed; it should not be required for known data shapes.
- Send the smallest informative, redacted sample to a remote model only with clear user permission, describing what will leave the browser and why. Offer a fully local fallback.
- Use a typed proposal schema; validate referenced columns, data types, cardinality, and relationships against the source. Return confidence and reasons; ambiguity is a review question, not a silent assumption.
- Never infer collaboration from a shared funder; never invent coordinates, dates, amounts, links or evidence. Keep recorded, manually added and suggested relationships visibly distinct.
- Provide a transparent import report, including ignored rows, possible duplicates, provenance and a reversible preview. Models must not directly mutate canonical records.
- Source-backed discoveries should identify the records behind each claim. A plausible story without evidence is not an insight.

## First-pilot boundaries and acceptance checks

Target: people comfortable with spreadsheets, not necessarily data modelling; test with charity leaders, researchers and community practitioners.

Must work:
- A novice goes from uploading an unfamiliar spreadsheet to an intelligible useful result without needing to choose 'funder', 'place', 'record', 'connection' or a lens.
- Recognised grant data, an ordinary entity sheet, an edge list, a Kumu export and a mixed workbook each produce coherent results; unknown columns or ambiguous links produce targeted correction prompts.
- A user can add a location or date, correct an interpretation, trace an insight to source rows, and save or share a useful output.
- A user knows what is on-device, what is sent to AI, and what publication makes public; no sensitive information is published by accident.
- Medium-size representative data works on a typical phone and laptop; the interface clearly reports long-running work, errors and recovery.
- There is one clear public testing URL without unexpectedly requiring the owner's Vercel account, plus tested auth and publishing permissions.

Pilot quality signals:
- First meaningful view in a few minutes, with no technical orientation.
- At least one grounded and interesting connection or insight found on each useful fixture.
- High user confidence in what Mossy knows, suggests and does not know.
- A saved shareable output without needing an explanation from the developer.

## Implementation sequence

1. Adopt Mossy branding visibly while preserving all existing technical identifiers and URLs.
2. Audit and resolve the current launch blockers: hosting protection, account and publishing journeys, recovery, cross-device expectations, open PRs, regression and mobile tests.
3. Reduce the home page to one import action and a friendly example; move specialist start routes into an optional examples/sources menu.
4. Introduce a post-import 'Here's what Mossy found' experience with evidence-linked findings, best starting visual and a clear way to amend the reading.
5. Add AI-assisted mapping suggestions behind explicit consent and a local-only fallback. Keep the manual mapping UI as an escape hatch.
6. Run a short, observed user pilot. Fix points of hesitation and false certainty before expanding functionality.

## Not now

A fully autonomous agent importing unseen private datasets, automatic external enrichment without consent, new graph engines, simultaneous rewrites of the database and auth, semantic guesses presented as recorded facts, and further independent studios.

## Fictional example library and community Showcase

Five fully fictional, source-attributed graph examples live at `apps/web/public/examples/*.json`:
The Village Web (relationships), Follow the Money (funding), After Dark (geography),
The Ripple Effect (signed systems), Changing Tides (timeline).
Each also has a lightweight SVG visual preview and **two plain CSV source files**
(`*-records.csv`, `*-relationships.csv`) designed for the unified importer.
Those CSVs intentionally contain the underlying rows; they are not pre-built Mossy graph documents.
For an import exercise, download both and select them together. A JSON file opens the finished map.

The **Showcase** page at `/showcase` lists intentionally submitted,
operator-reviewed publications. Published maps are not automatically featured.
Submitting requires an existing publication under the author's account and a separate
consent choice. Rejecting and unpublishing both remove public listing eligibility.
This is not the same thing as opening the app to unauthenticated pilot users:
Vercel access protection and host configuration require separate release checks.
