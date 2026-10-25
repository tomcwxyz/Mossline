import { suggestFundingMapping } from "../funding";
import { BUILT_IN_SHAPES } from "./builtin";
import { headingIndex, normaliseHeading, parseShape, templateResolves, type RecordTemplate, type Shape } from "./shape";
import type { SourceTable } from "./tables";

/**
 * Recognising a table: score each known shape by the headings it needs, and
 * when none fits, describe the table with a suggested shape built from its
 * own headings. Suggestions are starting points for a person to check.
 */
export interface ShapeMatch { shape: Shape; score: number; builtIn: boolean }

const alt = (h: string) => h.split("|");
export function recogniseTable(table: SourceTable, shapes: Shape[] = BUILT_IN_SHAPES): ShapeMatch[] {
  const index = headingIndex(table.headings);
  const has = (h: string) => alt(h).some(a => index.has(normaliseHeading(a)));
  const out: ShapeMatch[] = [];
  for (const shape of shapes) {
    const all = shape.match?.all ?? [], any = shape.match?.any ?? [];
    if (!all.length || !all.every(has)) continue;
    const anyHits = any.filter(has).length;
    if (any.length && anyHits === 0) continue;
    out.push({ shape, score: all.length * 3 + anyHits, builtIn: true });
  }
  out.sort((a, b) => b.score - a.score);
  const suggested = suggestShape(table);
  if (suggested) out.push({ shape: suggested, score: 0, builtIn: false });
  return out;
}

/** The first heading matching the words, in the order the words are listed. */
const pick = (headings: string[], words: string[]) => {
  for (const w of words) { const h = headings.find(x => normaliseHeading(x) === normaliseHeading(w)); if (h) return h; }
  return "";
};
const brace = (h: string) => h ? "{" + h + "}" : "";
const schemeFor = (h: string) => /charity/i.test(h) ? "charity" as const : /company/i.test(h) ? "company" as const : "orgid" as const;

