import type { GraphDocument } from "../schema";
import type { PlannedTable } from "./engine";
import { normaliseIdentifier } from "./identifiers";
import { headingIndex, render, type Shape } from "./shape";
import { DelimitedParser, detectDelimiter, uniqueHeadings, type SourceTable } from "./tables";

/**
 * Very large register files (the whole Charity Commission register, a
 * Companies House extract) are only useful for filling in records a map
 * already has. They are read as a stream and only rows that name one of the
 * map's identifiers are kept, so a file of several hundred megabytes never
 * has to sit in memory.
 */

/** Identifiers (and, for shapes without identifiers, names) a large table could match. */
export function wantedKeys(base: GraphDocument | null, batch: PlannedTable[]): Set<string> {
  const keys = new Set<string>();
  for (const node of base?.nodes ?? []) {
    for (const id of node.identifiers ?? []) keys.add("id:" + id);
    if (node.id.startsWith("id:")) keys.add("id:" + node.id.slice(3));
    keys.add("label:" + node.label.toLocaleLowerCase("en-GB").trim());
  }
  for (const { table, shape, use } of batch) {
    if (use !== "records") continue;
    const index = headingIndex(table.headings);
    for (const row of table.rows) for (const t of shape.records) {
      for (const rule of t.identifiers ?? []) {
        if (rule.scheme === "local") continue;
        const id = normaliseIdentifier(render(rule.value, row, index), rule.scheme);
        if (id) keys.add("id:" + id);
      }
      const label = render(t.label, row, index);
      if (label) keys.add("label:" + label.toLocaleLowerCase("en-GB").trim());
    }
  }
  return keys;
}

/** A test for one row of a table read with this shape: does it name a wanted record? */
export function rowMatcher(shape: Shape, headings: string[], wanted: Set<string>): (row: string[]) => boolean {
  const index = headingIndex(headings);
  const idRules = shape.records.flatMap(t => (t.identifiers ?? []).filter(r => r.scheme !== "local"));
  const refRules = shape.links.flatMap(l => [l.from, l.to]).filter((e): e is { ref: string; scheme?: "orgid" | "charity" | "company" | "raw" | "local" } =>
    typeof e !== "string" && !!e.scheme && e.scheme !== "local");
  const byName = !idRules.length && !refRules.length;
  return row => {
    for (const r of idRules) { const id = normaliseIdentifier(render(r.value, row, index), r.scheme); if (id && wanted.has("id:" + id)) return true; }
    for (const r of refRules) { const id = normaliseIdentifier(render(r.ref, row, index), r.scheme!); if (id && wanted.has("id:" + id)) return true; }
    if (byName) for (const t of shape.records) {
      const label = render(t.label, row, index);
      if (label && wanted.has("label:" + label.toLocaleLowerCase("en-GB").trim())) return true;
    }
    return false;
  };
}

/** The heading row and first rows of a delimited file, from its opening bytes. */
export function readHead(file: string, text: string, sampleRows = 8): SourceTable {
  const body = text.replace(/^﻿/, "");
  const firstBreak = body.search(/\r?\n/);
  const delimiter = detectDelimiter(firstBreak < 0 ? body : body.slice(0, firstBreak));
  let headings: string[] | null = null;
  const rows: string[][] = [];
  const parser = new DelimitedParser(delimiter, cells => {
    if (!headings) { headings = cells.map(h => h.trim()); return; }
    if (rows.length < sampleRows) rows.push(cells);
  });
  // The last line of a partial read may be cut off; leave it out.
  parser.push(body.slice(0, Math.max(body.lastIndexOf("\n"), 0)));
  parser.finish();
  if (!headings) throw new Error(file + ": no heading row found");
  return { name: file, file, format: delimiter === "\t" ? "tsv" : "csv", headings: uniqueHeadings(headings), rows, firstRecordNumber: 2 };
}

/** Stream a delimited file, keeping only rows `keep` accepts, with their record numbers. */
export async function streamDelimited(file: string, chunks: AsyncIterable<string>, keep: (row: string[], headings: string[]) => boolean,
  onProgress?: (rowsRead: number) => void): Promise<{ table: SourceTable; rowsRead: number }> {
  let headings: string[] | null = null, delimiter: string | null = null, parser: DelimitedParser | null = null;
  const rows: string[][] = [], numbers: number[] = [];
  let read = 0, first = true;
  for await (let chunk of chunks) {
    if (first) { chunk = chunk.replace(/^﻿/, ""); first = false; }
    if (!parser) {
      const br = chunk.search(/\r?\n/);
      delimiter = detectDelimiter(br < 0 ? chunk : chunk.slice(0, br));
      parser = new DelimitedParser(delimiter, cells => {
        if (!headings) { headings = uniqueHeadings(cells.map(h => h.trim())); return; }
        read++;
        if (keep(cells, headings)) { rows.push(cells); numbers.push(read + 1); }
        if (onProgress && read % 50_000 === 0) onProgress(read);
      });
    }
    parser.push(chunk);
  }
  parser?.finish();
  if (!headings) throw new Error(file + ": no heading row found");
  return { table: { name: file, file, format: delimiter === "\t" ? "tsv" : "csv", headings, rows, firstRecordNumber: numbers[0] ?? 2,
    recordNumbers: numbers }, rowsRead: read };
}
