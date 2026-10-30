"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collaborationGraph, confirmInferredRelationship, defaultGrouping, emptyAnnotationLayer, fundingFlows, grantsAsLinks, graphFingerprint,
  groupRecords, groupingOptions, type GroupingKind, connectionTypes, edgePolarity, feedbackLoops, loopLabels,
  applyEdits, toKumuWorkbook,
  graphWithAnnotations, isRecorded, parseAnnotationLayer, placedCoordinates, projectAtlas,
  type AtlasAnnotationLayer, type AtlasFilters, type AtlasLens, type ConnectionTrail,
  type GraphDocument, type GraphEdge, type NodeType, stepRecords, type Story, type StoryMark, type StoryView
} from "@mossline/graph-core";
import { useStories } from "../hooks/useStories";
import type { StoryPin } from "./atlas/MarkLayer";
import { MARK_NEEDS, StoryCard, StoryEditor, StoryReader, makeMark, markPrompt, type MarkPick } from "./atlas/Stories";
import { loadFundingDataset } from "../lib/funding-dataset-store";
import { useMapEdits } from "../hooks/useMapEdits";
import { ChangeList, QuickEntry, RecordCreator, type EditingApi } from "./atlas/Editing";
import { FollowConnection } from "./FollowConnection";
import { NetworkLens, type AtlasRoute } from "./atlas/NetworkLens";
import { useAtlasTheme } from "./atlas/theme";
import { useAtlasStyle } from "./atlas/sketch";
import { MapLens } from "./atlas/MapLens";
import { FundingLens } from "./atlas/FundingLens";
import { TimeStrip, TimelineLens, type YearRange } from "./atlas/TimeLens";
import { RecordPanel, TypeMark } from "./atlas/RecordPanel";
import { PublishCard } from "./atlas/PublishCard";
import { ShareMapCard } from "./atlas/ShareMapCard";
import type { SharedLink } from "../lib/map-library";
import { useAccount } from "../hooks/useAccount";
import { LINK_INKS, SIGN_INKS, TYPE_PLURAL, type AtlasTheme } from "./atlas/palette";

const LENSES: { id: AtlasLens; label: string; help: string }[] = [
  { id: "network", label: "Network", help: "Position follows recorded relationships" },
  { id: "map", label: "Map", help: "Position follows source coordinates" },
  { id: "themes", label: "Themes", help: "Areas follow a grouping you choose: source tags, programme, place, funder or suggested topics" },
  { id: "funding", label: "Funding", help: "Recorded funding, not implied collaboration" },
  { id: "timeline", label: "Timeline", help: "Dates on recorded relationships" }
];
const SUGGESTION_LIMIT = { nodes: 5000, edges: 10000 };

