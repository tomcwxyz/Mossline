"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  newStep, storyId, storyProblems, storyTextToHtml,
  type GraphDocument, type Story, type StoryMark, type StoryMedia, type StoryStep, type StoryView
} from "@mossline/graph-core";
import { prepareImage } from "../../lib/story-store";

/** Choosing records on the map for a mark: what's being drawn, and what's been picked so far. */
export type MarkPick = { kind: StoryMark["kind"]; targets: string[] };
export const MARK_NEEDS: Record<StoryMark["kind"], number> = { ring: 0, callout: 1, arrow: 2, number: 1 };
const MARK_NAMES: Record<StoryMark["kind"], string> = { ring: "Ring", callout: "Note", arrow: "Arrow", number: "Number" };
const MARK_HELP: Record<StoryMark["kind"], string> = {
  ring: "Click each record to ring, then Finish.", callout: "Click the record the note is about.",
  arrow: "Click the record the arrow starts from, then the one it points to.", number: "Click the record to number."
};
export const markPrompt = (p: MarkPick) => p.kind === "arrow" && p.targets.length === 1 ? "Now click the record the arrow points to." : MARK_HELP[p.kind];

/** Builds a finished mark from picked records. */
export function makeMark(pick: MarkPick, step: StoryStep): StoryMark {
  const id = storyId("mark:");
  if (pick.kind === "ring") return { id, kind: "ring", targets: pick.targets.slice(0, 200) };
  if (pick.kind === "callout") return { id, kind: "callout", targets: [pick.targets[0]], text: "Note" };
  if (pick.kind === "arrow") return { id, kind: "arrow", targets: [pick.targets[0], pick.targets[1]] };
  const n = step.marks.filter(m => m.kind === "number").length + 1;
  return { id, kind: "number", targets: [pick.targets[0]], n: Math.min(n, 99) };
}

const viewSummary = (v: StoryView, labelOf: (id: string) => string) => {
  const parts: string[] = [v.lens[0].toUpperCase() + v.lens.slice(1)];
  if (v.record) parts.push(labelOf(v.record));
  if (v.q) parts.push("“" + v.q + "”");
  if (v.theme) parts.push(v.theme);
  if (v.region) parts.push(v.region);
  if (v.funder) parts.push("funded by " + labelOf(v.funder));
  if (v.from || v.to) parts.push((v.from ?? "…") + "–" + (v.to ?? "…"));
  if (v.loop) parts.push("a feedback loop");
  return parts.join(" · ");
};

