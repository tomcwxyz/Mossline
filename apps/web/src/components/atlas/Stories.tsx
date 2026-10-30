"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  describeStep, isLinkedPicture, markStyleOf, newStep, storyId, storyProblems, storyTextToHtml, type StoryCover,
  type GraphDocument, type Story, type StoryMark, type StoryMedia, type StoryStep, type StoryView
} from "@mossline/graph-core";
import { prepareImage } from "../../lib/story-store";
import { motion } from "./snapshot";

/** Choosing records on the map for a mark: what's being drawn, and what's been picked so far. */
export type MarkPick = { kind: StoryMark["kind"] | "pin"; targets: string[]; mediaId?: string };
export const MARK_NEEDS: Record<MarkPick["kind"], number> = { ring: 0, callout: 1, arrow: 2, number: 1, pin: 1 };
const MARK_NAMES: Record<StoryMark["kind"], string> = { ring: "Ring", callout: "Note", arrow: "Arrow", number: "Number" };
const MARK_HELP: Record<StoryMark["kind"], string> = {
  ring: "Click each record to ring, then Finish.", callout: "Click the record the note is about.",
  arrow: "Click the record the arrow starts from, then the one it points to.", number: "Click the record to number."
};
export const markPrompt = (p: MarkPick) => p.kind === "pin" ? "Click the record to pin the picture beside."
  : p.kind === "arrow" && p.targets.length === 1 ? "Now click the record the arrow points to." : MARK_HELP[p.kind];

/** Builds a finished mark from picked records. */
export function makeMark(pick: MarkPick & { kind: StoryMark["kind"] }, step: StoryStep): StoryMark {
  const id = storyId("mark:");
  if (pick.kind === "ring") return { id, kind: "ring", targets: pick.targets.slice(0, 200) };
  if (pick.kind === "callout") return { id, kind: "callout", targets: [pick.targets[0]], text: "Note" };
  if (pick.kind === "arrow") return { id, kind: "arrow", targets: [pick.targets[0], pick.targets[1]] };
  const n = step.marks.filter(m => m.kind === "number").length + 1;
  return { id, kind: "number", targets: [pick.targets[0]], n: Math.min(n, 99) };
}

