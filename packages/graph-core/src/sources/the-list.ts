import { parseGraphDocument, type GraphDocument, type GraphEdge, type GraphNode, type SourceOrigin } from "../schema";

/**
 * The List's published changes are assertions about funder behaviour, NOT grant
 * awards, verified outcomes, or evidence that two funders collaborate.
 * Keep the source and each of its categorical claims separately inspectable.
 */
const LIST = "https://the-list.uk";
const clean = (v: unknown, limit = 4000): string =>
  typeof v === "string" ? v.trim().slice(0, limit) : "";
const safeUrl = (v: unknown): string | undefined => {
  const s = clean(v, 2000);
  try {
    const u = new URL(s);
    return (u.protocol === "https:" || u.protocol === "http:") && !u.username && !u.password ? u.href : undefined;
  } catch { return undefined; }
};
const strings = (v: unknown): string[] => Array.isArray(v) ?
  [...new Set(v.filter(x => typeof x === "string").map(x => clean(x, 80)).filter(Boolean))].slice(0, 30) : [];
const dateOnly = (v: unknown): string => {
  const value = clean(v, 35);
  if (!/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return "";
  const day = value.slice(0, 10);
  return !Number.isNaN(Date.parse(day + "T00:00:00Z")) ? day : "";
};
const key = (value: string): string => encodeURIComponent(value.toLocaleLowerCase("en-GB").replace(/\s+/g, " ").trim());
const receipt = (recordId: string, fields: Record<string, string>): SourceOrigin => ({
  system: "json", recordId, fileName: "The List — published changes",
  shape: "The List: approved or confirmed", fields
});

type ListFunder = {
  id?: unknown; name?: unknown; charity_number?: unknown; website?: unknown;
  "360GivingOrgID"?: unknown;
};
export type PublishedListChange = {
  id?: unknown; slug?: unknown; status?: unknown; description?: unknown;
  change_type?: unknown; date_of_change?: unknown; submitted_at?: unknown;
  additional_details?: unknown; url?: unknown; funder_id?: unknown;
  funder_name?: unknown; organisation_sizes_impacted?: unknown;
  organisation_types_impacted?: unknown; charitable_cause_areas?: unknown;
  funder?: ListFunder | null;
};
export interface ListGraphResult {
  graph: GraphDocument;
  count: number;
  skipped: number;
}

/** Only accepts the public, reviewed records returned by The List's public_changes API. */
export function theListChangesToGraph(input: unknown): ListGraphResult {
  if (!Array.isArray(input)) throw Error("The List feed must be an array of published changes.");
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  let count = 0, skipped = 0;
  for (const raw of input) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { skipped++; continue; }
    const c = raw as PublishedListChange;
    const id = clean(c.id, 100);
    const status = clean(c.status, 40).toLowerCase();
    const publicSummary = clean(c.description, 4000);
    if (!id || !/^[a-zA-Z0-9_-]{8,100}$/.test(id) || !["approved", "confirmed"].includes(status)) {
      skipped++; continue;
    }
    const funder: ListFunder = c.funder && typeof c.funder === "object" ? c.funder : {};
    const funderId = clean(funder.id ?? c.funder_id, 100);
    const funderName = clean(funder.name ?? c.funder_name, 250);
    const changeType = clean(c.change_type, 120) || "Not classified";
    // Historical published records sometimes lack a summary. Preserve them,
    // visibly labelled as such, rather than inventing a description or dropping them.
    const description = publicSummary || clean(c.additional_details, 4000) ||
      "No public summary supplied for this " + changeType.toLowerCase() + " change.";
    const date = dateOnly(c.date_of_change) || dateOnly(c.submitted_at);
    const slug = clean(c.slug, 220);
    const recordUrl = /^[a-zA-Z0-9_-]+$/.test(slug) ?
      LIST + "/changes/" + slug : LIST + "/changes/" + encodeURIComponent(id);
    const originalUrl = safeUrl(c.url);
    const causeAreas = strings(c.charitable_cause_areas);
    const types = strings(c.organisation_types_impacted);
    const sizes = strings(c.organisation_sizes_impacted);

    // If the source contains no stable funder identity, do NOT join on a name.
    const organisationId = funderId ? "the-list:funder:" + funderId : "the-list:unlinked-funder:" + id;
    const changeId = "the-list:change:" + id;
    const source = receipt(id, {
      "The List record": recordUrl,
      "Change type": changeType,
      ...(date ? { "Date (source)": date } : {}),
      ...(originalUrl ? { "Original evidence": originalUrl } : {}),
      ...(funderName ? { Funder: funderName } : {})
    });
    if (!nodes.has(organisationId)) {
      const charity = clean(funder.charity_number, 30).toUpperCase().replace(/\s+/g, "");
      const orgId = clean(funder["360GivingOrgID"], 100);
      const identifiers = [...new Set([
        ...(orgId ? [orgId] : []),
        ...(charity.startsWith("SC") ? ["GB-SC-" + charity] :
          charity.startsWith("NIC") ? ["GB-NIC-" + charity] :
          /^\d{5,8}$/.test(charity) ? ["GB-CHC-" + charity] : [])
      ])];
      nodes.set(organisationId, {
        id: organisationId,
        label: funderName || "Funder not linked to a register record",
        type: "funder", tags: [],
        identifiers,
        ...(safeUrl(funder.website) ? { sourceUrl: safeUrl(funder.website) } : {}),
        origin: source, receipts: [source],
        properties: {
          "The List funder ID": funderId || "Not supplied",
          "Identity status": funderId ? "Linked by The List's funder ID" : "Unlinked; not merged on name"
        }
      });
    }
    nodes.set(changeId, {
      id: changeId,
      label: description.length > 105 ? description.slice(0, 102) + "…" : description,
      description: [description, ...(publicSummary ? [clean(c.additional_details, 4000)] : [])].filter(Boolean).join("\n\n"),
      type: "other",
      tags: [...new Set([changeType, ...causeAreas])],
      sourceUrl: recordUrl,
      origin: source, receipts: [source],
      properties: {
        "Record kind": "Published change in funding behaviour (not a grant award)",
        "Public summary": publicSummary ? "Supplied by The List" : "Missing; label uses details or an explicit placeholder",
        "Change type": changeType, "The List ID": id, "The List record": recordUrl,
        ...(date ? { Date: date } : {}),
        ...(originalUrl ? { "Original evidence": originalUrl } : {}),
        "Affected organisation types (reported)": types.join("; "),
        "Affected organisation sizes (reported)": sizes.join("; "),
        "Cause areas (reported)": causeAreas.join("; "),
        "Licence": "The List © CC BY-NC — attribution and non-commercial terms apply"
      }
    });
    edges.set("the-list:reports:" + id, {
      id: "the-list:reports:" + id, source: organisationId, target: changeId,
      type: "has a published change", direction: "directed",
      description: "The List records this change about the named funder. Not an award or proof of direct impact.",
      sourceUrl: recordUrl, origin: source,
      properties: { ...(date ? { Date: date } : {}), "Change type": changeType }
    });

    const category = (kind: string, value: string, label: string, relation: string) => {
      const catId = "the-list:" + kind + ":" + key(value);
      if (!nodes.has(catId)) nodes.set(catId, {
        id: catId, label, type: "topic", tags: [value],
        description: "A classification reported in The List, not independent evidence of an outcome.",
        sourceUrl: LIST + "/changes",
        properties: { "Category": kind, "Source": "The List" }
      });
      const edgeId = "the-list:" + kind + ":" + id + ":" + key(value);
      edges.set(edgeId, {
        id: edgeId, source: changeId, target: catId, type: relation,
        direction: "directed", sourceUrl: recordUrl, origin: source,
        description: "Classification attached to this published change; it does not establish a measured impact."
      });
    };
    category("change-type", changeType, changeType, "classified as");
    for (const value of causeAreas) category("cause", value, value, "lists cause area");
    for (const value of types) category("organisation-type", value, "Organisation type: " + value, "lists affected organisation type");
    for (const value of sizes) category("organisation-size", value, "Organisation size: " + value, "lists affected organisation size");
    count++;
  }
  if (!count) throw Error("No approved or confirmed changes were found in The List feed.");
  return {
    graph: parseGraphDocument({
      version: 1, title: "Shifting Ground · The List",
      description: "An exploratory atlas of approved or confirmed UK funding changes from The List (the-list.uk), CC BY-NC. Recorded relationships describe source reports and classifications, not grants, collaboration, verified impact or places of benefit. Coverage reflects the records captured by The List and must not be taken as a representative survey of all funders. Data changes over time; import again to obtain a newer copy.",
      nodes: [...nodes.values()], edges: [...edges.values()]
    }),
    count, skipped
  };
}
