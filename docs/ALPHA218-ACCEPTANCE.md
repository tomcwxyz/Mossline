# Alpha 2.18 — quality and recovery

Baseline: Alpha 2.17, commit `f50083f`. This is the first incremental response to the [improvement review](./EXPERIENCE.md).

## In this branch

- Surface the already-implemented **general-network IndexedDB recovery** on `/recover`, next to funding recovery. The map-library backup alone is not a complete backup for either kind of large dataset.
- Bring the studio canvas higher: compact the header and place the example-network library **after** the workspace. The example library remains available from the start screen.
- Replace misleading terminology: a clear Network / Connections / Places trio; distinguish map switching from returning to all maps; remove the outdated version label and developer-specific sidebar advice.
- Clarify coverage on grouped networks: source records **accounted for** does not mean each node is visibly drawn.
- Clarify complete funding-source totals versus legacy subset analysis; do not require an extra import acknowledgement when the parser reports no warnings or excluded individual awards.
- Skip an adaptive group's sole category (often `Region not recorded`), and test that the underlying records remain accounted for.

- Recognise a grants/360Giving CSV uploaded through the general import route and hand it to the funding importer with the original file, without inventing generic entity relationships.
- Add a canvas-first mobile filter drawer, closed by default and dismissible via Escape.
- Commit an npm v3 lockfile, switch GitHub CI to `npm ci`, and add Playwright/axe smoke tests for the major entry points.

## Regression checks

- `npm run test`: adaptive graph and grants-detection regression tests added; CI must pass.
- `npm run typecheck`, `npm run build` and `npm run test:e2e`: CI must pass (the latter installs Chromium on CI).
- Manually verify `/recover` on a browser with an existing **large general map**; export the map library and complete data separately, import in a fresh browser profile, and confirm the map opens and all original counts match.
- Open the community example at 1440 × 900 and 390 × 844; check the first-screen graph, three view tabs, map switcher and post-workspace example library. On mobile, open and dismiss the filter drawer.
- Import a small, clean funding CSV: the create button should be available without an unrelated confirmation. Repeat with warnings and excluded individual awards: the review checkbox must still be required.
- Import a larger funding CSV: check totals in the main Network view and confirm any subset-specific analysis is labelled as such. Upload the same file from the general import route and verify the redirect to funding analysis.
- Open a 120-funder network without regions and expand Funders: it should go to alphabetic groups, not one unhelpful "Region not recorded" group.

## Not yet in this increment

- Extended Playwright coverage for real locally stored IndexedDB data and all detailed user workflows; the new suite covers the entry points, not every edge case.
- New question-led exploration, reporting outputs, merged stores or large renderer consolidation. Those have separate implementation and migration risks.

Do not merge until the branch build passes and existing browser-local data has been checked in the recovery workflow. Never clear a real browser's stored data as a test.
