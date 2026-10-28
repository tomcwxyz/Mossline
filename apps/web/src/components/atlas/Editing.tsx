"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  describeEdit, edgePolarity, edgeValues, makeEdit, newRecordId, nodeValues, planQuickLinks, quickLinkEdits,
  type Edit, type EditLayer, type EdgeFields, type GraphDocument, type GraphEdge, type GraphNode, type NodeFields, type NodeType
} from "@mossline/graph-core";
import { TYPE_LABEL } from "./palette";
import { TypeMark } from "./RecordPanel";

/**
 * Editing a map in place. Every form here produces changes (see
 * graph-core/edits.ts) that sit beside the imported records with a receipt;
 * nothing overwrites what a file said.
 */
const TYPES: NodeType[] = ["organisation", "project", "funder", "person", "place", "outcome", "topic", "other"];
const DIRECTIONS: { value: NonNullable<GraphEdge["direction"]>; label: string }[] = [
  { value: "directed", label: "→ one way" }, { value: "mutual", label: "↔ both ways" }, { value: "undirected", label: "— no direction" }];
const SIGNS: { value: "none" | "+" | "-"; label: string }[] = [
  { value: "none", label: "No sign" }, { value: "+", label: "+ more leads to more" }, { value: "-", label: "− more leads to less" }];
const splitTags = (s: string) => [...new Set(s.split(/[,;|]/).map(t => t.trim()).filter(Boolean))];

export interface EditingApi {
  graph: GraphDocument;
  editor: string;
  add: (edits: Edit[]) => void;
  /** Start choosing a link's other end on the map. */
  pickTarget: (fromId: string) => void;
  picked: string | null;
  clearPicked: () => void;
  linkKinds: string[];
}