// ---- Writing a story ---------------------------------------------------------------
export function StoryEditor({ stories, story, graph, stepIndex, labelOf, captureView, picking, onPick, onStep, onChange, onCreate,
  onOpen, onDelete, onRead, onPresent, onClose, onSave, canWrite = true, shared = false, local = [], onMoveLocal }: {
  stories: Story[]; story: Story | null; graph: GraphDocument; stepIndex: number; labelOf: (id: string) => string;
  captureView: () => StoryView; picking: MarkPick | null; onPick: (p: MarkPick | null) => void;
  onStep: (i: number) => void; onChange: (s: Story) => void; onCreate: (title: string) => void;
  onOpen: (id: string | null) => void; onDelete: (id: string) => void; onRead: () => void; onPresent: () => void; onClose: () => void;
  /** Saves what's been typed now, rather than in a moment: called when focus leaves the editor. */
  onSave: () => void;
  /** Viewers of a shared map can read and present stories, not change them. */
  canWrite?: boolean;
  /** Kept with a shared map, and this browser's stories for it that aren't there yet. */
  shared?: boolean; local?: Story[]; onMoveLocal?: () => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [imageError, setImageError] = useState("");
  const [open, setOpen] = useState(true);
  const problems = useMemo(() => story ? storyProblems(story, graph) : [], [story, graph]);
  useEffect(() => { setConfirmDelete(false); setImageError(""); }, [story?.id, stepIndex]);

  const step = story?.steps[stepIndex] ?? null;
  const put = (next: Partial<Story>) => story && onChange({ ...story, ...next });
  const putStep = (next: Partial<StoryStep>) => story && step && put({ steps: story.steps.map((s, i) => i === stepIndex ? { ...s, ...next } : s) });
  const putMedia = (id: string, next: Partial<StoryMedia>) => step && putStep({ media: step.media.map(m => m.id === id ? { ...m, ...next } as StoryMedia : m) });
  const putMark = (id: string, next: Partial<StoryMark>) => step && putStep({ marks: step.marks.map(m => m.id === id ? { ...m, ...next } as StoryMark : m) });
  const move = (from: number, to: number) => {
    if (!story || to < 0 || to >= story.steps.length) return;
    const steps = [...story.steps]; const [s] = steps.splice(from, 1); steps.splice(to, 0, s);
    put({ steps }); onStep(to);
  };
  async function addImage(file: File) {
    if (!step) return;
    setImageError("");
    try {
      const src = await prepareImage(file);
      putStep({ media: [...step.media, { id: storyId("media:"), kind: "image", src, alt: "", people: "unknown" }] });
    } catch (e) { setImageError(e instanceof Error ? e.message : "Couldn't add that image."); }
  }
  const fileRef = useRef<HTMLInputElement>(null);

  return <aside className={"ml-overlay-card ml-edit-card ml-story-editor" + (open ? "" : " is-closed")} aria-label={canWrite ? "Writing a story" : "Stories"}
    onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onSave(); }}>
    <div className="ml-story-editor-head">
      <button type="button" className="ml-unplaced-head" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <strong>{story ? story.title : "Stories"}</strong><span aria-hidden="true">{open ? "–" : "+"}</span></button>
      <button type="button" className="ml-quiet ml-story-close" onClick={onClose} aria-label="Close stories">×</button>
    </div>
    {open && !story && <>
      <p className="ml-small">A story walks someone through this map, step by step, in your words. Each step remembers a view of the map,
        and can have pictures, quotes and marks drawn on the map.</p>
      {stories.length > 0 && <ul className="ml-story-list">{stories.map(s => <li key={s.id}>
        <button type="button" onClick={() => onOpen(s.id)}><strong>{s.title}</strong>
          <small>{s.steps.length} {s.steps.length === 1 ? "step" : "steps"}</small></button></li>)}</ul>}
      {!stories.length && !canWrite && <p className="ml-small">No stories on this map yet.</p>}
      {canWrite && <form className="ml-edit-form" onSubmit={e => { e.preventDefault(); onCreate(newTitle); setNewTitle(""); }}>
        <label className="ml-edit-field"><span>New story</span>
          <input value={newTitle} maxLength={140} placeholder="e.g. How the food network grew" onChange={e => setNewTitle(e.target.value)}/></label>
        <div className="ml-edit-actions"><button type="submit" className="ml-solid">Start a story</button></div>
      </form>}
      {shared && canWrite && local.length > 0 && <div className="ml-edit-form ml-edit-form--inline ml-story-local" role="group" aria-label="Stories in this browser">
        <p className="ml-small">{local.length === 1 ? "“" + local[0].title + "” is" : local.length + " stories are"} only in this browser,
          from before this map was shared.</p>
        <div className="ml-edit-actions"><button type="button" className="ml-quiet" onClick={onMoveLocal}>
          Move {local.length === 1 ? "it" : "them"} into the shared map</button></div>
      </div>}
      <p className="ml-small">{shared
        ? "Stories are kept with the shared map: everyone who can open it can read them" + (canWrite ? ", and people who can change it can write them." : ".")
        : "Stories are kept in this browser with the map. Save the map to your account to write them with others, or publish the map with its story."}</p>
    </>}
    {open && story && !canWrite && <>
      <div className="ml-edit-actions">
        <button type="button" className="ml-link-button" onClick={() => onOpen(null)}>← All stories</button>
        <span className="ml-story-spacer"/>
        <button type="button" className="ml-quiet" onClick={onRead} disabled={!story.steps.length}>Read</button>
        <button type="button" className="ml-quiet" onClick={onPresent} disabled={!story.steps.length}>Present</button>
      </div>
      {story.steps.length > 0 && <div className="ml-story-steps"><ol>{story.steps.map((s, i) => <li key={s.id}>
        <button type="button" aria-current={i === stepIndex ? "step" : undefined} onClick={() => onStep(i)}>
          <b>{i + 1}</b><span>{s.title.trim() || viewSummary(s.view, labelOf)}</span></button></li>)}</ol></div>}
      <p className="ml-small">You can view this map, so you can read and present its stories but not change them.</p>
    </>}
    {open && story && canWrite && <>
      <div className="ml-edit-actions">
        <button type="button" className="ml-link-button" onClick={() => onOpen(null)}>← All stories</button>
        <span className="ml-story-spacer"/>
        <button type="button" className="ml-quiet" onClick={onRead} disabled={!story.steps.length}>Read</button>
        <button type="button" className="ml-quiet" onClick={onPresent} disabled={!story.steps.length}>Present</button>
      </div>
      <label className="ml-edit-field"><span>Title</span>
        <input value={story.title} maxLength={140} onChange={e => put({ title: e.target.value })}/></label>
      <label className="ml-edit-field"><span>Introduction <small>optional</small></span>
        <textarea rows={2} value={story.intro} maxLength={2000} onChange={e => put({ intro: e.target.value })}/></label>

      <div className="ml-story-steps">
        <p className="ml-story-label">Steps</p>
        {story.steps.length > 0 && <ol>{story.steps.map((s, i) => <li key={s.id}>
          <button type="button" aria-current={i === stepIndex ? "step" : undefined} onClick={() => onStep(i)}>
            <b>{i + 1}</b><span>{s.title.trim() || viewSummary(s.view, labelOf)}</span></button></li>)}</ol>}
        <button type="button" className="ml-solid" disabled={story.steps.length >= 60} onClick={() => {
          const s = newStep(captureView());
          put({ steps: [...story.steps.slice(0, stepIndex + 1), s, ...story.steps.slice(stepIndex + 1)] });
          onStep(story.steps.length ? stepIndex + 1 : 0);
        }}>Add a step from this view</button>
        <p className="ml-small">Set up the map first (lens, selection, filters), then add a step. It remembers what the map shows.</p>
      </div>

      {step && <section className="ml-story-step-edit" aria-label={"Step " + (stepIndex + 1)}>
        <div className="ml-edit-actions">
          <strong className="ml-story-label">Step {stepIndex + 1}</strong><span className="ml-story-spacer"/>
          <button type="button" className="ml-quiet" aria-label="Move step earlier" disabled={stepIndex === 0} onClick={() => move(stepIndex, stepIndex - 1)}>↑</button>
          <button type="button" className="ml-quiet" aria-label="Move step later" disabled={stepIndex === story.steps.length - 1} onClick={() => move(stepIndex, stepIndex + 1)}>↓</button>
        </div>
        <p className="ml-small ml-story-view">Shows: {viewSummary(step.view, labelOf)}
          {" "}<button type="button" className="ml-link-button" onClick={() => putStep({ view: captureView() })}>Use the map as it is now</button></p>
        <label className="ml-edit-field"><span>Heading</span>
          <input value={step.title} maxLength={140} onChange={e => putStep({ title: e.target.value })}/></label>
        <label className="ml-edit-field"><span>Text <small>**bold**, *italic*, [link](https://…); a blank line starts a new paragraph</small></span>
          <textarea rows={5} value={step.text} maxLength={4000} onChange={e => putStep({ text: e.target.value })}/></label>

        <p className="ml-story-label">Marks on the map</p>
        <div className="ml-edit-bar" role="group" aria-label="Draw a mark">
          {(Object.keys(MARK_NAMES) as StoryMark["kind"][]).map(k => <button key={k} type="button" className="ml-quiet"
            aria-pressed={picking?.kind === k} disabled={step.marks.length >= 40}
            onClick={() => onPick(picking?.kind === k ? null : { kind: k, targets: [] })}>{MARK_NAMES[k]}</button>)}
        </div>
        {step.view.lens !== "network" && step.view.lens !== "themes" && <p className="ml-small">Marks show on the Network and Themes lenses.</p>}
        {step.marks.length > 0 && <ul className="ml-story-marks">{step.marks.map(m => <li key={m.id}>
          <span className="ml-story-mark-kind">{MARK_NAMES[m.kind]}{m.kind === "number" ? " " + m.n : ""}</span>
          <small>{m.targets.map(labelOf).join(m.kind === "arrow" ? " → " : ", ")}</small>
          {m.kind !== "number" && <input aria-label={MARK_NAMES[m.kind] + " text"} value={m.text ?? ""} maxLength={m.kind === "callout" ? 160 : 80}
            placeholder={m.kind === "callout" ? "What the note says" : "Label (optional)"}
            onChange={e => putMark(m.id, { text: m.kind === "callout" ? e.target.value : e.target.value || undefined })}/>}
          <button type="button" className="ml-link-button" onClick={() => putStep({ marks: step.marks.filter(x => x.id !== m.id) })}>Remove</button>
        </li>)}</ul>}

        <p className="ml-story-label">Pictures and quotes</p>
        <div className="ml-edit-bar">
          <button type="button" className="ml-quiet" disabled={step.media.length >= 6} onClick={() => fileRef.current?.click()}>Add a picture…</button>
          <button type="button" className="ml-quiet" disabled={step.media.length >= 6} onClick={() =>
            putStep({ media: [...step.media, { id: storyId("media:"), kind: "quote", text: "", who: "", consent: false }] })}>Add a quote</button>
          <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Choose a picture"
            onChange={e => { const f = e.currentTarget.files?.[0]; if (f) void addImage(f); e.currentTarget.value = ""; }}/>
        </div>
        {imageError && <p className="ml-small ml-story-error" role="alert">{imageError}</p>}
        {step.media.map(m => <div key={m.id} className="ml-edit-form ml-edit-form--inline ml-story-media-edit">
          {m.kind === "image" ? <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.src} alt="" className="ml-story-thumb"/>
            <label className="ml-edit-field"><span>Description for people who can&apos;t see it</span>
              <input value={m.alt} maxLength={400} onChange={e => putMedia(m.id, { alt: e.target.value })}/></label>
            <label className="ml-edit-field"><span>Caption <small>optional</small></span>
              <input value={m.caption ?? ""} maxLength={400} onChange={e => putMedia(m.id, { caption: e.target.value || undefined })}/></label>
            <div className="ml-edit-row">
              <label className="ml-edit-field"><span>Credit</span>
                <input value={m.credit ?? ""} maxLength={200} placeholder="Who took or made it" onChange={e => putMedia(m.id, { credit: e.target.value || undefined })}/></label>
              <label className="ml-edit-field"><span>Licence <small>optional</small></span>
                <input value={m.licence ?? ""} maxLength={120} placeholder="e.g. CC BY 4.0" onChange={e => putMedia(m.id, { licence: e.target.value || undefined })}/></label>
            </div>
            <label className="ml-edit-field"><span>Recognisable people</span>
              <select value={m.people} onChange={e => putMedia(m.id, { people: e.target.value as "none" | "consented" | "unknown" })}>
                <option value="unknown">Choose…</option>
                <option value="none">Nobody recognisable</option>
                <option value="consented">They agreed to it being used</option></select></label>
          </> : <>
            <label className="ml-edit-field"><span>Quote</span>
              <textarea rows={3} value={m.text} maxLength={1200} onChange={e => putMedia(m.id, { text: e.target.value })}/></label>
            <label className="ml-edit-field"><span>Who said it</span>
              <input value={m.who} maxLength={200} placeholder="Name, role, or a description they chose" onChange={e => putMedia(m.id, { who: e.target.value })}/></label>
            <label className="ml-story-check"><input type="checkbox" checked={m.consent} onChange={e => putMedia(m.id, { consent: e.target.checked })}/>
              They agreed to be quoted, attributed this way</label>
          </>}
          <button type="button" className="ml-link-button ml-edit-remove" onClick={() => putStep({ media: step.media.filter(x => x.id !== m.id) })}>
            Remove {m.kind === "image" ? "picture" : "quote"}</button>
        </div>)}

        <div className="ml-edit-actions">
          {confirmDelete ? <>
            <span className="ml-small">Delete this step?</span>
            <button type="button" className="ml-danger ml-solid" onClick={() => { put({ steps: story.steps.filter((_, i) => i !== stepIndex) }); onStep(Math.max(0, stepIndex - 1)); }}>Delete</button>
            <button type="button" className="ml-quiet" onClick={() => setConfirmDelete(false)}>Keep</button>
          </> : <button type="button" className="ml-link-button ml-edit-remove" onClick={() => setConfirmDelete(true)}>Delete step</button>}
        </div>
      </section>}

      {problems.length > 0 && <section className="ml-story-problems" aria-label="Before publishing">
        <p className="ml-story-label">Before publishing</p>
        <ul>{problems.map((p, i) => <li key={i} className={"is-" + p.severity}>
          {p.stepId ? <button type="button" className="ml-link-button" onClick={() => onStep(story.steps.findIndex(s => s.id === p.stepId))}>{p.message}</button> : p.message}
        </li>)}</ul>
      </section>}
      <DeleteStory onDelete={() => onDelete(story.id)}/>
    </>}
  </aside>;
}

