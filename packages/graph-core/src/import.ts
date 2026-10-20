import { parseGraphDocument, type GraphDocument, type GraphNode, type GraphEdge, type NodeType } from "./schema";

export type ImportIssue = { severity: "warning" | "error"; message: string };
export type ImportFile = { name: string; text: string };
export type ImportPreview = {
  graph: GraphDocument | null;
  issues: ImportIssue[];
  source: "mossline" | "kumu" | "csv" | "unknown";
  counts: { nodes: number; edges: number };
};
type Row = Record<string, unknown>;
const types: Record<string, NodeType> = {
  organisation: "organisation", organization: "organisation", company: "organisation",
  charity: "organisation", project: "project", programme: "project", program: "project",
  initiative: "project", funder: "funder", foundation: "funder", donor: "funder",
  person: "person", people: "person", place: "place", location: "place", region: "place"
};
const value = (v: unknown): string => v == null ? "" : String(v).trim();
function field(row: Row, ...names: string[]): unknown {
  const key = Object.keys(row).find(k => names.includes(k.trim().toLowerCase()));
  return key === undefined ? undefined : row[key];
}
function webUrl(raw: unknown): string | undefined {
  const s = value(raw);
  try { if (["http:", "https:"].includes(new URL(s).protocol)) return s; } catch {}
  return undefined;
}
function tags(raw: unknown): string[] {
  return (Array.isArray(raw) ? raw : value(raw).split("|")).map(value).filter(Boolean);
}
const stable = (prefix: string, key: string) => prefix + ":" + encodeURIComponent(key);
const isWithheld = (row: Row): boolean => ["false","no","0","private"].includes(
  value(field(row,"public")).toLowerCase());