/** The parts of a step's view an author may want to drop: a selection left over, a search, a filter. */
function viewParts(v: StoryView, labelOf: (id: string) => string): { key: string; text: string; clear: (keyof StoryView)[] }[] {
  const parts: { key: string; text: string; clear: (keyof StoryView)[] }[] = [];
  if (v.record) parts.push({ key: "record", text: labelOf(v.record) + " selected", clear: ["record"] });
  if (v.q) parts.push({ key: "q", text: "search “" + v.q + "”", clear: ["q"] });
  if (v.theme) parts.push({ key: "theme", text: v.theme, clear: ["theme"] });
  if (v.type) parts.push({ key: "type", text: "only " + v.type + " records", clear: ["type"] });
  if (v.region) parts.push({ key: "region", text: v.region, clear: ["region"] });
  if (v.funder) parts.push({ key: "funder", text: "funded by " + labelOf(v.funder), clear: ["funder"] });
  if (v.from || v.to) parts.push({ key: "dates", text: (v.from ?? "…") + "–" + (v.to ?? "…"), clear: ["from", "to"] });
  if (v.loop) parts.push({ key: "loop", text: "a feedback loop", clear: ["loop"] });
  return parts;
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
  onOpen, onDelete, onRead, onPresent, onClose, onSave, canWrite = true, shared = false, local = [], onMoveLocal, onPrint }: {
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
  onPrint?: () => void;
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
  const [dropping, setDropping] = useState(false);
  const [linking, setLinking] = useState(false);
  const [addingAudio, setAddingAudio] = useState(false);
  async function addImages(files: File[]) {
    if (!step) return;
    setImageError("");
    const added: StoryMedia[] = [];
    for (const file of files.slice(0, Math.max(0, 6 - step.media.length))) {
      try { added.push({ id: storyId("media:"), kind: "image", src: await prepareImage(file), alt: "", people: "unknown" }); }
      catch (e) { setImageError(e instanceof Error ? e.message : "Couldn't add that image."); }
    }
    if (files.length > 6 - step.media.length) setImageError("A step can have up to six pictures and quotes.");
    if (added.length) putStep({ media: [...step.media, ...added] });
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
        {onPrint && <button type="button" className="ml-quiet" onClick={onPrint} disabled={!story.steps.length}>Print</button>}
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
        {onPrint && <button type="button" className="ml-quiet" onClick={onPrint} disabled={!story.steps.length}>Print</button>}
      </div>
      <label className="ml-edit-field"><span>Title</span>
        <input value={story.title} maxLength={140} onChange={e => put({ title: e.target.value })}/></label>
      <label className="ml-edit-field"><span>Introduction <small>optional</small></span>
        <textarea rows={2} value={story.intro} maxLength={2000} onChange={e => put({ intro: e.target.value })}/></label>
      <div className="ml-story-style"><span className="ml-story-label" id="ml-story-style-label">Marks on the map</span>
        <div className="ml-segmented" role="group" aria-labelledby="ml-story-style-label">
          {([["clean", "Clean"], ["hand", "Hand-drawn"]] as const).map(([v, text]) =>
            <button key={v} type="button" aria-pressed={markStyleOf(story) === v} onClick={() => put({ style: v })}>{text}</button>)}
        </div></div>
      <CoverEditor cover={story.cover} onChange={cover => put({ cover })}/>

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

      {step && <section className={"ml-story-step-edit" + (dropping ? " is-dropping" : "")} aria-label={"Step " + (stepIndex + 1)}
        // Pictures can be dropped onto the step, or pasted while writing it.
        onDragOver={e => { if ([...e.dataTransfer.items].some(i => i.kind === "file")) { e.preventDefault(); setDropping(true); } }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false); }}
        onDrop={e => { const files = [...e.dataTransfer.files].filter(f => f.type.startsWith("image/")); if (!files.length) return;
          e.preventDefault(); setDropping(false); void addImages(files); }}
        onPaste={e => { const files = [...e.clipboardData.files].filter(f => f.type.startsWith("image/")); if (!files.length) return;
          e.preventDefault(); void addImages(files); }}>
        <div className="ml-edit-actions">
          <strong className="ml-story-label">Step {stepIndex + 1}</strong><span className="ml-story-spacer"/>
          <button type="button" className="ml-quiet" aria-label="Move step earlier" disabled={stepIndex === 0} onClick={() => move(stepIndex, stepIndex - 1)}>↑</button>
          <button type="button" className="ml-quiet" aria-label="Move step later" disabled={stepIndex === story.steps.length - 1} onClick={() => move(stepIndex, stepIndex + 1)}>↓</button>
        </div>
        <div className="ml-story-view" role="group" aria-label="What this step shows">
          <span className="ml-story-view-lens">{step.view.lens[0].toUpperCase() + step.view.lens.slice(1)}</span>
          {viewParts(step.view, labelOf).map(p => <span key={p.key} className="ml-story-view-chip">{p.text}
            <button type="button" aria-label={"Stop showing " + p.text} title="Remove from this step"
              onClick={() => { const v = { ...step.view }; for (const k of p.clear) delete v[k]; putStep({ view: v }); }}>×</button></span>)}
          <button type="button" className="ml-link-button" onClick={() => putStep({ view: captureView() })}>Use the map as it is now</button>
        </div>
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
        {(step.view.lens === "funding" || step.view.lens === "timeline")
          ? <p className="ml-small">Marks show on the Network, Themes and Map lenses.</p>
          : step.view.lens === "map" && <p className="ml-small">On the Map, marks show for records that have a place.</p>}
        {step.marks.length > 0 && <ul className="ml-story-marks">{step.marks.map(m => <li key={m.id}>
          <span className="ml-story-mark-kind">{MARK_NAMES[m.kind]}{m.kind === "number" ? " " + m.n : ""}</span>
          <small>{m.targets.map(labelOf).join(m.kind === "arrow" ? " → " : ", ")}</small>
          {m.kind !== "number" && <input aria-label={MARK_NAMES[m.kind] + " text"} value={m.text ?? ""} maxLength={m.kind === "callout" ? 160 : 80}
            placeholder={m.kind === "callout" ? "What the note says" : "Label (optional)"}
            onChange={e => putMark(m.id, { text: m.kind === "callout" ? e.target.value : e.target.value || undefined })}/>}
          <button type="button" className="ml-link-button" onClick={() => putStep({ marks: step.marks.filter(x => x.id !== m.id) })}>Remove</button>
        </li>)}</ul>}

        <label className="ml-story-check"><input type="checkbox" checked={step.fade !== false}
          onChange={e => putStep({ fade: e.target.checked ? undefined : false })}/>
          Fade the rest of the map, so this step&apos;s records stand out</label>

        <p className="ml-story-label">Pictures and quotes</p>
        <div className="ml-edit-bar">
          <button type="button" className="ml-quiet" disabled={step.media.length >= 6} onClick={() => fileRef.current?.click()}
            title="Or drop a picture onto the step, or paste one">Add a picture…</button>
          <button type="button" className="ml-quiet" disabled={step.media.length >= 6} aria-expanded={linking}
            onClick={() => setLinking(v => !v)}>Picture from a link…</button>
          <button type="button" className="ml-quiet" disabled={step.media.length >= 6} onClick={() =>
            putStep({ media: [...step.media, { id: storyId("media:"), kind: "quote", text: "", who: "", consent: false }] })}>Add a quote</button>
          <button type="button" className="ml-quiet" disabled={step.media.length >= 6} aria-expanded={addingAudio}
            onClick={() => setAddingAudio(v => !v)}>Add audio…</button>
          <input ref={fileRef} hidden type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Choose pictures"
            onChange={e => { const files = [...(e.currentTarget.files ?? [])]; if (files.length) void addImages(files); e.currentTarget.value = ""; }}/>
        </div>
        {linking && <PictureLink onAdd={src => { setLinking(false);
          putStep({ media: [...step.media, { id: storyId("media:"), kind: "image", src, alt: "", people: "unknown" }] }); }}/>}
        {addingAudio && <AudioAdder onAdd={src => { setAddingAudio(false);
          putStep({ media: [...step.media, { id: storyId("media:"), kind: "audio", src, transcript: "", who: "", consent: false }] }); }}/>}
        {imageError && <p className="ml-small ml-story-error" role="alert">{imageError}</p>}
        {step.media.map(m => <div key={m.id} className="ml-edit-form ml-edit-form--inline ml-story-media-edit">
          {m.kind === "image" ? <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.src} alt="" className="ml-story-thumb" referrerPolicy="no-referrer"/>
            {isLinkedPicture(m.src) && <p className="ml-small">Shown from {hostOf(m.src)}: readers&apos; browsers fetch it from there.</p>}
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
            <p className="ml-small ml-story-pin">{m.record
              ? <>Pinned beside <strong>{labelOf(m.record)}</strong> on the map. <button type="button" className="ml-link-button"
                  onClick={() => putMedia(m.id, { record: undefined })}>Unpin</button></>
              : <button type="button" className="ml-link-button" aria-pressed={picking?.mediaId === m.id}
                  onClick={() => onPick(picking?.mediaId === m.id ? null : { kind: "pin", targets: [], mediaId: m.id })}>Pin beside a record on the map…</button>}</p>
            <label className="ml-edit-field"><span>Recognisable people</span>
              <select value={m.people} onChange={e => putMedia(m.id, { people: e.target.value as "none" | "consented" | "unknown" })}>
                <option value="unknown">Choose…</option>
                <option value="none">Nobody recognisable</option>
                <option value="consented">They agreed to it being used</option></select></label>
          </> : m.kind === "audio" ? <>
            <audio controls preload="metadata" src={m.src} className="ml-story-audio"/>
            <label className="ml-edit-field"><span>Title <small>optional</small></span>
              <input value={m.title ?? ""} maxLength={140} onChange={e => putMedia(m.id, { title: e.target.value || undefined })}/></label>
            <label className="ml-edit-field"><span>Transcript <small>everything said, for people who can&apos;t hear it</small></span>
              <textarea rows={4} value={m.transcript} maxLength={20000} onChange={e => putMedia(m.id, { transcript: e.target.value })}/></label>
            <label className="ml-edit-field"><span>Who&apos;s speaking</span>
              <input value={m.who} maxLength={200} placeholder="Name, role, or a description they chose" onChange={e => putMedia(m.id, { who: e.target.value })}/></label>
            <label className="ml-edit-field"><span>Credit <small>optional</small></span>
              <input value={m.credit ?? ""} maxLength={200} placeholder="Who recorded it" onChange={e => putMedia(m.id, { credit: e.target.value || undefined })}/></label>
            <label className="ml-story-check"><input type="checkbox" checked={m.consent} onChange={e => putMedia(m.id, { consent: e.target.checked })}/>
              Everyone heard agreed to the recording being used here</label>
          </> : <>
            <label className="ml-edit-field"><span>Quote</span>
              <textarea rows={3} value={m.text} maxLength={1200} onChange={e => putMedia(m.id, { text: e.target.value })}/></label>
            <label className="ml-edit-field"><span>Who said it</span>
              <input value={m.who} maxLength={200} placeholder="Name, role, or a description they chose" onChange={e => putMedia(m.id, { who: e.target.value })}/></label>
            <label className="ml-story-check"><input type="checkbox" checked={m.consent} onChange={e => putMedia(m.id, { consent: e.target.checked })}/>
              They agreed to be quoted, attributed this way</label>
          </>}
          <button type="button" className="ml-link-button ml-edit-remove" onClick={() => putStep({ media: step.media.filter(x => x.id !== m.id) })}>
            Remove {m.kind === "image" ? "picture" : m.kind === "audio" ? "audio" : "quote"}</button>
        </div>)}

        <div className="ml-edit-actions">
          {confirmDelete ? <>
            <span className="ml-small">Delete this step?</span>
            <button type="button" className="ml-danger ml-solid" onClick={() => { put({ steps: story.steps.filter((_, i) => i !== stepIndex) }); onStep(Math.max(0, stepIndex - 1)); }}>Delete</button>
            <button type="button" className="ml-quiet" onClick={() => setConfirmDelete(false)}>Keep</button>
          </> : <>
            <button type="button" className="ml-link-button" disabled={story.steps.length >= 60} onClick={() => {
              const copy: StoryStep = { ...step, id: storyId("step:"), title: step.title ? step.title + " (copy)" : "",
                media: step.media.map(m => ({ ...m, id: storyId("media:") })), marks: step.marks.map(m => ({ ...m, id: storyId("mark:") })) };
              put({ steps: [...story.steps.slice(0, stepIndex + 1), copy, ...story.steps.slice(stepIndex + 1)] }); onStep(stepIndex + 1);
            }}>Duplicate step</button>
            <span className="ml-story-spacer"/>
            <button type="button" className="ml-link-button ml-edit-remove" onClick={() => setConfirmDelete(true)}>Delete step</button>
          </>}
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
const hostOf = (src: string) => { try { return new URL(src).hostname; } catch { return "another site"; } };
const creditLine = (p: { credit?: string; licence?: string }) => [p.credit, p.licence].filter(Boolean).join(" · ");

