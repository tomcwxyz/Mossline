import { fundingFlows, type FundingFlow } from "./field-atlas";
import type { GraphDocument, GraphNode } from "./schema";
import { approximatePlace, postcodeParts, recordPostcode } from "./sources/places";

/**
 * Ways to group records for the Themes lens, the Funding lens's middle column
 * and Timeline rows. Source groupings (tags, programme, funder, place) come
 * from what the data records. Topics are suggested by Mossline from words in
 * titles and descriptions: a hypothesis, always labelled as such.
 */
export type GroupingKind = "tags" | "topics" | "programme" | "funder" | "place";
export interface GroupingOption {
  kind: GroupingKind; label: string; note: string;
  /** Records the grouping places somewhere. */
  covered: number; groups: number; suggested: boolean;
}
export interface Grouping {
  kind: GroupingKind; suggested: boolean;
  /** Group of each record that has one. */
  of: Map<string, string>;
  /** Largest first. */
  groups: { name: string; count: number }[];
  /** Why a record is in its group, for the record panel (topics only). */
  why: Map<string, string[]>;
}

/* ---- Topics: a small, readable guide to what grants are for ---------------- */
const T = (topic: string, ...terms: string[]) => ({ topic, re: terms.map(t => new RegExp("\\b" + t, "i")) });
const TOPICS = [
  T("Young people", "youth", "young (?:people|person|adults?)", "teenag", "adolescen", "young carers"),
  T("Children and families", "child", "famil", "parent", "early years", "bab(?:y|ies)", "toddler", "nurser", "holiday activit"),
  T("Older people", "older (?:people|person|adults?)", "elderly", "later life", "pensioner", "dementia"),
  T("Mental health and wellbeing", "mental health", "wellbeing", "well-being", "loneliness", "isolat", "counsell", "suicid", "anxiety", "depression"),
  T("Health and care", "health(?!y)", "hospice", "palliative", "cancer", "disease", "clinic", "patients?\\b", "nhs\\b"),
  T("Carers", "carers?\\b", "respite", "caring\\b"),
  T("Disability", "disab", "deaf", "blind", "sight loss", "autis", "learning difficult", "wheelchair", "accessib"),
  T("Food", "food", "meals?\\b", "larder", "pantry", "hunger", "nutrition", "cook", "kitchen"),
  T("Money and cost of living", "povert", "cost of living", "hardship", "debt", "money advice", "financial inclusion", "fuel", "credit union", "welfare benefit"),
  T("Housing and homelessness", "homeless", "housing", "rough sleep", "tenan", "shelter"),
  T("Work and skills", "employ", "jobs?\\b", "skills", "training", "apprentic", "into work", "volunteering"),
  T("Education and learning", "school", "educat", "learning", "literacy", "numeracy", "tutor", "pupil", "students?\\b", "esol"),
  T("Arts and culture", "arts?\\b", "artist", "music", "theatre", "dance", "film", "museum", "creative", "festival", "choir", "gallery", "culture", "cultural"),
  T("Heritage", "heritage", "histor", "archive", "museum"),
  T("Sport and activity", "sport", "football", "cricket", "rugby", "swim", "physical activity", "exercise", "fitness", "boxing", "athletic", "cycling", "walking group"),
  T("Environment and nature", "environment", "climate", "nature", "wildlife", "trees?\\b", "garden", "conservation", "green space", "allotment", "recycl", "sustainab", "biodiversity", "energy"),
  T("Community buildings", "community (?:centre|building|hall|space)", "village hall", "church hall", "building", "refurbish", "premises", "repairs?\\b"),
  T("Safety and abuse", "domestic abuse", "domestic violence", "abuse", "exploitation", "violence", "victims?\\b", "safe space"),
  T("Refugees and migration", "refugee", "asylum", "migrant", "resettle"),
  T("Justice", "prison", "offend", "criminal justice", "probation", "ex-offender"),
  T("Addiction and recovery", "addiction", "alcohol", "drugs?\\b", "substance", "recovery"),
  T("Equality and inclusion", "lgbt", "women", "girls", "equalit", "inclusion", "racial", "ethnic minorit", "black\\b", "faith"),
  T("Digital", "digital", "online", "computer", "internet", "technolog"),
  T("Advice and advocacy", "advice", "advocacy", "legal", "rights\\b", "information service"),
  T("Running costs", "core costs?", "running costs", "core funding", "salar", "staff costs", "unrestricted", "overheads", "coordinator")
];
/** Topics a piece of text mentions, most mentioned first, with the words that matched. */
export function suggestTopics(text: string): { topic: string; words: string[] }[] {
  if (!text.trim()) return [];
  const out: { topic: string; words: string[]; n: number; order: number }[] = [];
  TOPICS.forEach(({ topic, re }, order) => {
    const words: string[] = [];
    for (const r of re) { const m = text.match(r); if (m) words.push(m[0].toLowerCase()); }
    if (words.length) out.push({ topic, words, n: words.length, order });
  });
  return out.sort((a, b) => b.n - a.n || a.order - b.order).map(({ topic, words }) => ({ topic, words }));
}
export const TOPIC_NAMES = TOPICS.map(t => t.topic);