function Note({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <label className="ml-edit-field"><span>Why, or where this comes from <small>optional</small></span>
    <input value={value} maxLength={300} placeholder="e.g. Agreed at the steering group, 3 Oct" onChange={e => onChange(e.target.value)}/></label>;
}

/** Change what a record says, or remove it from this map. */
export function RecordEditor({ node, api, onDone }: { node: GraphNode; api: EditingApi; onDone: () => void }) {
  const start = nodeValues(node, ["label", "type", "description", "region", "tags", "postcode"]);
  const [label, setLabel] = useState(start.label ?? "");
  const [type, setType] = useState<NodeType>(start.type ?? "other");
  const [description, setDescription] = useState(start.description ?? "");
  const [region, setRegion] = useState(start.region ?? "");
  const [tags, setTags] = useState((start.tags ?? []).join(", "));
  const [postcode, setPostcode] = useState(start.postcode ?? "");
  const [note, setNote] = useState("");
  const [removing, setRemoving] = useState(false);
  function save(event: FormEvent) {
    event.preventDefault();
    const now: NodeFields = { label: label.trim(), type, description: description.trim(), region: region.trim(), tags: splitTags(tags), postcode: postcode.trim().toUpperCase() };
    const set: NodeFields = {};
    for (const k of Object.keys(now) as (keyof NodeFields)[])
      if (JSON.stringify(now[k]) !== JSON.stringify(start[k])) (set as Record<string, unknown>)[k] = now[k];
    if (!now.label) return;
    if (Object.keys(set).length)
      api.add([makeEdit({ kind: "update-node", id: node.id, set, was: nodeValues(node, Object.keys(set) as (keyof NodeFields)[]) }, api.editor, note)]);
    onDone();
  }
  return <form className="ml-edit-form" onSubmit={save} aria-label={"Edit " + node.label}>
    <label className="ml-edit-field"><span>Name</span><input required value={label} maxLength={200} onChange={e => setLabel(e.target.value)}/></label>
    <label className="ml-edit-field"><span>Type</span><select value={type} onChange={e => setType(e.target.value as NodeType)}>
      {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></label>
    <label className="ml-edit-field"><span>Description</span><textarea value={description} maxLength={4000} rows={3} onChange={e => setDescription(e.target.value)}/></label>
    <label className="ml-edit-field"><span>Tags <small>separated by commas</small></span><input value={tags} onChange={e => setTags(e.target.value)}/></label>
    <div className="ml-edit-row">
      <label className="ml-edit-field"><span>Region</span><input value={region} maxLength={200} onChange={e => setRegion(e.target.value)}/></label>
      <label className="ml-edit-field"><span>Postcode</span><input value={postcode} maxLength={10} onChange={e => setPostcode(e.target.value)}/></label>
    </div>
    <Note value={note} onChange={setNote}/>
    <p className="ml-small">Saved as a change beside the imported record. What your files said is kept and can be restored.</p>
    <div className="ml-edit-actions">
      <button type="submit" className="ml-primary">Save changes</button>
      <button type="button" className="ml-quiet" onClick={onDone}>Cancel</button>
    </div>
    {!removing ? <button type="button" className="ml-link-button ml-edit-remove" onClick={() => setRemoving(true)}>Remove from this map…</button>
      : <div className="ml-edit-confirm" role="group" aria-label="Remove record">
        <p>Remove <strong>{node.label}</strong> and its links from this map? The source files are not changed, and you can undo this.</p>
        <div className="ml-edit-actions">
          <button type="button" className="ml-solid ml-danger" onClick={() => {
            api.add([makeEdit({ kind: "remove-node", id: node.id, label: node.label }, api.editor, note)]); onDone();
          }}>Remove</button>
          <button type="button" className="ml-quiet" onClick={() => setRemoving(false)}>Keep it</button>
        </div></div>}
  </form>;
}

/** Draw a new link from a record: choose the other end by name or on the map. */
export function LinkCreator({ from, api, onDone }: { from: GraphNode; api: EditingApi; onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [direction, setDirection] = useState<NonNullable<GraphEdge["direction"]>>("directed");
  const [sign, setSign] = useState<"none" | "+" | "-">("none");
  const [note, setNote] = useState("");
  const chosen = targetId ?? api.picked;
  const target = chosen ? api.graph.nodes.find(n => n.id === chosen) ?? null : null;
  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("en-GB");
    if (q.length < 2) return [];
    return api.graph.nodes.filter(n => n.id !== from.id && n.label.toLocaleLowerCase("en-GB").includes(q)).slice(0, 8);
  }, [query, api.graph, from.id]);
  const newName = query.trim();
  const exact = api.graph.nodes.some(n => n.label.toLocaleLowerCase("en-GB") === newName.toLocaleLowerCase("en-GB"));
  function save(event: FormEvent) {
    event.preventDefault();
    if (!type.trim()) return;
    const edits: Edit[] = [];
    let targetRecord = target?.id;
    if (!targetRecord) {
      if (!newName) return;
      targetRecord = newRecordId();
      edits.push(makeEdit({ kind: "add-node", node: { id: targetRecord, label: newName, type: from.type === "outcome" ? "outcome" : "organisation", tags: [] } }, api.editor, note));
    }
    edits.push(makeEdit({ kind: "add-edge", edge: { id: newRecordId(), source: from.id, target: targetRecord, type: type.trim(), direction,
      ...(sign !== "none" ? { properties: { Polarity: sign } } : {}) } }, api.editor, note));
    api.add(edits); api.clearPicked(); onDone();
  }
  return <form className="ml-edit-form" onSubmit={save} aria-label={"New link from " + from.label}>
    <p className="ml-edit-from"><TypeMark type={from.type}/><strong>{from.label}</strong> <span aria-hidden="true">{direction === "undirected" ? "—" : direction === "mutual" ? "↔" : "→"}</span></p>
    {target ? <p className="ml-edit-target"><TypeMark type={target.type}/><strong>{target.label}</strong>
      <button type="button" className="ml-link-button" onClick={() => { setTargetId(null); api.clearPicked(); }}>Change</button></p>
      : <>
        <label className="ml-edit-field"><span>Link to</span>
          <input value={query} placeholder="Type a name" onChange={e => setQuery(e.target.value)} autoFocus/></label>
        {matches.length > 0 && <ul className="ml-edit-matches">{matches.map(n => <li key={n.id}>
          <button type="button" onClick={() => setTargetId(n.id)}><TypeMark type={n.type}/>{n.label}</button></li>)}</ul>}
        {newName.length >= 2 && !exact && <p className="ml-small">No match? Saving adds <strong>{newName}</strong> as a new record.</p>}
        <button type="button" className="ml-quiet ml-edit-pick" onClick={() => api.pickTarget(from.id)}>Or choose it on the map</button>
      </>}
    <label className="ml-edit-field"><span>Kind of link</span>
      <input required list="ml-link-kinds" value={type} maxLength={120} placeholder="e.g. funds, partners with, increases" onChange={e => setType(e.target.value)}/>
      <datalist id="ml-link-kinds">{api.linkKinds.map(k => <option key={k} value={k}/>)}</datalist></label>
    <div className="ml-edit-row">
      <label className="ml-edit-field"><span>Direction</span><select value={direction} onChange={e => setDirection(e.target.value as typeof direction)}>
        {DIRECTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></label>
      <label className="ml-edit-field"><span>Cause and effect</span><select value={sign} onChange={e => setSign(e.target.value as typeof sign)}>
        {SIGNS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
    </div>
    <Note value={note} onChange={setNote}/>
    <div className="ml-edit-actions">
      <button type="submit" className="ml-primary" disabled={!target && newName.length < 2}>Add link</button>
      <button type="button" className="ml-quiet" onClick={() => { api.clearPicked(); onDone(); }}>Cancel</button>
    </div>
  </form>;
}

/** Change a link's kind, direction or sign, or remove it. */
export function LinkEditor({ edge, label, api, onDone }: { edge: GraphEdge; label: string; api: EditingApi; onDone: () => void }) {
  const start = edgeValues(edge, ["type", "direction", "polarity", "description"]);
  const [type, setType] = useState(start.type ?? "");
  const [direction, setDirection] = useState(start.direction ?? "directed");
  const [sign, setSign] = useState(start.polarity ?? "none");
  const [note, setNote] = useState("");
  function save(event: FormEvent) {
    event.preventDefault();
    const now: EdgeFields = { type: type.trim(), direction, polarity: sign };
    const set: EdgeFields = {};
    for (const k of Object.keys(now) as (keyof EdgeFields)[]) if (now[k] !== start[k]) (set as Record<string, unknown>)[k] = now[k];
    if (Object.keys(set).length && now.type)
      api.add([makeEdit({ kind: "update-edge", id: edge.id, set, was: edgeValues(edge, Object.keys(set) as (keyof EdgeFields)[]) }, api.editor, note)]);
    onDone();
  }
  return <form className="ml-edit-form ml-edit-form--inline" onSubmit={save} aria-label={"Edit link " + label}>
    <label className="ml-edit-field"><span>Kind of link</span><input required list="ml-link-kinds" value={type} onChange={e => setType(e.target.value)}/></label>
    <div className="ml-edit-row">
      <label className="ml-edit-field"><span>Direction</span><select value={direction} onChange={e => setDirection(e.target.value as typeof direction)}>
        {DIRECTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></label>
      <label className="ml-edit-field"><span>Sign</span><select value={sign} onChange={e => setSign(e.target.value as typeof sign)}>
        {SIGNS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
    </div>
    <Note value={note} onChange={setNote}/>
    <div className="ml-edit-actions">
      <button type="submit" className="ml-primary">Save</button>
      <button type="button" className="ml-quiet" onClick={onDone}>Cancel</button>
      <button type="button" className="ml-link-button ml-edit-remove" onClick={() => {
        api.add([makeEdit({ kind: "remove-edge", id: edge.id, label }, api.editor, note)]); onDone();
      }}>Remove link</button>
    </div>
  </form>;
}

/** Add a record by hand. */
export function RecordCreator({ api, onAdded }: { api: EditingApi; onAdded: (id: string) => void }) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<NodeType>("organisation");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [postcode, setPostcode] = useState("");
  const [note, setNote] = useState("");
  const clash = api.graph.nodes.find(n => n.label.toLocaleLowerCase("en-GB") === label.trim().toLocaleLowerCase("en-GB"));
  function save(event: FormEvent) {
    event.preventDefault();
    if (!label.trim()) return;
    const id = newRecordId();
    api.add([makeEdit({ kind: "add-node", node: { id, label: label.trim(), type, tags: splitTags(tags),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(postcode.trim() ? { properties: { Postcode: postcode.trim().toUpperCase() } } : {}) } }, api.editor, note)]);
    setLabel(""); setDescription(""); setTags(""); setPostcode(""); setNote("");
    onAdded(id);
  }
  return <form className="ml-edit-form" onSubmit={save} aria-label="Add a record">
    <label className="ml-edit-field"><span>Name</span><input required value={label} maxLength={200} onChange={e => setLabel(e.target.value)}/></label>
    {clash && <p className="ml-add-warn">A record called {clash.label} is already in this map. Add a link to it instead, or give this one a distinct name.</p>}
    <label className="ml-edit-field"><span>Type</span><select value={type} onChange={e => setType(e.target.value as NodeType)}>
      {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></label>
    <label className="ml-edit-field"><span>Description <small>optional</small></span><textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}/></label>
    <div className="ml-edit-row">
      <label className="ml-edit-field"><span>Tags <small>commas</small></span><input value={tags} onChange={e => setTags(e.target.value)}/></label>
      <label className="ml-edit-field"><span>Postcode <small>optional</small></span><input value={postcode} maxLength={10} onChange={e => setPostcode(e.target.value)}/></label>
    </div>
    <Note value={note} onChange={setNote}/>
    <button type="submit" className="ml-primary">Add record</button>
  </form>;
}

/** Type links, one per line: records are matched by name or created. */
export function QuickEntry({ api }: { api: EditingApi }) {
  const [text, setText] = useState("");
  const [type, setType] = useState<NodeType>("outcome");
  const [note, setNote] = useState("");
  const { plans, notLinks } = useMemo(() => planQuickLinks(text.split("\n"), api.graph), [text, api.graph]);
  const created = [...new Set(plans.flatMap(p => p.newRecords.map(n => n.trim())))];
  return <form className="ml-edit-form" aria-label="Quick entry" onSubmit={e => {
    e.preventDefault();
    if (!plans.length) return;
    api.add(quickLinkEdits(plans, api.editor, type, note)); setText(""); setNote("");
  }}>
    <label className="ml-edit-field"><span>One link per line</span>
      <textarea rows={5} value={text} onChange={e => setText(e.target.value)} spellCheck={false}
        placeholder={"Volunteers + Meals served\nBurnout - Volunteers\nTrust -> funds -> Youth Project\nYouth Project <-> partners with <-> School"}/></label>
    <p className="ml-small"><code>+</code> more leads to more · <code>-</code> more leads to less · <code>-&gt; kind -&gt;</code> one way ·
      {" "}<code>&lt;-&gt;</code> both ways · <code>--</code> no direction</p>
    {plans.length > 0 && <div className="ml-edit-preview" aria-live="polite">
      <p><strong>{plans.length} {plans.length === 1 ? "link" : "links"}</strong>{created.length > 0 && <>, {created.length} new {created.length === 1 ? "record" : "records"}: {created.join(", ")}</>}</p>
      {created.length > 0 && <label className="ml-edit-field"><span>New records are</span><select value={type} onChange={e => setType(e.target.value as NodeType)}>
        {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></label>}
    </div>}
    {notLinks.length > 0 && <p className="ml-add-warn">Not read as a link: {notLinks.slice(0, 3).join("; ")}{notLinks.length > 3 ? "…" : ""}</p>}
    <Note value={note} onChange={setNote}/>
    <button type="submit" className="ml-primary" disabled={!plans.length}>Add {plans.length || ""} {plans.length === 1 ? "link" : "links"}</button>
  </form>;
}

/** Every change made here, newest first, each undoable, with exports. */
export function ChangeList({ layer, stale, label, onUndo, onExport }: {
  layer: EditLayer; stale: Edit[]; label: (id: string) => string; onUndo: (id: string, undone: boolean) => void;
  onExport: (kind: "map" | "kumu" | "changes") => void;
}) {
  const staleIds = new Set(stale.map(s => s.id));
  const entries = [...layer.entries].reverse();
  return <div className="ml-edit-changes">
    {entries.length === 0 ? <p className="ml-small">No changes yet. Records and links you add or change appear here, each with a way to undo it.</p>
      : <ol>{entries.slice(0, 200).map(e => <li key={e.id} className={(e.undone ? "is-undone" : "") + (staleIds.has(e.id) ? " is-stale" : "")}>
        <div><strong>{describeEdit(e, label)}</strong>
          <small>{e.by} · {new Date(e.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            {e.note ? " · " + e.note : ""}{staleIds.has(e.id) ? " · waiting: its record is not in this map" : ""}{e.undone ? " · undone" : ""}</small></div>
        <button type="button" className="ml-quiet" onClick={() => onUndo(e.id, !e.undone)}>{e.undone ? "Redo" : "Undo"}</button>
      </li>)}</ol>}
    {entries.length > 200 && <p className="ml-small">{entries.length - 200} earlier changes are kept but not listed.</p>}
    <div className="ml-edit-exports">
      <p className="ml-small">Changes are saved in this browser with the map. Keep a copy:</p>
      <button type="button" className="ml-quiet" onClick={() => onExport("map")}>Map with changes (Mossline)</button>
      <button type="button" className="ml-quiet" onClick={() => onExport("kumu")}>Elements and connections (Kumu, Excel)</button>
      <button type="button" className="ml-quiet" onClick={() => onExport("changes")} disabled={!entries.length}>Changes only (backup)</button>
    </div>
  </div>;
}

/** A link line in the record panel's edit mode: its sign, if any, shown plainly. */
export const signOf = (e: GraphEdge) => edgePolarity(e);
