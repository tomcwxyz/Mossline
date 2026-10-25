"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collaborationGraph, confirmInferredRelationship, emptyAnnotationLayer, fundingFlows, graphFingerprint,
  graphWithAnnotations, isRecorded, parseAnnotationLayer, projectAtlas, recordedCoordinates,
  type AtlasAnnotationLayer, type AtlasFilters, type AtlasLens, type ConnectionTrail,
  type GraphDocument, type GraphEdge, type NodeType
} from "@mossline/graph-core";
import { loadFundingDataset } from "../lib/funding-dataset-store";
import { FollowConnection } from "./FollowConnection";
import { NetworkLens, type AtlasRoute } from "./atlas/NetworkLens";
import { MapLens } from "./atlas/MapLens";
import { FundingLens } from "./atlas/FundingLens";
import { TimeStrip, TimelineLens, type YearRange } from "./atlas/TimeLens";
import { RecordPanel, TypeMark } from "./atlas/RecordPanel";
import { TYPE_PLURAL, type AtlasTheme } from "./atlas/palette";

const LENSES: { id: AtlasLens; label: string; help: string }[] = [
  { id: "network", label: "Network", help: "Position follows recorded relationships" },
  { id: "map", label: "Map", help: "Position follows source coordinates" },
  { id: "themes", label: "Themes", help: "Areas follow source tags, not inferred meanings" },
  { id: "funding", label: "Funding", help: "Recorded funding, not implied collaboration" },
  { id: "timeline", label: "Timeline", help: "Dates on recorded relationships" }
];
const SUGGESTION_LIMIT = { nodes: 5000, edges: 10000 };

