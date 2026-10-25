import { parseGraphDocument, type GraphDocument, type GraphEdge, type GraphNode, type NodeType, type SourceOrigin } from "../schema";
import { normaliseIdentifier, type IdScheme } from "./identifiers";
import { headingIndex, render, titleCaseName, type LinkTemplate, type RecordTemplate, type Shape } from "./shape";
import type { SourceTable } from "./tables";

/**
 * The one engine: tables + shapes → records and links, joined on identifiers
 * across files and with the map they are added to. It never joins on names;
 * matching names are returned for a person to decide.
 */

export type UseMode = "records" | "fill";
export interface PlannedTable { table: SourceTable; shape: Shape; use: UseMode }

const TYPE_WORDS: Record<string, NodeType> = {
  organisation: "organisation", organization: "organisation", org: "organisation", company: "organisation", charity: "organisation",
  group: "organisation", network: "organisation", project: "project", programme: "project", program: "project", initiative: "project",
  grant: "project", funder: "funder", foundation: "funder", donor: "funder", trust: "funder", person: "person", people: "person",
  individual: "person", contact: "person", place: "place", location: "place", region: "place", area: "place", geography: "place",
  topic: "topic", theme: "topic", issue: "topic", methodology: "methodology", outcome: "outcome"
};
export function typeFromWord(value: string, fallback: NodeType): NodeType {
  const w = value.toLowerCase().replace(/[^a-z ]/g, "").trim();
  return TYPE_WORDS[w] ?? TYPE_WORDS[w.replace(/s$/, "")] ?? TYPE_WORDS[w.split(" ").pop() ?? ""] ?? fallback;
}
const HIDDEN = new Set(["false", "no", "0", "private", "internal"]);
const labelKey = (shapeId: string, type: NodeType, label: string) =>
  "label:" + shapeId + ":" + type + ":" + label.toLocaleLowerCase("en-GB").replace(/\s+/g, " ").trim();
const nameKey = (label: string) => label.toLocaleLowerCase("en-GB")
  .replace(/\b(the|ltd|limited|cic|cio|plc|llp|charitable incorporated organisation|community interest company)\b/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim();

export function extractPostcode(text: string): string {
  const m = text.toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/);
  return m ? m[1] + " " + m[2] : "";
}
const coordinate = (v: string, lo: number, hi: number) => {
  if (!/^[+-]?\d+(\.\d+)?$/.test(v.trim())) return null;
  const n = Number(v); return n >= lo && n <= hi ? n : null;
};

interface Draft {
  n: number; row: string; table: string; file: string; shape: Shape; template: RecordTemplate;
  label: string; type: NodeType; ids: string[]; local: string[]; key: string;
  description: string; region: string; tags: string[]; properties: Record<string, string>; fields?: Record<string, string>;
  latitude: number | null; longitude: number | null; postcode: string;
  receipt: SourceOrigin; primary: boolean; existingOnly: boolean;
  grant?: { from: number; to: number; amount: string; currency: string; date: string; programme: string };
}
type Ref = { draft: number } | { ref: string; scheme?: IdScheme };
interface DraftLink { row: string; table: string; file: string; template: LinkTemplate; from: Ref; to: Ref; type: string;
  direction?: GraphEdge["direction"]; description: string; fields?: Record<string, string>; receipt: SourceOrigin; id: string }

export interface TableReport {
  table: string; shape: string; use: UseMode; rows: number; used: number;
  skipped: { reason: string; count: number }[];
  added: Partial<Record<NodeType, number>>; filledIn: number; links: number; unresolvedLinks: number;
}
export interface SameNameCandidate { a: string; b: string; label: string; aSource: string; bSource: string }
export interface SourceResult {
  graph: GraphDocument;
  tables: TableReport[];
  joins: { text: string; count: number }[];
  sameName: SameNameCandidate[];
  totals: { newRecords: number; filledIn: number; newLinks: number; alreadyPresent: number };
}

