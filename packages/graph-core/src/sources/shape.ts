import { z } from "zod";
import { nodeTypeSchema } from "../schema";

/**
 * A shape says what a table's rows mean: which records each row names, which
 * links it records, which columns are identifiers, places or tags. Shapes are
 * plain data, so the built-in ones (360Giving, Charity Commission, Companies
 * House, Kumu) and one a person adjusts are read by the same engine.
 *
 * Values are templates: "{Recipient Org:Name}" reads a column, "|" inside the
 * braces lists alternatives ("{Title|title}"), and text outside braces is
 * kept as written ("funds").
 */
const template = z.string().max(300);
const scheme = z.enum(["orgid", "charity", "company", "raw", "local"]);

export const recordTemplateSchema = z.object({
  /** Handle used by links in the same shape, e.g. "funder". */
  key: z.string().min(1).max(40),
  label: template,
  /** "title": names a register writes in capitals ("ALLENDALE LARDER") are shown
   *  as "Allendale Larder"; the original stays in the record's source fields. */
  labelCase: z.enum(["title"]).optional(),
  /** A fixed type, or a template whose value is matched to a type. */
  type: z.union([nodeTypeSchema, template]),
  typeFallback: nodeTypeSchema.optional(),
  /** Codes a source uses for types, e.g. {"P":"person","O":"organisation"}. */
  typeMap: z.record(z.string().max(40), nodeTypeSchema).optional(),
  identifiers: z.array(z.object({ value: template, scheme })).max(6).optional(),
  description: template.optional(),
  region: template.optional(),
  tags: z.array(z.object({ value: template, split: z.string().max(3).optional(), strip: z.enum(["sic"]).optional() })).max(8).optional(),
  place: z.object({ latitude: template.optional(), longitude: template.optional(),
    postcode: template.optional(), address: template.optional() }).optional(),
  /** Columns kept on the record: the whole row, or a list of headings. */
  fields: z.union([z.literal("row"), z.array(z.string().max(150)).max(60)]).optional(),
  /** Named values; repeated rows for the same record collect distinct values. */
  properties: z.record(z.string().max(80), template).optional(),
  /** A grant moves money between two other records in the same row. */
  grant: z.object({ from: z.string(), to: z.string(), amount: template.optional(), currency: template.optional(),
    date: template.optional(), programme: template.optional() }).optional(),
  /** Only create this record when the template has a value. */
  when: template.optional(),
  /** Only add to a record that already exists (e.g. classification rows). */
  existingOnly: z.boolean().optional()
}).strict();

const endpoint = z.union([z.string().min(1), z.object({
  /** Template naming another record: an identifier, a local ID or a label. */
  ref: template,
  scheme: scheme.optional()
}).strict()]);

export const linkTemplateSchema = z.object({
  from: endpoint, to: endpoint,
  type: template,
  direction: z.union([z.enum(["directed", "undirected", "mutual"]), template]).optional(),
  description: template.optional(),
  fields: z.union([z.literal("row"), z.array(z.string().max(150)).max(60)]).optional(),
  /** Named values on the link, e.g. {"Start Date": "{trustee_date_of_appointment}"}. */
  properties: z.record(z.string().max(80), template).optional(),
  when: template.optional()
}).strict();

export const shapeSchema = z.object({
  kind: z.literal("mossline-shape"),
  version: z.literal(1),
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  /** One sentence: what a row of this table is. */
  each: z.string().max(200),
  about: z.string().max(600).optional(),
  /** Headings used to recognise the table; alternatives separated by "|". */
  match: z.object({ all: z.array(z.string()).max(20).default([]), any: z.array(z.string()).max(30).default([]) }).optional(),
  skip: z.array(z.object({ when: template, equals: z.array(z.string()).optional(), notEquals: z.array(z.string()).optional(),
    reason: z.string().max(200) })).max(10).optional(),
  records: z.array(recordTemplateSchema).max(12),
  links: z.array(linkTemplateSchema).max(12).default([])
}).strict();

export type RecordTemplate = z.infer<typeof recordTemplateSchema>;
export type LinkTemplate = z.infer<typeof linkTemplateSchema>;
export type Shape = z.infer<typeof shapeSchema>;
export type ShapeInput = z.input<typeof shapeSchema>;
export function parseShape(raw: unknown): Shape { return shapeSchema.parse(raw); }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Look up headings once, ignoring case, spacing and punctuation. */
export function headingIndex(headings: string[]): Map<string, number> {
  const index = new Map<string, number>();
  headings.forEach((h, i) => { const k = norm(h); if (!index.has(k)) index.set(k, i); });
  return index;
}
/** Columns a template reads (all alternatives). */
export function templateColumns(t: string | undefined): string[] {
  if (!t) return [];
  return [...t.matchAll(/\{([^}]+)\}/g)].flatMap(m => m[1].split("|").map(s => s.trim()));
}
/** Fill a template from one row. Empty when every referenced column is empty. */
export function render(t: string | undefined, row: string[], index: Map<string, number>): string {
  if (!t) return "";
  let anyColumn = false, anyValue = false;
  const out = t.replace(/\{([^}]+)\}/g, (_, inner: string) => {
    anyColumn = true;
    for (const alt of inner.split("|")) {
      const i = index.get(norm(alt));
      const v = i === undefined ? "" : (row[i] ?? "").trim();
      if (v) { anyValue = true; return v; }
    }
    return "";
  });
  return anyColumn && !anyValue ? "" : out.trim();
}
/** True when at least one alternative of every brace group exists in the headings. */
export function templateResolves(t: string | undefined, index: Map<string, number>): boolean {
  if (!t) return true;
  return [...t.matchAll(/\{([^}]+)\}/g)].every(m => m[1].split("|").some(alt => index.has(norm(alt))));
}
export const normaliseHeading = norm;

const KEEP_UPPER = new Set(["CIC", "CIO", "UK", "NHS", "YMCA", "YWCA", "PCC", "PTA", "LLP", "PLC", "CVS", "RSPB", "RNLI", "BBC", "NE", "NW", "SE", "SW", "II", "III", "IV"]);
const SMALL = new Set(["of", "and", "the", "for", "in", "on", "at", "to", "a", "an", "by", "with", "de", "la"]);
/** Title case for names written entirely in capitals; anything with lower case is left alone. */
export function titleCaseName(name: string): string {
  if (/[a-z]/.test(name) || !/[A-Z]{2}/.test(name)) return name;
  let first = true;
  return name.split(/(\s+|[-/(])/).map(part => {
    if (!part || /^\s+$/.test(part) || /^[-/(]$/.test(part)) return part;
    const bare = part.replace(/[^A-Z0-9&']/g, "");
    let out: string;
    if (KEEP_UPPER.has(bare) || /\d/.test(part)) out = part;
    else if (!first && SMALL.has(part.toLowerCase())) out = part.toLowerCase();
    else out = part.toLowerCase().replace(/(^|[^a-z'])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase())
      .replace(/^Mc([a-z])/, (_, c: string) => "Mc" + c.toUpperCase()).replace(/'S\b/g, "'s");
    first = false;
    return out;
  }).join("").replace(/\bLtd\b/g, "Ltd").replace(/\bLimited\b/g, "Limited");
}
