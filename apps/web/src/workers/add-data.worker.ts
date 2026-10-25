/// <reference lib="webworker" />
import {
  applySources, mergeRecords, missingColumns, parseGraphDocument, placeByPostcode, readDelimited, readHead, readJson, readXlsx,
  recogniseTable, rowMatcher, streamDelimited, summarisePlaces, wantedKeys,
  type GraphDocument, type PlacesSummary, type PlannedTable, type PostcodeCentroids, type Shape, type SourceResult,
  type SourceTable, type UseMode
} from "@mossline/graph-core";

/**
 * Reads the files a person adds, recognises each table, and joins them into a
 * map, all off the main thread. File contents stay here; the page only sees
 * summaries until the person chooses to add the result.
 */
const LARGE_FILE = 40_000_000;
const MAX_WHOLE_FILE = 80_000_000;

export type TableInfo = {
  name: string; file: string; format: SourceTable["format"]; headings: string[]; rows: number | null; bytes: number;
  sample: string[][]; large: boolean; matches: { shape: Shape; score: number; builtIn: boolean; missing: string[] }[];
};
export type MapFile = { file: string; title: string; nodes: number; edges: number };
export type SameNameRow = { a: string; b: string; label: string; aType: string; bType: string; aSource: string; bSource: string;
  aIds: string[]; bIds: string[] };
export type AddReport = Omit<SourceResult, "graph" | "sameName"> & {
  sameName: SameNameRow[]; places: PlacesSummary; counts: { nodes: number; edges: number };
  added: { id: string; label: string; type: string }[]; mapsAdded: number;
};
export type AddCommand =
  | { kind: "read"; id: number; files: File[] }
  | { kind: "apply"; id: number; plans: { table: string; shape: Shape; use: UseMode }[]; maps: string[]; base: GraphDocument | null; title: string }
  | { kind: "exact"; id: number }
  | { kind: "finish"; id: number; merges: [string, string][] };
export type AddMessage =
  | { kind: "stage"; id: number; message: string }
  | { kind: "tables"; id: number; tables: TableInfo[]; maps: MapFile[]; problems: { file: string; message: string }[] }
  | { kind: "result"; id: number; report: AddReport }
  | { kind: "exact-done"; id: number; found: number; asked: number; places: PlacesSummary; failed?: string }
  | { kind: "graph"; id: number; graph: GraphDocument }
  | { kind: "failed"; id: number; message: string };

const tables = new Map<string, SourceTable>();
const largeFiles = new Map<string, File>();
const mossline = new Map<string, GraphDocument>();
let result: GraphDocument | null = null;
let centroids: PostcodeCentroids | null | undefined;

const post = (m: AddMessage) => self.postMessage(m);
const stage = (id: number, message: string) => post({ kind: "stage", id, message });

async function loadCentroids(): Promise<PostcodeCentroids | null> {
  if (centroids !== undefined) return centroids;
  try {
    const res = await fetch(new URL("/geo/postcode-sectors.json", self.location.origin));
    centroids = res.ok ? await res.json() as PostcodeCentroids : null;
  } catch { centroids = null; }
  return centroids;
}

function info(table: SourceTable, bytes: number, large: boolean, rows: number | null): TableInfo {
  return { name: table.name, file: table.file, format: table.format, headings: table.headings, rows, bytes,
    sample: table.rows.slice(0, 5), large,
    matches: recogniseTable(table).map(m => ({ ...m, missing: missingColumns(m.shape, table) })) };
}

