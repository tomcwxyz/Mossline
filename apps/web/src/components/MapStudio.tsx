"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  auditGraph, collaborationGraph, explainRelationship, filterGraph, graphFingerprint, parseGraphDocument, parsePerspectives,
  previewImport, discoverData, findRecordedRoutes, findStructuralJunctions,
  type ImportPreview, type ImportFile, type DataDiscovery, type MappedPreview,
  type GraphDocument, type GraphEdge, type GraphNode, type GraphAudit, type EvidencePath, type ConnectionTrail,
  type NodeType, type CollaborationBasis, type SavedPerspective
} from "@mossline/graph-core";
import { GraphCanvas, type LabelDensity, type NetworkLayout } from "./GraphCanvas";
import { DataMappingWorkbench } from "./DataMappingWorkbench";
import demo from "../../../../data/demo.json";

const TYPE_LABELS: Record<NodeType, string> = {
  organisation: "Organisations", project: "Projects", funder: "Funders",
  person: "People", place: "Places", other: "Other"
};
const TYPE_KEYS = Object.keys(TYPE_LABELS) as NodeType[];
const ORIGINAL = parseGraphDocument(demo);
const STORAGE_KEY = "mossline-demo-graph-v1";
const SAVED_KEY = "mossline-perspectives-v1";
const DEMO_KEY = graphFingerprint(ORIGINAL);
type ViewMode = "landscape" | "collaborations";