/** A picture that opens full size. Linked pictures are fetched without saying which page they're on. */
function Picture({ src, alt, caption, credit, licence, className = "ml-story-figure" }: {
  src: string; alt: string; caption?: string; credit?: string; licence?: string; className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const credits = creditLine({ credit, licence });
  return <figure className={className}>
    <button type="button" className="ml-story-zoom" onClick={() => dialog.current?.showModal()} aria-label={"Show full size: " + (alt || "picture")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer"/>
    </button>
    {(caption || credits) && <figcaption>{caption}{caption && credits ? " " : ""}{credits && <small>{credits}</small>}</figcaption>}
    <dialog ref={dialog} className="ml-lightbox" aria-label={alt || "Picture"} onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} referrerPolicy="no-referrer"/>
      <div className="ml-lightbox-foot">
        <p>{caption}{caption && credits ? " · " : ""}{credits}</p>
        <button type="button" className="ml-solid" onClick={() => dialog.current?.close()} autoFocus>Close</button>
      </div>
    </dialog>
  </figure>;
}
function Media({ media }: { media: StoryMedia[] }) {
  return <>{media.map(m => m.kind === "image"
    ? <Picture key={m.id} src={m.src} alt={m.alt} caption={m.caption} credit={m.credit} licence={m.licence}/>
    : m.kind === "audio" ? <figure key={m.id} className="ml-story-figure ml-story-listen">
      {m.title && <p className="ml-story-listen-title">{m.title}</p>}
      <audio controls preload="none" src={m.src}/>
      <figcaption>{[m.who, m.credit].filter(Boolean).join(" · ")}</figcaption>
      <details className="ml-story-transcript"><summary>Transcript</summary><p>{m.transcript}</p></details>
    </figure>
    : <blockquote key={m.id} className="ml-story-quote"><p>{m.text}</p>{m.who && <footer>— {m.who}</footer>}</blockquote>)}</>;
}

/**
 * Adding audio: a short file, a recording made here, or an https link. Clips
 * are kept whole (no re-encoding), so long ones make a story heavy to keep
 * and publish: a link suits anything over a couple of minutes.
 */
const AUDIO_MAX = 2_000_000;
/** A data URL in the plain form stories accept: data:audio/<type>[;codecs=…];base64,… */
const tidyAudioUrl = (url: string) => url.replace(/^data:audio\/([a-z0-9-]+)([^,]*),/i, (_m, type: string, params: string) => {
  const codecs = params.split(";").find(p => p.startsWith("codecs="));
  return "data:audio/" + (type === "x-m4a" ? "mp4" : type.toLowerCase()) + ";" + (codecs ? codecs.toLowerCase() + ";" : "") + "base64,";
});
function AudioAdder({ onAdd }: { onAdd: (src: string) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState("");
  const [url, setUrl] = useState("");
  const [recording, setRecording] = useState<{ stop: () => void; started: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => {
      const s = Math.floor((Date.now() - recording.started) / 1000);
      setElapsed(s);
      if (s >= 180) recording.stop(); // three minutes at most
    }, 250);
    return () => window.clearInterval(t);
  }, [recording]);
  const asDataUrl = (blob: Blob) => new Promise<string>((done, fail) => {
    const r = new FileReader(); r.onload = () => done(tidyAudioUrl(String(r.result))); r.onerror = () => fail(r.error); r.readAsDataURL(blob);
  });
  async function take(blob: Blob) {
    setProblem("");
    if (!/^audio\/(mpeg|mp4|ogg|webm|aac|x-m4a)/.test(blob.type)) { setProblem("Use an MP3, M4A, OGG or WebM audio file."); return; }
    if (blob.size > AUDIO_MAX) { setProblem("That clip is " + (blob.size / 1e6).toFixed(1) + " MB; the limit is 2 MB. Shorten it, or add it by a link."); return; }
    try { onAdd(await asDataUrl(blob)); } catch { setProblem("Couldn't read that clip."); }
  }
  async function record() {
    setProblem("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].find(t => MediaRecorder.isTypeSupported(t)) ?? "";
      const rec = new MediaRecorder(stream, { mimeType: type || undefined, audioBitsPerSecond: 32_000 });
      const parts: Blob[] = [];
      rec.ondataavailable = e => parts.push(e.data);
      rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); setRecording(null); void take(new Blob(parts, { type: rec.mimeType.split(";")[0] })); };
      rec.start();
      setElapsed(0);
      setRecording({ stop: () => { if (rec.state !== "inactive") rec.stop(); }, started: Date.now() });
    } catch { setProblem("Couldn't use the microphone. Check the browser has permission."); }
  }
  return <div className="ml-edit-form ml-edit-form--inline ml-story-audio-add">
    <div className="ml-edit-bar">
      <button type="button" className="ml-quiet" onClick={() => file.current?.click()} disabled={!!recording}>Choose a file…</button>
      {recording
        ? <button type="button" className="ml-solid" onClick={recording.stop}>Stop recording · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</button>
        : typeof MediaRecorder !== "undefined" && <button type="button" className="ml-quiet" onClick={() => void record()}>Record…</button>}
    </div>
    <input ref={file} hidden type="file" accept="audio/mpeg,audio/mp4,audio/ogg,audio/webm,audio/aac,audio/x-m4a,.m4a,.mp3" aria-label="Choose an audio file"
      onChange={e => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (f) void take(f); }}/>
    <form className="ml-story-audio-link" onSubmit={e => { e.preventDefault();
      try { const u = new URL(url.trim()); if (u.protocol !== "https:" || u.username || u.password) throw Error(); onAdd(u.toString()); }
      catch { setProblem("Use the clip's full web address, starting https://"); } }}>
      <label className="ml-edit-field"><span>Or a link to the clip</span>
        <input type="url" value={url} placeholder="https://…" onChange={e => { setUrl(e.target.value); setProblem(""); }}/></label>
      <button type="submit" className="ml-quiet">Add</button>
    </form>
    {problem && <p className="ml-small ml-story-error" role="alert">{problem}</p>}
    <p className="ml-small">Up to 2 MB uploaded, or three minutes recorded here. Keep clips short: they&apos;re kept whole, and go with the story when it&apos;s published. Every clip needs a transcript.</p>
  </div>;
}