function DeleteStory({ onDelete }: { onDelete: () => void }) {
  const [sure, setSure] = useState(false);
  return <div className="ml-edit-actions">{sure ? <>
    <span className="ml-small">Delete the whole story? This can&apos;t be undone.</span>
    <button type="button" className="ml-danger ml-solid" onClick={onDelete}>Delete story</button>
    <button type="button" className="ml-quiet" onClick={() => setSure(false)}>Keep</button>
  </> : <button type="button" className="ml-link-button ml-edit-remove" onClick={() => setSure(true)}>Delete story…</button>}</div>;
}

// ---- Reading a story ----------------------------------------------------------------
function Html({ text, className }: { text: string; className?: string }) {
  // storyTextToHtml escapes everything first; only its own small set of tags gets through.
  return text.trim() ? <div className={className} dangerouslySetInnerHTML={{ __html: storyTextToHtml(text) }}/> : null;
}
function Media({ media }: { media: StoryMedia[] }) {
  return <>{media.map(m => m.kind === "image" ? <figure key={m.id} className="ml-story-figure">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={m.src} alt={m.alt} loading="lazy"/>
    {(m.caption || m.credit || m.licence) && <figcaption>{m.caption}{m.caption && (m.credit || m.licence) ? " " : ""}
      {(m.credit || m.licence) && <small>{[m.credit, m.licence].filter(Boolean).join(" · ")}</small>}</figcaption>}
  </figure> : <blockquote key={m.id} className="ml-story-quote"><p>{m.text}</p>{m.who && <footer>— {m.who}</footer>}</blockquote>)}</>;
}

