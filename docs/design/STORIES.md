# Stories: design notes

**Status: next on the roadmap, not built.** These notes set out what a story is, how media and annotation fit, and what to settle before building.

Stories answer a different need from the atlas. The atlas lets someone explore; a story lets an author *walk someone through* what a map shows, in order, in their own words. The Pudding's visual essays are the reference for the feel ("immersive on a basic level"). Data for Action's "maps as conversations" is the reference for the purpose: a map people can see themselves in, talk about, and add to.

## What a story is

A story is an ordered list of **steps**. Each step has:

- **A view of the map:** lens, filters, selection, highlighted records, a followed route or feedback loop, and the camera (zoom and position, or map extent). This is the atlas's existing view state; a step is a saved view with a place in a sequence.
- **Words:** a heading and a short passage of text (Markdown, kept short: a step is a beat, not a chapter).
- **Optional media:** see below.
- **Optional annotations:** marks drawn on the map for this step, see below.

Steps refer to records, links and places **by ID, never by position**. A story keeps working when the data is updated or the layout shifts. If a step points at a record that's gone, the story says so instead of quietly showing something else.

## Media

What a story can carry, roughly in order of usefulness:

| Kind | Notes |
| --- | --- |
| **Images and photographs** | The most common case. Upload, or link to an https image. Alt text is required; a credit line and licence are prompted for. |
| **Quotes** | A person's words, shown as a pull-quote attached to a record or place. Attribution, plus a "this person agreed to be quoted" tick. |
| **Audio clips** | Oral histories and voices from a place. Short, with a transcript required (accessibility, and searchable). |
| **Video clips** | Short, captioned. Hosted file or a link to a video service; a link means the reader's browser contacts that service, so say so. |
| **Sketches and scans** | Hand-drawn maps, workshop photos, postcards (the Dear Data feel). Treated as images, but they can be pinned to a place or record. |
| **Documents** | Links out (reports, minutes, sources), shown as receipts, consistent with how the atlas already shows evidence. |

Principles:

- **Consent and rights travel with the media.** Each item records a credit, a licence and, where people are recognisable or heard, that consent was given. Publishing a story re-checks these, just as publishing a map shows every record first.
- **Accessibility is not optional.** Alt text for images, transcripts for audio, captions for video. A story can't be published with these missing.
- **Size is a plan matter.** Media storage counts towards plan limits. The free plan allows links and a few small images; organisations get real storage.
- **Storage stays portable.** In the browser, media lives in IndexedDB beside the map. On a hosted Mossline, it goes to any S3-compatible object store, never a proprietary-only service (AGENTS.md rule 1).

## Annotation

Annotations are the **author's voice on the map**, and must never be mistaken for the data. The atlas already has three marks:

- **ink** for what's recorded;
- **pencil** for suggestions;
- **wash** for navigation.

Stories add a fourth, **marginalia**: drawn in a hand-written style, in a colour set aside for the author, clearly "someone's notes".

| Annotation | Anchored to |
| --- | --- |
| **Callout:** a short note with a leader line | A record, link or place |
| **Ring:** a loose pencil circle around a group | A set of records (it follows them if the layout moves) |
| **Arrow:** "look from here to here", not a relationship | Two records or places |
| **Area:** an outline drawn on the Map lens, e.g. a neighbourhood as residents describe it | Geographic coordinates (a polygon) |
| **Number marker:** "1, 2, 3", to sequence a walk | Records or places |

Rules:

- **Anchors, not pixels.** Every annotation is attached to records, links or coordinates, so it survives relayout, zoom and data updates.
- **Not evidence.** An arrow in a story never becomes a link in the data. It isn't counted, routed through, or exported as a relationship. If the author decides it *is* a relationship, they add it as an edit, with its receipt.
- **Drawn areas are the exception worth keeping.** A resident-drawn neighbourhood is useful data in its own right ("maps as conversations"). Areas start as story annotations, with a later path to save one into the map as a recorded place with its author and date.

## Reading a story

- **Scrolling (the default).** Text scrolls in a column; the map stays pinned beside it and moves to each step's view as it scrolls into place. On a phone, steps become cards over the map.
- **Presenting.** One step at a time, keyboard-driven, for workshops and meetings.
- **Motion:**
  - camera moves, fades and records gently gathering into their groups;
  - always interruptible;
  - with `prefers-reduced-motion`, cut between views instead.
- **Leaving the story.** "Explore this map" opens the full atlas at the current step, read-only for a published story.

## Taking part (later)

A conversation map invites responses: "is this your experience?", "add a place that matters to you", "what's missing?". When stories open to readers:

- **Responses arrive as pencil:** visibly unconfirmed, until the author or organisation reviews them, in the same review flow as suggested links.
- **Who can respond:** anyone with the link, or invited people. Anonymous responses need moderation and rate limits; that's an organisation-plan feature.
- **Overlap with Map my Patch.** Map my Patch already does map-based questions. Linking the two (questions in Map my Patch, responses appearing in a Mossline story) may beat rebuilding it.

## Storage and publishing

- **Where stories live.** Stories are kept with their map: in the browser, in a shared map, or in an organisation.
- **What publishing includes.** A published story contains only the records, links and media its steps use, after the same item-by-item review as publishing a map. Large stories are fine, since published maps already hold whole maps.
- **How the published page works.** Published stories open in the atlas's read-only mode, with the story column added.

## To settle before building

1. **Narrative length.** Is a story mainly short (5–15 steps) or sometimes long-form? This decides whether text supports headings, footnotes and inline media, or stays deliberately simple.
2. **Drawing tools.** Freehand pencil marks (more expressive, harder to anchor) or shape-based marks only (rings, arrows, areas)? Suggest shapes first, freehand later.
3. **Media hosting for the hosted service.** Which S3-compatible store and region, and the per-plan storage limits.
4. **Taking part in the first release, or later?** Suggest later, after the reading experience is right.
5. **Map my Patch.** Link it, or build responses natively?

## Suggested first release

- Steps from saved views, with text, images (with alt text and credit), quotes, and shape annotations: callout, ring, arrow, number.
- Scrolling and presenting modes, with reduced motion.
- Publishing with item-by-item review.

Then audio and video, drawn areas, and responses.
