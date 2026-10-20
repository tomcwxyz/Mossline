# Mossline Alpha 1.1 — first-time usability trial

## Task 1: a novice explores a new spreadsheet
Without explaining graph terminology, give the tester the instruction:

> This is a spreadsheet of organisations, projects and funders. Could you
> use Mossline to explore who is involved in what, and where funding comes from?

1. Choose **Try sample spreadsheet**.
2. Note whether the three suggested counts and illustrated relationships
   answer the question *What did Mossline understand?*
3. Select **Not quite — help me adjust it**. Confirm it asks about the
   meaning of columns in everyday language rather than graph schema.
4. Verify the region belongs to **Organisation**, not Project or Funder.
5. Select **Yes — show me the network**, then **Create a new map and explore**.
6. Verify that the fictional demo is still selectable in **Your maps**.
7. Expected sample: **7 entities, 6 relationships, 1 excluded non-public row**.
   No false conflicting-description warning and no list of 83/123 removals
   unless the user explicitly selects **Update the map I'm viewing**.

Measure completion (target: under five minutes), requests for clarification,
wrong assumptions, first hesitation, trust in suggested relationships,
whether correction feels understandable, and ability to recover the previous map.
Don't tutor the tester while observing.

## Task 2: avoid invented connections
Upload a simple CSV with `Name,Region,Notes` and no relationship columns.
Expect an **entity list** suggestion, zero fabricated relationship links,
and an option to extend mapping via Advanced.

## Task 3: inspect a mistaken interpretation
Open Advanced mapping and assign the same `Region` column to both
region and description. Expect a clear actionable error and no accepted graph.

## Task 4: PFT real-source parity
Upload **Elements** and **Connections** CSVs from the PFT Kumu feed together.
Expected read-only preview: **107 network entities, 242 recorded relations**,
all endpoints resolvable and seven original Kumu classes mapped to nine
canonical type options. Exclude map/coastline helper tabs. Verify original
entity URLs and source IDs and sample relationship type labels manually.
A browser test is still outstanding behind Vercel Authentication.

## Task 5: deliberate replacement
Switch back to a saved map and import a different dataset. Choose **Update
the map I'm viewing**. Check the identity-based before/after report, confirm
that removed entities/links are gated by an additional acknowledgement,
and ensure a failed storage write is clearly reported.

## Limits
Do not interpret the fictional PFT prototype as independently verified data.
Uploaded files and saved maps are browser-local; browser storage may be
cleared by the user. No existing Kumu or Google Sheet is modified.
Browser interaction, mobile visual QA, assistive technology review and
independent novice evaluation remain pending.

## Follow a connection — exploration-first acceptance test (alpha 1.2)

1. Open the fictional landscape, select a starting entity using **1 · Start with**.
   Check the **2 · Find connections to** dropdown: it must exclude the start,
   include only destinations reachable within five *recorded* relationships,
   and group them by minimum distance.
2. Choose any offered destination. A source-record route should appear
   immediately, without a pointless error or extra required click.
3. Switch the starting entity: the previous destination/path must clear.
4. Choose an excluded relationship type: unreachable destinations must vanish.
   No choices should have an explanatory empty state, not a dead dropdown.
5. Select an entity directly on the canvas and choose **Explore connections
   from here** in the right inspector. The route panel should preselect that
   entity and offer real destinations.
6. Try one of the direct connection buttons; the path should be highlighted.
7. Verify the **Try an example: North Fields → Riverbank** button still shows a
   genuine recorded route from `o1` to `o3` (two steps in the demo).
8. Check light-background buttons (**Not quite**, **Close**) for legible
   contrast and visible keyboard focus at desktop and narrow viewport widths.

Reachability traverses recorded source links both ways for exploration,
but individual source-direction arrows are preserved in the route details.
This does not independently verify a claim of collaboration or funding.
No interactive protected-preview UI test has yet been performed.
