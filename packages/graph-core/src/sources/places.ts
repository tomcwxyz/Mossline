import { readAtlasLocation } from "../geography";
import { parseGraphDocument, type GraphDocument, type GraphNode } from "../schema";
import { extractPostcode } from "./engine";

/**
 * Places from postcodes. A source's own coordinates always win. Otherwise a
 * postcode can give an approximate position, kept apart from recorded ones
 * under "Approximate location" so it is never mistaken for source data:
 * the map draws it differently and the record says where it came from.
 */
export const APPROXIMATE_KEY = "Approximate location";

export type PlacePrecision = "postcode" | "postcode sector" | "postcode district";
export interface ApproximatePlace {
  latitude: number; longitude: number; precision: PlacePrecision;
  method: "offline lookup" | "postcodes.io"; from: string;
}
export interface PostcodeCentroids {
  kind: "mossline-postcode-centroids"; version: 1; generated: string; attribution: string[];
  sectors: Record<string, [number, number, number?]>; districts: Record<string, [number, number, number?]>;
}

/** Only a record's own postcode places it: source columns describing another
 *  record (a grant row's "Recipient Org:Postal Code") are never used. */
const POSTCODE_FIELDS = ["Postcode", "postcode", "Post Code", "Postal Code", "postalCode"];
/** The postcode a record carries, from its own properties. */
export function recordPostcode(node: GraphNode): string {
  const p = node.properties ?? {};
  for (const k of POSTCODE_FIELDS) if (typeof p[k] === "string") { const pc = extractPostcode(p[k] as string); if (pc) return pc; }
  return "";
}
export function postcodeParts(postcode: string): { postcode: string; sector: string; district: string } | null {
  const pc = extractPostcode(postcode);
  if (!pc) return null;
  const [district, inward] = pc.split(" ");
  return { postcode: pc, sector: district + " " + inward[0], district };
}

export function lookupPostcode(postcode: string, data: PostcodeCentroids): ApproximatePlace | null {
  const parts = postcodeParts(postcode);
  if (!parts) return null;
  const s = data.sectors[parts.sector];
  if (s) return { latitude: s[0], longitude: s[1], precision: "postcode sector", method: "offline lookup", from: parts.postcode };
  const d = data.districts[parts.district];
  if (d) return { latitude: d[0], longitude: d[1], precision: "postcode district", method: "offline lookup", from: parts.postcode };
  return null;
}

export function approximatePlace(node: GraphNode): ApproximatePlace | null {
  const v = node.properties?.[APPROXIMATE_KEY];
  if (!v || typeof v !== "object") return null;
  const a = v as Partial<ApproximatePlace>;
  if (typeof a.latitude !== "number" || typeof a.longitude !== "number" || !Number.isFinite(a.latitude) || !Number.isFinite(a.longitude)) return null;
  return { latitude: a.latitude, longitude: a.longitude, precision: a.precision ?? "postcode district",
    method: a.method ?? "offline lookup", from: a.from ?? "" };
}

/** Where to draw a record: its recorded position, else an approximate one. */
export function placedCoordinates(node: GraphNode): { lat: number; lon: number; approximate: false } |
  { lat: number; lon: number; approximate: true; place: ApproximatePlace } | null {
  const recorded = readAtlasLocation(node);
  if (recorded) return { lat: recorded.latitude, lon: recorded.longitude, approximate: false };
  const a = approximatePlace(node);
  return a ? { lat: a.latitude, lon: a.longitude, approximate: true, place: a } : null;
}

export interface PlacesSummary {
  recorded: number; withPostcode: number; placed: Partial<Record<PlacePrecision, number>>;
  notFound: string[]; noPlace: number; postcodesToLookUp: string[];
}

/** Count what can be placed, and how, without changing anything. */
export function summarisePlaces(graph: GraphDocument, data: PostcodeCentroids | null): PlacesSummary {
  const out: PlacesSummary = { recorded: 0, withPostcode: 0, placed: {}, notFound: [], noPlace: 0, postcodesToLookUp: [] };
  const toLookUp = new Set<string>();
  for (const node of graph.nodes) {
    if (readAtlasLocation(node)) { out.recorded++; continue; }
    const pc = recordPostcode(node);
    const existing = approximatePlace(node);
    if (!pc) { if (existing) out.placed[existing.precision] = (out.placed[existing.precision] ?? 0) + 1; else out.noPlace++; continue; }
    out.withPostcode++;
    if (existing?.precision !== "postcode") toLookUp.add(pc);
    const found = existing ?? (data ? lookupPostcode(pc, data) : null);
    if (found) out.placed[found.precision] = (out.placed[found.precision] ?? 0) + 1;
    else if (out.notFound.length < 50) out.notFound.push(pc);
  }
  out.postcodesToLookUp = [...toLookUp];
  return out;
}

/**
 * Give records without recorded coordinates an approximate place from their
 * postcode: exact positions a person chose to look up first, then the offline
 * sector or district. Recorded coordinates are never touched.
 */
export function placeByPostcode(graph: GraphDocument, data: PostcodeCentroids | null,
  exact: Record<string, [number, number]> = {}): { graph: GraphDocument; placed: number } {
  let placed = 0;
  const nodes = graph.nodes.map(node => {
    if (readAtlasLocation(node)) return node;
    const pc = recordPostcode(node);
    if (!pc) return node;
    const current = approximatePlace(node);
    const hit = exact[pc];
    let next: ApproximatePlace | null = null;
    if (hit) next = { latitude: hit[0], longitude: hit[1], precision: "postcode", method: "postcodes.io", from: pc };
    else if (!current && data) next = lookupPostcode(pc, data);
    if (!next || (current && current.precision === next.precision && current.from === next.from)) return node;
    placed++;
    return { ...node, properties: { ...(node.properties ?? {}), [APPROXIMATE_KEY]: next } };
  });
  return { graph: placed ? parseGraphDocument({ ...graph, nodes }) : graph, placed };
}

/** Describe an approximate place for the record panel. */
export function describeApproximatePlace(a: ApproximatePlace): string {
  const where = a.precision === "postcode" ? "postcode " + a.from
    : a.precision === "postcode sector" ? "the middle of postcode sector " + (postcodeParts(a.from)?.sector ?? a.from)
    : "the middle of postcode district " + (postcodeParts(a.from)?.district ?? a.from);
  return "Approximate · placed at " + where + (a.method === "postcodes.io" ? " (looked up with postcodes.io)" : "");
}
