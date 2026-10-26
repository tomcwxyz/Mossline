import { strToU8, zipSync } from "fflate";
import { z } from "zod";
import { edgePolarity, readPolarity, type Polarity } from "./systems";
import {
  graphEdgeSchema, graphNodeSchema, nodeTypeSchema, parseGraphDocument,
  type GraphDocument, type GraphEdge, type GraphNode, type NodeType, type SourceOrigin
} from "./schema";

/**
 * Changes a person makes inside Mossline. They are kept as a list beside the
 * imported records, never written into them: imported data can be refreshed
 * without losing the work, every change has a receipt (who, when, why), an
 * overridden value keeps what the file said, and any change can be undone.
 */
const nodeFields = z.object({
  label: z.string().min(1).max(200), type: nodeTypeSchema, description: z.string().max(4000),
  region: z.string().max(200), tags: z.array(z.string().max(80)).max(40), postcode: z.string().max(12)
}).partial();
const edgeFields = z.object({
  type: z.string().min(1).max(120), direction: z.enum(["directed", "undirected", "mutual"]),
  polarity: z.enum(["+", "-", "none"]), description: z.string().max(2000)
}).partial();
const opSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("add-node"), node: graphNodeSchema }),
  z.object({ kind: z.literal("update-node"), id: z.string(), set: nodeFields, was: nodeFields }),
  z.object({ kind: z.literal("remove-node"), id: z.string(), label: z.string() }),
  z.object({ kind: z.literal("add-edge"), edge: graphEdgeSchema }),
  z.object({ kind: z.literal("update-edge"), id: z.string(), set: edgeFields, was: edgeFields }),
  z.object({ kind: z.literal("remove-edge"), id: z.string(), label: z.string() })
]);
export const editSchema = z.object({
  id: z.string().min(1), at: z.string(), by: z.string().max(80), note: z.string().max(1000).optional(),
  undone: z.boolean().optional(), op: opSchema
});
export const editLayerSchema = z.object({
  kind: z.literal("mossline-edits"), version: z.literal(1), entries: z.array(editSchema).max(20000)
});
export type Edit = z.infer<typeof editSchema>;
export type EditOp = z.infer<typeof opSchema>;
export type EditLayer = z.infer<typeof editLayerSchema>;
export type NodeFields = z.infer<typeof nodeFields>;
export type EdgeFields = z.infer<typeof edgeFields>;

export const emptyEdits = (): EditLayer => ({ kind: "mossline-edits", version: 1, entries: [] });
export function parseEdits(raw: unknown): EditLayer {
  const parsed = editLayerSchema.safeParse(raw);
  return parsed.success ? parsed.data : emptyEdits();
}

let counter = 0;
const newId = (prefix: string) => prefix + Date.now().toString(36) + (counter++).toString(36) + Math.random().toString(36).slice(2, 6);
/** A record or link someone enters here gets a stable ID of its own. */
export const newRecordId = () => newId("you:");
export function makeEdit(op: EditOp, by: string, note?: string, at = new Date().toISOString()): Edit {
  return { id: newId("edit:"), at, by: by.trim() || "you", ...(note?.trim() ? { note: note.trim() } : {}), op };
}
/** Add a change to the end of the list. */
export function recordEdit(layer: EditLayer, edit: Edit): EditLayer {
  return { ...layer, entries: [...layer.entries, edit] };
}
export function setUndone(layer: EditLayer, id: string, undone: boolean): EditLayer {
  return { ...layer, entries: layer.entries.map(e => e.id === id ? { ...e, undone } : e) };
}

/** The receipt a change leaves on the record or link it touches. */
export function editReceipt(edit: Edit): SourceOrigin {
  return { system: "edit", recordId: edit.id,
    fields: { by: edit.by, at: edit.at, ...(edit.note ? { note: edit.note } : {}),
      change: edit.op.kind === "update-node" || edit.op.kind === "update-edge"
        ? Object.keys(edit.op.set).join(", ") : edit.op.kind.replace("-", " ") } };
}
export const isEdited = (o: SourceOrigin | undefined) => o?.system === "edit";

