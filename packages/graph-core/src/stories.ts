import { z } from "zod";
import type { GraphDocument } from "./schema";

/**
 * A story walks someone through a map, step by step, in the author's words.
 * Each step is a view of the map (the atlas's own view state), a short text,
 * optional media, and optional marks drawn on the map in the author's hand.
 *
 * Steps point at records by ID, never by position, so a story survives the
 * data being updated and the layout moving. Marks are the author's notes:
 * they are never records or relationships, never counted, never exported as
 * data (see docs/design/STORIES.md).
 */
const id = z.string().min(1).max(200);
const httpsOrData = z.string().max(3_000_000).refine(v => {
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v)) return true;
  try { const u = new URL(v); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; }
}, "Images must be uploaded, or an https link");

const httpsOrAudio = z.string().max(3_000_000).refine(v => {
  if (/^data:audio\/(mpeg|mp4|ogg|webm|aac|x-m4a);(codecs=[a-z0-9.]+;)?base64,[A-Za-z0-9+/=]+$/.test(v)) return true;
  try { const u = new URL(v); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; }
}, "Audio must be uploaded, recorded, or an https link");

/** What the map shows at a step: the same state the atlas keeps in its address. */
export const storyViewSchema = z.object({
  lens: z.enum(["network", "map", "themes", "funding", "timeline"]),
  record: id.optional(),
  q: z.string().max(200).optional(),
  theme: z.string().max(200).optional(),
  group: z.string().max(40).optional(),
  region: z.string().max(200).optional(),
  funder: id.optional(),
  type: z.string().max(40).optional(),
  from: z.number().int().min(1800).max(2200).optional(),
  to: z.number().int().min(1800).max(2200).optional(),
  loop: z.string().max(400).optional()
}).strict();

export const storyMediaSchema = z.discriminatedUnion("kind", [
  z.object({
    id, kind: z.literal("image"), src: httpsOrData,
    /** Read aloud and shown when the image can't be: required to publish. */
    alt: z.string().max(400),
    credit: z.string().max(200).optional(),
    licence: z.string().max(120).optional(),
    /** Recognisable people in it agreed to it being used. */
    people: z.enum(["none", "consented", "unknown"]).default("unknown"),
    caption: z.string().max(400).optional(),
    /** Pinned beside a record on the map while its step is shown. */
    record: id.optional()
  }).strict(),
  z.object({
    id, kind: z.literal("quote"), text: z.string().min(1).max(1200),
    who: z.string().max(200),
    /** The person agreed to be quoted: required to publish. */
    consent: z.boolean(),
    record: id.optional()
  }).strict(),
  z.object({
    id, kind: z.literal("audio"), src: httpsOrAudio,
    title: z.string().max(140).optional(),
    /** Everything said, for people who can't hear it and for search: required to publish. */
    transcript: z.string().max(20_000),
    who: z.string().max(200),
    /** The people heard agreed to it being used: required to publish. */
    consent: z.boolean(),
    credit: z.string().max(200).optional(),
    record: id.optional()
  }).strict()
]);

/** A story's cover: shown on its title card and at the top of the reading column. */
export const storyCoverSchema = z.object({
  src: httpsOrData, alt: z.string().max(400),
  credit: z.string().max(200).optional(), licence: z.string().max(120).optional(),
  people: z.enum(["none", "consented", "unknown"]).default("unknown")
}).strict();

/** Marks drawn on the map, anchored to records. */
export const storyMarkSchema = z.discriminatedUnion("kind", [
  z.object({ id, kind: z.literal("ring"), targets: z.array(id).min(1).max(200), text: z.string().max(80).optional() }).strict(),
  z.object({ id, kind: z.literal("callout"), targets: z.array(id).length(1), text: z.string().min(1).max(160) }).strict(),
  z.object({ id, kind: z.literal("arrow"), targets: z.array(id).length(2), text: z.string().max(80).optional() }).strict(),
  z.object({ id, kind: z.literal("number"), targets: z.array(id).length(1), n: z.number().int().min(1).max(99) }).strict()
]);

export const storyStepSchema = z.object({
  id,
  title: z.string().max(140),
  text: z.string().max(4000),
  view: storyViewSchema,
  media: z.array(storyMediaSchema).max(6).default([]),
  marks: z.array(storyMarkSchema).max(40).default([]),
  /** Fade the rest of the map so the step's records stand out (on unless turned off). */
  fade: z.boolean().optional()
}).strict();

export const storySchema = z.object({
  kind: z.literal("mossline-story"),
  version: z.literal(1),
  id,
  title: z.string().min(1).max(140),
  intro: z.string().max(2000).default(""),
  cover: storyCoverSchema.optional(),
  steps: z.array(storyStepSchema).max(60),
  updatedAt: z.string()
}).strict();

export type Story = z.infer<typeof storySchema>;
export type StoryStep = z.infer<typeof storyStepSchema>;
export type StoryView = z.infer<typeof storyViewSchema>;
export type StoryMedia = z.infer<typeof storyMediaSchema>;
export type StoryMark = z.infer<typeof storyMarkSchema>;
export type StoryCover = z.infer<typeof storyCoverSchema>;
/** Whether a picture is a link to another site (its readers' browsers fetch it from there) rather than uploaded. */
export const isLinkedPicture = (src: string) => src.startsWith("https://");

