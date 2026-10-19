"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  collaborationGraph, filterGraph, graphFingerprint, neighbours, parseGraphDocument, parsePerspectives, previewImport,
  type ImportPreview,
  type GraphDocument, type GraphNode, type NodeType, type CollaborationBasis, type SavedPerspective
} from "@mossline/graph-core";
import { GraphCanvas, type LabelDensity, type NetworkLayout } from "./GraphCanvas";
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

function NodeInspector({ node, graph, source, onPick }: {
  node: GraphNode;
  graph: GraphDocument;
  source: GraphDocument;
  onPick: (id: string) => void;
}) {
  const links = neighbours(graph, node.id);
  const related = graph.edges.filter(e => e.source === node.id || e.target === node.id);
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
      <span key={tag}>{tag}</span>)}</div>
    {node.sourceUrl && <a href={node.sourceUrl} target="_blank" rel="noreferrer">View source ↗</a>}
    {node.origin && <p className="help">Imported from {node.origin.system.toUpperCase()} · source record {node.origin.recordId}</p>}
    {node.properties && Object.keys(node.properties).length > 0 && <details className="original-fields">
      <summary>Original source fields ({Object.keys(node.properties).length})</summary>
      <dl>{Object.entries(node.properties).map(([key,value]) =>
        <div key={key}><dt>{key}</dt><dd>{typeof value === "string" ? value : JSON.stringify(value) ?? "—"}</dd></div>)}</dl>
    </details>}
    <div className="inspector-section">
      <p className="eyebrow">Relationships · {links.length}</p>
      {links.length === 0 && <p className="muted">No connected entities in the current map.</p>}
      {links.map(item => {
        const edge = related.find(e => (e.source === item.id && e.target === node.id) || (e.source === node.id && e.target === item.id));
        const supporting = (edge?.evidenceNodeIds ?? []).map(id => source.nodes.find(n => n.id === id)?.label ?? id).join(", ");
        return <button className="relation" key={item.id} onClick={() => onPick(item.id)}>
          <span className={"small-dot " + item.type} />
          <span><strong>{item.label}</strong><small>{edge?.type ?? "connected"}{edge?.inferred ? " · inferred" : ""}</small>
            {supporting && <small>Shared through: {supporting}</small>}
          </span>
          <span aria-hidden="true">↗</span>
        </button>;
      })}
    </div>
  </div>;
}

export function MapStudio() {
  const [graph, setGraph] = useState<GraphDocument>(ORIGINAL);
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<NodeType[]>(TYPE_KEYS);
  const [context, setContext] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    setSelectedId(null);
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
    setLabelDensity(item.labels);setSelectedId(null);setFocusId(null);
    setNotice("Opened ‘"+item.name+"’. Source data is unchanged.");
  }

  function updateGraph(next: GraphDocument) {
    setGraph(next);
    setSelectedId(null);
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
      setImportPreview(previewImport(input));
      setNotice("");
    } catch (error) {
      setNotice("Import failed: " + (error instanceof Error ? error.message : "unable to read files"));
    }
  }

  function applyImport() {
    const preview = importPreview;
    if (!preview?.graph || preview.issues.some(i => i.severity === "error")) return;
    updateGraph(preview.graph);
    setNotice("Loaded " + preview.graph.nodes.length + " entities and " + preview.graph.edges.length +
      " relationships. Changes stay in this browser.");
    setImportPreview(null);
  }

  function resetDemo() {
    updateGraph(ORIGINAL);
    setNotice("Illustrative landscape restored.");
  }

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">✳</span><span>mossline<span className="brand-period">.</span></span><small>alpha 0.3</small></div>
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
        <input aria-label="Import Kumu blueprint JSON or exported Sheets CSVs" ref={fileRef} type="file" multiple accept=".json,.csv,application/json,text/csv" hidden onChange={onImport}/>
        <button className="button-outline" onClick={() => fileRef.current?.click()}>↑ Import data</button>
        <button className="button-primary" onClick={() => saveJson(graph)}>↓ Export map</button>
      </div>
    </section>
    {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div>}
    {importPreview && <section className="import-preview" aria-label="Import preview">
      <div className="import-title">
        <div><p className="eyebrow">Review before replacing the current map</p>
          <h2>Import preview · {importPreview.source.toUpperCase()}</h2>
          <p>{importPreview.counts.nodes} entities · {importPreview.counts.edges} relationships</p>
        </div>
        <button className="button-outline" onClick={() => setImportPreview(null)}>Close</button>
      </div>
      <p className="help">No changes yet. Confirming will replace this browser's map.
        Export your current map first to keep a backup. Files are processed locally.</p>
      {importPreview.issues.length > 0 && <ul className="import-issues">
        {importPreview.issues.map((issue,index) => <li key={index} className={issue.severity}>
          <strong>{issue.severity}:</strong> {issue.message}</li>)}
      </ul>}
      {importPreview.issues.length === 0 && <p className="help">No issues detected in supported source fields.</p>}
      <button className="button-primary"
        disabled={!importPreview.graph || importPreview.issues.some(i => i.severity === "error")}
        onClick={applyImport}>Replace current map with import</button>
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
              <option value="organic">Organic</option><option value="radial">Radial</option>
            </select></label>
            <label>Labels <select aria-label="Network labels" value={labelDensity}
              onChange={event => setLabelDensity(event.target.value as LabelDensity)}>
              <option value="essential">Essential</option><option value="all">All</option>
            </select></label>
          </div>
        </div>
        <GraphCanvas graph={filtered.graph} contextNodeIds={filtered.contextNodeIds} selectedId={selectedId}
          onSelect={setSelectedId} view={view} layoutMode={layoutMode} labelDensity={labelDensity} />
        <div className="map-bottomline"><span>Drag to explore · Scroll to zoom · Select an entity to discover more</span><span>Built with Cytoscape.js</span></div>
      </div>
      <aside className="inspector">
        {selected ? <NodeInspector node={selected} graph={filtered.graph} source={graph} onPick={setSelectedId} /> :
          <div className="empty-inspector">
            <div className="orbit"><span>✳</span></div>
            <p className="eyebrow">The relationships matter</p>
            <h2>Follow a thread.</h2>
            <p>Select any node on the landscape to see what it represents and how it connects to the wider system.</p>
            <div className="empty-rule"/>
            <p className="insight">“What can we understand by looking at the relationships, rather than simply the parts?”</p>
          </div>}
      </aside>
    </section>
    <footer className="footer"><span>mossline — make sense of connected worlds.</span><span>Open by design · Read-only MCP · Locally saved perspectives</span></footer>
  </main>;
}