/**
 * The reading column: steps scroll past and the map beside it follows the one
 * in the middle of the column. Every step can also be reached with the buttons
 * or the arrow keys.
 */
export function StoryReader({ story, stepIndex, onStep, onExit, exitLabel, onPresent }: {
  story: Story; stepIndex: number; onStep: (i: number) => void; onExit: () => void; exitLabel: string; onPresent: () => void;
}) {
  const column = useRef<HTMLDivElement>(null);
  const fromScroll = useRef(false);
  /** While the column is being scrolled for someone, the steps it passes don't count. */
  const quietUntil = useRef(0);
  const stepRef = useRef(stepIndex); stepRef.current = stepIndex;
  // The current step is the last one whose top has passed a line a third of the way down the column.
  useEffect(() => {
    const root = column.current;
    if (!root) return;
    let timer = 0;
    const check = () => {
      const wait = quietUntil.current - Date.now();
      window.clearTimeout(timer);
      if (wait > 0) { timer = window.setTimeout(check, wait + 20); return; }
      const line = root.getBoundingClientRect().top + root.clientHeight * 0.38;
      let current = 0;
      root.querySelectorAll<HTMLElement>("[data-step]").forEach(el => { if (el.getBoundingClientRect().top <= line) current = Number(el.dataset.step); });
      if (current !== stepRef.current) { fromScroll.current = true; onStep(current); }
    };
    root.addEventListener("scroll", check, { passive: true });
    return () => { root.removeEventListener("scroll", check); window.clearTimeout(timer); };
  }, [onStep]);
  // Opening the column, or moving by button or key, scrolls it to the step.
  useEffect(() => {
    if (fromScroll.current) { fromScroll.current = false; return; }
    const root = column.current;
    if (!root) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    quietUntil.current = Date.now() + (still ? 150 : 900);
    const el = stepIndex > 0 ? root.querySelector<HTMLElement>(`[data-step="${stepIndex}"]`) : null;
    if (el) el.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
    else root.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
  }, [stepIndex]);

  return <div className="ml-story-reader" ref={column} tabIndex={0} aria-label={"Story: " + story.title}>
    <header className="ml-story-reader-head">
      <p className="ml-story-kicker">A story about this map</p>
      <h1>{story.title}</h1>
      <Html text={story.intro} className="ml-story-text"/>
      <div className="ml-edit-actions">
        <button type="button" className="ml-quiet" onClick={onPresent}>Present</button>
        <button type="button" className="ml-link-button" onClick={onExit}>{exitLabel}</button>
      </div>
    </header>
    {story.steps.map((s, i) => <section key={s.id} data-step={i} className={"ml-story-section" + (i === stepIndex ? " is-current" : "")}
      aria-current={i === stepIndex ? "step" : undefined} aria-labelledby={"story-step-" + i}>
      <h2 id={"story-step-" + i}><span className="ml-story-num">{i + 1}</span>{s.title || "Step " + (i + 1)}</h2>
      <Html text={s.text} className="ml-story-text"/>
      <Media media={s.media}/>
    </section>)}
    <footer className="ml-story-end">
      <p>End of the story.</p>
      <button type="button" className="ml-solid" onClick={onExit}>{exitLabel}</button>
    </footer>
  </div>;
}

