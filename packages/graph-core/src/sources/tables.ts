/**
 * Reading any supplied file into plain tables: headings plus rows of text.
 * Everything downstream (shapes, identifiers, merging) works on these tables,
 * so CSV, tab-separated text, Excel sheets and JSON arrays are all the same
 * to the rest of Mossline. Nothing here interprets what a column means.
 */

export type TableFormat = "csv" | "tsv" | "json" | "xlsx";
export interface SourceTable {
  /** File name, plus the sheet or JSON key when one file holds several tables. */
  name: string;
  file: string;
  format: TableFormat;
  headings: string[];
  rows: string[][];
  /** Record number of rows[0] in the source (header line is 1 for text files). */
  firstRecordNumber: number;
  /** Record numbers of each row, when rows were picked out of a larger file. */
  recordNumbers?: number[];
}

const MAX_COLUMNS = 400;

/** Pick the delimiter that splits the heading line into the most fields. */
export function detectDelimiter(firstLine: string): "," | "\t" | ";" | "|" {
  const counts: Record<string, number> = { ",": 0, "\t": 0, ";": 0, "|": 0 };
  let quoted = false;
  for (let i = 0; i < firstLine.length; i++) {
    const c = firstLine[i];
    if (c === '"') quoted = !quoted;
    else if (!quoted && c in counts) counts[c]++;
  }
  if (counts["\t"] > 0 && counts["\t"] >= counts[","]) return "\t";
  const best = (Object.entries(counts) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
  return (best[1] > 0 ? best[0] : ",") as "," | "\t" | ";" | "|";
}

/**
 * Incremental delimited-text parser. Quotes are honoured when a field starts
 * with one; a stray quote inside an unquoted field is kept as text, which is
 * how real register extracts behave. Rows are emitted as they complete, so
 * very large files can be read in chunks.
 */
export class DelimitedParser {
  private cell = "";
  private row: string[] = [];
  private quoted = false;
  private afterQuote = false;
  private atFieldStart = true;
  private pendingCR = false;
  constructor(private readonly delimiter: string, private readonly onRow: (cells: string[]) => void) {}
  push(text: string) {
    const d = this.delimiter;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (this.pendingCR) { this.pendingCR = false; if (c === "\n") continue; }
      if (this.quoted) {
        if (c === '"') { this.quoted = false; this.afterQuote = true; }
        else this.cell += c;
        continue;
      }
      if (this.afterQuote) {
        this.afterQuote = false;
        if (c === '"') { this.cell += '"'; this.quoted = true; continue; }
        if (c !== d && c !== "\n" && c !== "\r") { this.cell += '"' + c; continue; }
      }
      if (c === '"' && this.atFieldStart) { this.quoted = true; this.atFieldStart = false; continue; }
      if (c === d) { this.row.push(this.cell); this.cell = ""; this.atFieldStart = true; continue; }
      if (c === "\n" || c === "\r") {
        this.endRow();
        if (c === "\r") this.pendingCR = true;
        continue;
      }
      this.cell += c; this.atFieldStart = false;
    }
  }
  private endRow() {
    this.row.push(this.cell);
    if (this.row.length > 1 || this.row[0].trim()) this.onRow(this.row);
    this.row = []; this.cell = ""; this.atFieldStart = true; this.afterQuote = false;
  }
  finish() {
    if (this.quoted) this.quoted = false;
    if (this.cell || this.row.length) this.endRow();
  }
}

const clean = (h: string) => h.replace(/^﻿/, "").trim();

/** One delimited text file → one table. */
export function readDelimited(file: string, text: string): SourceTable {
  const body = text.replace(/^﻿/, "");
  const firstBreak = body.search(/\r?\n/);
  const delimiter = detectDelimiter(firstBreak < 0 ? body : body.slice(0, firstBreak));
  let headings: string[] | null = null;
  const rows: string[][] = [];
  const parser = new DelimitedParser(delimiter, cells => {
    if (!headings) { headings = cells.map(clean); return; }
    rows.push(cells);
  });
  parser.push(body); parser.finish();
  if (!headings) throw new Error(file + ": no heading row found");
  const h = uniqueHeadings(headings);
  if (h.length > MAX_COLUMNS) throw new Error(file + ": more than " + MAX_COLUMNS + " columns");
  return { name: file, file, format: delimiter === "\t" ? "tsv" : "csv", headings: h, rows, firstRecordNumber: 2 };
}

/** Blank or repeated headings get a readable, distinct name rather than failing. */
export function uniqueHeadings(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((h, i) => {
    const base = h.trim() || "Column " + (i + 1);
    const n = seen.get(base.toLowerCase()) ?? 0;
    seen.set(base.toLowerCase(), n + 1);
    return n ? base + " (" + (n + 1) + ")" : base;
  });
}

/* ---- JSON ---------------------------------------------------------------- */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
const isObject = (v: unknown): v is Record<string, Json> => !!v && typeof v === "object" && !Array.isArray(v);
const scalar = (v: Json): string => v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);

/** Flatten nested objects to dotted keys; arrays of objects get an index
 *  (recipientOrganization.0.name), arrays of values are joined with " | ". */
function flatten(value: Record<string, Json>, prefix = "", out: Record<string, string> = {}, depth = 0) {
  for (const [key, v] of Object.entries(value)) {
    const path = prefix ? prefix + "." + key : key;
    if (isObject(v) && depth < 4) flatten(v, path, out, depth + 1);
    else if (Array.isArray(v)) {
      if (v.length && v.every(isObject) && depth < 4) v.slice(0, 5).forEach((item, i) => flatten(item as Record<string, Json>, path + "." + i, out, depth + 1));
      else out[path] = v.map(scalar).filter(Boolean).join(" | ");
    } else out[path] = scalar(v);
  }
  return out;
}
function tableFromObjects(name: string, file: string, items: Record<string, Json>[]): SourceTable {
  const flat = items.map(item => flatten(item));
  const headings: string[] = [];
  const seen = new Set<string>();
  for (const row of flat) for (const key of Object.keys(row)) if (!seen.has(key)) { seen.add(key); headings.push(key); }
  if (headings.length > MAX_COLUMNS) throw new Error(name + ": more than " + MAX_COLUMNS + " fields");
  return { name, file, format: "json", headings, rows: flat.map(r => headings.map(h => r[h] ?? "")), firstRecordNumber: 1 };
}
export type JsonRead = { kind: "tables"; tables: SourceTable[] } | { kind: "mossline"; graph: unknown };
/** A JSON file becomes one table per array of objects it holds (a top-level
 *  array, or keys such as elements/connections or grants). A Mossline map is
 *  passed through as a ready graph. */
export function readJson(file: string, text: string): JsonRead {
  const data = JSON.parse(text.replace(/^﻿/, "")) as Json;
  if (Array.isArray(data)) {
    const items = data.filter(isObject);
    if (!items.length) throw new Error(file + ": no records found in the JSON array");
    return { kind: "tables", tables: [tableFromObjects(file, file, items)] };
  }
  if (!isObject(data)) throw new Error(file + ": expected a JSON object or array");
  if (data.version === 1 && Array.isArray(data.nodes) && Array.isArray(data.edges)) return { kind: "mossline", graph: data };
  const tables: SourceTable[] = [];
  for (const [key, v] of Object.entries(data)) {
    if (Array.isArray(v) && v.length && v.some(isObject))
      tables.push(tableFromObjects(file + " · " + key, file, v.filter(isObject) as Record<string, Json>[]));
  }
  if (!tables.length) throw new Error(file + ": no arrays of records found in this JSON");
  return { kind: "tables", tables };
}