/** A shape built from the table's own headings, for anything unrecognised. */
export function suggestShape(table: SourceTable): Shape | null {
  const h = table.headings;
  if (!h.length) return null;
  const base = { kind: "mossline-shape" as const, version: 1 as const, id: "suggested:" + table.name, match: { all: [], any: [] } };

  // Grants without the 360Giving headings: funder, recipient and an amount, date or grant ID.
  const f = suggestFundingMapping(h);
  if (f.funder && f.recipient && (f.amount || f.date || f.grantId)) {
    return parseShape({ ...base, name: "Grants (funder to recipient)", each: "Each row is a grant from a funder to a recipient.",
      records: [
        { key: "funder", type: "funder", label: brace(f.funder), identifiers: f.funderId ? [{ value: brace(f.funderId), scheme: schemeFor(f.funderId) }] : [] },
        { key: "recipient", type: "organisation", label: brace(f.recipient),
          identifiers: f.recipientId ? [{ value: brace(f.recipientId), scheme: schemeFor(f.recipientId) }] : [], region: brace(f.region) || undefined },
        { key: "grant", type: "project", label: brace(f.title || f.grantId) || "{" + f.recipient + "}", fields: "row",
          identifiers: f.grantId ? [{ value: brace(f.grantId), scheme: "raw" }] : [], description: brace(f.description) || undefined,
          tags: f.themes ? [{ value: brace(f.themes), split: ";" }] : [],
          grant: { from: "funder", to: "recipient", amount: brace(f.amount) || undefined, currency: brace(f.currency) || undefined,
            date: brace(f.date) || undefined, programme: brace(f.programme) || undefined } }],
      links: [] });
  }

  const from = pick(h, ["from", "source", "sourceentity", "sourceorganisation", "fromname"]);
  const to = pick(h, ["to", "target", "targetentity", "targetorganisation", "toname"]);
  const kind = pick(h, ["type", "relationship", "relationshiptype", "connectiontype", "link", "linktype"]);
  if (from && to) {
    return parseShape({ ...base, name: "Links between named records", each: "Each row links one named record to another.",
      records: [], links: [{ from: { ref: brace(from) }, to: { ref: brace(to) }, type: kind ? brace(kind) : "connected", fields: "row" }] });
  }

  const label = pick(h, ["label", "name", "organisation", "organisationname", "organization", "organizationname", "title", "entity", "project", "projectname", "charityname", "companyname"]) || h[0];
  const typeCol = pick(h, ["type", "elementtype", "entitytype", "category", "kind"]);
  const idCol = pick(h, ["id", "identifier", "orgid", "organisationidentifier", "reference", "ref"]);
  const charityCol = pick(h, ["charitynumber", "registeredcharitynumber", "charityno", "charityregistrationnumber", "regcharitynumber"]);
  const companyCol = pick(h, ["companynumber", "companyno", "companyregistrationnumber", "crn"]);
  const lat = pick(h, ["latitude", "lat"]), lon = pick(h, ["longitude", "lon", "lng", "long"]);
  const postcode = pick(h, ["postcode", "postalcode", "post code", "zip"]);
  const region = pick(h, ["region", "area", "geographicreach", "localauthority", "county"]);
  const description = pick(h, ["description", "summary", "about", "activities", "notes"]);
  const tags = pick(h, ["tags", "themes", "topics", "theme", "topic", "keywords"]);
  const looksLikeOrg = /organi[sz]ation|charity|company|org/i.test(label);
  const record: RecordTemplate = {
    key: "row", label: brace(label),
    type: typeCol ? brace(typeCol) : looksLikeOrg ? "organisation" : "other", typeFallback: looksLikeOrg ? "organisation" : "other",
    identifiers: [
      ...(idCol ? [{ value: brace(idCol), scheme: /org/i.test(idCol) ? "orgid" as const : "local" as const }] : []),
      ...(charityCol ? [{ value: brace(charityCol), scheme: "charity" as const }] : []),
      ...(companyCol ? [{ value: brace(companyCol), scheme: "company" as const }] : [])],
    description: brace(description) || undefined, region: brace(region) || undefined,
    tags: tags ? [{ value: brace(tags), split: tags && /;/.test(table.rows.slice(0, 20).map(r => r[h.indexOf(tags)]).join("")) ? ";" : "|" }] : [],
    place: lat || lon || postcode ? { latitude: brace(lat) || undefined, longitude: brace(lon) || undefined, postcode: brace(postcode) || undefined } : undefined,
    fields: "row"
  };
  // Other columns that name things (organisation + project + funder) become linked records.
  const named = (["organisation", "project", "funder"] as const).map(t => ({ t, col: pick(h, t === "organisation"
    ? ["organisation", "organisationname", "organization", "organizationname", "partner"]
    : t === "project" ? ["project", "projectname", "programme", "initiative"] : ["funder", "fundername", "foundation", "fundingbody", "donor"]) }))
    .filter(x => x.col && x.col !== label);
  if (named.length) {
    const labelType = pick(h, ["project", "projectname", "programme", "initiative"]) === label ? "project" : record.type;
    return parseShape({ ...base, name: "Rows naming several records", each: "Each row names " + [label, ...named.map(n => n.col)].join(", ") + ".",
      records: [{ ...record, type: labelType }, ...named.map(n => ({ key: n.t, type: n.t, label: brace(n.col) }))],
      links: named.map(n => ({ from: "row", to: n.t, type: n.t === "funder" ? "funded by" : n.t === "project" ? "delivers" : "works with" })) });
  }
  return parseShape({ ...base, name: "List of records", each: "Each row is one record named in “" + label + "”.", records: [record], links: [] });
}

/** Columns a shape refers to that this table does not have (for warnings). */
export function missingColumns(shape: Shape, table: SourceTable): string[] {
  const index = headingIndex(table.headings);
  const templates = shape.records.flatMap(r => [r.label]).concat(shape.links.flatMap(l => [
    typeof l.from === "string" ? "" : l.from.ref, typeof l.to === "string" ? "" : l.to.ref]));
  return templates.filter(t => t && !templateResolves(t, index));
}