/* ---- Postcode areas: the letters of a postcode name its area --------------- */
const AREAS: Record<string, string> = {
  AB: "Aberdeen", AL: "St Albans", B: "Birmingham", BA: "Bath", BB: "Blackburn", BD: "Bradford", BH: "Bournemouth", BL: "Bolton",
  BN: "Brighton", BR: "Bromley", BS: "Bristol", BT: "Belfast", CA: "Carlisle", CB: "Cambridge", CF: "Cardiff", CH: "Chester",
  CM: "Chelmsford", CO: "Colchester", CR: "Croydon", CT: "Canterbury", CV: "Coventry", CW: "Crewe", DA: "Dartford", DD: "Dundee",
  DE: "Derby", DG: "Dumfries", DH: "Durham", DL: "Darlington", DN: "Doncaster", DT: "Dorchester", DY: "Dudley", E: "East London",
  EC: "Central London", EH: "Edinburgh", EN: "Enfield", EX: "Exeter", FK: "Falkirk", FY: "Blackpool", G: "Glasgow", GL: "Gloucester",
  GU: "Guildford", HA: "Harrow", HD: "Huddersfield", HG: "Harrogate", HP: "Hemel Hempstead", HR: "Hereford", HS: "Outer Hebrides",
  HU: "Hull", HX: "Halifax", IG: "Ilford", IP: "Ipswich", IV: "Inverness", KA: "Kilmarnock", KT: "Kingston upon Thames", KW: "Kirkwall",
  KY: "Kirkcaldy", L: "Liverpool", LA: "Lancaster", LD: "Llandrindod Wells", LE: "Leicester", LL: "Llandudno", LN: "Lincoln", LS: "Leeds",
  LU: "Luton", M: "Manchester", ME: "Medway", MK: "Milton Keynes", ML: "Motherwell", N: "North London", NE: "Newcastle upon Tyne",
  NG: "Nottingham", NN: "Northampton", NP: "Newport", NR: "Norwich", NW: "North West London", OL: "Oldham", OX: "Oxford", PA: "Paisley",
  PE: "Peterborough", PH: "Perth", PL: "Plymouth", PO: "Portsmouth", PR: "Preston", RG: "Reading", RH: "Redhill", RM: "Romford",
  S: "Sheffield", SA: "Swansea", SE: "South East London", SG: "Stevenage", SK: "Stockport", SL: "Slough", SM: "Sutton", SN: "Swindon",
  SO: "Southampton", SP: "Salisbury", SR: "Sunderland", SS: "Southend-on-Sea", ST: "Stoke-on-Trent", SW: "South West London",
  SY: "Shrewsbury", TA: "Taunton", TD: "Galashiels", TF: "Telford", TN: "Tonbridge", TQ: "Torquay", TR: "Truro", TS: "Teesside",
  TW: "Twickenham", UB: "Southall", W: "West London", WA: "Warrington", WC: "Central London", WD: "Watford", WF: "Wakefield",
  WN: "Wigan", WR: "Worcester", WS: "Walsall", WV: "Wolverhampton", YO: "York", ZE: "Shetland"
};
/** "NE46 1AB" → "Newcastle upon Tyne (NE)": a fact about the postcode itself. */
export function postcodeAreaName(postcode: string): string {
  const parts = postcodeParts(postcode);
  const letters = parts?.district.match(/^[A-Z]+/)?.[0];
  return letters && AREAS[letters] ? AREAS[letters] + " (" + letters + ")" : "";
}
/** Where a record is, as words: its recorded region, else the town or area its own postcode is in. */
export function placeName(node: GraphNode): string {
  if (node.region) return node.region;
  const approx = approximatePlace(node);
  if (approx?.town) return approx.town;
  const pc = recordPostcode(node);
  return pc ? postcodeAreaName(pc) : "";
}