function fieldsFor(spec: RecordTemplate["fields"], headings: string[], row: string[]): Record<string, string> | undefined {
  if (!spec) return undefined;
  const out: Record<string, string> = {};
  const wanted = spec === "row" ? headings : spec;
  const index = headingIndex(headings);
  for (const h of wanted) {
    const i = spec === "row" ? headings.indexOf(h) : index.get(h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const v = i === undefined || i < 0 ? "" : (row[i] ?? "").trim();
    if (v) out[spec === "row" ? h : headings[i!]] = v;
  }
  return out;
}

/** Read every planned table and join the result into `base` (or a new map). */
export function applySources(plans: PlannedTable[], base: GraphDocument | null, title = "Imported data"): SourceResult {
  const drafts: Draft[] = [];
  const links: DraftLink[] = [];
  const reports: TableReport[] = [];
  const rowsOf = new Map<string, { drafts: number[]; links: number[]; use: UseMode; report: TableReport }>();

  for (const plan of plans) {
    const { table, shape } = plan;
    const index = headingIndex(table.headings);
    const report: TableReport = { table: table.name, shape: shape.name, use: plan.use, rows: table.rows.length, used: 0,
      skipped: [], added: {}, filledIn: 0, links: 0, unresolvedLinks: 0 };
    reports.push(report);
    const skip = (reason: string) => {
      const s = report.skipped.find(x => x.reason === reason);
      if (s) s.count++; else report.skipped.push({ reason, count: 1 });
    };
    const publicCol = index.get("public");
    const system: SourceOrigin["system"] = table.format;
    table.rows.forEach((row, r) => {
      const recordNumber = table.recordNumbers?.[r] ?? table.firstRecordNumber + r;
      const rowKey = table.name + "\u0000" + recordNumber;
      if (publicCol !== undefined && HIDDEN.has((row[publicCol] ?? "").trim().toLowerCase())) { skip("Marked not public"); return; }
      for (const rule of shape.skip ?? []) {
        const v = render(rule.when, row, index);
        const hit = rule.equals ? rule.equals.some(e => e.toLowerCase() === v.toLowerCase())
          : rule.notEquals ? !!v && !rule.notEquals.some(e => e.toLowerCase() === v.toLowerCase()) : !!v;
        if (hit) { skip(rule.reason); return; }
      }
      const receipt = (recordId: string): SourceOrigin => ({ system, recordId, fileName: table.file, recordNumber, shape: shape.name });
      const local = new Map<string, number>();
      const made: number[] = [];
      for (const t of shape.records) {
        if (t.when && !render(t.when, row, index)) continue;
        const rawLabel = render(t.label, row, index);
        if (!rawLabel) continue;
        const label = t.labelCase === "title" ? titleCaseName(rawLabel) : rawLabel;
        const fallback = t.typeFallback ?? "other";
        const typeText = render(t.type, row, index);
        const mapped = t.typeMap ? Object.entries(t.typeMap).find(([k]) => k.toLowerCase() === typeText.toLowerCase())?.[1] : undefined;
        const type: NodeType = (["organisation", "project", "funder", "person", "place", "topic", "methodology", "outcome", "other"] as string[]).includes(t.type)
          ? t.type as NodeType : mapped ?? typeFromWord(typeText, fallback);
        const ids: string[] = [], locals: string[] = [];
        for (const idRule of t.identifiers ?? []) {
          const raw = render(idRule.value, row, index);
          if (!raw) continue;
          if (idRule.scheme === "local") { locals.push(raw); continue; }
          const id = normaliseIdentifier(raw, idRule.scheme);
          if (id && !ids.includes(id)) ids.push(id);
        }
        const tags: string[] = [];
        for (const tagRule of t.tags ?? []) {
          const v = render(tagRule.value, row, index);
          if (!v) continue;
          for (let tag of tagRule.split ? v.split(tagRule.split) : [v]) {
            tag = tag.trim();
            if (tagRule.strip === "sic") tag = tag.replace(/^\d{4,5}\s*-\s*/, "");
            if (tag && !tags.includes(tag) && tag.length <= 80) tags.push(tag);
          }
        }
        const properties: Record<string, string> = {};
        for (const [name, tpl] of Object.entries(t.properties ?? {})) { const v = render(tpl, row, index); if (v) properties[name] = v; }
        const pc = extractPostcode(render(t.place?.postcode, row, index)) || extractPostcode(render(t.place?.address, row, index));
        const n = drafts.length;
        drafts.push({ n, row: rowKey, table: table.name, file: table.file, shape, template: t, label, type, ids, local: locals,
          key: labelKey(shape.id, type, label), description: render(t.description, row, index), region: render(t.region, row, index),
          tags, properties, fields: fieldsFor(t.fields, table.headings, row),
          latitude: coordinate(render(t.place?.latitude, row, index), -90, 90),
          longitude: coordinate(render(t.place?.longitude, row, index), -180, 180),
          postcode: pc, receipt: receipt(t.key + ":" + (ids[0] ?? locals[0] ?? label)),
          primary: t.fields !== undefined, existingOnly: !!t.existingOnly });
        local.set(t.key, n); made.push(n);
      }
      for (const n of made) {
        const g = drafts[n].template.grant;
        if (!g) continue;
        const from = local.get(g.from), to = local.get(g.to);
        if (from === undefined || to === undefined) continue;
        drafts[n].grant = { from, to, amount: render(g.amount, row, index), currency: render(g.currency, row, index),
          date: render(g.date, row, index), programme: render(g.programme, row, index) };
      }
      const madeLinks: number[] = [];
      shape.links.forEach((l, li) => {
        if (l.when && !render(l.when, row, index)) return;
        const end = (e: LinkTemplate["from"]): Ref | null => {
          if (typeof e === "string") { const d = local.get(e); return d === undefined ? null : { draft: d }; }
          const ref = render(e.ref, row, index);
          return ref ? { ref, scheme: e.scheme } : null;
        };
        const type = render(l.type, row, index) || (l.type.includes("{") ? "connected" : l.type);
        const from = end(l.from), toRaw = typeof l.to === "string" ? null : render(l.to.ref, row, index);
        // "To" may list several targets separated by "|", as Kumu allows.
        const tos: (Ref | null)[] = toRaw !== null && typeof l.to !== "string"
          ? toRaw.split("|").map(s => s.trim()).filter(Boolean).map(ref => ({ ref, scheme: (l.to as { scheme?: IdScheme }).scheme }))
          : [end(l.to)];
        if (!from || !type) return;
        const dir = l.direction ? render(l.direction, row, index).toLowerCase() || l.direction : "";
        tos.forEach((to, ti) => {
          if (!to) return;
          madeLinks.push(links.length);
          links.push({ row: rowKey, table: table.name, file: table.file, template: l, from, to, type,
            direction: (["directed", "undirected", "mutual"] as const).find(d => d === dir),
            description: render(l.description, row, index),
            fields: (() => {
              const f = { ...(fieldsFor(l.fields, table.headings, row) ?? {}) };
              for (const [k, tpl] of Object.entries(l.properties ?? {})) { const v = render(tpl, row, index); if (v) f[k] = v; }
              return Object.keys(f).length ? f : undefined;
            })(),
            receipt: receipt("link:" + (li + 1) + ":" + (ti + 1)),
            id: "src:" + shape.id + ":" + encodeURIComponent(table.file) + ":" + recordNumber + ":" + li + ":" + ti });
        });
      });
      if (made.length || madeLinks.length) rowsOf.set(rowKey, { drafts: made, links: madeLinks, use: plan.use, report });
    });
  }

  /* ---- Identity: union drafts that share an identifier, local ID or (within a shape) a label ---- */
  const parent = drafts.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb); };
  const byKey = new Map<string, number>();
  const join = (key: string, n: number) => { const seen = byKey.get(key); if (seen === undefined) byKey.set(key, n); else union(seen, n); };
  for (const d of drafts) {
    for (const id of d.ids) join("id:" + id, d.n);
    for (const l of d.local) join("local:" + l, d.n);
    if (!d.ids.length && !d.local.length) join(d.key, d.n);
  }
  // Existing records, found by identifier or (for re-imports of the same shape) by label key.
  const existing = base?.nodes ?? [];
  const existingById = new Map(existing.map(n => [n.id, n]));
  const existingKey = new Map<string, GraphNode>();
  for (const node of existing) {
    for (const id of node.identifiers ?? []) existingKey.set("id:" + id, node);
    if (node.id.startsWith("id:")) existingKey.set("id:" + node.id.slice(3), node);
    for (const r of [node.origin, ...(node.receipts ?? [])]) if (r?.shape) existingKey.set("label:" + r.shape + ":" + node.label.toLocaleLowerCase("en-GB"), node);
  }
  const groupExisting = new Map<number, GraphNode>();
  for (const d of drafts) {
    const root = find(d.n);
    if (groupExisting.has(root)) continue;
    for (const k of [...d.ids.map(i => "id:" + i), "label:" + d.shape.name + ":" + d.label.toLocaleLowerCase("en-GB")]) {
      const hit = existingKey.get(k);
      if (hit && (k.startsWith("id:") || !d.ids.length)) { groupExisting.set(root, hit); break; }
    }
  }
  const members = new Map<number, Draft[]>();
  for (const d of drafts) { const r = find(d.n); members.set(r, [...(members.get(r) ?? []), d]); }

  /* ---- Resolve link endpoints ---- */
  const batchLabel = new Map<string, number[]>();
  const fileLabel = new Map<string, number[]>();
  for (const [root, ds] of members) {
    for (const lab of new Set(ds.map(d => d.label.toLocaleLowerCase("en-GB")))) batchLabel.set(lab, [...(batchLabel.get(lab) ?? []), root]);
    for (const k of new Set(ds.map(d => d.file + "\u0000" + d.label.toLocaleLowerCase("en-GB")))) fileLabel.set(k, [...(fileLabel.get(k) ?? []), root]);
  }
  const existingLabel = new Map<string, GraphNode[]>();
  for (const node of existing) { const k = node.label.toLocaleLowerCase("en-GB"); existingLabel.set(k, [...(existingLabel.get(k) ?? []), node]); }
  type End = { root: number } | { node: GraphNode } | null;
  const resolve = (ref: Ref, file?: string): End => {
    if ("draft" in ref) return { root: find(ref.draft) };
    if (ref.scheme && ref.scheme !== "local") {
      const id = normaliseIdentifier(ref.ref, ref.scheme);
      if (!id) return null;
      const d = byKey.get("id:" + id);
      if (d !== undefined) return { root: find(d) };
      const e = existingKey.get("id:" + id);
      return e ? { node: e } : null;
    }
    const d = byKey.get("local:" + ref.ref);
    if (d !== undefined) return { root: find(d) };
    const lab = ref.ref.toLocaleLowerCase("en-GB");
    // A name in a links table means a record from the same file first (Kumu's
    // Connections sheet names its own Elements), then anywhere in this batch.
    const same = file ? fileLabel.get(file + "\u0000" + lab) ?? [] : [];
    if (same.length === 1) return { root: same[0] };
    const roots = batchLabel.get(lab) ?? [];
    if (roots.length === 1) return { root: roots[0] };
    if (roots.length > 1) return null;
    const nodes = existingLabel.get(lab) ?? [];
    return nodes.length === 1 ? { node: nodes[0] } : null;
  };

  /* ---- Fill-in: keep rows that touch a record already in the map ---- */
  const keepRow = new Map<string, boolean>();
  for (const [rowKey, info] of rowsOf) {
    if (info.use === "records") { keepRow.set(rowKey, true); continue; }
    const touches = info.drafts.some(n => groupExisting.has(find(n))) ||
      info.links.some(li => [links[li].from, links[li].to].some(ref => {
        const e = resolve(ref, links[li].file);
        return !!e && ("node" in e || groupExisting.has(e.root));
      }));
    keepRow.set(rowKey, touches);
    if (!touches) {
      const s = info.report.skipped.find(x => x.reason === "Not about a record in this map");
      if (s) s.count++; else info.report.skipped.push({ reason: "Not about a record in this map", count: 1 });
    }
  }
  const liveGroup = new Map<number, boolean>();
  for (const [root, ds] of members) {
    const kept = ds.filter(d => keepRow.get(d.row));
    // A record only some rows "fill in" must already exist, here or in another table of this batch.
    const alive = kept.length > 0 && (groupExisting.has(root) || kept.some(d => !d.existingOnly));
    liveGroup.set(root, alive);
  }

  /* ---- Build nodes ---- */
  const nodes = new Map<string, GraphNode>(existing.map(n => [n.id, { ...n, tags: [...n.tags],
    properties: n.properties ? { ...n.properties } : undefined, receipts: n.receipts ? [...n.receipts] : undefined,
    identifiers: n.identifiers ? [...n.identifiers] : undefined }]));
  const nodeOf = new Map<number, string>();
  const usedIds = new Set(nodes.keys());
  let newRecords = 0, filledIn = 0;
  const filledNodes = new Set<string>();
  for (const [root, ds] of members) {
    if (!liveGroup.get(root)) continue;
    const kept = ds.filter(d => keepRow.get(d.row));
    const hit = groupExisting.get(root);
    let node: GraphNode;
    if (hit) node = nodes.get(hit.id)!;
    else {
      const first = kept.find(d => !d.existingOnly) ?? kept[0];
      const ids = [...new Set(kept.flatMap(d => d.ids))];
      let id = ids.length ? "id:" + ids[0] : first.local.length ? "src:" + first.shape.id + ":" + first.local[0] : first.key.replace(/^label:/, "src:");
      while (usedIds.has(id)) id += "'";
      usedIds.add(id);
      node = { id, label: first.label, type: first.type, tags: [] };
      nodes.set(id, node);
      newRecords++;
      const report = rowsOf.get(first.row)?.report;
      if (report) report.added[first.type] = (report.added[first.type] ?? 0) + 1;
    }
    nodeOf.set(root, node.id);
    const sawReceipt = new Set<string>();
    for (const d of kept) {
      // Type: a funder or project reading is more specific than a generic organisation.
      if (node.type === "organisation" && d.type === "funder") node.type = "funder";
      // A name written in capitals gives way to the same name written normally.
      if (!/[a-z]/.test(node.label) && /[a-z]/.test(d.label) && node.label.toLowerCase() === d.label.toLowerCase()) node.label = d.label;
      if (!node.description && d.description) node.description = d.description;
      if (!node.region && d.region) node.region = d.region;
      for (const t of d.tags) if (!node.tags.includes(t)) node.tags.push(t);
      const ids = new Set(node.identifiers ?? []);
      for (const i of d.ids) ids.add(i);
      if (ids.size) node.identifiers = [...ids];
      const props = { ...(node.properties ?? {}) };
      const isNewNode = !hit && !node.origin;
      if (d.fields && (isNewNode || !node.properties)) Object.assign(props, d.fields);
      for (const [k, v] of Object.entries(d.properties)) {
        const prev = props[k];
        if (prev === undefined || prev === "") props[k] = v;
        else if (typeof prev === "string" && !prev.split("; ").includes(v)) props[k] = prev + "; " + v;
      }
      if (d.latitude !== null && d.longitude !== null && props.Latitude === undefined && props["Atlas location"] === undefined) {
        props.Latitude = String(d.latitude); props.Longitude = String(d.longitude);
      }
      if (d.postcode && !props.Postcode) props.Postcode = d.postcode;
      node.properties = props;
      // One receipt per row the record is about; one per shape for rows that only name it.
      const key = d.primary ? d.row : d.shape.id + ":" + d.table;
      if (!sawReceipt.has(key)) {
        sawReceipt.add(key);
        const r: SourceOrigin = { ...d.receipt, ...(d.fields && !(isNewNode && !node.origin) ? { fields: d.fields } : {}) };
        if (!node.origin) node.origin = { ...d.receipt };
        const receipts = node.receipts ?? [];
        if (!receipts.some(x => x.fileName === r.fileName && x.recordNumber === r.recordNumber && x.recordId === r.recordId)) receipts.push(r);
        node.receipts = receipts;
      }
      if (hit && !filledNodes.has(node.id)) {
        filledNodes.add(node.id); filledIn++;
        const report = rowsOf.get(d.row)?.report;
        if (report) report.filledIn++;
      }
    }
  }

  /* ---- Grants: funder → grant → recipient, in the form the Funding lens reads ---- */
  const edges = new Map<string, GraphEdge>((base?.edges ?? []).map(e => [e.id, e]));
  let newLinks = 0, alreadyPresent = 0;
  const addEdge = (e: GraphEdge, report?: TableReport) => {
    if (edges.has(e.id)) { alreadyPresent++; return; }
    edges.set(e.id, e); newLinks++;
    if (report) report.links++;
  };
  for (const d of drafts) {
    if (!d.grant || !keepRow.get(d.row) || !liveGroup.get(find(d.n))) continue;
    const grantId = nodeOf.get(find(d.n)), funderId = nodeOf.get(find(d.grant.from)), recipientId = nodeOf.get(find(d.grant.to));
    if (!grantId || !funderId || !recipientId) continue;
    const grant = nodes.get(grantId)!;
    const amount = Number(d.grant.amount.replace(/[£$€,\s]/g, ""));
    grant.properties = { ...(grant.properties ?? {}), mosslineFundingGrant: true, funderId, recipientId,
      ...(d.grant.amount && Number.isFinite(amount) ? { amountAwarded: amount } : {}),
      ...(d.grant.currency ? { currency: d.grant.currency } : {}), ...(d.grant.date ? { awardDate: d.grant.date } : {}),
      ...(d.grant.programme ? { programme: d.grant.programme } : {}) };
    const dated = { ...(d.grant.date ? { "Award Date": d.grant.date } : {}), ...(d.grant.amount ? { "Amount Awarded": d.grant.amount } : {}),
      ...(d.grant.currency ? { Currency: d.grant.currency } : {}) };
    const report = rowsOf.get(d.row)?.report;
    addEdge({ id: "grant:" + grantId + ":awarded", source: funderId, target: grantId, type: "awarded", direction: "directed",
      origin: { ...d.receipt, recordId: "grant:" + d.receipt.recordId }, properties: dated }, report);
    addEdge({ id: "grant:" + grantId + ":awarded-to", source: grantId, target: recipientId, type: "awarded to", direction: "directed",
      origin: { ...d.receipt, recordId: "grant:" + d.receipt.recordId }, properties: d.grant.date ? { "Award Date": d.grant.date } : {} }, report);
  }

  /* ---- Links ---- */
  for (const l of links) {
    if (!keepRow.get(l.row)) continue;
    const report = rowsOf.get(l.row)?.report;
    const end = (ref: Ref) => {
      const e = resolve(ref, l.file);
      if (!e) return null;
      if ("node" in e) return e.node.id;
      return liveGroup.get(e.root) ? nodeOf.get(e.root) ?? null : null;
    };
    const source = end(l.from), target = end(l.to);
    if (!source || !target) { if (report) report.unresolvedLinks++; continue; }
    addEdge({ id: l.id, source, target, type: l.type, ...(l.direction ? { direction: l.direction } : {}),
      ...(l.description ? { description: l.description } : {}), origin: l.receipt, ...(l.fields ? { properties: l.fields } : {}) }, report);
  }
  for (const r of reports) r.used = [...rowsOf.entries()].filter(([k, v]) => v.report === r && keepRow.get(k)).length;

  /* ---- Joins across files, and with the map ---- */
  const joinCounts = new Map<string, number>();
  for (const [root, ds] of members) {
    if (!liveGroup.get(root)) continue;
    const tables = [...new Set(ds.filter(d => keepRow.get(d.row)).map(d => d.table))];
    if (groupExisting.has(root)) for (const t of tables) joinCounts.set(t + "\u0000map", (joinCounts.get(t + "\u0000map") ?? 0) + 1);
    for (let i = 0; i < tables.length; i++) for (let j = i + 1; j < tables.length; j++) {
      const k = tables[i] + "\u0000" + tables[j];
      joinCounts.set(k, (joinCounts.get(k) ?? 0) + 1);
    }
  }
  const joins = [...joinCounts].map(([k, count]) => {
    const [a, b] = k.split("\u0000");
    return { text: b === "map" ? a + " ↔ records already in this map" : a + " ↔ " + b, count };
  }).sort((x, y) => y.count - x.count);

  /* ---- Same name, no shared identifier: listed, never merged ---- */
  const sameName: SameNameCandidate[] = [];
  const created = [...nodeOf.values()].filter(id => !existingById.has(id));
  const named = new Map<string, GraphNode[]>();
  for (const node of nodes.values()) {
    // People are left out: two people sharing a name is common and not a lead.
    if (node.type === "person") continue;
    const k = nameKey(node.label);
    if (k.length < 4) continue;
    named.set(k, [...(named.get(k) ?? []), node]);
  }
  const createdSet = new Set(created);
  for (const group of named.values()) {
    if (group.length < 2 || !group.some(n => createdSet.has(n.id))) continue;
    for (let i = 0; i < group.length && sameName.length < 200; i++) for (let j = i + 1; j < group.length; j++) {
      const a = group[i], b = group[j];
      if (!createdSet.has(a.id) && !createdSet.has(b.id)) continue;
      const share = (a.identifiers ?? []).some(x => (b.identifiers ?? []).includes(x));
      const conflict = (a.identifiers ?? []).some(x => x.startsWith("GB-")) && (b.identifiers ?? []).some(x => x.startsWith("GB-"));
      if (share || conflict) continue;
      sameName.push({ a: a.id, b: b.id, label: b.label, aSource: a.origin?.fileName ?? "this map", bSource: b.origin?.fileName ?? "this map" });
    }
  }

  const graph = parseGraphDocument({ version: 1, title: base?.title ?? title, description: base?.description ?? "",
    nodes: [...nodes.values()], edges: [...edges.values()] });
  return { graph, tables: reports, joins, sameName, totals: { newRecords, filledIn, newLinks, alreadyPresent } };
}

