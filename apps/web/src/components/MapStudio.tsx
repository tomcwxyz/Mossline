"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  collaborationGraph, filterGraph, neighbours, parseGraphDocument,
  type GraphDocument, type GraphNode, type NodeType, type CollaborationBasis
} from "@mossline/graph-core";
import { GraphCanvas } from "./GraphCanvas";
import demo from "../../../../data/demo.json";

const TYPE_LABELS: Record<NodeType, string> = {
  organisation: "Organisations", project: "Projects", funder: "Funders",
  person: "People", place: "Places", other: "Other"
};
const TYPE_KEYS = Object.keys(TYPE_LABELS) as NodeType[];
const ORIGINAL = parseGraphDocument(demo);
const STORAGE_KEY = "mossline-demo-graph-v1";
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
    <div className={"inspector-icon " + node.type}>{node.label.slice(0, 1)}</div>
    <p className="eyebrow">{node.type}{node.region ? " · " + node.region : ""}</p>
    <h2>{node.label}</h2>
    <p className="description">{node.description ?? "No description yet. Add context to your data source."}</p>
    {node.sourceUrl && <a href={node.sourceUrl} target="_blank" rel="noreferrer">View source ↗</a>}
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
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setGraph(parseGraphDocument(JSON.parse(saved)));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const current = useMemo(() => view === "collaborations" ? collaborationGraph(graph, basis) : graph, [graph, view, basis]);
  const activeTypes = view === "collaborations" ? (["organisation"] as NodeType[]) : types;
  const filtered = useMemo(() => filterGraph(current, {
    types: activeTypes, query, includeNeighbours: context
  }), [current, activeTypes.join("|"), query, context]);
  const selected = current.nodes.find(n => n.id === selectedId) ?? null;
  const totalTypes = useMemo(() => TYPE_KEYS.map(type => ({
    type, count: graph.nodes.filter(n => n.type === type).length
  })), [graph]);

  function toggleType(type: NodeType) {
    setSelectedId(null);
    setTypes(previous => previous.includes(type) ? previous.filter(v => v !== type) : [...previous, type]);
  }

  function updateGraph(next: GraphDocument) {
    setGraph(next);
    setSelectedId(null);
    setQuery("");
    setView("landscape");
    setTypes(TYPE_KEYS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async function onImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseGraphDocument(JSON.parse(await file.text()));
      updateGraph(parsed);
      setNotice("Loaded " + parsed.nodes.length + " entities and " + parsed.edges.length + " relationships.");
    } catch (error) {
      setNotice("Import failed: " + (error instanceof Error ? error.message : "invalid graph JSON"));
    }
    event.target.value = "";
  }

  function resetDemo() {
    updateGraph(ORIGINAL);
    setNotice("Illustrative landscape restored.");
  }

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">✳</span><span>mossline<span className="brand-period">.</span></span><small>alpha 0.1</small></div>
      <div className="topbar-right"><span className="local-tag"><span className="signal" /> Local prototype</span>
        <a href="https://github.com/tomcwxyz/Mossline" target="_blank" rel="noreferrer">Open source ↗</a>
      </div>
    </header>
    <section className="heading">
      <div>
        <p className="eyebrow">A place to understand what connects us</p>
        <h1>{graph.title}<span className="heading-period">.</span></h1>
        <p className="subtitle">{graph.description}</p>
      </div>
      <div className="actions">
        <input aria-label="Import Mossline JSON" ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onImport}/>
        <button className="button-outline" onClick={() => fileRef.current?.click()}>↑ Import JSON</button>
        <button className="button-primary" onClick={() => saveJson(graph)}>↓ Export map</button>
      </div>
    </section>
    {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div>}
    <section className="workspace">
      <aside className="sidebar">
        <p className="eyebrow">Explore</p>
        <div className="view-switch">
          <button className={view === "landscape" ? "on" : ""} onClick={() => { setView("landscape"); setSelectedId(null); }}>✳ <span>Landscape</span></button>
          <button className={view === "collaborations" ? "on" : ""} onClick={() => { setView("collaborations"); setSelectedId(null); }}>◎ <span>Collaborations</span></button>
        </div>
        <div className="sidebar-divider" />
        <div className="filter-heading">
          <p className="eyebrow">Find & filter</p>
          <button onClick={() => { setTypes(TYPE_KEYS); setQuery(""); setBasis("all"); setSelectedId(null); }}>Clear</button>
        </div>
        <input className="search" value={query} onChange={event => { setQuery(event.target.value); setSelectedId(null); }} placeholder="Search the landscape…" aria-label="Search entities" />
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
        <div className="sidebar-bottom">
          <p className="eyebrow">Your data stays yours</p>
          <p className="help">Imported JSON is kept in this browser only. MCP reads the bundled demo unless configured separately.</p>
          <button className="text-button" onClick={resetDemo}>Restore example landscape ↗</button>
        </div>
      </aside>
      <div className="map-panel">
        <div className="map-topline"><span><span className="signal" /> {view === "landscape" ? "Living network" : "Shared associations"}</span>
          <span>{filtered.graph.nodes.length} entities <span className="sep">·</span> {filtered.graph.edges.length} relationships</span></div>
        <GraphCanvas graph={filtered.graph} contextNodeIds={filtered.contextNodeIds} selectedId={selectedId} onSelect={setSelectedId} />
        <div className="map-bottomline"><span>Drag to explore · Scroll to zoom · Select an entity to discover more</span><span>Built with Cytoscape.js</span></div>
      </div>
      <aside className="inspector">
        {selected ? <NodeInspector node={selected} graph={current} source={graph} onPick={setSelectedId} /> :
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
    <footer className="footer"><span>mossline — make sense of connected worlds.</span><span>Open by design · Read-only MCP included · Local-first prototype</span></footer>
  </main>;
}