let counter = 0;
export const storyId = (prefix: string) => prefix + Date.now().toString(36) + (counter++).toString(36) + Math.random().toString(36).slice(2, 6);
export function newStory(title: string, now = new Date()): Story {
  return { kind: "mossline-story", version: 1, id: storyId("story:"), title: title.trim() || "Untitled story", intro: "", steps: [], updatedAt: now.toISOString() };
}
export function newStep(view: StoryView, title = ""): StoryStep {
  return { id: storyId("step:"), title, text: "", view, media: [], marks: [] };
}
export const parseStory = (value: unknown): Story => storySchema.parse(value);

/** Records a step points at: its selected record, quoted records and marked records. */
export function stepRecords(step: StoryStep): string[] {
  const ids = new Set<string>();
  if (step.view.record) ids.add(step.view.record);
  if (step.view.funder) ids.add(step.view.funder);
  for (const m of step.marks) for (const t of m.targets) ids.add(t);
  for (const m of step.media) if (m.record) ids.add(m.record);
  return [...ids];
}

/**
 * The marks and pinned pictures in words, for people who can't see them:
 * read out with the step, so the map's annotations reach everyone.
 */
export function describeStep(step: StoryStep, labelOf: (id: string) => string): string {
  const list = (ids: string[]) => ids.length <= 2 ? ids.map(labelOf).join(" and ")
    : ids.slice(0, -1).map(labelOf).join(", ") + " and " + labelOf(ids[ids.length - 1]);
  const parts = step.marks.map(m =>
    m.kind === "ring" ? "a ring around " + list(m.targets) + (m.text ? " labelled “" + m.text + "”" : "")
    : m.kind === "callout" ? "a note on " + labelOf(m.targets[0]) + ": “" + m.text + "”"
    : m.kind === "arrow" ? "an arrow from " + labelOf(m.targets[0]) + " to " + labelOf(m.targets[1]) + (m.text ? " labelled “" + m.text + "”" : "")
    : "number " + m.n + " on " + labelOf(m.targets[0]));
  for (const m of step.media) if (m.kind === "image" && m.record)
    parts.push("a picture beside " + labelOf(m.record) + (m.alt.trim() ? " (" + m.alt.trim() + ")" : ""));
  return parts.length ? "On the map: " + parts.join("; ") + "." : "";
}

export type StoryProblem = { stepId: string | null; severity: "block" | "note"; message: string };
/**
 * What stops a story being published (block), and what's worth a look (note).
 * Accessibility and consent block; missing credits and records gone from the
 * map are notes, because the author may have reasons.
 */
export function storyProblems(story: Story, graph?: GraphDocument): StoryProblem[] {
  const problems: StoryProblem[] = [];
  const known = graph ? new Set(graph.nodes.map(n => n.id)) : null;
  if (!story.steps.length) problems.push({ stepId: null, severity: "block", message: "Add at least one step." });
  if (story.cover) {
    if (!story.cover.alt.trim()) problems.push({ stepId: null, severity: "block", message: "The cover picture needs a description for people who can't see it." });
    if (story.cover.people === "unknown") problems.push({ stepId: null, severity: "block", message: "Say whether recognisable people in the cover picture agreed to it being used." });
    if (!story.cover.credit?.trim()) problems.push({ stepId: null, severity: "note", message: "The cover picture has no credit." });
  }
  story.steps.forEach((step, i) => {
    const where = "Step " + (i + 1);
    if (!step.title.trim() && !step.text.trim()) problems.push({ stepId: step.id, severity: "note", message: where + " has no words yet." });
    for (const m of step.media) {
      if (m.kind === "image") {
        if (!m.alt.trim()) problems.push({ stepId: step.id, severity: "block", message: where + ": an image needs a description for people who can't see it." });
        if (m.people === "unknown") problems.push({ stepId: step.id, severity: "block", message: where + ": say whether recognisable people in an image agreed to it being used." });
        if (!m.credit?.trim()) problems.push({ stepId: step.id, severity: "note", message: where + ": an image has no credit." });
      } else if (m.kind === "audio") {
        if (!m.transcript.trim()) problems.push({ stepId: step.id, severity: "block", message: where + ": an audio clip needs a transcript, for people who can't hear it." });
        if (!m.consent) problems.push({ stepId: step.id, severity: "block", message: where + ": confirm " + (m.who.trim() || "the people heard") + " agreed to the recording being used." });
        if (!m.who.trim()) problems.push({ stepId: step.id, severity: "note", message: where + ": an audio clip doesn't say who's speaking." });
      } else {
        if (!m.consent) problems.push({ stepId: step.id, severity: "block", message: where + ": confirm " + (m.who.trim() || "the person quoted") + " agreed to be quoted." });
        if (!m.who.trim()) problems.push({ stepId: step.id, severity: "note", message: where + ": a quote has no attribution." });
      }
    }
    if (known) {
      const missing = stepRecords(step).filter(r => !known.has(r));
      if (missing.length) problems.push({ stepId: step.id, severity: "note",
        message: where + ": " + missing.length + (missing.length === 1 ? " record it points at isn't" : " records it points at aren't") + " in the map any more." });
    }
  });
  return problems;
}

/**
 * Story text: a deliberately small, safe subset. Paragraphs, line breaks,
 * **bold**, *italic* and [links](https://…). Everything else is shown as
 * typed, so published stories can't carry scripts or markup.
 */
export function storyTextToHtml(text: string): string {
  const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  const inline = (s: string) => escape(s)
    .replace(/\[([^\]]{1,200})\]\((https:\/\/[^\s)]{1,500})\)/g, (_m, label: string, url: string) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`)
    .replace(/\*\*([^*]{1,500})\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]{0,499})\*/g, "$1<em>$2</em>");
  return text.trim().split(/\n{2,}/).filter(p => p.trim())
    .map(p => "<p>" + p.split("\n").map(inline).join("<br>") + "</p>").join("");
}