function nodeWith(node: GraphNode, set: NodeFields): GraphNode {
  const next: GraphNode = { ...node, tags: set.tags ?? node.tags, properties: { ...(node.properties ?? {}) } };
  if (set.label !== undefined) next.label = set.label;
  if (set.type !== undefined) next.type = set.type;
  if (set.description !== undefined) { if (set.description) next.description = set.description; else delete next.description; }
  if (set.region !== undefined) { if (set.region) next.region = set.region; else delete next.region; }
  if (set.postcode !== undefined) {
    if (set.postcode) next.properties!.Postcode = set.postcode; else delete next.properties!.Postcode;
    // A new postcode needs a fresh approximate place; the old one no longer applies.
    delete next.properties!["Approximate location"];
  }
  return next;
}
function edgeWith(edge: GraphEdge, set: EdgeFields): GraphEdge {
  const next: GraphEdge = { ...edge, properties: { ...(edge.properties ?? {}) } };
  if (set.type !== undefined) next.type = set.type;
  if (set.direction !== undefined) next.direction = set.direction;
  if (set.description !== undefined) { if (set.description) next.description = set.description; else delete next.description; }
  if (set.polarity !== undefined) {
    for (const k of ["polarity", "Polarity", "effect", "Effect", "sign", "Sign"]) delete next.properties![k];
    if (set.polarity !== "none") next.properties!.Polarity = set.polarity;
  }
  return next;
}
/** The current value of each field a change would set, so it can be shown and restored. */
export function nodeValues(node: GraphNode, keys: (keyof NodeFields)[]): NodeFields {
  const out: NodeFields = {};
  for (const k of keys) {
    if (k === "postcode") out.postcode = typeof node.properties?.Postcode === "string" ? node.properties.Postcode as string : "";
    else if (k === "tags") out.tags = [...node.tags];
    else if (k === "label") out.label = node.label;
    else if (k === "type") out.type = node.type;
    else if (k === "description") out.description = node.description ?? "";
    else if (k === "region") out.region = node.region ?? "";
  }
  return out;
}
export function edgeValues(edge: GraphEdge, keys: (keyof EdgeFields)[]): EdgeFields {
  const out: EdgeFields = {};
  for (const k of keys) {
    if (k === "type") out.type = edge.type;
    else if (k === "direction") out.direction = edge.direction ?? "directed";
    else if (k === "polarity") out.polarity = edgePolarity(edge) ?? "none";
    else if (k === "description") out.description = edge.description ?? "";
  }
  return out;
}

export interface EditedMap {
  graph: GraphDocument;
  /** Changes that could not apply (their record is no longer in the map), kept, not dropped. */
  stale: Edit[];
  /** Records and links someone removed here, with the change that removed them. */
  removed: Map<string, Edit>;
}

/** The map as imported, with every live change applied in order. */
export function applyEdits(base: GraphDocument, layer: EditLayer): EditedMap {
  const nodes = new Map(base.nodes.map(n => [n.id, n]));
  const edges = new Map(base.edges.map(e => [e.id, e]));
  const stale: Edit[] = [], removed = new Map<string, Edit>();
  const receipt = <T extends { receipts?: SourceOrigin[]; origin?: SourceOrigin }>(item: T, edit: Edit): T =>
    ({ ...item, receipts: [...(item.receipts ?? (item.origin ? [item.origin] : [])), editReceipt(edit)] });
  for (const edit of layer.entries) {
    if (edit.undone) continue;
    const op = edit.op;
    if (op.kind === "add-node") {
      if (nodes.has(op.node.id)) { stale.push(edit); continue; }
      nodes.set(op.node.id, { ...op.node, origin: editReceipt(edit) });
    } else if (op.kind === "update-node") {
      const n = nodes.get(op.id);
      if (!n) { stale.push(edit); continue; }
      nodes.set(op.id, receipt(nodeWith(n, op.set), edit));
    } else if (op.kind === "remove-node") {
      if (!nodes.delete(op.id)) { stale.push(edit); continue; }
      removed.set(op.id, edit);
    } else if (op.kind === "add-edge") {
      if (edges.has(op.edge.id)) { stale.push(edit); continue; }
      edges.set(op.edge.id, { ...op.edge, origin: editReceipt(edit) });
    } else if (op.kind === "update-edge") {
      const e = edges.get(op.id);
      if (!e) { stale.push(edit); continue; }
      edges.set(op.id, { ...edgeWith(e, op.set), origin: e.origin, properties: { ...edgeWith(e, op.set).properties,
        "Changed here": [e.properties?.["Changed here"], edit.by + " · " + edit.at.slice(0, 10) + " · " + Object.keys(op.set).join(", ")].filter(Boolean).join("; ") } });
    } else {
      if (!edges.delete(op.id)) { stale.push(edit); continue; }
      removed.set(op.id, edit);
    }
  }
  // A link whose record was removed goes with it; a link added to a missing record waits, unapplied.
  const list = [...edges.values()].filter(e => {
    if (nodes.has(e.source) && nodes.has(e.target)) return true;
    const added = layer.entries.find(x => !x.undone && x.op.kind === "add-edge" && x.op.edge.id === e.id);
    if (added && !stale.includes(added)) stale.push(added);
    return false;
  });
  return { graph: parseGraphDocument({ ...base, nodes: [...nodes.values()], edges: list }), stale, removed };
}