async function read(id: number, files: File[]) {
  tables.clear(); largeFiles.clear(); mossline.clear(); result = null;
  const out: TableInfo[] = [], maps: MapFile[] = [], problems: { file: string; message: string }[] = [];
  for (const file of files) {
    stage(id, "Reading " + file.name + "…");
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".xlsx")) {
        if (file.size > MAX_WHOLE_FILE) throw Error("This workbook is too large to open here. Save each sheet as CSV and add those instead.");
        for (const t of readXlsx(file.name, new Uint8Array(await file.arrayBuffer()))) { tables.set(t.name, t); out.push(info(t, file.size, false, t.rows.length)); }
      } else if (lower.endsWith(".xls")) {
        throw Error("Older .xls workbooks cannot be read. Save it as .xlsx or CSV.");
      } else if (lower.endsWith(".json")) {
        if (file.size > MAX_WHOLE_FILE) throw Error("This JSON file is too large to open here.");
        const r = readJson(file.name, await file.text());
        if (r.kind === "mossline") {
          const g = parseGraphDocument(r.graph);
          mossline.set(file.name, g); maps.push({ file: file.name, title: g.title, nodes: g.nodes.length, edges: g.edges.length });
        }
        else for (const t of r.tables) { tables.set(t.name, t); out.push(info(t, file.size, false, t.rows.length)); }
      } else if (file.size > LARGE_FILE) {
        // Only the heading and first rows now; the rest is streamed when used.
        const head = readHead(file.name, await file.slice(0, 256_000).text());
        tables.set(head.name, head); largeFiles.set(head.name, file);
        out.push(info(head, file.size, true, null));
      } else {
        const t = readDelimited(file.name, await file.text());
        tables.set(t.name, t); out.push(info(t, file.size, false, t.rows.length));
      }
    } catch (error) {
      problems.push({ file: file.name, message: error instanceof Error ? error.message : "Could not read this file." });
    }
  }
  post({ kind: "tables", id, tables: out, maps, problems });
}

async function* textChunks(file: File, onBytes: (n: number) => void): AsyncIterable<string> {
  const reader = file.stream().getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onBytes(value.byteLength);
    yield decoder.decode(value, { stream: true });
  }
  const rest = decoder.decode();
  if (rest) yield rest;
}

/** Add whole Mossline maps first: records not already present, by ID. */
function withMaps(base: GraphDocument | null, names: string[], title: string): GraphDocument | null {
  let graph = base;
  for (const name of names) {
    const g = mossline.get(name);
    if (!g) continue;
    if (!graph) { graph = g; continue; }
    const ids = new Set(graph.nodes.map(n => n.id)), edgeIds = new Set(graph.edges.map(e => e.id));
    graph = parseGraphDocument({ ...graph, nodes: [...graph.nodes, ...g.nodes.filter(n => !ids.has(n.id))],
      edges: [...graph.edges, ...g.edges.filter(e => !edgeIds.has(e.id))] });
  }
  return graph && !base ? { ...graph, title } : graph;
}