export function FieldAtlasWorkspace({ graph: imported, datasetId, onBack, onImport, onAdvanced, example }: {
  graph: GraphDocument; datasetId?: string; onBack: () => void; onImport: () => void; onAdvanced: () => void; example?: boolean;
}) {
  // ---- Complete source (funding datasets live in IndexedDB) -------------------
  const [fullSource, setFullSource] = useState<GraphDocument | null>(null);
  const [datasetStatus, setDatasetStatus] = useState<"loading" | "ready" | "error">(datasetId ? "loading" : "ready");
  const [datasetError, setDatasetError] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (!datasetId) { setFullSource(null); setDatasetStatus("ready"); return; }
    setDatasetStatus("loading");
    loadFundingDataset(datasetId).then(dataset => {
      if (cancelled) return;
      setFullSource(dataset.graph); setDatasetStatus("ready");
    }).catch(error => {
      if (cancelled) return;
      setDatasetStatus("error");
      setDatasetError(error instanceof Error ? error.message : "Cannot restore full dataset");
    });
    return () => { cancelled = true; };
  }, [datasetId]);
  const sourceGraph = fullSource ?? imported;
  const graphKey = useMemo(() => graphFingerprint(sourceGraph), [sourceGraph]);

  // ---- Reviewer confirmations: a separate, dataset-bound annotation layer -----
  const [annotations, setAnnotations] = useState<AtlasAnnotationLayer>(() => emptyAnnotationLayer(graphKey));
  const storageKey = "mossline:atlas-annotations:v1:" + graphKey;
  const [annotationsReady, setAnnotationsReady] = useState(false);
  const annotationFileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      setAnnotations(stored ? parseAnnotationLayer(JSON.parse(stored), graphKey) : emptyAnnotationLayer(graphKey));
    } catch { setAnnotations(emptyAnnotationLayer(graphKey)); }
    setAnnotationsReady(true);
  }, [storageKey, graphKey]);
  useEffect(() => {
    if (!annotationsReady || annotations.graphKey !== graphKey) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(annotations)); } catch { /* storage full or blocked */ }
  }, [annotations, annotationsReady, graphKey, storageKey]);
  const largeSource = sourceGraph.nodes.length > SUGGESTION_LIMIT.nodes || sourceGraph.edges.length > SUGGESTION_LIMIT.edges;
  const proposedGraph = useMemo(() => {
    // Shared-funder/project associations are pencil: derived, reversible, never counted.
    if (largeSource) return sourceGraph;
    const existing = new Set(sourceGraph.edges.map(e => e.id));
    const suggestions = collaborationGraph(sourceGraph, "all").edges.filter(e => e.inferred && !existing.has(e.id));
    return suggestions.length ? { ...sourceGraph, edges: [...sourceGraph.edges, ...suggestions] } : sourceGraph;
  }, [sourceGraph, largeSource]);
  const graph = useMemo(() => graphWithAnnotations(proposedGraph,
    annotations.graphKey === graphKey ? annotations : emptyAnnotationLayer(graphKey)), [proposedGraph, annotations, graphKey]);

  const [notice, setNotice] = useState("");
  function exportAnnotations() {
    const payload = { kind: "mossline-atlas-annotation-backup", version: 1, exportedAt: new Date().toISOString(), layer: annotations };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url;
    a.download = "mossline-review-" + graphKey.slice(0, 12) + ".json";
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    setNotice("Review backup exported. Keep this file somewhere safe; it is separate from the source dataset.");
  }
  async function importAnnotations(file: File) {
    try {
      if (file.size > 2_000_000) throw Error("Review backup is too large.");
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || !("kind" in parsed) ||
        parsed.kind !== "mossline-atlas-annotation-backup" || !("layer" in parsed)) throw Error("Not a Mossline review backup.");
      const layer = parseAnnotationLayer(parsed.layer, graphKey);
      if (!parsed.layer || typeof parsed.layer !== "object" || !("graphKey" in parsed.layer) ||
        parsed.layer.graphKey !== graphKey) throw Error("This backup belongs to another version of the dataset.");
      if (!("entries" in parsed.layer) || !Array.isArray(parsed.layer.entries) ||
        layer.entries.length !== parsed.layer.entries.length) throw Error("Review backup contains invalid entries.");
      const valid = layer.entries.every(entry => proposedGraph.edges.some(e =>
        e.id === entry.proposedEdgeId && e.inferred && e.source === entry.source && e.target === entry.target));
      if (!valid) throw Error("One or more proposed relationships are not present in this dataset.");
      const existing = new Set(annotations.entries.map(x => x.id));
      const incoming = layer.entries.filter(x => !existing.has(x.id));
      setAnnotations(old => ({ ...old, entries: [...old.entries, ...incoming] }));
      setNotice("Restored " + incoming.length + " reviewer confirmations. Existing confirmations were preserved.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not import review backup."); }
  }
  function confirm(edge: GraphEdge, input: { relationship: string; reviewer: string; reason: string }) {
    try {
      setAnnotations(layer => confirmInferredRelationship(proposedGraph, layer, edge.id, { ...input, now: new Date().toISOString() }));
      setNotice("Confirmed in a separate local annotation, with reviewer and reason. Source data unchanged.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not confirm suggestion."); }
  }

  // ---- View state, mirrored in the URL ----------------------------------------
  const [lens, setLens] = useState<AtlasLens>("network");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState("");
  const [region, setRegion] = useState("");
  const [funderId, setFunderId] = useState("");
  const [range, setRange] = useState<YearRange>({ from: null, to: null });
  const [type, setType] = useState<NodeType | null>(null);
  const [browse, setBrowse] = useState(false);
  const [browseLimit, setBrowseLimit] = useState(100);
  const [routeFromId, setRouteFromId] = useState<string | null>(null);
  const [trail, setTrail] = useState<ConnectionTrail | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(true);
  const [nightPref, setNightPref] = useState<AtlasTheme | null>(null);
  const [urlReady, setUrlReady] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("lens");
    if (LENSES.some(l => l.id === requested)) setLens(requested as AtlasLens);
    setSelectedId(params.get("record")); setSearch(params.get("q") ?? "");
    setTheme(params.get("theme") ?? ""); setRegion(params.get("region") ?? "");
    setFunderId(params.get("funder") ?? "");
    const year = (key: string) => { const y = Number(params.get(key)); return params.has(key) && y >= 1800 && y <= 2200 ? y : null; };
    const legacy = year("year");
    setRange({ from: year("from") ?? legacy, to: year("to") ?? legacy });
    const t = params.get("type"); if (t && t in TYPE_PLURAL) setType(t as NodeType);
    setUrlReady(true);
  }, []);
  useEffect(() => {
    if (!urlReady) return;
    const url = new URL(window.location.href);
    for (const key of ["lens", "record", "q", "theme", "region", "funder", "year", "from", "to", "type"]) url.searchParams.delete(key);
    url.searchParams.set("lens", lens);
    if (selectedId) url.searchParams.set("record", selectedId);
    if (search) url.searchParams.set("q", search);
    if (theme) url.searchParams.set("theme", theme);
    if (region) url.searchParams.set("region", region);
    if (funderId) url.searchParams.set("funder", funderId);
    if (range.from !== null) url.searchParams.set("from", String(range.from));
    if (range.to !== null) url.searchParams.set("to", String(range.to));
    if (type) url.searchParams.set("type", type);
    window.history.replaceState(window.history.state, "", url.toString());
  }, [urlReady, lens, selectedId, search, theme, region, funderId, range, type]);
  useEffect(() => {
    const listener = (e: globalThis.KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape") { setSelectedId(null); setBrowse(false); }
      const index = Number(e.key) - 1;
      if (index >= 0 && index < LENSES.length) setLens(LENSES[index].id);
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  // ---- Projections ------------------------------------------------------------
  const baseFilters: AtlasFilters = useMemo(() => ({ query: search, theme, region, funderId: funderId || undefined,
    types: type ? [type] : undefined }), [search, theme, region, funderId, type]);
  const filters: AtlasFilters = useMemo(() => ({ ...baseFilters, fromYear: range.from ?? undefined, toYear: range.to ?? undefined }),
    [baseFilters, range]);
  const result = useMemo(() => projectAtlas(graph, filters), [graph, filters]);
  const undated = useMemo(() => projectAtlas(graph, baseFilters), [graph, baseFilters]);
  const selected = useMemo(() => graph.nodes.find(n => n.id === selectedId) ?? null, [graph, selectedId]);
  const flowsAll = useMemo(() => fundingFlows(graph), [graph]);
  const flowsView = useMemo(() => fundingFlows(result.graph), [result.graph]);
  const flowsUndated = useMemo(() => fundingFlows(undated.graph), [undated.graph]);
  const recordedTotal = useMemo(() => graph.edges.filter(isRecorded).length, [graph]);
  const themes = useMemo(() => [...new Set(graph.nodes.flatMap(n => n.tags))].sort(), [graph]);
  const regions = useMemo(() => [...new Set(graph.nodes.map(n => n.region).filter((s): s is string => !!s))].sort(), [graph]);
  const funders = useMemo(() => graph.nodes.filter(n => n.type === "funder").sort((a, b) => a.label.localeCompare(b.label)), [graph]);
  const typesPresent = useMemo(() => [...new Set(graph.nodes.map(n => n.type))], [graph]);
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const e of graph.edges) if (isRecorded(e)) { d.set(e.source, (d.get(e.source) ?? 0) + 1); d.set(e.target, (d.get(e.target) ?? 0) + 1); }
    return d;
  }, [graph]);
  const leads = useMemo(() => [...graph.nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
    .slice(0, 5).map(node => ({ node, degree: degree.get(node.id) ?? 0 })), [graph, degree]);
  const recordList = useMemo(() => [...result.graph.nodes].sort((a, b) => a.label.localeCompare(b.label)), [result.graph]);
  useEffect(() => setBrowseLimit(100), [filters]);
  const unplaced = useMemo(() => result.graph.nodes.filter(n => !recordedCoordinates(n)), [result.graph]);
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of result.graph.nodes) for (const tag of new Set(node.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [result.graph]);
  const route: AtlasRoute | null = useMemo(() => trail && trail.steps.length ? {
    nodeIds: [trail.steps[0].fromId, ...trail.steps.map(s => s.toId)], edgeIds: trail.steps.map(s => s.edgeId)
  } : null, [trail]);
  const onRoute = useCallback((next: ConnectionTrail | null) => {
    setTrail(next);
    if (next) setLens(current => current === "network" || current === "map" ? current : "network");
  }, []);
  const pickRecord = useCallback((id: string | null) => { setSelectedId(id); }, []);
  const onUnavailable = useCallback(() =>
    setNotice("This device cannot draw the network. Browse records lists everything; Advanced tools has the previous explorer."), []);

  // One theme for every lens; the choice is remembered on this device.
  const activeTheme: AtlasTheme = nightPref ?? "day";
  useEffect(() => {
    try { const saved = window.localStorage.getItem("mossline:atlas-theme"); if (saved === "night" || saved === "day") setNightPref(saved); } catch { /* storage blocked */ }
  }, []);
  const chooseTheme = (next: AtlasTheme) => {
    setNightPref(next);
    try { window.localStorage.setItem("mossline:atlas-theme", next); } catch { /* storage blocked */ }
  };
  const activeFilters = [search, type, theme, region, funderId, range.from ?? range.to ?? ""].filter(v => v !== "" && v !== null).length;
  const clearAll = () => { setSearch(""); setType(null); setTheme(""); setRegion(""); setFunderId(""); setRange({ from: null, to: null }); };
  const canvasLens = lens === "network" || lens === "themes" || lens === "map";
  const funderName = funderId ? graph.nodes.find(n => n.id === funderId)?.label : "";
  const closeMenu = () => { if (menuRef.current) menuRef.current.open = false; };

  return <main className="ml-atlas" data-theme={activeTheme} data-lens={lens}>
    <header className="ml-header">
      <button className="ml-wordmark" type="button" onClick={onBack} aria-label="Mossline — all maps">
        <svg viewBox="0 0 26 26" aria-hidden="true"><path d="M3 19C8 19 9 8 14 8S20 15 23 6" className="ml-mark-line"/>
          <circle cx="3.5" cy="19" r="2.6" className="ml-mark-a"/><circle cx="14" cy="8" r="2.6" className="ml-mark-b"/>
          <circle cx="22.6" cy="6.4" r="2.6" className="ml-mark-c"/></svg>
        <span>Mossline</span>
      </button>
      <details className="ml-dataset" ref={menuRef}>
        <summary>
          <strong>{imported.title}</strong>
          <small>{graph.nodes.length.toLocaleString("en-GB")} records · {recordedTotal.toLocaleString("en-GB")} recorded links
            {example ? " · example data" : ""}</small>
        </summary>
        <div className="ml-menu" role="group" aria-label="Map and data">
          <button type="button" onClick={() => { closeMenu(); onBack(); }}>All maps</button>
          <button type="button" onClick={() => { closeMenu(); onImport(); }}>Import data</button>
          <hr/>
          <p className="ml-menu-note">Reviewer confirmations are stored separately from your source records.</p>
          <button type="button" onClick={() => { closeMenu(); exportAnnotations(); }} disabled={!annotations.entries.length}>
            Export reviews ({annotations.entries.length})</button>
          <button type="button" onClick={() => { closeMenu(); annotationFileRef.current?.click(); }}>Restore reviews</button>
          <hr/>
          <button type="button" onClick={() => { closeMenu(); onAdvanced(); }}>Advanced tools ↗</button>
        </div>
      </details>
      <input ref={annotationFileRef} hidden type="file" accept=".json,application/json" aria-label="Restore review backup"
        onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void importAnnotations(file); event.currentTarget.value = ""; }}/>
      <nav className="ml-lenses" aria-label="Atlas lenses">
        {LENSES.map((item, i) => <button key={item.id} type="button" title={item.help + " · key " + (i + 1)}
          aria-current={lens === item.id ? "page" : undefined} onClick={() => setLens(item.id)}>{item.label}</button>)}
      </nav>
      <label className="ml-search">
        <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg>
        <span className="ml-visually-hidden">Ask or find</span>
        <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a record, tag or place"/>
        {search ? <button type="button" className="ml-search-clear" aria-label="Clear search" onClick={() => setSearch("")}>×</button>
          : <kbd aria-hidden="true">/</kbd>}
      </label>
      <div className="ml-header-actions">
        <span className="ml-local"><i aria-hidden="true"/>On this device</span>
        <button type="button" className="ml-quiet" onClick={() => chooseTheme(activeTheme === "night" ? "day" : "night")}
          aria-label={activeTheme === "night" ? "Use day colours" : "Use night colours"}>{activeTheme === "night" ? "Day" : "Night"}</button>
        <button type="button" className="ml-solid" onClick={() => navigator.clipboard?.writeText(window.location.href).then(() =>
          setNotice("View link copied. The underlying local dataset does not travel with the link."))
          .catch(() => setNotice("Copy the address from your browser."))}>Share view</button>
      </div>
    </header>

    <section className="ml-body">
      <div className="ml-stage">
        <div className={"ml-tools" + (filtersOpen ? " ml-tools--open" : "")}>
          <button type="button" className="ml-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(v => !v)}>
            {filtersOpen ? "Hide filters" : "Refine results" + (activeFilters ? " · " + activeFilters : "")}</button>
          <div className="ml-chips">
            <label className={"ml-chip" + (type ? " is-on" : "")}><span className="ml-visually-hidden">Type</span>
              <select aria-label="Type" value={type ?? ""} onChange={e => setType((e.target.value || null) as NodeType | null)}>
                <option value="">All types</option>{typesPresent.map(t => <option key={t} value={t}>{TYPE_PLURAL[t]}</option>)}</select></label>
            <label className={"ml-chip" + (theme ? " is-on" : "")}><span className="ml-visually-hidden">Theme</span>
              <select aria-label="Theme" value={theme} onChange={e => setTheme(e.target.value)}>
                <option value="">Any theme</option>{themes.map(t => <option key={t}>{t}</option>)}</select></label>
            <label className={"ml-chip" + (region ? " is-on" : "")}><span className="ml-visually-hidden">Place</span>
              <select aria-label="Place" value={region} onChange={e => setRegion(e.target.value)}>
                <option value="">Anywhere</option>{regions.map(r => <option key={r}>{r}</option>)}</select></label>
            {funders.length > 0 && <label className={"ml-chip" + (funderId ? " is-on" : "")}><span className="ml-visually-hidden">Funder</span>
              <select aria-label="Funder" value={funderId} onChange={e => setFunderId(e.target.value)}>
                <option value="">Any funder</option>{funders.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>}
            {(range.from !== null || range.to !== null) && <button type="button" className="ml-chip is-on"
              onClick={() => setRange({ from: null, to: null })}>{range.from ?? "…"}–{range.to ?? "…"} <span aria-hidden="true">×</span>
              <span className="ml-visually-hidden">Clear dates</span></button>}
            {activeFilters > 0 && <button type="button" className="ml-chip ml-chip--clear" onClick={clearAll}>Clear filters</button>}
          </div>
          <button type="button" className="ml-chip ml-chip--browse" aria-expanded={browse} onClick={() => setBrowse(b => !b)}>
            {browse ? "Hide list" : "Browse records"} · {result.graph.nodes.length.toLocaleString("en-GB")}</button>
          {funderName && <p className="ml-filter-note"><span>Showing records reached by {funderName}</span></p>}
        </div>

        {(datasetId && datasetStatus !== "ready") && <div className="ml-banner" role="status">
          {datasetStatus === "loading" ? "Loading the complete funding dataset from this device…" :
            "Full funding dataset unavailable. The compact overview remains visible, but is not the whole network. " + datasetError}
          {datasetStatus === "error" && <button type="button" onClick={onAdvanced}>Open recovery tools</button>}
        </div>}
        {largeSource && lens === "network" && <div className="ml-banner ml-banner--quiet" role="note">
          Large dataset: shared-funder suggestions are not computed. Every recorded relationship is shown.</div>}

        <div className={"ml-canvas" + (canvasLens ? "" : " ml-canvas--page")}>
          {result.graph.nodes.length === 0 ? <div className="ml-no-results">
            <h2>No matching records</h2><p>Nothing in this dataset matches the current filters.</p>
            <button type="button" className="ml-solid" onClick={clearAll}>Clear all filters</button>
          </div> : <>
            {(lens === "network" || lens === "themes") && <NetworkLens graph={result.graph} mode={lens} theme={activeTheme}
              selectedId={selectedId} route={lens === "network" ? route : null} onPick={pickRecord} onUnavailable={onUnavailable}/>}
            {lens === "map" && <MapLens graph={result.graph} flows={flowsView} theme={activeTheme} selectedId={selectedId} onPick={pickRecord}
              unplaced={unplaced} onBrowse={() => setBrowse(true)}/>}
            {lens === "funding" && <FundingLens graph={result.graph} flows={flowsView} theme={activeTheme} selectedId={selectedId} onPick={pickRecord}/>}
            {lens === "timeline" && <TimelineLens graph={undated.graph} flows={flowsUndated} range={range} onRange={setRange} theme={activeTheme}
              selectedId={selectedId} onPick={pickRecord}/>}
          </>}

          {lens === "themes" && result.graph.nodes.length > 0 && <aside className="ml-overlay-card ml-tag-card" aria-label="Source tags">
            <p className="ml-overlay-note">Grouped by source tags · not model-inferred themes</p>
            <ol>{tagCounts.slice(0, 12).map(([tag, count]) => <li key={tag}>
              <button type="button" aria-pressed={theme === tag} onClick={() => setTheme(theme === tag ? "" : tag)}>
                <span>{tag}</span><b>{count}</b></button></li>)}</ol>
            {tagCounts.length > 12 && <p className="ml-small">{tagCounts.length - 12} more tags in the Theme filter.</p>}
            {tagCounts.length === 0 && <p className="ml-small">No source tags are recorded for these records.</p>}
          </aside>}

          {canvasLens && lens !== "map" && result.graph.nodes.length > 0 && <div className={"ml-key" + (keyOpen ? "" : " ml-key--closed")}>
            <button type="button" className="ml-key-toggle" aria-expanded={keyOpen} onClick={() => setKeyOpen(v => !v)}>Key</button>
            {keyOpen && <div className="ml-key-body" aria-label="How to read this atlas">
              <ul className="ml-key-types">{typesPresent.filter(t => t !== "topic" && t !== "methodology" && t !== "outcome").map(t =>
                <li key={t}><TypeMark type={t}/>{TYPE_PLURAL[t]}</li>)}</ul>
              <ul className="ml-key-grammar">
                {lens !== "themes" && <li><span className="ml-key-ink"/>Ink · recorded in a source</li>}
                {lens === "network" && <li><span className="ml-key-pencil"/>Pencil · inferred, not confirmed</li>}
                <li><span className="ml-key-wash"/>{lens === "themes"
                  ? "Area · records sharing a source tag" : "Wash · drawn to help you navigate"}</li>
              </ul>
            </div>}
          </div>}

          {routeFromId && <div className="ml-follow-dock">
            <FollowConnection graph={graph} fromId={routeFromId} onChoose={setSelectedId} onRoute={onRoute}
              onClose={() => { setRouteFromId(null); setTrail(null); }}/>
          </div>}

          {browse && <section className="ml-browse" aria-label="Keyboard-accessible record list">
            <div className="ml-browse-head"><h2>Browse records · {recordList.length.toLocaleString("en-GB")}</h2>
              <button type="button" className="ml-quiet" onClick={() => setBrowse(false)} aria-label="Close list">×</button></div>
            <p className="ml-small">Every matching record, including any not drawn on a dense view.</p>
            <div className="ml-browse-list">{recordList.slice(0, browseLimit).map(n => <button type="button" key={n.id}
              aria-pressed={selectedId === n.id} onClick={() => setSelectedId(n.id)}>
              <TypeMark type={n.type}/><strong>{n.label}</strong><small>{n.type}</small></button>)}</div>
            {recordList.length > browseLimit && <button className="ml-browse-next" type="button" onClick={() => setBrowseLimit(n => n + 100)}>
              Show 100 more · {recordList.length - browseLimit} not listed yet</button>}
          </section>}

          {notice && <div className="ml-toast" role="status">{notice}<button type="button" onClick={() => setNotice("")}>Dismiss</button></div>}
        </div>
        {lens !== "timeline" && <TimeStrip graph={undated.graph} range={range} onRange={setRange}
          inView={result.recordedCount} theme={activeTheme}/>}
      </div>

      <aside className="ml-inspector" aria-label="Selected record">
        {selected && <button type="button" className="ml-inspector-close" onClick={() => setSelectedId(null)}
          aria-label="Clear selection">×</button>}
        <RecordPanel source={graph} view={result.graph} node={selected} flows={flowsAll} leads={leads}
          totalRecords={graph.nodes.length} totalRecorded={recordedTotal}
          onPick={setSelectedId} onFollow={id => { setRouteFromId(id); }} onConfirm={confirm}/>
      </aside>
    </section>
    <div className="ml-announcer" role="status" aria-live="polite">
      {selected ? selected.label + ", " + selected.type + ", " + (degree.get(selected.id) ?? 0) + " recorded links" : ""}
    </div>
  </main>;
}