/** Adding a picture by its web address: only https, and the editor says where it will be fetched from. */
function PictureLink({ onAdd }: { onAdd: (src: string) => void }) {
  const [url, setUrl] = useState("");
  const [problem, setProblem] = useState("");
  return <form className="ml-edit-form ml-edit-form--inline" onSubmit={e => {
    e.preventDefault();
    try { const u = new URL(url.trim()); if (u.protocol !== "https:" || u.username || u.password) throw Error(); onAdd(u.toString()); setUrl(""); }
    catch { setProblem("Use a picture's full web address, starting https://"); }
  }}>
    <label className="ml-edit-field"><span>Picture&apos;s web address</span>
      <input type="url" value={url} placeholder="https://…" onChange={e => { setUrl(e.target.value); setProblem(""); }}/></label>
    {problem && <p className="ml-small ml-story-error" role="alert">{problem}</p>}
    <p className="ml-small">Good for large photos: nothing is uploaded. Readers&apos; browsers fetch it from that site, which can see they did, and it disappears if the site removes it.</p>
    <div className="ml-edit-actions"><button type="submit" className="ml-quiet">Add picture</button></div>
  </form>;
}

/** The story's cover picture: uploaded, or from a link, with the same description, credit and consent as any picture. */
function CoverEditor({ cover, onChange }: { cover?: StoryCover; onChange: (c: StoryCover | undefined) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [linking, setLinking] = useState(false);
  const [problem, setProblem] = useState("");
  const set = (src: string) => { setProblem(""); setLinking(false); onChange({ src, alt: cover?.alt ?? "", credit: cover?.credit, licence: cover?.licence, people: cover?.people ?? "unknown" }); };
  return <div className="ml-story-cover-edit">
    <p className="ml-story-label">Cover picture <small>optional</small></p>
    {cover ? <div className="ml-edit-form ml-edit-form--inline">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cover.src} alt="" className="ml-story-thumb" referrerPolicy="no-referrer"/>
      <label className="ml-edit-field"><span>Description for people who can&apos;t see it</span>
        <input value={cover.alt} maxLength={400} onChange={e => onChange({ ...cover, alt: e.target.value })}/></label>
      <div className="ml-edit-row">
        <label className="ml-edit-field"><span>Credit</span>
          <input value={cover.credit ?? ""} maxLength={200} onChange={e => onChange({ ...cover, credit: e.target.value || undefined })}/></label>
        <label className="ml-edit-field"><span>Licence <small>optional</small></span>
          <input value={cover.licence ?? ""} maxLength={120} onChange={e => onChange({ ...cover, licence: e.target.value || undefined })}/></label>
      </div>
      <label className="ml-edit-field"><span>Recognisable people</span>
        <select value={cover.people} onChange={e => onChange({ ...cover, people: e.target.value as StoryCover["people"] })}>
          <option value="unknown">Choose…</option><option value="none">Nobody recognisable</option>
          <option value="consented">They agreed to it being used</option></select></label>
      <button type="button" className="ml-link-button ml-edit-remove" onClick={() => onChange(undefined)}>Remove cover</button>
    </div> : <div className="ml-edit-bar">
      <button type="button" className="ml-quiet" onClick={() => file.current?.click()}>Upload…</button>
      <button type="button" className="ml-quiet" aria-expanded={linking} onClick={() => setLinking(v => !v)}>From a link…</button>
    </div>}
    <input ref={file} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Choose a cover picture"
      onChange={e => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = "";
        if (f) prepareImage(f).then(set).catch(err => setProblem(err instanceof Error ? err.message : "Couldn't add that picture.")); }}/>
    {linking && !cover && <PictureLink onAdd={set}/>}
    {problem && <p className="ml-small ml-story-error" role="alert">{problem}</p>}
  </div>;
}