/** What a change says, in a line, for the history list. */
export function describeEdit(edit: Edit, label: (id: string) => string): string {
  const op = edit.op;
  switch (op.kind) {
    case "add-node": return "Added " + op.node.label;
    case "remove-node": return "Removed " + op.label;
    case "update-node": return "Changed " + Object.keys(op.set).join(", ") + " of " + label(op.id);
    case "add-edge": return "Linked " + label(op.edge.source) + " " + arrow(op.edge.direction) + " " + label(op.edge.target) + " (" + op.edge.type +
      (edgePolarity(op.edge) ? " " + (edgePolarity(op.edge) === "+" ? "+" : "−") : "") + ")";
    case "update-edge": return "Changed " + Object.keys(op.set).join(", ") + " of a link";
    case "remove-edge": return "Removed the link " + op.label;
  }
}
const arrow = (d: GraphEdge["direction"]) => d === "undirected" ? "—" : d === "mutual" ? "↔" : "→";

/* ---- Quick entry: type a link, get records and a link ---------------------- */
export interface QuickLink {
  from: string; to: string; type: string; direction: NonNullable<GraphEdge["direction"]>; polarity: Polarity | null;
}
/**
 * "Trust -> funds -> Youth Project", "Volunteers + Meals served",
 * "Rain - Crop yield", "A <-> partners <-> B", "A -- related -- B".
 * Returns null when a line is not a link.
 */
