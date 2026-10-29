# Hand-drawn styling: design notes

**Status: on the roadmap, not built.** A second way of drawing maps, alongside the current clean atlas style: a field notebook rather than a printed atlas.

## Why

The examples people bring are mostly drawn, not plotted:

- the Regenerative Atlas's soft clustered blobs;
- Dear Data's postcards;
- Kate McLean's smellscapes;
- workshop maps on paper.

A drawn look says "this is a picture of how we understand things", not "this is the official truth". It suits:

- systems maps and theories of change;
- conversation maps;
- anything still being worked out with people.

It also makes published maps and stories feel like *made* things.

Mossline already leans this way: the field-atlas metaphor, the ink/pencil/wash grammar, the serif and hand-set feel. Sketched styling takes that further, without changing the data.

## The rule: style never changes meaning

The visual grammar must survive intact:

- **Ink, recorded:** a confident hand-drawn line. It wobbles, but it's solid.
- **Pencil, suggested:** a light, broken, hatched or graphite line, unmistakably different from ink.
- **Wash, for navigation:** watercolour areas behind groups, with soft edges and slightly uneven pigment.
- **Marginalia** (story annotations, see `STORIES.md`): handwriting, in the author's colour.

Arrows, +/− signs, loop labels and the colours for each record type keep their meaning. A sketched map must be as readable, and as honest, as the clean one.

## What changes

| Element | Clean (today) | Sketched |
| --- | --- | --- |
| Links | Straight, even lines | Slightly curved, wobbling strokes with tapered ends; pencil links hatched |
| Records | Crisp shapes | Hand-inked outlines, a little irregular, with light fill |
| Groups | Smooth wash | Watercolour wash with paper grain and pigment pooling at the edges |
| Labels | IBM Plex Sans | A legible open-licence handwriting face for labels, Newsreader kept for headings |
| Background | Flat paper colour | Subtle paper texture, which can be turned off |
| Map lens | Clean basemap | Muted, inked basemap: coastlines and roads as pen lines, fewer details |

**The wobble is fixed, not random each time.** Each record and link takes its jitter from a seed derived from its ID, so the drawing doesn't shimmer when the view moves and looks the same for everyone.

## Where it applies

- **A switch beside Night/Day:** Clean or Sketched, for the whole app.
- **Per published map and per story:** the author chooses, so a published story can be sketched even if the reader's own preference is clean.
- **Lenses:** Network, Themes and Map first; Funding and Timeline charts later (hand-drawn bars and timelines are a good fit).

## Constraints

- **Performance.** The network uses Sigma (WebGL) and handles tens of thousands of records. Sketching is done in the GPU programs (vertex jitter and stroke textures), not by redrawing in SVG. Above a size threshold (likely a few thousand links), sketching falls back to clean, and the page says so.
- **Accessibility.** Labels stay at WCAG AA contrast in day and night. The handwriting face must be readable at small sizes, and people can choose clean labels with sketched lines. Textures never sit behind text. Reduced-motion users see no animated wobble.
- **Licences.** Fonts under the SIL Open Font Licence, served locally like the current fonts. Any drawing library (for example Rough.js for SVG overlays and charts) must be open source with a permissive licence.
- **Printing and export.** Sketched maps should export to PNG and PDF looking as they do on screen.

## Suggested steps

1. **Prove the look in Themes on a small map:** the watercolour wash, inked outlines and the handwriting face, with the ink, pencil and wash distinctions checked with a few people.
2. **Sigma edge and node programs** with seeded wobble; pencil hatching; the size fallback.
3. **The Clean/Sketched switch;** an author's choice for published maps and stories.
4. **Map lens basemap style;** then the charts.

## Related: field notes

Sensory and observational mapping (smellwalks, soundwalks, "what I noticed here") would sit naturally on a sketched map. Observations are a different kind of data from records and links: what was sensed, where, how strongly, when. So field notes would be a layer of their own: points and routes, drawn as rings and contours. That's a separate experiment, listed on the roadmap; the sketched style is what would make it look right.