/**
 * The reading column: steps scroll past and the map beside it follows the one
 * in the middle of the column. Every step can also be reached with the buttons
 * or the arrow keys.
 */
export function StoryReader({ story, stepIndex, onStep, onExit, exitLabel, onPresent, labelOf, onCopyStep, onPrint }: {
  story: Story; stepIndex: number; onStep: (i: number) => void; onExit: () => void; exitLabel: string; onPresent: () => void;
  labelOf: (id: string) => string;
  /** Published stories: copy a link that opens on this step. */
  onCopyStep?: (i: number) => void;
  /** Lays the story out for paper or PDF. */
  onPrint?: () => void;
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
      // Scrolling done for someone (a button, a key, a link) isn't them choosing a step:
      // a short story's column may not be able to scroll the step all the way up.
      if (Date.now() < quietUntil.current) return;
      window.clearTimeout(timer);
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
    const still = motion.still || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    quietUntil.current = Date.now() + (still ? 150 : 900);
    const el = stepIndex > 0 ? root.querySelector<HTMLElement>(`[data-step="${stepIndex}"]`) : null;
    if (el) el.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
    else root.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
  }, [stepIndex]);

  return <div className={"ml-story-reader ml-story--" + markStyleOf(story)} ref={column} tabIndex={0} aria-label={"Story: " + story.title}>
    <header className="ml-story-reader-head">
      {story.cover && <Picture src={story.cover.src} alt={story.cover.alt} credit={story.cover.credit} licence={story.cover.licence}
        className="ml-story-figure ml-story-cover-picture"/>}
      <p className="ml-story-kicker">A story about this map</p>
      <h1>{story.title}</h1>
      <Html text={story.intro} className="ml-story-text"/>
      <div className="ml-edit-actions">
        <button type="button" className="ml-quiet" onClick={onPresent}>Present</button>
        {onPrint && <button type="button" className="ml-quiet" onClick={onPrint}>Print or PDF</button>}
        <button type="button" className="ml-link-button" onClick={onExit}>{exitLabel}</button>
      </div>
    </header>
    {story.steps.map((s, i) => <section key={s.id} data-step={i} className={"ml-story-section" + (i === stepIndex ? " is-current" : "")}
      aria-current={i === stepIndex ? "step" : undefined} aria-labelledby={"story-step-" + i}>
      <h2 id={"story-step-" + i}><span className="ml-story-num">{i + 1}</span>{s.title || "Step " + (i + 1)}</h2>
      <Html text={s.text} className="ml-story-text"/>
      <Media media={s.media}/>
      <Described step={s} labelOf={labelOf}/>
      {onCopyStep && i === stepIndex && <button type="button" className="ml-link-button ml-story-steplink" onClick={() => onCopyStep(i)}>
        Copy a link to this step</button>}
    </section>)}
    <footer className="ml-story-end">
      <p>End of the story.</p>
      <button type="button" className="ml-solid" onClick={onExit}>{exitLabel}</button>
    </footer>
  </div>;
}