/** Merge two records a person has confirmed are the same organisation. */
export function mergeRecords(graph: GraphDocument, keepId: string, dropId: string): GraphDocument {
  const keep = graph.nodes.find(n => n.id === keepId), drop = graph.nodes.find(n => n.id === dropId);
  if (!keep || !drop || keepId === dropId) return graph;
  const merged: GraphNode = { ...keep, tags: [...new Set([...keep.tags, ...drop.tags])],
    identifiers: [...new Set([...(keep.identifiers ?? []), ...(drop.identifiers ?? [])])],
    receipts: [...(keep.receipts ?? (keep.origin ? [keep.origin] : [])), ...(drop.receipts ?? (drop.origin ? [drop.origin] : []))],
    description: keep.description ?? drop.description, region: keep.region ?? drop.region,
    properties: { ...(drop.properties ?? {}), ...(keep.properties ?? {}),
      "Merged by you": [keep.properties?.["Merged by you"], drop.label + " (same name, confirmed on " + new Date().toISOString().slice(0, 10) + ")"].filter(Boolean).join("; ") } };
  if (!merged.identifiers?.length) delete merged.identifiers;
  const seen = new Set<string>();
  const edges = graph.edges.map(e => ({ ...e, source: e.source === dropId ? keepId : e.source, target: e.target === dropId ? keepId : e.target }))
    .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
  const nodes = graph.nodes.filter(n => n.id !== dropId).map(n => {
    if (n.id === keepId) return merged;
    const p = n.properties;
    if (p && (p.funderId === dropId || p.recipientId === dropId))
      return { ...n, properties: { ...p, ...(p.funderId === dropId ? { funderId: keepId } : {}), ...(p.recipientId === dropId ? { recipientId: keepId } : {}) } };
    return n;
  });
  return parseGraphDocument({ ...graph, nodes, edges });
}