async function apply(id: number, command: Extract<AddCommand, { kind: "apply" }>) {
  const base = withMaps(command.base, command.maps, command.title);
  const ready: PlannedTable[] = [];
  for (const p of command.plans) {
    const t = tables.get(p.table);
    if (t && !largeFiles.has(p.table)) ready.push({ table: t, shape: p.shape, use: p.use });
  }
  // Large files: stream, keeping rows that name a record from the map or the other files.
  const wanted = wantedKeys(base, ready);
  const planned: PlannedTable[] = [];
  const scanned = new Map<string, number>();
  for (const p of command.plans) {
    const file = largeFiles.get(p.table);
    if (!file) { const r = ready.find(x => x.table.name === p.table); if (r) planned.push(r); continue; }
    let bytes = 0, last = 0, match: ((row: string[]) => boolean) | null = null;
    stage(id, "Looking through " + file.name + " for records you have…");
    const { table, rowsRead } = await streamDelimited(file.name, textChunks(file, n => {
      bytes += n;
      const pct = Math.floor(bytes / file.size * 100);
      if (pct >= last + 5) { last = pct; stage(id, "Looking through " + file.name + " · " + pct + "%"); }
    }), (row, headings) => (match ??= rowMatcher(p.shape, headings, wanted))(row));
    stage(id, file.name + ": " + table.rows.length.toLocaleString("en-GB") + " of " + rowsRead.toLocaleString("en-GB") + " rows are about your records");
    scanned.set(table.name, rowsRead);
    planned.push({ table, shape: p.shape, use: "fill" });
  }
  // Tables that add records go first, so names and types come from them.
  planned.sort((a, b) => (a.use === b.use ? 0 : a.use === "records" ? -1 : 1));
  stage(id, "Joining records on their identifiers…");
  const res = applySources(planned, base, command.title);
  // For streamed files, count every row read, and the ones passed over as not about your records.
  for (const r of res.tables) {
    const n = scanned.get(r.table);
    if (n === undefined) continue;
    const passed = n - r.rows;
    r.rows = n;
    if (passed > 0) {
      const s = r.skipped.find(x => x.reason === "Not about a record you already have");
      if (s) s.count += passed; else r.skipped.push({ reason: "Not about a record you already have", count: passed });
    }
  }
  stage(id, "Placing records from their postcodes…");
  const needsPlaces = res.graph.nodes.some(n => n.properties && ("Postcode" in n.properties));
  const data = needsPlaces ? await loadCentroids() : null;
  result = placeByPostcode(res.graph, data).graph;
  const before = new Set(command.base?.nodes.map(n => n.id) ?? []);
  const byId = new Map(result.nodes.map(n => [n.id, n]));
  const sameName: SameNameRow[] = res.sameName.map(c => {
    const a = byId.get(c.a), b = byId.get(c.b);
    return { ...c, aType: a?.type ?? "", bType: b?.type ?? "", aIds: a?.identifiers ?? [], bIds: b?.identifiers ?? [] };
  });
  const added = result.nodes.filter(n => !before.has(n.id)).slice(0, 400).map(n => ({ id: n.id, label: n.label, type: n.type }));
  post({ kind: "result", id, report: { tables: res.tables, joins: res.joins, totals: res.totals, sameName,
    places: summarisePlaces(result, data), counts: { nodes: result.nodes.length, edges: result.edges.length }, added,
    mapsAdded: command.maps.length } });
}

/** Exact positions from postcodes.io, only when the person asks: the postcodes leave this device. */
async function exact(id: number) {
  if (!result) throw Error("Nothing to place yet.");
  const data = await loadCentroids();
  const asked = summarisePlaces(result, data).postcodesToLookUp;
  const found: Record<string, [number, number]> = {};
  let failed: string | undefined;
  for (let i = 0; i < asked.length; i += 100) {
    stage(id, "Looking up postcodes · " + Math.min(i + 100, asked.length).toLocaleString("en-GB") + " of " + asked.length.toLocaleString("en-GB"));
    try {
      const res = await fetch("https://api.postcodes.io/postcodes", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcodes: asked.slice(i, i + 100) }) });
      if (!res.ok) throw Error("postcodes.io replied " + res.status);
      const body = await res.json() as { result: { query: string; result: { postcode: string; latitude: number | null; longitude: number | null } | null }[] };
      for (const r of body.result) if (r.result && r.result.latitude !== null && r.result.longitude !== null)
        found[r.query.toUpperCase().replace(/\s+/g, " ").trim()] = [r.result.latitude, r.result.longitude];
    } catch (error) {
      failed = (error instanceof Error ? error.message : "The lookup failed") + ". Places found so far are kept; the rest stay approximate.";
      break;
    }
  }
  result = placeByPostcode(result, data, found).graph;
  post({ kind: "exact-done", id, found: Object.keys(found).length, asked: asked.length, places: summarisePlaces(result, data), failed });
}

self.onmessage = (event: MessageEvent<AddCommand>) => {
  const job = event.data;
  void (async () => {
    try {
      if (job.kind === "read") await read(job.id, job.files);
      else if (job.kind === "apply") await apply(job.id, job);
      else if (job.kind === "exact") await exact(job.id);
      else {
        if (!result) throw Error("Nothing to add yet.");
        let graph = result;
        for (const [keep, drop] of job.merges) graph = mergeRecords(graph, keep, drop);
        post({ kind: "graph", id: job.id, graph });
      }
    } catch (error) {
      post({ kind: "failed", id: job.id, message: error instanceof Error ? error.message : "Something went wrong reading these files." });
    }
  })();
};