/** The map's marks in words, read out with the step (hidden from sight: the marks are on the map). */
function Described({ step, labelOf }: { step: StoryStep; labelOf: (id: string) => string }) {
  const text = describeStep(step, labelOf);
  return text ? <p className="ml-visually-hidden">{text}</p> : null;
}

/**
 * One step at a time over the map: presenting to a room, and reading on a
 * phone. It opens on a title card; on a phone it can be folded down to its
 * buttons, to look at the map.
 */
export function StoryCard({ story, stepIndex, onStep, onExit, exitLabel, presenting, labelOf, cover, onBegin }: {
  story: Story; stepIndex: number; onStep: (i: number) => void; onExit: () => void; exitLabel: string; presenting: boolean;
  labelOf: (id: string) => string;
  /** Show the title card first; onBegin moves on to the first step. */
  cover?: boolean; onBegin?: () => void;
}) {
  const s = story.steps[stepIndex];
  const head = useRef<HTMLHeadingElement>(null);
  const [folded, setFolded] = useState(false);
  useEffect(() => { head.current?.focus({ preventScroll: true }); }, [stepIndex, cover]);
  if (!s) return null;
  if (cover) return <section className={"ml-story-card ml-story-cover" + (presenting ? " is-presenting" : "")} aria-label={"Story: " + story.title}>
    <p className="ml-story-kicker">A story about this map · {story.steps.length} {story.steps.length === 1 ? "step" : "steps"}</p>
    {story.cover && <Picture src={story.cover.src} alt={story.cover.alt} credit={story.cover.credit} licence={story.cover.licence}
      className="ml-story-figure ml-story-cover-picture"/>}
    <h2 ref={head} tabIndex={-1} className="ml-story-cover-title">{story.title}</h2>
    {story.intro.trim() && <div className="ml-story-card-body" tabIndex={0}><Html text={story.intro} className="ml-story-text"/></div>}
    <nav className="ml-story-nav" aria-label="Story steps">
      <button type="button" className="ml-quiet" onClick={onExit}>{presenting ? "Stop" : exitLabel}</button>
      <span className="ml-story-spacer"/>
      <button type="button" className="ml-solid" onClick={onBegin}>Begin →</button>
    </nav>
    {presenting && <p className="ml-story-keys">→ to begin · Esc to stop</p>}
  </section>;
  return <section className={"ml-story-card ml-story--" + markStyleOf(story) + (presenting ? " is-presenting" : "") + (folded ? " is-folded" : "")} aria-label={"Story: " + story.title}>
    <div className="ml-story-card-top">
      <p className="ml-story-kicker">{story.title} · {stepIndex + 1} of {story.steps.length}</p>
      {!presenting && <button type="button" className="ml-link-button ml-story-fold" aria-expanded={!folded} onClick={() => setFolded(v => !v)}>
        {folded ? "Show text" : "Hide text"}</button>}
    </div>
    <h2 ref={head} tabIndex={-1}>{s.title || "Step " + (stepIndex + 1)}</h2>
    {!folded && <div className="ml-story-card-body" key={s.id} tabIndex={0}>
      <Html text={s.text} className="ml-story-text"/>
      <Media media={s.media}/>
      <Described step={s} labelOf={labelOf}/>
    </div>}
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

/**
 * A story laid out for paper or PDF: the cover, then each step with a
 * picture of the map as it was shown, its words, pictures and quotes, and
 * every credit. Only shown when printing.
 */
export function StoryPrint({ story, pictures, labelOf, link, mapTitle }: {
  story: Story; pictures: (string | null)[]; labelOf: (id: string) => string; link?: string; mapTitle: string;
}) {
  return createPortal(<article className={"ml-print ml-story--" + markStyleOf(story)} aria-hidden="true">
    <header className="ml-print-head">
      {story.cover && <figure className="ml-print-cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={story.cover.src} alt={story.cover.alt} referrerPolicy="no-referrer"/>
        {creditLine(story.cover) && <figcaption>{creditLine(story.cover)}</figcaption>}
      </figure>}
      <p className="ml-story-kicker">A story about {mapTitle}</p>
      <h1>{story.title}</h1>
      <Html text={story.intro} className="ml-story-text"/>
    </header>
    {story.steps.map((s, i) => <section key={s.id} className="ml-print-step">
      <h2><span className="ml-story-num">{i + 1}</span>{s.title || "Step " + (i + 1)}</h2>
      {pictures[i] ? <figure className="ml-print-map">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pictures[i]!} alt={"The map at step " + (i + 1)}/>
        <figcaption>{describeStep(s, labelOf) || "The map at this step."}</figcaption>
      </figure> : <p className="ml-print-note">This step shows the {s.view.lens} lens{link ? "; open the story online to see it" : ""}.</p>}
      <Html text={s.text} className="ml-story-text"/>
      {s.media.map(m => m.kind === "image" ? <figure key={m.id} className="ml-print-picture">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.src} alt={m.alt} referrerPolicy="no-referrer"/>
        {(m.caption || creditLine(m)) && <figcaption>{m.caption}{m.caption && creditLine(m) ? " · " : ""}{creditLine(m)}</figcaption>}
      </figure> : m.kind === "audio" ? <blockquote key={m.id} className="ml-story-quote ml-print-audio">
        <p className="ml-print-audio-head">Audio{m.title ? ": " + m.title : ""} · transcript</p><p>{m.transcript}</p>
        {(m.who || m.credit) && <footer>— {[m.who, m.credit].filter(Boolean).join(" · ")}</footer>}</blockquote>
      : <blockquote key={m.id} className="ml-story-quote"><p>{m.text}</p>{m.who && <footer>— {m.who}</footer>}</blockquote>)}
    </section>)}
    <footer className="ml-print-foot">Made with Mossline{link ? " · " + link : ""}</footer>
  </article>, document.body);
}