function saveJson(graph: GraphDocument) {
  const blob = new Blob([JSON.stringify(graph, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "mossline-map.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function CoverageReport({ graph }: { graph: GraphDocument }) {
  const audit: GraphAudit = useMemo(() => auditGraph(graph), [graph]);
  const { coverage, totals } = audit;
  return <div className="coverage-report">
    <p className="coverage-disclaimer">Coverage describes fields in this dataset; it is not an assessment of truth, accuracy or impact.</p>
    <div className="coverage-grid">
      <div><strong>{totals.nodes}</strong><span>Entities</span></div>
      <div><strong>{totals.recorded}</strong><span>Recorded links</span></div>
      <div><strong>{coverage.nodesWithOrigin} / {totals.nodes}</strong><span>Entities with source ID</span></div>
      <div><strong>{coverage.relationshipsWithOrigin} / {totals.relationships}</strong><span>Links with source ID</span></div>
      <div><strong>{coverage.nodesWithDescription} / {totals.nodes}</strong><span>Descriptions</span></div>
      <div><strong>{coverage.nodesWithRegion} / {totals.nodes}</strong><span>Regions</span></div>
    </div>
    <div className="coverage-details">
      <p><strong>{audit.isolated.length}</strong> entities without a connection in this dataset</p>
      <p><strong>{audit.duplicateLabels.length}</strong> labels shared by more than one entity</p>
      <p><strong>{audit.categories.other}</strong> entities classified as Other</p>
      {audit.isolated.length > 0 && <details>
        <summary>Show unconnected entities</summary>
        <ul>{audit.isolated.slice(0,15).map(n=><li key={n.id}>{n.label}</li>)}</ul>
        {audit.isolated.length>15 && <p>Showing the first 15; use the source dataset for the full list.</p>}
      </details>}
      {audit.duplicateLabels.length > 0 && <details>
        <summary>Show repeated labels</summary>
        <ul>{audit.duplicateLabels.slice(0,15).map(group=><li key={group.label}>
          {group.label} ({group.ids.length} entities)
        </li>)}</ul>
      </details>}
      {audit.sources.length > 0 && <details>
        <summary>Source files and record counts</summary>
        <ul>{audit.sources.map(source=><li key={source.system+":"+source.fileName}>
          {source.fileName ?? source.system.toUpperCase()} · {source.nodes} entities · {source.relationships} links
        </li>)}</ul>
        <p>CSV references use logical record numbers, not physical line numbers. Kumu references use array positions.</p>
      </details>}
    </div>
  </div>;
}

function NodeInspector({ node, graph, source, onPick, onPickEdge }: {
  node: GraphNode;
  graph: GraphDocument;
  source: GraphDocument;
  onPick: (id: string) => void;
  onPickEdge: (id: string) => void;
}) {
  const related = graph.edges.filter(e => e.source === node.id || e.target === node.id);
  const links = related.flatMap(edge => {
    const neighbour = graph.nodes.find(item => item.id === (edge.source === node.id ? edge.target : edge.source));
    return neighbour ? [{ neighbour, edge }] : [];
  });
  return <div className="inspector-inner">
    <div className={"inspector-cover " + node.type}>
      {node.imageUrl ? <img src={node.imageUrl} alt="" referrerPolicy="no-referrer" loading="lazy" /> :
        <div className="inspector-cover-art" aria-hidden="true">✳</div>}
      <span>{node.type}</span>
    </div>
    <p className="eyebrow">{node.type}{node.region ? " · " + node.region : ""}</p>
    <h2>{node.label}</h2>
    <p className="description">{node.description ?? "No description yet. Add context to your data source."}</p>
    <div className="inspector-stats">
      <div><strong>{related.filter(e=>!e.inferred).length}</strong><small>Recorded links</small></div>
      <div><strong>{related.filter(e=>e.inferred).length}</strong><small>Shared associations</small></div>
    </div>
    {node.tags.length>0 && <div className="inspector-tags">{node.tags.map(tag=>
      <span key={tag}>{tag}</span>)}</div>}
    {node.sourceUrl && <a href={node.sourceUrl} target="_blank" rel="noreferrer">View source ↗</a>}
    {node.origin && <p className="help">Imported from {node.origin.system.toUpperCase()} · source record {node.origin.recordId}
      {node.origin.fileName && <> · file {node.origin.fileName}</>}
      {node.origin.recordNumber && <> · record {node.origin.recordNumber}</>}
    </p>}
    {node.properties && Object.keys(node.properties).length > 0 && <details className="original-fields">
      <summary>Original source fields ({Object.keys(node.properties).length})</summary>
      <dl>{Object.entries(node.properties).map(([key,value]) =>
        <div key={key}><dt>{key}</dt><dd>{typeof value === "string" ? value : JSON.stringify(value) ?? "—"}</dd></div>)}</dl>
    </details>}
    <div className="inspector-section">
      <p className="eyebrow">Relationships · {links.length}</p>
      {links.length === 0 && <p className="muted">No connected entities in the current map.</p>}
      {links.map(({neighbour, edge}) => {
        const supporting = (edge.evidenceNodeIds ?? []).map(id => source.nodes.find(n => n.id === id)?.label ?? id).join(", ");
        return <div className="relation-row" key={edge.id}>
          <button className="relation" onClick={() => onPick(neighbour.id)}>
            <span className={"small-dot " + neighbour.type} />
            <span><strong>{neighbour.label}</strong><small>{edge.type}{edge.inferred ? " · inferred" : ""}</small>
              {supporting && <small>Shared through: {supporting}</small>}
            </span>
            <span aria-hidden="true">↗</span>
          </button>
          <button className="relation-evidence" onClick={() => onPickEdge(edge.id)}
            aria-label={"Explain relationship with " + neighbour.label}>Why?</button>
        </div>;
      })}
    </div>
  </div>;
}

function EvidenceTrail({ path, source }: { path: EvidencePath | null; source: GraphDocument }) {
  if (!path) return <p className="relationship-unresolved">No supporting source-record path found.</p>;
  const names = new Map(source.nodes.map(n => [n.id, n.label]));
  const edges = new Map(source.edges.map(e => [e.id, e.type]));
  return <ol className="relationship-trail">
    {path.nodeIds.map((id, index) => <li key={id + "-" + index}>
      {index > 0 && <span className="trail-verb">{edges.get(path.edgeIds[index - 1]) ?? "linked to"}</span>}
      <span>{names.get(id) ?? id}</span>
    </li>)}
  </ol>;
}

function RelationshipInspector({ edge, source, onPick, onEvidence }: {
  edge: GraphEdge;
  source: GraphDocument;
  onPick: (id: string) => void;
  onEvidence: (id: string) => void;
}) {
  const explanation = explainRelationship(source, edge);
  return <div className="inspector-inner relationship-inspector">
    <div className="relationship-header-illustration" aria-hidden="true"><span>◎</span></div>
    <p className="eyebrow">Why are these connected?</p>
    <h2>{explanation.status === "inferred" ? "A shared association." : "A recorded relationship."}</h2>
    <div className="relationship-parties">
      <button type="button" onClick={() => onPick(edge.source)}>{explanation.source?.label ?? edge.source}</button>
      <span aria-hidden="true">↔</span>
      <button type="button" onClick={() => onPick(edge.target)}>{explanation.target?.label ?? edge.target}</button>
    </div>
    <div className={"relationship-status " + explanation.status}>
      {explanation.status === "inferred" ? "Inferred from source records" : "Recorded in dataset"}
    </div>
    <p className="description">{explanation.summary}</p>
    {edge.description && <p className="description">{edge.description}</p>}
    {explanation.status === "recorded" ? <>
      <div className="relationship-facts">
        <p><strong>Relationship</strong> {edge.type}</p>
        <p><strong>Direction</strong> {edge.direction ?? "directed"}</p>
        {edge.origin && <p><strong>Source record</strong> {edge.origin.system.toUpperCase()} · {edge.origin.recordId}
          {edge.origin.fileName && <> · {edge.origin.fileName}</>}
          {edge.origin.recordNumber && <> · record {edge.origin.recordNumber}</>}
        </p>}
      </div>
      {edge.sourceUrl && <a href={edge.sourceUrl} target="_blank" rel="noreferrer">Inspect source record ↗</a>}
      {edge.properties && Object.keys(edge.properties).length > 0 &&
        <details className="original-fields">
          <summary>Original relationship fields</summary>
          <dl>{Object.entries(edge.properties).map(([key, value]) => <div key={key}>
            <dt>{key}</dt><dd>{typeof value === "string" ? value : JSON.stringify(value) ?? "—"}</dd>
          </div>)}</dl>
        </details>}
    </> : <>
      <div className="inspector-section">
        <p className="eyebrow">Supporting records · {explanation.supports.length}</p>
        {explanation.supports.length === 0 &&
          <p className="relationship-unresolved">This association has no supporting record IDs. Treat it as unsubstantiated.</p>}
        {explanation.supports.map(support => <section key={support.nodeId} className="evidence-card">
          <p className="evidence-kind">{support.type}</p>
          <h3>{support.label}</h3>
          <div className="evidence-side"><p>First entity’s path</p><EvidenceTrail path={support.fromSource} source={source}/></div>
          <div className="evidence-side"><p>Second entity’s path</p><EvidenceTrail path={support.fromTarget} source={source}/></div>
          <button type="button" className="evidence-explore" onClick={() => onEvidence(support.nodeId)}>
            Explore {support.type} in the landscape ↗
          </button>
        </section>)}
      </div>
    </>}
    <p className="relationship-caveat">This view explains the records present in Mossline. It does not verify the underlying claims.</p>
  </div>;
}

export function MapStudio() {
  const [graph, setGraph] = useState<GraphDocument>(ORIGINAL);
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<NodeType[]>(TYPE_KEYS);
  const [context, setContext] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [traceFrom, setTraceFrom] = useState("");
  const [traceTo, setTraceTo] = useState("");
  const [connectionTrails, setConnectionTrails] = useState<ConnectionTrail[]>([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [excludedRelationType, setExcludedRelationType] = useState("");
  const [showJunctions, setShowJunctions] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("");
  const connectionTrail = connectionTrails[activeRouteIndex] ?? null;
  const [view, setView] = useState<ViewMode>("landscape");
  const [basis, setBasis] = useState<CollaborationBasis>("all");
  const [region, setRegion] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<NetworkLayout>("organic");
  const [labelDensity, setLabelDensity] = useState<LabelDensity>("essential");
  const [perspectives, setPerspectives] = useState<SavedPerspective[]>([]);
  const [showSave, setShowSave] = useState(false);
  const [newName, setNewName] = useState("");
  const [notice, setNotice] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [discovery, setDiscovery] = useState<DataDiscovery | null>(null);
  const [mappingFile, setMappingFile] = useState<ImportFile | null>(null);
  const [mappingSession, setMappingSession] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setGraph(parseGraphDocument(JSON.parse(saved)));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    try {
      const saved=window.localStorage.getItem(SAVED_KEY);
      if(saved) setPerspectives(parsePerspectives(JSON.parse(saved)));
    } catch { window.localStorage.removeItem(SAVED_KEY); }
  }, []);
  const graphKey=useMemo(()=>graphFingerprint(graph),[graph]);
  const savedForMap=useMemo(()=>perspectives.filter(p=>p.graphKey===graphKey)
    .sort((a,b)=>b.createdAt-a.createdAt),[perspectives,graphKey]);
  const current = useMemo(() => view === "collaborations" ? collaborationGraph(graph, basis) : graph, [graph, view, basis]);
  const activeTypes = view === "collaborations" ? (["organisation"] as NodeType[]) : types;
  const filtered = useMemo(() => filterGraph(current, {
    types: activeTypes, query, region, focusId, includeNeighbours: context
  }), [current, activeTypes.join("|"), query, region, focusId, context]);
  const selected = filtered.graph.nodes.find(n => n.id === selectedId) ?? null;
  const selectedEdge = filtered.graph.edges.find(e => e.id === selectedEdgeId) ?? null;
  function pickNode(id: string | null) {
    setSelectedId(id);
    setSelectedEdgeId(null);
  }
  function pickEdge(id: string) {
    setSelectedId(null);
    setSelectedEdgeId(id);
  }
  function exploreEvidence(id: string) {
    // Evidence objects are not included in an organisation-only collaboration projection.
    setView("landscape"); setTypes(TYPE_KEYS); setRegion(""); setQuery(""); setFocusId(null);
    setContext(true); setSelectedEdgeId(null); setSelectedId(id);
  }
  const names = useMemo(() => new Map(graph.nodes.map(n => [n.id, n.label])), [graph]);
  const entityOptions = useMemo(() => [...graph.nodes].sort((a,b) => a.label.localeCompare(b.label)), [graph]);
  const relationTypes = useMemo(() => [...new Set(graph.edges.filter(e=>!e.inferred).map(e=>e.type))].sort(), [graph]);
  const junctions = useMemo(() => findStructuralJunctions(graph), [graph]);
  const featuredJunctions = useMemo(() => junctions.filter(item =>
    ["organisation","project"].includes(graph.nodes.find(n=>n.id===item.nodeId)?.type ?? "")).slice(0,6),
  [junctions,graph]);
  function traceEntities(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = findRecordedRoutes(graph, traceFrom, traceTo, {
      maxHops: 5, maxRoutes: 3, excludeTypes: excludedRelationType ? [excludedRelationType] : []
    });
    setConnectionTrails(found);
    setActiveRouteIndex(0);
    if (!found.length) {
      setConnectionMessage("No recorded path within five steps was found with these settings. This does not prove the entities are unrelated.");
      return;
    }
    setConnectionMessage(found[0].steps.length === 0 ? "You've selected the same entity twice." :
      "Up to three alternative routes are shown, shortest first. These are source-record pathways, not proof of collaboration.");
    setView("landscape"); setQuery(""); setRegion(""); setTypes(TYPE_KEYS);
    setContext(true); setFocusId(null); setSelectedId(null); setSelectedEdgeId(null);
  }
  function clearTrail() {
    setConnectionTrails([]); setActiveRouteIndex(0); setConnectionMessage("");
  }
  function exploreJunction(id: string) {
    setView("landscape");setQuery("");setRegion("");setTypes(TYPE_KEYS);
    setContext(true);setFocusId(null);pickNode(id);clearTrail();
  }
  const regions = useMemo(() => [...new Set(graph.nodes.map(n => n.region).filter((v): v is string => !!v))].sort(), [graph]);
  const hubs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of filtered.graph.edges) {
      counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
      counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
    }
    return filtered.graph.nodes
      .filter(n => n.type === "organisation" || n.type === "project")
      .map(node => ({ node, connections: counts.get(node.id) ?? 0 }))
      .filter(item => item.connections > 0)
      .sort((a, b) => b.connections - a.connections || a.node.label.localeCompare(b.node.label))
      .slice(0, 5);
  }, [filtered.graph]);
  const totalTypes = useMemo(() => TYPE_KEYS.map(type => ({
    type, count: graph.nodes.filter(n => n.type === type).length
  })), [graph]);

  function toggleType(type: NodeType) {
    setSelectedId(null);setSelectedEdgeId(null);
    setTypes(previous => previous.includes(type) ? previous.filter(v => v !== type) : [...previous, type]);
  }

  function savePerspectives(next: SavedPerspective[]) {
    try {
      window.localStorage.setItem(SAVED_KEY,JSON.stringify(next));
      setPerspectives(next);
      return true;
    } catch { setNotice("Unable to save views in browser storage."); return false; }
  }

  function saveCurrentPerspective(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name=newName.trim().slice(0,60);
    if(!name) return;
    if(perspectives.length>=40){setNotice("40 saved views is the current local limit.");return;}
    const record:SavedPerspective={
      id:crypto.randomUUID(),name,graphKey,view,basis,region,query:query.slice(0,200),
      types:[...types],context,layout:layoutMode,labels:labelDensity,createdAt:Date.now()
    };
    if(savePerspectives([...perspectives,record])){
      setShowSave(false);setNewName("");
      setNotice("Saved perspective ‘"+name+"’ in this browser.");
    }
  }

  function openPerspective(item: SavedPerspective) {
    if(item.graphKey!==graphKey) return;
    setView(item.view);setBasis(item.basis);setRegion(item.region);setQuery(item.query);
    setTypes(item.types);setContext(item.context);setLayoutMode(item.layout);
    setLabelDensity(item.labels);setSelectedId(null);setSelectedEdgeId(null);setFocusId(null);
    setNotice("Opened ‘"+item.name+"’. Source data is unchanged.");
  }

  function updateGraph(next: GraphDocument) {
    setGraph(next);
    setSelectedId(null);
    setSelectedEdgeId(null);
    setConnectionTrails([]);
    setActiveRouteIndex(0);
    setConnectionMessage("");
    setTraceFrom("");
    setTraceTo("");
    setExcludedRelationType("");
    setQuery("");
    setView("landscape");
    setRegion("");
    setFocusId(null);
    setTypes(TYPE_KEYS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async function onImport(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    try {
      const input = await Promise.all(files.map(async file => ({name:file.name,text:await file.text()})));
      const analysis = input.length===1 ? discoverData(input[0]) : null;
      setDiscovery(analysis);
      setMappingFile(analysis?.kind==="csv-table" ? input[0] : null);
      setMappingSession(previous=>previous+1);
      setImportPreview(analysis?.kind==="csv-table" ? null : previewImport(input));
      setNotice("");
    } catch (error) {
      setImportPreview(null);
      setDiscovery(null);
      setMappingFile(null);
      setNotice("Import failed: " + (error instanceof Error ? error.message : "unable to read files"));
    }
  }

  function previewMappedGraph(result: MappedPreview) {
    setImportPreview({
      graph:result.graph, issues:result.issues,source:"csv",
      counts:{nodes:result.counts.nodes,edges:result.counts.edges}
    });
  }

  function closeImport() {
    setImportPreview(null);setDiscovery(null);setMappingFile(null);
  }

  function applyImport() {
    const preview = importPreview;
    if (!preview?.graph || preview.issues.some(i => i.severity === "error")) return;
    updateGraph(preview.graph);
    setNotice("Loaded " + preview.graph.nodes.length + " entities and " + preview.graph.edges.length +
      " relationships. Changes stay in this browser.");
    closeImport();
  }

  function resetDemo() {
    updateGraph(ORIGINAL);
    setNotice("Illustrative landscape restored.");
  }

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">✳</span><span>mossline<span className="brand-period">.</span></span><small>alpha 0.8</small></div>
      <div className="topbar-right"><span className="local-tag"><span className="signal" /> Browser-local studio</span>
        <a href="https://github.com/tomcwxyz/Mossline" target="_blank" rel="noreferrer">Open source ↗</a>
      </div>
    </header>
    <section className="heading">
      <div>
        <p className="eyebrow">A place to understand what connects us {graphKey===DEMO_KEY && <>· <span className="demo-indicator">Fictional demonstration data</span></>}</p>
        <h1>{graph.title}<span className="heading-period">.</span></h1>
        <p className="subtitle">{graph.description}</p>
      </div>
      <div className="actions">
        <input aria-label="Discover data from a Kumu JSON export or a CSV spreadsheet" ref={fileRef} type="file" multiple accept=".json,.csv,application/json,text/csv" hidden onChange={onImport}/>
        <button className="button-outline" onClick={() => fileRef.current?.click()}>↑ Discover your data</button>
        <button className="button-primary" onClick={() => saveJson(graph)}>↓ Export map</button>
      </div>
    </section>
    {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div>}
    {(importPreview || discovery) && <section className="import-preview" aria-label="Data discovery and import preview">
      <div className="import-title">
        <div><p className="eyebrow">Review before replacing the current map</p>
          <h2>{discovery?.kind==="kumu-configuration" ? "Understanding your Kumu project" :
            discovery?.kind==="csv-table" ? "Map your existing data" : "Import preview"}</h2>
          {importPreview && <p>{importPreview.counts.nodes} entities · {importPreview.counts.edges} relationships</p>}
        </div>
        <button className="button-outline" onClick={closeImport}>Close</button>
      </div>
      <p className="help">No changes yet. You will explicitly confirm before replacing this browser's map.
        Export the current map first to keep a backup. Files are processed locally.</p>
      {discovery?.kind==="kumu-configuration" && <div className="kumu-discovery">
        <p className="eyebrow">Configuration discovered · {discovery.title}</p>
        <div className="kumu-discovery-stats">
          <div><strong>{discovery.attributes.length}</strong><span>Defined fields</span></div>
          <div><strong>{discovery.perspectives.length}</strong><span>Perspectives</span></div>
          <div><strong>{discovery.embeddedNodes}</strong><span>Embedded entities</span></div>
          <div><strong>{discovery.embeddedEdges}</strong><span>Embedded links</span></div>
        </div>
        {discovery.externalSheets && <p className="mapping-important">
          Linked Google Sheets source detected. The project's configuration is present, but the spreadsheet rows
          must be exported separately before Mossline can reconstruct the network. No Google account is accessed here.
        </p>}
        <div className="kumu-discovery-parts">
          <div><h3>Entity categories</h3><p>{discovery.elementTypes.length ?
            discovery.elementTypes.join(" · ") : "No categories defined"}</p></div>
          <div><h3>Relationship vocabulary</h3><p>{discovery.connectionTypes.length ?
            discovery.connectionTypes.join(" · ") : "No relation labels defined"}</p></div>
          <div className="kumu-field-recommendations"><h3>How these fields could fit Mossline</h3>
            <p>Recommendations describe a possible destination. Review them against the actual spreadsheet data.</p>
            <ul>{discovery.fieldSuggestions.map(suggestion=><li key={suggestion.field}>
              <strong>{suggestion.field}</strong><span>{suggestion.role}</span>
              <small>{suggestion.treatment==="mapped" ? "Suggested mapping" :
                suggestion.treatment==="review" ? "Needs review" : "Preserve as custom field"}</small>
            </li>)}</ul>
          </div>
          <div><h3>Existing perspectives</h3>
            <ul>{discovery.perspectives.map((name,index)=><li key={index}>{name}</li>)}</ul>
          </div>
        </div>
        {discovery.advice.map((line,index)=><p className="help" key={index}>{line}</p>)}
      </div>}
      {discovery?.kind==="unsupported" && !importPreview?.graph &&
        <p className="mapping-important">{discovery.reason}</p>}
      {discovery?.kind==="csv-table" && mappingFile &&
        <DataMappingWorkbench key={mappingSession} file={mappingFile} discovery={discovery}
          onPreview={previewMappedGraph} onChange={()=>setImportPreview(null)}/>}
      {importPreview && importPreview.issues.length > 0 && <ul className="import-issues">
        {importPreview.issues.map((issue,index) => <li key={index} className={issue.severity}>
          <strong>{issue.severity}:</strong> {issue.message}</li>)}
      </ul>}
      {importPreview && importPreview.issues.length === 0 && <p className="help">No issues detected in supported fields. This is not a complete data-quality or Kumu-project audit.</p>}
      {importPreview?.graph && <div className="import-coverage">
        <h3>Before you import: source coverage</h3>
        <CoverageReport graph={importPreview.graph} />
      </div>}
      {importPreview && <button className="button-primary"
        disabled={!importPreview.graph || importPreview.graph.nodes.length===0 ||
          importPreview.issues.some(i => i.severity === "error")}
        onClick={applyImport}>Confirm and replace current browser map</button>}
    </section>}
    <section className="workspace">
      <aside className="sidebar">
        <p className="eyebrow">Explore</p>
        <div className="view-switch">
          <button className={view === "landscape" ? "on" : ""} onClick={() => { setView("landscape"); setSelectedId(null); setFocusId(null); }}>✳ <span>Landscape</span></button>
          <button className={view === "collaborations" ? "on" : ""} onClick={() => { setView("collaborations"); setSelectedId(null); setFocusId(null); }}>◎ <span>Collaborations</span></button>
        </div>
        <section className="perspectives-panel" aria-label="Saved perspectives">
          <div className="filter-heading"><p className="eyebrow">Saved perspectives</p>
            <button type="button" onClick={()=>{setShowSave(v=>!v);setNewName(view==="landscape"?"My landscape":"My collaborations");}}>+ Save</button></div>
          {showSave && <form className="perspective-form" onSubmit={saveCurrentPerspective}>
            <label htmlFor="save-view-name">Name this perspective</label>
            <input className="search" id="save-view-name" maxLength={60} required value={newName}
              onChange={e=>setNewName(e.target.value)} placeholder="e.g. Northern connections"/>
            <div><button className="button-primary" type="submit">Save view</button>
              <button className="text-button" type="button" onClick={()=>setShowSave(false)}>Cancel</button></div>
          </form>}
          {savedForMap.length===0 && <p className="help">Save your layout, search and filters, then return to them later.</p>}
          {savedForMap.map(item=><div key={item.id} className="saved-perspective">
            <button type="button" onClick={()=>openPerspective(item)}>
              <span>{item.name}</span><small>{item.view} · {item.layout}</small></button>
            <button className="remove-perspective" type="button" aria-label={"Delete "+item.name}
              onClick={()=>savePerspectives(perspectives.filter(p=>p.id!==item.id))}>×</button>
          </div>)}
          <p className="help">Only this browser · scoped to this dataset · no changes to source data</p>
        </section>
        <section className="trace-panel" aria-label="Find connections between two entities">
          <div className="trace-head"><p className="eyebrow">Follow a connection</p><span>Question-led explorer</span></div>
          <p className="help">How are two entities linked through projects, funding and other recorded relationships?</p>
          <form className="trace-form" onSubmit={traceEntities}>
            <label htmlFor="trace-from">From</label>
            <select id="trace-from" className="search" required value={traceFrom} onChange={e => {setTraceFrom(e.target.value);clearTrail();}}>
              <option value="">Choose an entity</option>
              {entityOptions.map(n => <option key={n.id} value={n.id}>{n.label} · {n.type}</option>)}
            </select>
            <label htmlFor="trace-to">To</label>
            <select id="trace-to" className="search" required value={traceTo} onChange={e => {setTraceTo(e.target.value);clearTrail();}}>
              <option value="">Choose an entity</option>
              {entityOptions.map(n => <option key={n.id} value={n.id}>{n.label} · {n.type}</option>)}
            </select>
            <label htmlFor="trace-exclude">Leave out a relationship type</label>
            <select id="trace-exclude" className="search" value={excludedRelationType}
              onChange={event=>{setExcludedRelationType(event.target.value);clearTrail();}}>
              <option value="">Use all recorded relationships</option>
              {relationTypes.map(type=><option value={type} key={type}>Exclude: {type}</option>)}
            </select>
            <button type="submit" className="trace-action" disabled={!traceFrom || !traceTo}>Explore routes →</button>
          </form>
          {graphKey===DEMO_KEY && <button type="button" className="trace-example" onClick={() => {
            setTraceFrom("o1"); setTraceTo("o3"); clearTrail();
          }}>Try an example: North Fields → Riverbank</button>}
          {connectionMessage && <div role="status" className="trace-response">
            <p>{connectionMessage}</p>
            {connectionTrails.length>1 && <div className="route-options" aria-label="Alternative recorded routes">
              {connectionTrails.map((route,index)=><button type="button" key={index}
                aria-pressed={activeRouteIndex===index}
                className={activeRouteIndex===index ? "chosen" : ""}
                onClick={()=>setActiveRouteIndex(index)}>
                Route {index+1}<small>{route.steps.length} steps</small>
              </button>)}
            </div>}
            {connectionTrail && connectionTrail.steps.length>0 && <>
              <p className="trace-caption">Route {activeRouteIndex+1} · {connectionTrail.steps.length} recorded steps</p>
              <ol className="trace-steps">
                {connectionTrail.steps.map((step, i) => <li key={step.edgeId+"-"+i}>
                  <button type="button" onClick={() => pickNode(step.fromId)}>{names.get(step.fromId)??step.fromId}</button>
                  <span>{step.direction==="undirected" || step.direction==="mutual" ? "↔" : step.forward ? "→" : "←"} {step.relation}</span>
                  <button type="button" className="trace-why" onClick={() => pickEdge(step.edgeId)}>Why?</button>
                </li>)}
                <li><button type="button" onClick={() => pickNode(connectionTrail.nodeIds[connectionTrail.nodeIds.length-1])}>
                  {names.get(connectionTrail.nodeIds[connectionTrail.nodeIds.length-1])}
                </button></li>
              </ol>
            </>}
            <button type="button" className="trace-clear" onClick={clearTrail}>Clear path</button>
          </div>}
        </section>
        <details className="junction-panel">
          <summary>Structural junctions <span>{featuredJunctions.length} shown</span></summary>
          <p className="help">Which organisations or projects hold different parts of the recorded network together? This is a structural test, not a judgement about importance or impact.</p>
          <label className="context-toggle">
            <input type="checkbox" checked={showJunctions} onChange={e=>setShowJunctions(e.target.checked)}/>
            Highlight junctions on the map
          </label>
          {featuredJunctions.length===0 && <p className="help">No qualifying organisation or project junctions in this dataset.</p>}
          {featuredJunctions.map(item => <button className="junction-item" key={item.nodeId}
            onClick={()=>exploreJunction(item.nodeId)}>
            <span>{names.get(item.nodeId) ?? item.nodeId}</span>
            <small>{item.separatedGroups} connected parts if removed</small>
          </button>)}
          <p className="help">Computed on all recorded relationships, ignoring inferred associations and current view filters.</p>
        </details>
        <div className="sidebar-divider" />
        <div className="filter-heading">
          <p className="eyebrow">Find & filter</p>
          <button onClick={() => { setTypes(TYPE_KEYS); setQuery(""); setBasis("all"); setRegion(""); setFocusId(null); setSelectedId(null); }}>Clear</button>
        </div>
        <input className="search" value={query} onChange={event => { setQuery(event.target.value); setSelectedId(null); }} placeholder="Search the landscape…" aria-label="Search entities" />
        <label className="collaboration-label" htmlFor="region-lens">Explore by region</label>
        <select id="region-lens" className="search" value={region} onChange={event => { setRegion(event.target.value); setSelectedId(null); setFocusId(null); }}>
          <option value="">Whole landscape</option>
          {regions.map(place => <option value={place} key={place}>{place}</option>)}
        </select>
        {view === "collaborations" ? <>
          <label className="collaboration-label" htmlFor="collaboration-basis">Show relationships</label>
          <select id="collaboration-basis" className="search" value={basis} onChange={event => { setBasis(event.target.value as CollaborationBasis); setSelectedId(null); }}>
            <option value="all">Recorded and shared associations</option>
            <option value="project">Shared projects</option>
            <option value="funder">Shared funders</option>
            <option value="recorded">Recorded direct relationships only</option>
          </select>
          <p className="help">Dashed lines show shared associations, not confirmed partnerships. Changing the basis does not remove the organisations.</p>
        </> : <div className="type-list">
          {totalTypes.filter(item => item.count > 0).map(({ type, count }) => <label key={type} className="type-item">
            <input type="checkbox" checked={types.includes(type)} onChange={() => toggleType(type)} />
            <span className={"small-dot " + type} /><span>{TYPE_LABELS[type]}</span><span className="type-count">{count}</span>
          </label>)}
        </div>}
        <label className="context-toggle"><input type="checkbox" checked={context} onChange={e => setContext(e.target.checked)} /> Keep related context</label>
        <p className="help">Retain one-hop neighbours so filters do not erase the relationships you are exploring.</p>
        {selected && <button className={"focus-button" + (focusId ? " on" : "")}
          onClick={() => setFocusId(previous => previous === selected.id ? null : selected.id)}>
          {focusId ? "← Show wider network" : "◎ Explore this entity’s connections"}
        </button>}
        {hubs.length > 0 && <div className="sidebar-highlights">
          <p className="eyebrow">Well-connected in this view</p>
          {hubs.map(({node, connections}) => <button key={node.id}
            onClick={() => { setSelectedId(node.id); setFocusId(null); }}>
            <span>{node.label}</span><small>{connections} links</small>
          </button>)}
        </div>}
        <details className="browse-panel" aria-label="Browse visible entities">
          <summary>Browse entities <span>{filtered.graph.nodes.length} in view</span></summary>
          <p className="help">Keyboard-accessible alternative to selecting nodes on the canvas.</p>
          <ul>{filtered.graph.nodes.slice(0,40).map(node=><li key={node.id}>
            <button type="button" onClick={()=>pickNode(node.id)}>
              <span className={"small-dot "+node.type}/>
              <span>{node.label}</span><small>{node.type}</small>
            </button>
          </li>)}</ul>
          {filtered.graph.nodes.length>40 && <p className="help">Showing the first 40. Narrow the results with search or filters.</p>}
        </details>
        <details className="audit-panel">
          <summary>Data health & provenance</summary>
          <CoverageReport graph={graph} />
        </details>
        <div className="sidebar-bottom">
          <p className="eyebrow">Your data stays yours</p>
          <p className="help">Imported JSON is kept in this browser only. MCP reads the bundled demo unless configured separately.</p>
          <button className="text-button" onClick={resetDemo}>Restore example landscape ↗</button>
        </div>
      </aside>
      <div className="map-panel">
        <div className="map-topline">
          <span><span className="signal" /> {view === "landscape" ? "Living network" : "Shared associations"}</span>
          <span>{filtered.graph.nodes.length} entities <span className="sep">·</span> {filtered.graph.edges.length} relationships</span>
          <div className="map-options">
            <label>Layout <select aria-label="Network layout" value={layoutMode}
              onChange={event => setLayoutMode(event.target.value as NetworkLayout)}>
              <option value="organic">Organic</option><option value="radial">Radial</option><option value="regions">Regions</option>
            </select></label>
            <label>Labels <select aria-label="Network labels" value={labelDensity}
              onChange={event => setLabelDensity(event.target.value as LabelDensity)}>
              <option value="essential">Essential</option><option value="all">All</option>
            </select></label>
          </div>
        </div>
        <GraphCanvas graph={filtered.graph} contextNodeIds={filtered.contextNodeIds}
          selectedId={selectedId} selectedEdgeId={selectedEdgeId}
          pathNodeIds={connectionTrail?.nodeIds ?? []}
          pathEdgeIds={connectionTrail?.steps.map(step => step.edgeId) ?? []}
          junctionNodeIds={showJunctions ? junctions.map(item=>item.nodeId) : []}
          onSelect={pickNode} onSelectEdge={pickEdge}
          view={view} layoutMode={layoutMode} labelDensity={labelDensity} />
        <div className="map-bottomline"><span>Drag to explore · Select a node or a relationship line to inspect its evidence</span><span>Built with Cytoscape.js</span></div>
      </div>
      <aside className="inspector">
        {selectedEdge ? <RelationshipInspector edge={selectedEdge} source={graph}
          onPick={pickNode} onEvidence={exploreEvidence} /> :
        selected ? <NodeInspector node={selected} graph={filtered.graph} source={graph}
          onPick={pickNode} onPickEdge={pickEdge} /> :
          <div className="empty-inspector">
            <div className="orbit"><span>✳</span></div>
            <p className="eyebrow">The relationships matter</p>
            <h2>Follow a thread.</h2>
            <p>Select a node to see its connections. Select a line, or use “Why?” beside a relationship, to see the recorded evidence behind it.</p>
            <div className="empty-rule"/>
            <p className="insight">“What can we understand by looking at the relationships, rather than simply the parts?”</p>
          </div>}
      </aside>
    </section>
    <footer className="footer"><span>mossline — make sense of connected worlds.</span><span>Open by design · Read-only MCP · Locally saved perspectives</span></footer>
  </main>;
}