export function parseQuickLink(line: string): QuickLink | null {
  const text = line.trim().replace(/\s+/g, " ");
  if (!text) return null;
  const named = text.match(/^(.+?) ?(<->|↔|->|→|--|—) ?(.+?) ?(<->|↔|->|→|--|—) ?(.+)$/);
  if (named) {
    const dir = (s: string) => s === "<->" || s === "↔" ? "mutual" : s === "--" || s === "—" ? "undirected" : "directed";
    const sign = readPolarity(named[3]);
    return { from: named[1].trim(), to: named[5].trim(), type: named[3].trim(), direction: dir(named[2]), polarity: sign };
  }
  const plain = text.match(/^(.+?) ?(<->|↔|->|→|--|—) ?(.+)$/);
  if (plain) {
    const d = plain[2] === "<->" || plain[2] === "↔" ? "mutual" : plain[2] === "--" || plain[2] === "—" ? "undirected" : "directed";
    return { from: plain[1].trim(), to: plain[3].trim(), type: d === "undirected" ? "related to" : "linked to", direction: d, polarity: null };
  }
  const signed = text.match(/^(.+?) ([+−-]) (.+)$/);
  if (signed) {
    const p = signed[2] === "+" ? "+" : "-";
    return { from: signed[1].trim(), to: signed[3].trim(), type: p === "+" ? "increases" : "decreases", direction: "directed", polarity: p };
  }
  return null;
}
export interface QuickPlan { link: QuickLink; fromId: string | null; toId: string | null; newRecords: string[] }
/** Match quick-entry names to records already in the map (by name, case aside); the rest will be new records. */
export function planQuickLinks(lines: string[], graph: GraphDocument): { plans: QuickPlan[]; notLinks: string[] } {
  const byName = new Map<string, string[]>();
  for (const n of graph.nodes) { const k = n.label.toLocaleLowerCase("en-GB"); byName.set(k, [...(byName.get(k) ?? []), n.id]); }
  const plans: QuickPlan[] = [], notLinks: string[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const link = parseQuickLink(line);
    if (!link) { notLinks.push(line.trim()); continue; }
    const find = (name: string) => { const ids = byName.get(name.toLocaleLowerCase("en-GB")) ?? []; return ids.length === 1 ? ids[0] : null; };
    const fromId = find(link.from), toId = find(link.to);
    plans.push({ link, fromId, toId, newRecords: [...(fromId ? [] : [link.from]), ...(toId ? [] : [link.to])] });
  }
  return { plans, notLinks };
}
/** The changes a set of quick-entry lines makes: new records once each, then the links. */
export function quickLinkEdits(plans: QuickPlan[], by: string, newType: NodeType, note?: string): Edit[] {
  const created = new Map<string, string>();
  const edits: Edit[] = [];
  const idFor = (name: string, known: string | null) => {
    if (known) return known;
    const k = name.toLocaleLowerCase("en-GB");
    if (!created.has(k)) {
      const id = newRecordId();
      created.set(k, id);
      edits.push(makeEdit({ kind: "add-node", node: { id, label: name, type: newType, tags: [] } }, by, note));
    }
    return created.get(k)!;
  };
  for (const p of plans) {
    const source = idFor(p.link.from, p.fromId), target = idFor(p.link.to, p.toId);
    edits.push(makeEdit({ kind: "add-edge", edge: { id: newRecordId(), source, target, type: p.link.type, direction: p.link.direction,
      ...(p.link.polarity ? { properties: { Polarity: p.link.polarity } } : {}) } }, by, note));
  }
  return edits;
}

/* ---- Export: a workbook Kumu (or any spreadsheet) can open ------------------ */
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const col = (i: number) => { let s = ""; i++; while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
function sheet(rows: string[][]): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
    rows.map((r, ri) => `<row r="${ri + 1}">` + r.map((v, ci) => v === "" ? "" :
      `<c r="${col(ci)}${ri + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join("") + "</row>").join("") +
    "</sheetData></worksheet>";
}
const KUMU_TYPE: Record<NodeType, string> = { organisation: "Organization", project: "Project", funder: "Funder", person: "Person",
  place: "Place", topic: "Topic", methodology: "Method", outcome: "Factor", other: "Other" };
/** Elements and Connections sheets, as Kumu imports them, with each item's source noted. */
export function toKumuWorkbook(graph: GraphDocument): Uint8Array {
  const label = new Map(graph.nodes.map(n => [n.id, n.label]));
  const src = (o?: SourceOrigin) => !o ? "" : o.system === "edit" ? "Entered in Mossline by " + (o.fields?.by ?? "you") + " " + (o.fields?.at ?? "").slice(0, 10)
    : [o.fileName ?? o.system, o.recordNumber ? "#" + o.recordNumber : ""].filter(Boolean).join(" ");
  const elements = [["ID", "Label", "Type", "Description", "Tags", "Region", "Postcode", "Source"],
    ...graph.nodes.map(n => [n.id, n.label, KUMU_TYPE[n.type], n.description ?? "", n.tags.join(" | "), n.region ?? "",
      typeof n.properties?.Postcode === "string" ? n.properties.Postcode as string : "", src(n.origin)])];
  const connections = [["From", "To", "Type", "Direction", "Polarity", "Description", "Source"],
    ...graph.edges.filter(e => !e.inferred).map(e => [label.get(e.source) ?? e.source, label.get(e.target) ?? e.target, e.type,
      e.direction ?? "directed", edgePolarity(e) ?? "", e.description ?? "", src(e.origin)])];
  const files: Record<string, string> = {
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Elements" sheetId="1" r:id="rId1"/><sheet name="Connections" sheetId="2" r:id="rId2"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": sheet(elements),
    "xl/worksheets/sheet2.xml": sheet(connections)
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
}
