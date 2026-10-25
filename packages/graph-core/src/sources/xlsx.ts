import { unzipSync, strFromU8 } from "fflate";
import { uniqueHeadings, type SourceTable } from "./tables";

/**
 * A small, read-only Excel (.xlsx) reader: each sheet becomes a table, its
 * first non-empty row the headings. Values are read as displayed text; no
 * formulas are evaluated and no styles are kept.
 */
const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&");
const attr = (tag: string, name: string) => tag.match(new RegExp("\\b" + name + '="([^"]*)"'))?.[1];

function column(ref: string): number {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function readXlsx(file: string, bytes: Uint8Array): SourceTable[] {
  const zip = unzipSync(bytes, { filter: f => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(f.name) });
  const text = (path: string) => zip[path] ? strFromU8(zip[path]) : "";
  const workbook = text("xl/workbook.xml");
  if (!workbook) throw new Error(file + ": not an Excel workbook");
  const rels = new Map<string, string>();
  for (const m of text("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], "Id"), target = attr(m[0], "Target");
    if (id && target) rels.set(id, "xl/" + target.replace(/^\/?xl\//, "").replace(/^\//, ""));
  }
  const shared: string[] = [];
  for (const m of text("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g))
    shared.push(decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")));
  const tables: SourceTable[] = [];
  for (const m of workbook.matchAll(/<sheet\b[^>]*\/?>/g)) {
    const name = decode(attr(m[0], "name") ?? "Sheet"), rid = attr(m[0], "r:id");
    const xml = rid && rels.has(rid) ? text(rels.get(rid)!) : "";
    if (!xml) continue;
    const grid: { r: number; cells: string[] }[] = [];
    for (const row of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const r = Number(attr(row[1], "r") ?? grid.length + 1);
      const cells: string[] = [];
      for (const c of row[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attr(c[1], "r"), type = attr(c[1], "t"), body = c[2] ?? "";
        const idx = ref ? column(ref) : cells.length;
        let v = "";
        if (type === "inlineStr") v = decode([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(""));
        else {
          const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
          v = type === "s" ? shared[Number(raw)] ?? "" : decode(raw);
        }
        cells[idx] = v;
      }
      if (cells.some(x => x && x.trim())) grid.push({ r, cells: Array.from(cells, x => x ?? "") });
    }
    if (!grid.length) continue;
    const [head, ...body] = grid;
    const headings = uniqueHeadings(head.cells.map(h => h.trim()));
    tables.push({ name: file + " · " + name, file, format: "xlsx", headings,
      rows: body.map(b => headings.map((_, i) => b.cells[i] ?? "")), firstRecordNumber: body[0]?.r ?? head.r + 1 });
  }
  if (!tables.length) throw new Error(file + ": no sheets with data");
  return tables;
}