/** Handles RFC-style CSV quotes, escaped quotes, newlines and BOM. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else cell += c;
    } else if (c === '"') {
      if (cell.trim() || closed) throw new Error("Unexpected CSV quote near character " + (i + 1));
      quoted = true;
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(cell); cell = ""; closed = false;
      if (c !== ",") {
        if (row.some(x => x.trim())) rows.push(row);
        row = [];
        if (c === "\r" && text[i + 1] === "\n") i++;
      }
    } else {
      if (closed && !/\s/.test(c)) throw new Error("Characters after a quoted CSV field");
      cell += c;
    }
  }
  if (quoted) throw new Error("Unterminated CSV quoted field");
  row.push(cell);
  if (row.some(x => x.trim())) rows.push(row);
  return rows;
}
function csvTable(input: string): { headers: string[]; rows: Row[] } {
  const [headers, ...lines] = parseCsv(input);
  if (!headers?.length || !headers.some(x => x.trim())) throw new Error("Missing CSV headers");
  const normalised = headers.map(x => x.trim().toLowerCase());
  if (new Set(normalised).size !== headers.length) throw new Error("Duplicate CSV headers");
  return { headers: normalised, rows: lines.map((cells, i) => {
    if (cells.length > headers.length) throw new Error("CSV row " + (i + 2) + " has too many columns");
    return Object.fromEntries(headers.map((h, j) => [h.trim(), cells[j] ?? ""]));
  }) };
}

type SourcePosition = { fileName: string; recordNumber: number };
function convert(elements: Row[], connections: Row[], source: "kumu" | "csv",
  issues: ImportIssue[], title: string,
  locations?: WeakMap<Row, SourcePosition>): GraphDocument | null {
  const nodes: GraphNode[] = [], edges: GraphEdge[] = [];
  const used = new Set<string>(), byId = new Map<string,string>(), byLabel = new Map<string,string[]>();
  const rejectedUrls = { image: 0, nodeSource: 0, relationshipSource: 0 };
  const excludedRefs = new Set<string>();
  let privateNodes = 0, privateEdges = 0;
  for (const [index,row] of elements.entries()) {
    const label = value(field(row,"label","name")), original = value(field(row,"id"));
    if (isWithheld(row)) {
      privateNodes++;
      if (label) excludedRefs.add(label);
      if (original) excludedRefs.add(original);
      continue;
    }
    if (!label) { issues.push({severity:"error",message:"Element row " + (index+1) + " has no label"}); continue; }
    const id = stable(source, original ? "id:" + original : "label:" + label);
    if (used.has(id)) {
      issues.push({severity:"error",message:"Duplicate element identity: " + (original || label) + ". Supply unique IDs."}); continue;
    }
    used.add(id);
    if (original) byId.set(original,id);
    byLabel.set(label,[...(byLabel.get(label) ?? []),id]);
    const rawType = value(field(row,"element type","type"));
    const type = types[rawType.toLowerCase()] ?? "other";
    if (rawType && type === "other" && rawType.toLowerCase() !== "other")
      issues.push({severity:"warning",message:"Unrecognised type '" + rawType + "' on " + label + "; original retained"});
    const rawImage = field(row,"imageurl","image url","image");
    const rawSource = field(row,"sourceurl","source url","url","website");
    const imageUrl = webUrl(rawImage), sourceUrl = webUrl(rawSource);
    if (value(rawImage) && !imageUrl) rejectedUrls.image++;
    if (value(rawSource) && !sourceUrl) rejectedUrls.nodeSource++;
    nodes.push({
      id,label,type,description:value(field(row,"description")) || undefined,
      region:value(field(row,"region","geographic reach")) || undefined,
      tags:tags(field(row,"tags","topics")),
      imageUrl,sourceUrl,
      origin:{system:source,recordId:original || label,...locations?.get(row)},
      properties:{...row}
    });
  }
  const edgeKeys = new Map<string,number>();
  const originalEdgeIds = new Set<string>();
  function resolve(raw: unknown, row: number): string | null {
    const ref = value(raw);
    if (byId.has(ref)) return byId.get(ref)!;
    const labels = byLabel.get(ref) ?? [];
    if (labels.length === 1) return labels[0];
    if (!labels.length && excludedRefs.has(ref)) return null;
    issues.push({severity:"error",message:"Connection row " + (row+1) + ": " +
      (labels.length ? "ambiguous" : "missing") + " endpoint '" + ref + "'. Use unique IDs."});
    return null;
  }
  for (const [index,row] of connections.entries()) {
    if (isWithheld(row)) { privateEdges++; continue; }
    const from = resolve(field(row,"from","source"),index);
    const destinations = value(field(row,"to","target")).split("|").map(x => x.trim()).filter(Boolean);
    if (!destinations.length) {
      issues.push({severity:"error",message:"Connection row " + (index+1) + " has no To endpoint"}); continue;
    }
    const original = value(field(row,"id")), kind = value(field(row,"connection type","type")) || "connected";
    if (original) {
      if (originalEdgeIds.has(original)) issues.push({severity:"error",message:"Duplicate connection ID: " + original});
      originalEdgeIds.add(original);
    }
    const rawDirection = value(field(row,"direction")).toLowerCase();
    const direction = (["directed","undirected","mutual"] as const).find(x => x === rawDirection);
    if (rawDirection && !direction)
      issues.push({severity:"warning",message:"Unknown direction '" + rawDirection + "' retained in properties"});
    for (const [targetIndex,destination] of destinations.entries()) {
      const to = resolve(destination,index);
      if (!from || !to) {
        if (excludedRefs.has(value(field(row,"from","source"))) || excludedRefs.has(destination))
          privateEdges++;
        continue;
      }
      const key = original ? "id:" + original + ":" + targetIndex :
        "link:" + from + "|" + to + "|" + kind + "|" + rawDirection;
      const occurrence = edgeKeys.get(key) ?? 0;
      edgeKeys.set(key,occurrence+1);
      const rawSource = field(row,"sourceurl","source url","url");
      const sourceUrl = webUrl(rawSource);
      if (targetIndex === 0 && value(rawSource) && !sourceUrl) rejectedUrls.relationshipSource++;
      edges.push({
        id:stable(source + ":edge",key + ":" + occurrence),source:from,target:to,type:kind,
        direction,description:value(field(row,"description")) || undefined,
        sourceUrl,
        origin:{system:source,recordId:original || String(index+1) + ":" + targetIndex,
          ...locations?.get(row)},
        properties:{...row}
      });
    }
  }
  if (privateNodes || privateEdges) issues.push({severity:"warning",
    message:privateNodes+" non-public entities and "+privateEdges+
      " non-public or withheld-endpoint relationships were excluded by the Public field."});
  for (const [label,ids] of byLabel)
    if (ids.length > 1) issues.push({severity:"warning",message:"Duplicate label '" + label +
      "' requires connections to use element IDs"});
  for (const [kind, count] of [
    ["entity image URLs", rejectedUrls.image],
    ["entity source URLs", rejectedUrls.nodeSource],
    ["relationship source URLs", rejectedUrls.relationshipSource]
  ] as const) {
    if (count) issues.push({severity:"warning",message:count + " " + kind +
      " were not valid HTTP(S) URLs; original values remain in source properties."});
  }
  if (issues.some(i => i.severity === "error")) return null;
  return parseGraphDocument({version:1,title,description:"Imported from " + source.toUpperCase(),
    nodes,edges});
}

/** Preview only: caller must explicitly confirm replacing its current graph. */
export function previewImport(files: ImportFile[]): ImportPreview {
  const issues: ImportIssue[] = [];
  let source: ImportPreview["source"] = "unknown";
  let counts = {nodes:0,edges:0};
  const locations = new WeakMap<Row, SourcePosition>();
  const mark = (rows: Row[], fileName: string, start: number) => {
    rows.forEach((row, i) => locations.set(row, {fileName, recordNumber: start + i}));
  };
  try {
    if (!files.length) throw new Error("Choose at least one file");
    if (files.length === 1 && files[0].name.toLowerCase().endsWith(".json")) {
      const data: unknown = JSON.parse(files[0].text);
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Expected a JSON object");
      const obj = data as Row;
      if (obj.version === 1 && Array.isArray(obj.nodes) && Array.isArray(obj.edges)) {
        source = "mossline";
        const graph = parseGraphDocument(data);
        return {graph,issues,source,counts:{nodes:graph.nodes.length,edges:graph.edges.length}};
      }
      source = "kumu";
      if (!Array.isArray(obj.elements) || !Array.isArray(obj.connections))
        throw new Error("Unsupported Kumu backup structure. Expected blueprint arrays 'elements' and 'connections'.");
      const elements = obj.elements as Row[], connections = obj.connections as Row[];
      if (elements.length===0 && connections.length===0) {
        const maps = Array.isArray(obj.maps) ? obj.maps as Row[] : [];
        const linkedSheets = maps.some(m => typeof m.src==="string" &&
          m.src.toLowerCase().startsWith("auth:googlesheets:"));
        issues.push({severity:"error",message:linkedSheets ?
          "This Kumu export contains configuration but no elements or connections. The map is backed by linked Google Sheets: export its data tabs as CSV to build the network. Your current Mossline map has not been changed." :
          "This Kumu project contains no embedded entities or connections. Import is blocked to prevent replacing your map with an empty graph."});
        return {graph:null,issues,source,counts};
      }
      if (![...elements,...connections].every(x => x && typeof x === "object" && !Array.isArray(x)))
        throw new Error("Kumu elements and connections must be objects");
      counts = {nodes:elements.length,edges:connections.length};
      mark(elements,files[0].name,1); mark(connections,files[0].name,1);
      const extra = Object.keys(obj).filter(k => !["elements","connections"].includes(k));
      const recognised = new Set(["version","name","description","proxyImages","defaultMap","defaultPerspective",
        "attributeRelevance","attributes","elements","connections","loops","maps","perspectives"]);
      const omitted = extra.filter(k => !recognised.has(k));
      if (Array.isArray(obj.perspectives) && obj.perspectives.length)
        issues.push({severity:"warning",message:obj.perspectives.length +
          " Kumu perspectives and their CSS styling cannot yet be converted; preserve this file."});
      if (Array.isArray(obj.maps) && obj.maps.length)
        issues.push({severity:"warning",message:"Map settings and linked sources are configuration only; map styling is not imported."});
      if (omitted.length) issues.push({severity:"warning",message:"Unrecognised top-level fields: " +
        omitted.join(", ") + ". Retain the original backup."});
      const graph = convert(elements,connections,"kumu",issues,
        files[0].name.replace(/\.json$/i,""),locations);
      return {graph,issues,source,counts:graph ? {nodes:graph.nodes.length,edges:graph.edges.length} : counts};
    }
    source = "csv";
    if (files.some(f => !f.name.toLowerCase().endsWith(".csv")))
      throw new Error("Choose one JSON file or one/more CSV files, not mixed types");
    const elements: Row[] = [], connections: Row[] = [];
    for (const file of files) {
      const table = csvTable(file.text), keys = new Set(table.headers);
      if (keys.has("from") && keys.has("to")) {
        mark(table.rows,file.name,2);
        connections.push(...table.rows);
      } else if (keys.has("label") || keys.has("name")) {
        mark(table.rows,file.name,2);
        elements.push(...table.rows);
      }
      else throw new Error(file.name + ": expected Label or From,To column headings");
    }
    if (!elements.length) throw new Error("An elements CSV is required to resolve connection endpoints");
    if (!connections.length) issues.push({severity:"warning",message:"No connections supplied: map will contain entities only"});
    counts = {nodes:elements.length,edges:connections.length};
    const graph = convert(elements,connections,"csv",issues,"Imported landscape",locations);
    return {graph,issues,source,counts:graph ? {nodes:graph.nodes.length,edges:graph.edges.length} : counts};
  } catch (error) {
    issues.push({severity:"error",message:error instanceof Error ? error.message : "Unrecognised input"});
  }
  return {graph:null,issues,source,counts};
}