/* ---- Grouping records ----------------------------------------------------- */
const isGrant = (n: GraphNode) => n.properties?.mosslineFundingGrant === true;
function textOf(n: GraphNode) { return [n.label.replace(/^Grant to /i, ""), n.description ?? ""].join(". "); }
function majority(values: string[]): string | undefined {
  const m = new Map<string, number>();
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

/**
 * Group every record. Grants are grouped by what they record; organisations
 * by the grants they received (their main programme, funder or topic), so a
 * map of grants reads by subject even where organisations carry no tags.
 */
export function groupRecords(graph: GraphDocument, kind: GroupingKind, flows: FundingFlow[] = fundingFlows(graph)): Grouping {
  const of = new Map<string, string>(), why = new Map<string, string[]>();
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const received = new Map<string, FundingFlow[]>();
  for (const f of flows) received.set(f.recipientId, [...(received.get(f.recipientId) ?? []), f]);
  const tagCount = new Map<string, number>();
  if (kind === "tags") for (const n of graph.nodes) for (const t of new Set(n.tags)) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const topicsOf = new Map<string, { topic: string; words: string[] }[]>();
  const topics = (n: GraphNode) => { let t = topicsOf.get(n.id); if (!t) { t = suggestTopics(textOf(n)); topicsOf.set(n.id, t); } return t; };

  for (const n of graph.nodes) {
    const grants = (received.get(n.id) ?? []).map(f => f.grantId ? byId.get(f.grantId) : undefined).filter((g): g is GraphNode => !!g);
    let group: string | undefined;
    if (kind === "tags") {
      group = n.tags.length ? [...new Set(n.tags)].sort((a, b) => (tagCount.get(b) ?? 0) - (tagCount.get(a) ?? 0) || a.localeCompare(b))[0] : undefined;
    } else if (kind === "programme") {
      const own = typeof n.properties?.programme === "string" ? n.properties.programme as string : undefined;
      group = own || majority(grants.map(g => String(g.properties?.programme ?? "")));
    } else if (kind === "funder") {
      if (n.type === "funder") group = n.label;
      else if (isGrant(n)) group = byId.get(String(n.properties?.funderId ?? ""))?.label;
      else group = majority((received.get(n.id) ?? []).map(f => byId.get(f.funderId)?.label ?? ""));
    } else if (kind === "place") {
      group = placeName(n) || (isGrant(n) ? placeName(byId.get(String(n.properties?.recipientId ?? "")) ?? n) : "") || undefined;
    } else if (n.type !== "funder") {
      // Topics: a record's own words first; an organisation without any takes the topic most of its grants share.
      const own = topics(n);
      if (own.length) { group = own[0].topic; why.set(n.id, own[0].words); }
      else {
        const fromGrants = grants.map(g => topics(g)[0]?.topic ?? "");
        group = majority(fromGrants);
        if (group) why.set(n.id, ["through " + fromGrants.filter(t => t === group).length + " of its grants"]);
      }
    }
    if (group) of.set(n.id, group);
  }
  const counts = new Map<string, number>();
  for (const g of of.values()) counts.set(g, (counts.get(g) ?? 0) + 1);
  return { kind, suggested: kind === "topics", of, why,
    groups: [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)) };
}

const LABELS: Record<GroupingKind, [string, string]> = {
  tags: ["Source tags", "Tags and classifications in your files"],
  programme: ["Programme", "The grant programme each award was made under"],
  funder: ["Main funder", "Who funded each record most often"],
  place: ["Place", "Region in your files, or the town of a record's own postcode"],
  topics: ["Suggested topics", "Suggested by Mossline from words in titles and descriptions. Not in your source; check before relying on it"]
};
/** Which groupings this map can support, and how much of it each covers. */
export function groupingOptions(graph: GraphDocument, flows: FundingFlow[] = fundingFlows(graph)): GroupingOption[] {
  const kinds: GroupingKind[] = ["tags", "programme", "place", "funder", "topics"];
  return kinds.map(kind => {
    const g = groupRecords(graph, kind, flows);
    return { kind, label: LABELS[kind][0], note: LABELS[kind][1], covered: g.of.size, groups: g.groups.length, suggested: kind === "topics" };
  }).filter(o => o.groups > 0 && !(o.kind === "funder" && !flows.length));
}
/** Source groupings first, when they cover enough of the map to be useful. */
export function defaultGrouping(options: GroupingOption[], total: number): GroupingKind {
  const useful = (o: GroupingOption) => o.covered >= total * 0.3 && o.groups >= 2 && o.groups <= Math.max(60, total * 0.05);
  for (const kind of ["tags", "programme"] as GroupingKind[]) {
    const o = options.find(x => x.kind === kind);
    if (o && useful(o)) return kind;
  }
  if (options.some(o => o.kind === "topics" && o.covered >= total * 0.2)) return "topics";
  return options[0]?.kind ?? "tags";
}