/** One step at a time over the map: presenting to a room, and reading on a phone. */
export function StoryCard({ story, stepIndex, onStep, onExit, exitLabel, presenting }: {
  story: Story; stepIndex: number; onStep: (i: number) => void; onExit: () => void; exitLabel: string; presenting: boolean;
}) {
  const s = story.steps[stepIndex];
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => { head.current?.focus({ preventScroll: true }); }, [stepIndex]);
  if (!s) return null;
  return <section className={"ml-story-card" + (presenting ? " is-presenting" : "")} aria-label={"Story: " + story.title}>
    <p className="ml-story-kicker">{story.title} · {stepIndex + 1} of {story.steps.length}</p>
    <h2 ref={head} tabIndex={-1}>{s.title || "Step " + (stepIndex + 1)}</h2>
    <div className="ml-story-card-body">
      <Html text={s.text} className="ml-story-text"/>
      <Media media={s.media}/>
    </div>
    <nav className="ml-story-nav" aria-label="Story steps">
      <button type="button" className="ml-quiet" disabled={stepIndex === 0} onClick={() => onStep(stepIndex - 1)}>← Back</button>
      <span className="ml-story-dots" aria-hidden="true">{story.steps.map((x, i) => <i key={x.id} className={i === stepIndex ? "is-on" : ""}/>)}</span>
      {stepIndex < story.steps.length - 1
        ? <button type="button" className="ml-solid" onClick={() => onStep(stepIndex + 1)}>Next →</button>
        : <button type="button" className="ml-solid" onClick={onExit}>{exitLabel}</button>}
    </nav>
    {presenting && <p className="ml-story-keys">← → to move · Esc to stop</p>}
  </section>;
}