export function FieldAtlasWorkspace({ graph: imported, datasetId, mapId, onBack, onImport, onAdvanced, example, message = "", onMessageShown, readOnly = false, shared, onSharedChange, onSharedRefresh, story: publishedStory, published }: {
  graph: GraphDocument; datasetId?: string; onBack: () => void; onImport: () => void; onAdvanced: () => void; example?: boolean;
  /** The saved map's ID: changes made here are kept under it. */
  mapId?: string;
  /** Shown once, e.g. after adding data; onMessageShown lets the owner clear it. */
  message?: string; onMessageShown?: () => void;
  /** A published copy: explore only. No editing, reviews, data menus or publishing, and nothing read from this browser's storage. */
  readOnly?: boolean;
  /** This map's copy in a Mossline account, if it has one; onSharedChange records saving, leaving or deleting it. */
  shared?: SharedLink; onSharedChange?: (link: SharedLink | undefined) => void;
  /** Fetch the newer imported records someone added to this shared map. */
  onSharedRefresh?: () => void;
  /** A published story to open with: the page starts reading it. */
  story?: Story;
  /** A published copy: its address, and whether it's embedded in another site. */
  published?: { slug: string; embedded: boolean };
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
  // ---- Changes made here sit beside the imported records ---------------------
  const edits = useMapEdits(readOnly ? undefined : mapId, !readOnly, shared);
  const viewOnly = readOnly || shared?.role === "viewer";
  const editedMap = useMemo(() => applyEdits(sourceGraph, edits.layer), [sourceGraph, edits.layer]);
  const workingGraph = editedMap.graph;

  // ---- Reviewer confirmations: a separate, dataset-bound annotation layer -----
  const [annotations, setAnnotations] = useState<AtlasAnnotationLayer>(() => emptyAnnotationLayer(graphKey));
  const storageKey = "mossline:atlas-annotations:v1:" + graphKey;
  const [annotationsReady, setAnnotationsReady] = useState(false);
  const annotationFileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      if (readOnly) { setAnnotations(emptyAnnotationLayer(graphKey)); setAnnotationsReady(true); return; }
      const stored = window.localStorage.getItem(storageKey);
      setAnnotations(stored ? parseAnnotationLayer(JSON.parse(stored), graphKey) : emptyAnnotationLayer(graphKey));
    } catch { setAnnotations(emptyAnnotationLayer(graphKey)); }
    setAnnotationsReady(true);
  }, [storageKey, graphKey, readOnly]);
  useEffect(() => {
    if (readOnly || !annotationsReady || annotations.graphKey !== graphKey) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(annotations)); } catch { /* storage full or blocked */ }
  }, [annotations, annotationsReady, graphKey, storageKey]);
  const largeSource = workingGraph.nodes.length > SUGGESTION_LIMIT.nodes || workingGraph.edges.length > SUGGESTION_LIMIT.edges;
  const proposedGraph = useMemo(() => {
    // Shared-funder/project associations are pencil: derived, reversible, never counted.
    if (largeSource) return workingGraph;
    const existing = new Set(workingGraph.edges.map(e => e.id));
    const suggestions = collaborationGraph(workingGraph, "all").edges.filter(e => e.inferred && !existing.has(e.id));
    return suggestions.length ? { ...workingGraph, edges: [...workingGraph.edges, ...suggestions] } : workingGraph;
  }, [workingGraph, largeSource]);
  const graph = useMemo(() => graphWithAnnotations(proposedGraph,
    annotations.graphKey === graphKey ? annotations : emptyAnnotationLayer(graphKey)), [proposedGraph, annotations, graphKey]);

  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!message) return;
    setNotice(message); onMessageShown?.();
  }, [message, onMessageShown]);
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
  const [groupChoice, setGroupChoice] = useState<GroupingKind | null>(null);
  const [grantView, setGrantView] = useState<"links" | "records" | null>(null);
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
  const [urlReady, setUrlReady] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const shareRef = useRef<HTMLDetailsElement>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const accountState = useAccount(!readOnly).state;
  const publishing = accountState.status === "ready";
  const sharing = accountState.status === "ready" && accountState.sharedMaps;
  const [shareOpen, setShareOpen] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("lens");
    if (LENSES.some(l => l.id === requested)) setLens(requested as AtlasLens);
    setSelectedId(params.get("record")); setSearch(params.get("q") ?? "");
    setTheme(params.get("theme") ?? ""); setRegion(params.get("region") ?? "");
    const g = params.get("group");
    if (g && ["tags", "topics", "programme", "funder", "place"].includes(g)) setGroupChoice(g as GroupingKind);
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
    for (const key of ["lens", "record", "q", "theme", "group", "region", "funder", "year", "from", "to", "type"]) url.searchParams.delete(key);
    if (groupChoice) url.searchParams.set("group", groupChoice);
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
  }, [urlReady, lens, selectedId, search, theme, groupChoice, region, funderId, range, type]);
  useEffect(() => {
    const listener = (e: globalThis.KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape") { if (pickingRef.current) { setPickingFrom(null); return; } setSelectedId(null); setBrowse(false); }
      const index = Number(e.key) - 1;
      if (index >= 0 && index < LENSES.length) setLens(LENSES[index].id);
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  // ---- Groupings: worked out once a lens or filter needs them ---------------
  const sourceFlows = useMemo(() => fundingFlows(graph), [graph]);
  const [groupsWanted, setGroupsWanted] = useState(false);
  useEffect(() => { if (lens === "themes" || lens === "funding" || lens === "timeline" || theme) setGroupsWanted(true); }, [lens, theme]);
  const groupOptions = useMemo(() => groupsWanted ? groupingOptions(graph, sourceFlows) : [], [groupsWanted, graph, sourceFlows]);
  const groupKind: GroupingKind = groupChoice && groupOptions.some(o => o.kind === groupChoice) ? groupChoice
    : defaultGrouping(groupOptions, graph.nodes.length);
  const grouping = useMemo(() => groupsWanted ? groupRecords(graph, groupKind, sourceFlows) : null, [groupsWanted, graph, groupKind, sourceFlows]);
  const groupOption = groupOptions.find(o => o.kind === groupKind);
  /** Records in the chosen group, with the funders and recipients of their grants for context. */
  const groupIds = useMemo(() => {
    if (!theme || !grouping || groupKind === "tags") return undefined;
    const ids = new Set<string>();
    for (const [id, g] of grouping.of) if (g === theme) ids.add(id);
    for (const f of sourceFlows) if (ids.has(f.recipientId) || (f.grantId && ids.has(f.grantId))) {
      ids.add(f.funderId); ids.add(f.recipientId); if (f.grantId) ids.add(f.grantId);
    }
    return ids;
  }, [theme, grouping, groupKind, sourceFlows]);
  const chooseGroup = (kind: GroupingKind) => { setGroupChoice(kind); setTheme(""); };

  // ---- Projections ------------------------------------------------------------
  const [hiddenLinks, setHiddenLinks] = useState<Set<string>>(new Set());
  const baseFilters: AtlasFilters = useMemo(() => ({ query: search, theme, region, funderId: funderId || undefined, groupIds,
    hiddenLinkTypes: hiddenLinks.size ? hiddenLinks : undefined,
    types: type ? [type] : undefined }), [search, theme, region, funderId, type, groupIds, hiddenLinks]);
  const filters: AtlasFilters = useMemo(() => ({ ...baseFilters, fromYear: range.from ?? undefined, toYear: range.to ?? undefined }),
    [baseFilters, range]);
  const result = useMemo(() => projectAtlas(graph, filters), [graph, filters]);
  const undated = useMemo(() => projectAtlas(graph, baseFilters), [graph, baseFilters]);
  const selected = useMemo(() => graph.nodes.find(n => n.id === selectedId) ?? null, [graph, selectedId]);
  useEffect(() => { if (selected?.type === "funder") setGroupsWanted(true); }, [selected]);
  const flowsAll = sourceFlows;
  const flowsView = useMemo(() => fundingFlows(result.graph), [result.graph]);
  const flowsUndated = useMemo(() => fundingFlows(undated.graph), [undated.graph]);
  const recordedTotal = useMemo(() => graph.edges.filter(isRecorded).length, [graph]);
  const themes = useMemo(() => grouping && groupKind !== "tags" ? grouping.groups.slice(0, 80).map(g => g.name)
    : [...new Set(graph.nodes.flatMap(n => n.tags))].sort(), [graph, grouping, groupKind]);
  // Grants drawn as links between funder and recipient when there are many of them.
  const grantCount = useMemo(() => sourceFlows.filter(f => f.grantId).length, [sourceFlows]);
  const showGrantsAs = grantView ?? (grantCount >= 100 ? "links" : "records");
  const linksView = useMemo(() => grantCount && showGrantsAs === "links" ? grantsAsLinks(result.graph, flowsView) : null,
    [grantCount, showGrantsAs, result.graph, flowsView]);
  const alias = useMemo(() => linksView ? new Map([...linksView.grantEnds].map(([g, e]) => [g, e.recipientId])) : undefined, [linksView]);
  const drawnAll = linksView?.graph ?? result.graph;
  // Summary links (grants drawn as links) are hidden here; source links are left out by the filter.
  const drawn = useMemo(() => hiddenLinks.size ? { ...drawnAll, edges: drawnAll.edges.filter(e => !hiddenLinks.has(e.type)) } : drawnAll,
    [drawnAll, hiddenLinks]);
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
  const unplaced = useMemo(() => result.graph.nodes.filter(n => !placedCoordinates(n)), [result.graph]);
  /** Group sizes among the records drawn in the Themes lens. */
  const groupCounts = useMemo(() => {
    if (!grouping) return [] as [string, number][];
    const counts = new Map<string, number>();
    for (const n of drawn.nodes) { const g = grouping.of.get(n.id); if (g) counts.set(g, (counts.get(g) ?? 0) + 1); }
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [grouping, drawn]);
  // One Night/Day choice for every lens and page, remembered on this device.
  const [activeTheme, chooseTheme] = useAtlasTheme();
  const [drawingStyle, chooseStyle] = useAtlasStyle();
  const activeThemeRef = useRef(activeTheme); activeThemeRef.current = activeTheme;
  const byLabel = useMemo(() => new Map(graph.nodes.map(n => [n.id, n.label])), [graph]);
  // ---- Kinds of link, signs and feedback loops -----------------------------------
  /** The kinds of recorded link as drawn; hidden kinds stay listed so they can be shown again. */
  const linkTypes = useMemo(() => {
    const shown = connectionTypes(drawn);
    return [...shown, ...[...hiddenLinks].filter(t => !shown.some(x => x.type === t)).map(type => ({ type, count: 0, directed: 0, signed: 0 }))];
  }, [drawn, hiddenLinks]);
  const signedShare = useMemo(() => {
    const total = linkTypes.reduce((s, t) => s + t.count, 0);
    return total ? linkTypes.reduce((s, t) => s + t.signed, 0) / total : 0;
  }, [linkTypes]);
  // A cause-and-effect map is coloured by sign; a map with a handful of kinds, by kind; otherwise plain ink.
  const linkMode: "sign" | "type" | "plain" = signedShare >= 0.5 ? "sign" : linkTypes.length >= 2 && linkTypes.length <= LINK_INKS.day.length ? "type" : "plain";
  const linkInk = useMemo(() => new Map(linkTypes.slice(0, LINK_INKS.day.length).map((t, i) => [t.type, i])), [linkTypes]);
  const linkColour = useCallback((e: GraphEdge) => {
    if (linkMode === "sign") { const p = edgePolarity(e); return p ? SIGN_INKS[activeThemeRef.current][p === "+" ? "plus" : "minus"] : null; }
    if (linkMode === "type") { const i = linkInk.get(e.type); return i === undefined ? null : LINK_INKS[activeThemeRef.current][i]; }
    return null;
  }, [linkMode, linkInk]);
  const toggleLink = (t: string) => setHiddenLinks(h => { const n = new Set(h); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const loopsFound = useMemo(() => lens === "network" || selectedId ? feedbackLoops(result.graph) : { loops: [], truncated: false },
    [lens, selectedId, result.graph]);
  const loopLabel = useMemo(() => loopLabels(loopsFound.loops), [loopsFound]);
  const [loopId, setLoopId] = useState<string | null>(null);
  const loop = loopId ? loopsFound.loops.find(l => l.id === loopId) ?? null : null;
  const [loopsOpen, setLoopsOpen] = useState(true);
  // On a phone the list starts folded, so the drawing comes first.
  useEffect(() => { if (window.innerWidth <= 720) setLoopsOpen(false); }, []);
  const route: AtlasRoute | null = useMemo(() => loop ? { nodeIds: loop.nodeIds, edgeIds: loop.edgeIds }
    : trail && trail.steps.length ? {
    nodeIds: [trail.steps[0].fromId, ...trail.steps.map(s => s.toId)], edgeIds: trail.steps.map(s => s.edgeId)
  } : null, [trail, loop]);
  const showLoop = useCallback((id: string | null) => { setLoopId(id); if (id) { setTrail(null); setRouteFromId(null); setLens("network"); } }, []);
  const onRoute = useCallback((next: ConnectionTrail | null) => {
    if (next) setLoopId(null);
    setTrail(next);
    if (next) setLens(current => current === "network" || current === "map" ? current : "network");
  }, []);
  // ---- Stories ------------------------------------------------------------------
  // Kept in this browser with the map (by its saved ID, or by its data for maps that aren't saved).
  const storyKey = mapId ?? graphKey;
  const [storyId, setStoryId] = useState<string | null>(publishedStory?.id ?? null);
  const [storyMode, setStoryMode] = useState<null | "edit" | "read" | "present">(publishedStory ? "read" : null);
  const presentFrom = useRef<"edit" | "read">("read");
  const [stepIndex, setStepIndex] = useState(0);
  const [markPick, setMarkPick] = useState<MarkPick | null>(null);
  const markPickRef = useRef(markPick); markPickRef.current = markPick;
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(max-width: 720px)"); const on = () => setNarrow(q.matches);
    on(); q.addEventListener("change", on); return () => q.removeEventListener("change", on);
  }, []);
  const storyStore = useStories({ storeKey: storyKey, sharedId: shared?.id, readOnly, published: publishedStory,
    active: storyMode !== null, onNotice: setNotice });
  const { stories, change: changeStory, flush: flushStory } = storyStore;
  const story = stories.find(s => s.id === storyId) ?? null;
  const step = story && storyMode ? story.steps[Math.min(stepIndex, story.steps.length - 1)] ?? null : null;
  const captureView = (): StoryView => ({ lens,
    ...(selectedId ? { record: selectedId } : {}), ...(search ? { q: search.slice(0, 200) } : {}), ...(theme ? { theme } : {}),
    ...(groupChoice ? { group: groupChoice } : {}), ...(region ? { region } : {}), ...(funderId ? { funder: funderId } : {}),
    ...(type ? { type } : {}), ...(range.from !== null ? { from: range.from } : {}), ...(range.to !== null ? { to: range.to } : {}),
    ...(loopId ? { loop: loopId } : {}) });
  /** Shows a step's view of the map. */
  const viewKey = step ? step.id + JSON.stringify(step.view) : "";
  useEffect(() => {
    if (!step) return;
    const v = step.view;
    setLens(v.lens); setSelectedId(v.record ?? null); setSearch(v.q ?? ""); setTheme(v.theme ?? "");
    setGroupChoice(v.group && ["tags", "topics", "programme", "funder", "place"].includes(v.group) ? v.group as GroupingKind : null);
    setRegion(v.region ?? ""); setFunderId(v.funder ?? ""); setType(v.type && v.type in TYPE_PLURAL ? v.type as NodeType : null);
    setRange({ from: v.from ?? null, to: v.to ?? null }); setLoopId(v.loop ?? null); setTrail(null); setRouteFromId(null); setBrowse(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);
  // A mark is finished once it has the records it needs (a ring when the author says so).
  useEffect(() => {
    if (!markPick || !story || !step || markPick.kind === "ring" || markPick.targets.length < MARK_NEEDS[markPick.kind]) return;
    const pick = markPick;
    changeStory({ ...story, steps: story.steps.map(s => s.id !== step.id ? s : pick.kind === "pin"
      ? { ...s, media: s.media.map(m => m.id === pick.mediaId && m.kind === "image" ? { ...m, record: pick.targets[0] } : m) }
      : { ...s, marks: [...s.marks, makeMark({ ...pick, kind: pick.kind }, s)] }) });
    setMarkPick(null);
  }, [markPick, story, step, changeStory]);
  const finishRing = () => {
    if (markPick?.kind === "ring" && markPick.targets.length && story && step)
      changeStory({ ...story, steps: story.steps.map(s => s.id === step.id ? { ...s, marks: [...s.marks, makeMark({ ...markPick, kind: "ring" }, s)] } : s) });
    setMarkPick(null);
  };
  useEffect(() => { if (storyMode !== "edit") setMarkPick(null); }, [storyMode, stepIndex]);
  const storyMarks: StoryMark[] | undefined = step ? [...step.marks,
    ...(markPick?.targets.length ? [{ id: "picking", kind: "ring" as const, targets: markPick.targets }] : [])] : undefined;
  const storyPins: StoryPin[] | undefined = step ? step.media.flatMap(m => m.kind === "image" && m.record
    ? [{ id: m.id, record: m.record, src: m.src, alt: m.alt }] : []) : undefined;
  const storyFrame = step && (storyMode === "read" || storyMode === "present") ? stepRecords(step) : undefined;
  const reading = !!story && (storyMode === "read" || storyMode === "present");
  // A title card opens presenting, and reading on a phone; any move past it begins the story.
  const [cover, setCover] = useState(!!publishedStory);
  const goToStep = useCallback((i: number) => { setCover(false); setStepIndex(i); }, []);
  /** The title card only shows where a card does: presenting, or reading on a phone. */
  const coverShown = cover && (storyMode === "present" || narrow);
  const startStory = (mode: "read" | "present", from: "edit" | "read") => { presentFrom.current = from; setCover(true); setStoryMode(mode); };
  // The step a published story is on is part of its address, so a link can open on it.
  useEffect(() => {
    if (!readOnly || !publishedStory) return;
    const n = Number(new URLSearchParams(window.location.search).get("step"));
    if (Number.isInteger(n) && n >= 1 && n <= publishedStory.steps.length) { setStepIndex(n - 1); if (n > 1) setCover(false); }
  }, [readOnly, publishedStory]);
  useEffect(() => {
    if (!readOnly || !publishedStory || !urlReady) return;
    const url = new URL(window.location.href);
    if (reading && !coverShown) url.searchParams.set("step", String(stepIndex + 1)); else url.searchParams.delete("step");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [readOnly, publishedStory, reading, coverShown, stepIndex, urlReady, lens, selectedId]);
  const fullPage = () => window.location.origin + (published ? "/p/" + published.slug : window.location.pathname);
  const embedded = !!published?.embedded;
  const [embedOpen, setEmbedOpen] = useState(false);
  const copyStepLink = (i: number) => {
    const url = fullPage() + "?step=" + (i + 1);
    void navigator.clipboard?.writeText(url).then(() => setNotice("Link to step " + (i + 1) + " copied.")).catch(() => setNotice("Copy the address from your browser."));
  };
  /** A step's records stand out: the rest of the map fades, and the links between them are drawn. */
  const spotlight: AtlasRoute | null = useMemo(() => {
    if (!step || !reading || step.fade === false || step.view.loop) return null;
    const present = new Set(drawn.nodes.map(n => n.id));
    const ids = new Set(stepRecords(step).map(id => alias?.get(id) ?? id).filter(id => present.has(id)));
    if (ids.size < 2) return null;
    return { nodeIds: [...ids], edgeIds: drawn.edges.filter(e => isRecorded(e) && ids.has(e.source) && ids.has(e.target)).map(e => e.id) };
  }, [step, reading, drawn, alias]);
  const exitStory = () => { if (storyMode === "present") setStoryMode(presentFrom.current); else setStoryMode(readOnly ? null : "edit"); };
  const exitLabel = storyMode === "present" ? "Stop presenting" : readOnly ? "Explore the map" : "Back to writing";
  useEffect(() => {
    if (!reading || !story) return;
    const listener = (e: globalThis.KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      // A picture open full size has the keys (Esc closes it, not the story).
      if (document.querySelector("dialog.ml-lightbox[open]")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); if (coverRef.current) setCover(false); else setStepIndex(i => Math.min(i + 1, story.steps.length - 1)); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); setCover(false); setStepIndex(i => Math.max(i - 1, 0)); }
      if (e.key === "Escape" && storyMode === "present") setStoryMode(presentFrom.current);
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [reading, story, storyMode]);
  const coverRef = useRef(coverShown); coverRef.current = coverShown;
  const openStories = () => { setEditMode(false); setKeyOpen(false); setPickingFrom(null); setPublishOpen(false); setShareOpen(false); setStoryMode("edit"); };

  // ---- Editing ------------------------------------------------------------------
  const [editMode, setEditMode] = useState(false);
  const [editTab, setEditTab] = useState<"add" | "quick" | "changes">("add");
  const [editCardOpen, setEditCardOpen] = useState(true);
  /** Choosing a link's other end on the map: the record it starts from, and the one picked. */
  const [pickingFrom, setPickingFrom] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const pickingRef = useRef(pickingFrom); pickingRef.current = pickingFrom;
  const pickRecord = useCallback((id: string | null) => {
    if (markPickRef.current) {
      if (id) setMarkPick(p => p && !p.targets.includes(id) ? { ...p, targets: [...p.targets, id] } : p);
      return;
    }
    const from = pickingRef.current;
    if (from) {
      if (id && id !== from) { setPicked(id); setPickingFrom(null); setSelectedId(from); }
      return;
    }
    setSelectedId(id);
  }, []);
  const liveChanges = edits.layer.entries.filter(e => !e.undone).length;
  const editing: EditingApi | null = useMemo(() => editMode ? {
    graph: workingGraph, editor: edits.editor || "you", add: list => { edits.add(list); },
    pickTarget: from => { setPickingFrom(from); setPicked(null); }, picked, clearPicked: () => setPicked(null),
    linkKinds: connectionTypes(workingGraph).map(t => t.type).filter(t => t !== "funded").slice(0, 40)
  } : null, [editMode, workingGraph, edits, picked]);
  const download = (name: string, data: BlobPart, type: string) => {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement("a"); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
  const fileStem = (imported.title || "mossline-map").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60) || "mossline-map";
  /** A record's name, even when it has since been removed or never arrived. */
  const labelOf = (id: string) => {
    const now = workingGraph.nodes.find(n => n.id === id) ?? sourceGraph.nodes.find(n => n.id === id);
    if (now) return now.label;
    for (const e of edits.layer.entries) {
      if (e.op.kind === "remove-node" && e.op.id === id) return e.op.label;
      if (e.op.kind === "add-node" && e.op.node.id === id) return e.op.node.label;
    }
    return "a record no longer in this map";
  };
  function exportEdits(kind: "map" | "kumu" | "changes") {
    if (kind === "map") download(fileStem + ".json", JSON.stringify(workingGraph, null, 2), "application/json");
    else if (kind === "kumu") download(fileStem + "-kumu.xlsx", toKumuWorkbook(workingGraph) as BlobPart,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    else download(fileStem + "-changes.json", JSON.stringify(edits.layer, null, 2), "application/json");
    setNotice(kind === "changes" ? "Changes saved as a separate backup file." : "Map exported with your changes. Each item notes where it came from.");
  }
  const onUnavailable = useCallback(() =>
    setNotice("This device cannot draw the network. Browse records lists everything; Advanced tools has the previous explorer."), []);


  const activeFilters = [search, type, theme, region, funderId, range.from ?? range.to ?? ""].filter(v => v !== "" && v !== null).length;
  const clearAll = () => { setSearch(""); setType(null); setTheme(""); setRegion(""); setFunderId(""); setRange({ from: null, to: null }); };
  const canvasLens = lens === "network" || lens === "themes" || lens === "map";
  const funderName = funderId ? graph.nodes.find(n => n.id === funderId)?.label : "";
  const closeMenu = () => { if (menuRef.current) menuRef.current.open = false; };
  const closeShare = () => { if (shareRef.current) shareRef.current.open = false; };

  return <main className={"ml-atlas" + (storyMode === "present" ? " ml-atlas--presenting" : "") + (reading ? " ml-atlas--reading" : "") + (storyMode === "edit" ? " ml-atlas--writing" : "") + (embedded ? " ml-atlas--embedded" : "")}
    data-theme={activeTheme} data-lens={lens}>
    <header className="ml-header">
      {embedded ? <a className="ml-wordmark" href={"/p/" + (published?.slug ?? "") + (reading ? "?step=" + (stepIndex + 1) : "")} target="_blank" rel="noopener"
        aria-label="Open this in Mossline (new tab)">
        <svg viewBox="0 0 26 26" aria-hidden="true"><path d="M3 19C8 19 9 8 14 8S20 15 23 6" className="ml-mark-line"/>
          <circle cx="3.5" cy="19" r="2.6" className="ml-mark-a"/><circle cx="14" cy="8" r="2.6" className="ml-mark-b"/>
          <circle cx="22.6" cy="6.4" r="2.6" className="ml-mark-c"/></svg>
        <span>Mossline</span>
      </a> :
      <button className="ml-wordmark" type="button" onClick={onBack} aria-label="Mossline — all maps">
        <svg viewBox="0 0 26 26" aria-hidden="true"><path d="M3 19C8 19 9 8 14 8S20 15 23 6" className="ml-mark-line"/>
          <circle cx="3.5" cy="19" r="2.6" className="ml-mark-a"/><circle cx="14" cy="8" r="2.6" className="ml-mark-b"/>
          <circle cx="22.6" cy="6.4" r="2.6" className="ml-mark-c"/></svg>
        <span>Mossline</span>
      </button>}
      {readOnly ? <div className="ml-dataset ml-dataset--static">
        <strong>{imported.title}</strong>
        <small>{graph.nodes.length.toLocaleString("en-GB")} records · {recordedTotal.toLocaleString("en-GB")} recorded links · published copy</small>
      </div> : <>
      <details className="ml-dataset" ref={menuRef}>
        <summary>
          <strong>{imported.title}</strong>
          <small>{graph.nodes.length.toLocaleString("en-GB")} records · {recordedTotal.toLocaleString("en-GB")} recorded links
            {example ? " · example data" : ""}</small>
        </summary>
        <div className="ml-menu" role="group" aria-label="Map and data">
          <button type="button" onClick={() => { closeMenu(); onBack(); }}>All maps</button>
          {!viewOnly && <button type="button" onClick={() => { closeMenu(); onImport(); }}>Add data…</button>}
          <button type="button" onClick={() => { closeMenu(); openStories(); }}>Stories{stories.length ? " · " + stories.length : ""}…</button>
          {(sharing || shared) && <button type="button" onClick={() => { closeMenu(); setPublishOpen(false); setShareOpen(true); }}>
            {shared ? "Sharing…" : "Save to your account…"}</button>}
          <hr/>
          <p className="ml-menu-note">Reviewer confirmations are stored separately from your source records.</p>
          <button type="button" onClick={() => { closeMenu(); exportAnnotations(); }} disabled={!annotations.entries.length}>
            Export reviews ({annotations.entries.length})</button>
          <button type="button" onClick={() => { closeMenu(); annotationFileRef.current?.click(); }}>Restore reviews</button>
          <hr/>
          <button type="button" onClick={() => { closeMenu(); onAdvanced(); }}>Advanced tools ↗</button>
        </div>
      </details>
      </>}
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
        {shared ? <button type="button" className={"ml-local ml-shared-badge is-" + edits.status.state} onClick={() => { setPublishOpen(false); setShareOpen(true); }}
          title={edits.status.state === "offline" ? edits.status.message : "Who has this map"}>
          <i aria-hidden="true"/><span className="ml-shared-text">{edits.status.state === "offline" ? "Shared · offline" : edits.status.state === "syncing" ? "Shared · updating" : "Shared"}
          {shared.role === "viewer" ? " · view only" : ""}</span></button>
          : <span className="ml-local"><i aria-hidden="true"/>{readOnly ? "Read-only" : "On this device"}</span>}
        {!viewOnly && <button type="button" className={editMode ? "ml-solid ml-edit-toggle" : "ml-quiet ml-edit-toggle"} aria-pressed={editMode}
          onClick={() => { setEditMode(v => { if (!v) setKeyOpen(false); return !v; }); setPickingFrom(null); setPicked(null); setStoryMode(null); }}>
          {editMode ? "Done" : "Edit"}{liveChanges > 0 && !editMode ? <span className="ml-edit-count"> · {liveChanges}</span> : null}</button>}
        <button type="button" className="ml-quiet" onClick={() => chooseTheme(activeTheme === "night" ? "day" : "night")}
          aria-label={activeTheme === "night" ? "Use day colours" : "Use night colours"}>{activeTheme === "night" ? "Day" : "Night"}</button>
        {readOnly && story && !storyMode && <button type="button" className="ml-quiet" onClick={() => { setStepIndex(0); startStory("read", "read"); }}>Read the story</button>}
        {embedded ? <a className="ml-solid ml-account-button" href={"/p/" + (published?.slug ?? "") + (reading ? "?step=" + (stepIndex + 1) : "")} target="_blank" rel="noopener">
          Open full page ↗</a> : readOnly ? <>
          {published && <button type="button" className="ml-quiet" aria-expanded={embedOpen} onClick={() => setEmbedOpen(v => !v)}>Embed</button>}
          <button type="button" className="ml-solid" onClick={() => navigator.clipboard?.writeText(fullPage())
          .then(() => setNotice("Link copied.")).catch(() => setNotice("Copy the address from your browser."))}>Copy link</button></> :
        <details className="ml-share" ref={shareRef}>
          <summary className="ml-solid">Share</summary>
          <div className="ml-menu ml-menu--right" role="group" aria-label="Share">
            <button type="button" onClick={() => { closeShare(); void navigator.clipboard?.writeText(window.location.href).then(() =>
              setNotice("View link copied. The underlying local dataset does not travel with the link."))
              .catch(() => setNotice("Copy the address from your browser.")); }}>Copy view link</button>
            <p className="ml-menu-note">Opens this view for someone with the same data in their browser.</p>
            {publishing && <><hr/>
              <button type="button" onClick={() => { closeShare(); setShareOpen(false); setPublishOpen(true); }}>Publish online…</button>
              <p className="ml-menu-note">A reviewed copy of what&apos;s drawn, at a link anyone can open. Needs an account.</p></>}
          </div>
        </details>}
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
                <option value="">{groupOption && groupKind !== "tags" ? "Any " + groupOption.label.toLowerCase().replace(/^main /, "") : "Any theme"}</option>
                {themes.map(t => <option key={t}>{t}</option>)}</select></label>
            {grantCount > 0 && (lens === "network" || lens === "themes") && <label className={"ml-chip" + (showGrantsAs === "records" ? " is-on" : "")}>
              <span className="ml-visually-hidden">Grants</span>
              <select aria-label="Grants" value={showGrantsAs} onChange={e => setGrantView(e.target.value as "links" | "records")}>
                <option value="links">Grants as links</option><option value="records">Each grant as a record</option></select></label>}
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
            {(lens === "network" || lens === "themes") && <NetworkLens graph={drawn} mode={lens} theme={activeTheme}
              groupOf={grouping?.of} groupKey={groupKind} groupName={groupOption?.label} suggested={grouping?.suggested} alias={alias}
              linkColour={linkMode === "plain" ? undefined : linkColour} linkKey={linkMode + ":" + activeTheme}
              selectedId={selectedId} route={spotlight ?? (lens === "network" ? route : null)} onPick={pickRecord} onUnavailable={onUnavailable}
              marks={storyMarks} pins={storyPins} frame={storyFrame} frameKey={storyMode ?? ""} sketch={drawingStyle === "sketched"}/>}
            {lens === "map" && <MapLens graph={result.graph} flows={flowsView} theme={activeTheme} selectedId={selectedId} onPick={pickRecord}
              unplaced={unplaced} onBrowse={() => setBrowse(true)}
              marks={storyMarks} pins={storyPins} frame={storyFrame} frameKey={storyMode ?? ""} spotlight={spotlight?.nodeIds}/>}
            {lens === "funding" && <FundingLens graph={result.graph} flows={flowsView} theme={activeTheme} selectedId={selectedId} onPick={pickRecord}
              grouping={grouping} groupLabel={groupOption?.label ?? "Theme"}/>}
            {lens === "timeline" && <TimelineLens graph={undated.graph} flows={flowsUndated} range={range} onRange={setRange} theme={activeTheme}
              grouping={grouping} groupLabel={groupOption?.label ?? "Themes"}
              selectedId={selectedId} onPick={pickRecord}/>}
          </>}

          {lens === "themes" && result.graph.nodes.length > 0 && !storyMode && <aside className={"ml-overlay-card ml-tag-card" + (grouping?.suggested ? " is-suggested" : "")}
            aria-label="Groups">
            <label className="ml-group-by"><span>Group by</span>
              <select value={groupKind} onChange={e => chooseGroup(e.target.value as GroupingKind)}>
                {groupOptions.map(o => <option key={o.kind} value={o.kind}>{o.label}</option>)}</select></label>
            <p className="ml-overlay-note">{groupOption?.note ?? "Grouped by source tags"}
              {groupOption && <> · {groupOption.covered.toLocaleString("en-GB")} of {graph.nodes.length.toLocaleString("en-GB")} records</>}</p>
            <ol>{groupCounts.slice(0, 12).map(([name, count]) => <li key={name}>
              <button type="button" aria-pressed={theme === name} onClick={() => setTheme(theme === name ? "" : name)}>
                <span>{name}</span><b>{count}</b></button></li>)}</ol>
            {groupCounts.length > 12 && <p className="ml-small">{groupCounts.length - 12} more in the filter above.</p>}
            {groupCounts.length === 0 && <p className="ml-small">Nothing in this view can be grouped this way. Try another grouping.</p>}
            <div className="ml-style-switch"><span id="ml-style-label">Drawing · trial</span>
              <div className="ml-segmented" role="group" aria-labelledby="ml-style-label">
                {(["clean", "sketched"] as const).map(v => <button key={v} type="button" aria-pressed={drawingStyle === v}
                  onClick={() => chooseStyle(v)}>{v === "clean" ? "Clean" : "Sketched"}</button>)}
              </div></div>
          </aside>}

          {canvasLens && lens !== "map" && result.graph.nodes.length > 0 && !reading && <div className={"ml-key" + (keyOpen ? "" : " ml-key--closed")}>
            <button type="button" className="ml-key-toggle" aria-expanded={keyOpen} onClick={() => setKeyOpen(v => !v)}>Key</button>
            {keyOpen && <div className="ml-key-body" aria-label="How to read this atlas">
              <ul className="ml-key-types">{typesPresent.filter(t => t !== "topic" && t !== "methodology").map(t =>
                <li key={t}><TypeMark type={t}/>{TYPE_PLURAL[t]}</li>)}</ul>
              <ul className="ml-key-grammar">
                {lens !== "themes" && <li><span className="ml-key-ink"/>Ink · recorded in a source</li>}
                {lens === "network" && <li><span className="ml-key-pencil"/>Pencil · inferred, not confirmed</li>}
                <li><span className="ml-key-wash"/>{lens === "themes"
                  ? "Area · records sharing a source tag" : "Wash · drawn to help you navigate"}</li>
                {lens === "network" && linkTypes.some(t => t.directed > 0) && <li><span className="ml-key-arrow" aria-hidden="true">→</span>Arrows point the way a link is recorded</li>}
              </ul>
              {lens === "network" && linkTypes.length > 1 && <div className="ml-key-links">
                <p className="ml-key-links-head">{linkMode === "sign" ? "Cause and effect" : "Kinds of link"} · choose which to show</p>
                <ul>{(linkMode === "sign"
                  ? [{ key: "+", label: "+ more leads to more", colour: SIGN_INKS[activeTheme].plus },
                    { key: "-", label: "− more leads to less", colour: SIGN_INKS[activeTheme].minus }]
                  : []).map(s => <li key={s.key} className="ml-key-sign"><i style={{ background: s.colour }}/>{s.label}</li>)}
                  {linkTypes.slice(0, 12).map(t => <li key={t.type}>
                    <button type="button" aria-pressed={!hiddenLinks.has(t.type)} onClick={() => toggleLink(t.type)}
                      title={(hiddenLinks.has(t.type) ? "Show " : "Hide ") + t.type + " links"}>
                      <i style={{ background: linkMode === "type" && linkInk.has(t.type) ? LINK_INKS[activeTheme][linkInk.get(t.type)!] : undefined }}
                        className={linkMode === "type" && linkInk.has(t.type) ? "" : "is-ink"}/>
                      <span>{t.type}</span><b>{hiddenLinks.has(t.type) ? "hidden" : t.count.toLocaleString("en-GB")}</b></button></li>)}</ul>
                {hiddenLinks.size > 0 && <button type="button" className="ml-link-button" onClick={() => setHiddenLinks(new Set())}>Show every kind</button>}
              </div>}
            </div>}
          </div>}

          {lens === "network" && loopsFound.loops.length > 0 && !routeFromId && !storyMode && <aside className={"ml-overlay-card ml-loop-card" + (loopsOpen ? "" : " is-closed")} aria-label="Feedback loops">
            <button type="button" className="ml-unplaced-head" aria-expanded={loopsOpen} onClick={() => setLoopsOpen(v => !v)}>
              <strong>Feedback loops · {loopsFound.loops.length}{loopsFound.truncated ? "+" : ""}</strong><span aria-hidden="true">{loopsOpen ? "–" : "+"}</span></button>
            {loopsOpen && <>
              <p className="ml-small">Chains of recorded, directed links that come back to where they started.
                {signedShare > 0 && <> <strong>R</strong>einforcing loops build on themselves; <strong>B</strong>alancing loops push back.</>}</p>
              <ol>{loopsFound.loops.slice(0, 12).map(l => <li key={l.id}>
                <button type="button" aria-pressed={loopId === l.id} onClick={() => showLoop(loopId === l.id ? null : l.id)}>
                  <b className={"ml-loop-chip ml-loop-chip--" + l.kind}>{loopLabel.get(l.id)}</b>
                  <span>{l.nodeIds.map(id => byLabel.get(id) ?? id).join(" → ")} →</span>
                </button></li>)}</ol>
              {loopsFound.loops.length > 12 && <p className="ml-small">{loopsFound.loops.length - 12} more; select a record to see the loops it is in.</p>}
              {loopsFound.truncated && <p className="ml-small">This map has more loops than are listed; longer ones were not searched.</p>}
              {loop && <p className="ml-small" role="status">{loopLabel.get(loop.id)} is {loop.kind === "unknown" ? "a loop whose links do not all record a sign" : "a " + loop.kind + " loop"}
                {loop.kind !== "unknown" ? (loop.kind === "reinforcing" ? ": a change anywhere in it comes back stronger." : ": a change anywhere in it comes back weaker, steadying the loop.") : "."}</p>}
            </>}
          </aside>}

          {routeFromId && <div className="ml-follow-dock">
            <FollowConnection graph={graph} fromId={routeFromId} onChoose={setSelectedId} onRoute={onRoute}
              onClose={() => { setRouteFromId(null); setTrail(null); }}/>
          </div>}

          {browse && <section className="ml-browse" aria-label="Keyboard-accessible record list">
            <div className="ml-browse-head"><h2>Browse records · {recordList.length.toLocaleString("en-GB")}</h2>
              <button type="button" className="ml-quiet" onClick={() => setBrowse(false)} aria-label="Close list">×</button></div>
            <p className="ml-small">Every matching record, including any not drawn on a dense view.</p>
            <div className="ml-browse-list">{recordList.slice(0, browseLimit).map(n => <button type="button" key={n.id}
              aria-pressed={selectedId === n.id} onClick={() => pickRecord(n.id)}>
              <TypeMark type={n.type}/><strong>{n.label}</strong><small>{n.type}</small></button>)}</div>
            {recordList.length > browseLimit && <button className="ml-browse-next" type="button" onClick={() => setBrowseLimit(n => n + 100)}>
              Show 100 more · {recordList.length - browseLimit} not listed yet</button>}
          </section>}

          {editMode && <aside className={"ml-overlay-card ml-edit-card" + (editCardOpen ? "" : " is-closed")} aria-label="Editing this map">
            <button type="button" className="ml-unplaced-head" aria-expanded={editCardOpen} onClick={() => setEditCardOpen(v => !v)}>
              <strong>Editing this map</strong><span aria-hidden="true">{editCardOpen ? "–" : "+"}</span></button>
            {editCardOpen && <>
              <label className="ml-edit-field ml-edit-name"><span>Your name on changes</span>
                <input value={edits.editor} maxLength={80} placeholder="e.g. Tom" onChange={e => edits.setEditor(e.target.value)}/></label>
              <div className="ml-segmented ml-edit-tabs" role="group" aria-label="Editing">
                {([["add", "Add record"], ["quick", "Quick entry"], ["changes", "Changes · " + liveChanges]] as const).map(([id, text]) =>
                  <button key={id} type="button" aria-pressed={editTab === id} onClick={() => setEditTab(id)}>{text}</button>)}
              </div>
              {editing && editTab === "add" && <RecordCreator api={editing} onAdded={id => { setSelectedId(id);
                if (window.innerWidth <= 720) setEditCardOpen(false);
                setNotice("Record added. Use Add a link in the panel to connect it."); }}/>}
              {editing && editTab === "quick" && <QuickEntry api={editing}/>}
              {editTab === "changes" && <ChangeList layer={edits.layer} stale={editedMap.stale}
                label={labelOf}
                onUndo={(id, undone) => edits.undo(id, undone)} onExport={exportEdits}/>}
              <p className="ml-small">Select a record to change it or link it. Your files are never changed.</p>
            </>}
          </aside>}
          {storyMode === "edit" && !readOnly && <StoryEditor stories={stories} story={story} graph={workingGraph} stepIndex={stepIndex}
            labelOf={labelOf} captureView={captureView} picking={markPick} onPick={setMarkPick} onStep={setStepIndex} onChange={changeStory}
            canWrite={storyStore.canWrite} shared={storyStore.shared} local={storyStore.local} onMoveLocal={() => void storyStore.moveLocal()}
            onCreate={title => { const s = storyStore.create(title); setStoryId(s.id); setStepIndex(0); }}
            onOpen={id => { setStoryId(id); setStepIndex(0); }}
            onDelete={id => { storyStore.remove(id); setStoryId(null); }}
            onRead={() => startStory("read", "edit")}
            onPresent={() => startStory("present", "edit")}
            onClose={() => { flushStory(); setStoryMode(null); }} onSave={flushStory}/>}
          {markPick && <div className="ml-banner ml-pick-banner" role="status">
            {markPrompt(markPick)}{markPick.kind === "ring" && markPick.targets.length > 0 ? " " + markPick.targets.length + " chosen." : ""}
            {" "}You can also choose from Browse records.
            {markPick.kind === "ring" && <button type="button" disabled={!markPick.targets.length} onClick={finishRing}>Finish</button>}
            <button type="button" onClick={() => setMarkPick(null)}>Cancel</button></div>}
          {reading && story && (storyMode === "present" || narrow) && <StoryCard story={story} stepIndex={stepIndex} onStep={goToStep}
            onExit={exitStory} exitLabel={exitLabel} presenting={storyMode === "present"} labelOf={labelOf}
            cover={coverShown} onBegin={() => setCover(false)}/>}
          {pickingFrom && <div className="ml-banner ml-pick-banner" role="status">
            Click the record to link <strong>{workingGraph.nodes.find(n => n.id === pickingFrom)?.label}</strong> to.
            <button type="button" onClick={() => setPickingFrom(null)}>Cancel</button></div>}

          {shareOpen && !readOnly && <ShareMapCard graph={sourceGraph} mapId={mapId} shared={shared} account={accountState}
            status={edits.status} onLinked={link => onSharedChange?.(link)} onClose={() => setShareOpen(false)}/>}
          {publishOpen && <PublishCard graph={result.graph} whole={workingGraph} stories={stories.filter(s => s.steps.length)}
            initialStory={storyMode ? storyId ?? "" : ""} title={imported.title} mapId={mapId} onClose={() => setPublishOpen(false)}/>}
          {shared && edits.remoteSource > shared.sourceVersion && <div className="ml-banner ml-pick-banner" role="status">
            Someone has added data to this map.
            <button type="button" onClick={() => onSharedRefresh?.()}>Get it</button></div>}
          {embedOpen && published && <EmbedCard slug={published.slug} title={imported.title} story={!!publishedStory} onClose={() => setEmbedOpen(false)}/>}
          {notice && <div className="ml-toast" role="status">{notice}<button type="button" onClick={() => setNotice("")}>Dismiss</button></div>}
        </div>
        {lens !== "timeline" && <TimeStrip graph={undated.graph} range={range} onRange={setRange}
          inView={result.recordedCount} theme={activeTheme}/>}
      </div>

      {reading && story && storyMode === "read" && !narrow ? <aside className="ml-inspector ml-inspector--story" aria-label="Story">
        <StoryReader story={story} stepIndex={stepIndex} onStep={goToStep} onExit={exitStory} exitLabel={exitLabel}
          onPresent={() => startStory("present", "read")} labelOf={labelOf} onCopyStep={readOnly ? copyStepLink : undefined}/>
      </aside> :
      <aside className="ml-inspector" aria-label="Selected record">
        {selected && <button type="button" className="ml-inspector-close" onClick={() => setSelectedId(null)}
          aria-label="Clear selection">×</button>}
        <RecordPanel source={graph} view={result.graph} node={selected} flows={flowsAll} leads={leads} editing={editing}
          totalRecords={graph.nodes.length} totalRecorded={recordedTotal}
          onPick={setSelectedId} onFollow={id => { setLoopId(null); setRouteFromId(id); }} onConfirm={readOnly ? undefined : confirm}
          loops={loopsFound.loops} loopLabel={loopLabel} onLoop={id => showLoop(id)}
          grouping={grouping} groupLabel={groupOption?.label ?? "Theme"}/>
      </aside>}
    </section>
    <div className="ml-announcer" role="status" aria-live="polite">
      {selected ? selected.label + ", " + selected.type + ", " + (degree.get(selected.id) ?? 0) + " recorded links" : ""}
    </div>
  </main>;
}

/** The code to put a published map or story on another website. */
export function EmbedCard({ slug, title, story, onClose }: { slug: string; title: string; story: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [height, setHeight] = useState(640);
  const code = `<iframe src="${typeof window === "undefined" ? "" : window.location.origin}/p/${slug}/embed" title="${title.replace(/[<>"&]/g, "")}" ` +
    `width="100%" height="${height}" style="border:0;border-radius:8px" loading="lazy" allow="fullscreen"></iframe>`;
  return <aside className="ml-overlay-card ml-embed-card" aria-label="Embed on a website">
    <div className="ml-unplaced-head"><strong>Embed on a website</strong>
      <button type="button" className="ml-link-button" onClick={onClose} aria-label="Close embed">×</button></div>
    <p className="ml-small">Paste this where your website builder accepts an HTML embed. {story ? "It opens on the story; " : ""}readers can open the full page from it.</p>
    <label className="ml-edit-field"><span>Height</span>
      <select value={height} onChange={e => setHeight(Number(e.target.value))}>
        <option value={480}>Short (480 pixels)</option><option value={640}>Medium (640 pixels)</option><option value={820}>Tall (820 pixels)</option>
      </select></label>
    <textarea className="ml-embed-code" readOnly rows={4} value={code} aria-label="Embed code" onFocus={e => e.currentTarget.select()}/>
    <div className="ml-edit-actions">
      <button type="button" className="ml-solid" onClick={() => void navigator.clipboard?.writeText(code).then(() => setCopied(true)).catch(() => {})}>
        {copied ? "Copied" : "Copy code"}</button>
    </div>
    <p className="ml-small">The embedded page sets no cookies and keeps nothing in readers&apos; browsers.</p>
  </aside>;
}
