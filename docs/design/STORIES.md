# Stories: design notes

**Status: first release built (October 2026).** These notes set out what a story is, how media and annotation fit, and what's still to come. "What the first release does" below says what was built and how; the rest is the longer plan.

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

- **Spotlight.** While a step is read, its records stand out: the rest of the map fades, the links between them are drawn, and their names are shown. On by default; *Fade the rest of the map* turns it off for a step.
- **Marks in words.** Each step carries a sentence describing its marks and pinned pictures ("On the map: a ring around Hexham and Newcastle…"), read out by screen readers, since the marks themselves are drawings.
- **Title card.** Presenting, and reading on a phone, open on the story's title and introduction, with *Begin*.
- **On a phone,** the step card folds down to its buttons (*Hide text*) to look at the map.
- **Links to a step.** A published story keeps the current step in its address (`?step=3`), and *Copy a link to this step* gives one to send.
- **Writing.** A step's view is shown as chips: a selection, search or filter left over from exploring can be removed with ×. Steps can be duplicated. Pictures can be dropped onto a step or pasted, several at once.
- **Embedding.** A published story (or map) can be put on another website: *Embed* on its page gives the code. See `docs/HOSTED_PUBLISHING.md`.
- **Link previews.** A shared link to a published story shows its title, introduction and cover (or a small drawn network). See `docs/HOSTED_PUBLISHING.md`.
- **Print or PDF.** *Print* (writing) or *Print or PDF* (reading) shows each step in turn, takes a picture of the map as it's shown (marks, spotlight and names included), then opens the browser's print dialog. The layout has the cover, then a page per step with its map, words, pictures, quotes and credits, ready for paper or *Save as PDF*. Steps on the Funding and Timeline lenses print without a map picture for now, and say so.
- **Audio.** A step can have short audio clips: an MP3, M4A, OGG or WebM file up to 2 MB, a recording made in the browser (up to three minutes, at speech quality), or an https link. Every clip needs a transcript, and the author's confirmation that everyone heard agreed, before the story can be published. Readers get a player, who's speaking, and the transcript; printed stories carry the transcript. Clips are kept whole, not re-encoded, so a link suits anything long.
- **Where stories live.** Stories are kept with their map: in the browser, in a shared map, or in an organisation.
- **What publishing includes.** The map, the story and its media, after the same item-by-item review as publishing a map. (The first release publishes the whole map with a story, since steps use filters; see below.)
- **How the published page works.** Published stories open in the atlas's read-only mode, with the story column added.

## What the first release does

Decided: stories are mostly short; marks are shapes first, freehand later; readers responding comes later.

- **Model.** `packages/graph-core/src/stories.ts`. A story is up to 60 steps. Each step has the atlas's view state (lens, record, search, group, filters, dates, loop), a heading, short text, up to six pictures or quotes and up to 40 marks. Everything points at records by ID.
- **Text.** A deliberately small, safe subset: paragraphs, line breaks, `**bold**`, `*italic*` and `[links](https://…)`. Everything else is shown as typed, so a published story can't carry markup or scripts.
- **Clean or hand-drawn.** Each story chooses how its marks are drawn: *Clean* (precise rings, straight arrows, sans-serif labels, solid numbered markers; the default for new stories, suited to reports and presentations) or *Hand-drawn* (loose, notebook-like). Published stories keep the author's choice. Stories made before the choice existed stay hand-drawn.
- **Marks.** Ring (any number of records), note (one record, with text), arrow (two records) and number. Drawn over the Network, Themes and Map lenses (on the Map, for records with a place) in the marginalia colour (`--ml-margin`), in a loose hand. The wobble is seeded from the mark's ID, so it stays still as the map moves. Marks are placed against records each frame, so they follow zoom and layout; a mark whose records aren't drawn is hidden.
- **Pinned pictures.** A picture can be pinned beside a record: while its step is shown, it appears as a small postcard next to that record on the Network, Themes or Map lens, as well as in the text.
- **Cover picture.** A story can have a cover, shown on its title card and at the top of the reading column, with the same description, credit and consent checks as any picture.
- **Pictures from a link.** Large photos can be added by their https address instead of uploaded. The editor says which site readers' browsers will fetch them from; they're fetched without saying which page asked.
- **Full size.** Any picture opens full size; Esc closes it without leaving the story.
- **Pictures and quotes.** Uploaded pictures are shrunk to 1,600 pixels across and kept in the browser (IndexedDB) with the story. A picture needs a description (alt text) and an answer about recognisable people before the story can be published; a missing credit is a note, not a block. A quote needs the person's agreement, ticked by the author.
- **Writing.** *Stories…* in the map's menu. A step is added from the map as it is; *Use the map as it is now* updates it. Marks are made by clicking records on the map, or choosing them from *Browse records* (keyboard). A checklist shows what blocks publishing and what's worth a look.
- **Reading.** A column of steps beside the pinned map, which follows the step a third of the way down the column. On a phone, one step at a time on a card over the map. **Presenting** is the card, larger, with ← → and Esc. The map frames each step's records, clear of the card; with reduced motion, it cuts instead of moving.
- **Spotlight.** While a step is read, its records stand out: the rest of the map fades, the links between them are drawn, and their names are shown. On by default; *Fade the rest of the map* turns it off for a step.
- **Marks in words.** Each step carries a sentence describing its marks and pinned pictures ("On the map: a ring around Hexham and Newcastle…"), read out by screen readers, since the marks themselves are drawings.
- **Title card.** Presenting, and reading on a phone, open on the story's title and introduction, with *Begin*.
- **On a phone,** the step card folds down to its buttons (*Hide text*) to look at the map.
- **Links to a step.** A published story keeps the current step in its address (`?step=3`), and *Copy a link to this step* gives one to send.
- **Writing.** A step's view is shown as chips: a selection, search or filter left over from exploring can be removed with ×. Steps can be duplicated. Pictures can be dropped onto a step or pasted, several at once.
- **Where stories live.** In the browser, with the map (by its saved ID). On a shared map, on the server with the map: editors write, viewers read and present, and a clash keeps both versions (see `docs/SHARED_MAPS.md`).
- **Publishing.** Choose a story in *Publish online*. The page opens on the story, with *Explore the map* to leave it. Because steps use filters, the whole map is published with a story, not just what's drawn now, after the same review. Pictures go inside the published copy, within the 4 MB a publication can carry; object storage for larger media comes with audio and video.

## Still to settle

1. **Media hosting for the hosted service.** Which S3-compatible store and region, and the per-plan storage limits.
2. **Map my Patch.** Link it, or build responses natively?

## Next

- Captioned video, and drawn areas on the Map lens (audio and marks on places are done).
- Freehand marks, once shapes have been used for a while.
- Readers responding, as pencil.
