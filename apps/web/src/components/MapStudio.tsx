"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  applyAssetPack, applyNodeStyleImages, matchAssetPack, visualAssetUrl, buildUkAtlas,
  emptyLayoutHistory, recordLayoutMovement, undoLayoutMovement, redoLayoutMovement,
  collaborationGraph, compareGraphDocuments, filterGraph, graphFingerprint, parseGraphDocument,
  findRecordedRoutes, findReachableDestinations, findStructuralJunctions,
  type GraphDocument, type ConnectionTrail,
  type NodeType, type CollaborationBasis, type SavedPerspective, type NodeStyleOverride, type LayoutHistory, type LayoutPositions,
  type FundingFullAnalysis,
  MAP_LIBRARY_STORAGE_KEY,LEGACY_GRAPH_STORAGE_KEY
} from "@mossline/graph-core";
import { GraphCanvas, type LabelDensity, type NetworkLayout } from "./GraphCanvas";
import {StartScreen} from "./StartScreen";
import {CoverageReport,NodeInspector,RelationshipInspector} from "./NetworkInspector";
import {useSavedViewLibrary} from "../hooks/useSavedViewLibrary";
import {useNetworkImport} from "../hooks/useNetworkImport";
import {WholeGraphExplorer} from "./WholeGraphExplorer";
import {NetworkAI} from "./NetworkAI";
import {ConnectionsExplorer} from "./ConnectionsExplorer";
import { AtlasCanvas, type AtlasMode, type KindFilter } from "./AtlasCanvas";
import { GuidedDiscovery } from "./GuidedDiscovery";
import { NodeAppearanceEditor } from "./NodeAppearanceEditor";
import { AssetLibraryPanel } from "./AssetLibraryPanel";
import { ShareViewPanel } from "./ShareViewPanel";
import { HostedPublishPanel } from "./HostedPublishPanel";
import { FundingWorkbench, FundingInsights } from "./FundingLandscape";
import { PFT_VISUAL_PACK } from "../data/pft-visual-pack";
import { PFT_VISUAL_EXAMPLE } from "../data/pft-visual-example";
import { PftVisualShowcase } from "./PftVisualShowcase";
import {saveGeneralGraph,shouldStoreGeneralGraph}
  from "../lib/general-map-store";
import {MAX_LOCAL_MAPS} from "../lib/map-library";
import {useLocalMapLibrary} from "../hooks/useLocalMapLibrary";
import type {ColumnMapping} from "@mossline/graph-core";
import demo from "../../../../data/demo.json";
import communityExample from "../../../../data/community-example.json";

const TYPE_LABELS: Record<NodeType, string> = {
  organisation: "Organisations", project: "Projects", funder: "Funders",
  person: "People", place: "Places", topic: "Topics", methodology: "Methods", outcome: "Outcomes", other: "Other"
};
const TYPE_KEYS = Object.keys(TYPE_LABELS) as NodeType[];
const ORIGINAL = parseGraphDocument(demo);
const COMMUNITY_EXAMPLE = parseGraphDocument(communityExample);
const DEMO_KEY = graphFingerprint(ORIGINAL);
type ViewMode = "landscape" | "collaborations" | "atlas";

function saveJson(graph: GraphDocument) {
  const blob = new Blob([JSON.stringify(graph, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "mossline-map.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function MapStudio() {
  const [graph, setGraph] = useState<GraphDocument>(ORIGINAL);
  const [experienceSpace,setExperienceSpace]=useState<"home"|"studio">("home");
  const [traceOpen,setTraceOpen]=useState(false);
  const [insightsOpen,setInsightsOpen]=useState(false);
  const [mobileFiltersOpen,setMobileFiltersOpen]=useState(false);
  const [mobileMapOptionsOpen,setMobileMapOptionsOpen]=useState(false);
  const mobileFiltersRef=useRef<HTMLElement|null>(null);
  const [showFundingWorkbench,setShowFundingWorkbench]=useState(false);
  const [fundingInitialFile,setFundingInitialFile]=useState<File|null>(null);
  const [wholeNetworkOpen,setWholeNetworkOpen]=useState(false);
  const [standardAiOpen,setStandardAiOpen]=useState(false);
  const [detailedToolsOpen,setDetailedToolsOpen]=useState(false);
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
  useEffect(()=>{
    if(!mobileFiltersOpen)return;
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==="Escape")setMobileFiltersOpen(false);
    };
    document.addEventListener("keydown",onKeyDown);
    mobileFiltersRef.current?.focus();
    return ()=>document.removeEventListener("keydown",onKeyDown);
  },[mobileFiltersOpen]);
  const [connectionMessage, setConnectionMessage] = useState("");
  const connectionTrail = connectionTrails[activeRouteIndex] ?? null;
  const [view, setView] = useState<ViewMode>("landscape");
  const [basis, setBasis] = useState<CollaborationBasis>("all");
  const [region, setRegion] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<NetworkLayout>("organic");
  const [illustrated, setIllustrated] = useState(true);
  const [atlasMode,setAtlasMode]=useState<AtlasMode>("stories");
  const [atlasKind,setAtlasKind]=useState<KindFilter>("project");
  const [labelDensity, setLabelDensity] = useState<LabelDensity>("essential");
  // Authorable view positions, never stored in the canonical graph.
  const [positionState,setPositionState] = useState<{
    key:string;positions:Record<string,{x:number;y:number}>
  }>({key:"",positions:{}});
  const [positionRevision,setPositionRevision] = useState(0);
  const [nodeStyles,setNodeStyles]=useState<Record<string,NodeStyleOverride>>({});
  const [arrangementState,setArrangementState]=useState<{key:string;history:LayoutHistory}>({
    key:"",history:emptyLayoutHistory()
  });
  const dragStartRef=useRef<{key:string;positions:LayoutPositions}|null>(null);
  const [showSave, setShowSave] = useState(false);
  const [newName, setNewName] = useState("");
  const [storyTitle,setStoryTitle]=useState("");
  const [storyIntroduction,setStoryIntroduction]=useState("");
  const [storyCover,setStoryCover]=useState("");
  const [activeStory,setActiveStory]=useState<SavedPerspective["presentation"]>();
  const [notice, setNotice] = useState("");
  const {
    importMode,setImportMode,importMapName,setImportMapName,
    importPreview,setImportPreview,acknowledgeRemovals,setAcknowledgeRemovals,
    discovery,mappingFile,initialMapped,importNeedsIndexedDb,
    showImportCoverage,setShowImportCoverage,importBusy,setImportBusy,
    importStage,setImportStage,importWorkerRef,importRequestRef,
    mappingSession,onImport,buildMappedInWorker,previewMappedGraph,closeImport,tryExampleDiscovery
  }=useNetworkImport({
    setNotice,
    onImportStarted:()=>{setShowFundingWorkbench(false);setFundingInitialFile(null);},
    onFundingFileDetected:file=>{setFundingInitialFile(file);setShowFundingWorkbench(true);}
  });

  const {hasSavedMapLibrary,localMaps,oversizedSavedMaps,savedMapBackupMade,
    setSavedMapBackupMade,activeMapId,updateGraph,createNewMap,
    applyFundingProjection,selectLocalMap,resetOversizedCache}=useLocalMapLibrary({
      initialGraph:ORIGINAL,setGraph,resetExplorer,setNotice,onMapSelected:closeImport
    });
  const fileRef = useRef<HTMLInputElement>(null);
  const tracePanelRef = useRef<HTMLElement>(null);


  const activeFundingMap=localMaps.find(item=>item.id===activeMapId);
  const fullFundingView=view==="landscape"&&!!activeFundingMap?.fundingDatasetId;
  // In the full-source experience the worker owns the source-graph query and
  // drawing. Avoid preparing a second complete graph for the legacy canvas.
  // Connections and Places continue to use their original analysis tools.
  const sourceExplorerCandidate=view==="landscape"&&
    (fullFundingView||(!detailedToolsOpen&&
      (wholeNetworkOpen||graph.nodes.length>260||graph.edges.length>650)));
  const graphKey=useMemo(()=>graphFingerprint(graph),[graph]);
  const {perspectives,assets,portablePreview,setPortablePreview,perspectiveFileRef,
    savedForMap,savePerspectives,saveArtwork,addArtwork,
    downloadPerspectives,previewPerspectiveImport,confirmPerspectiveImport}=
    useSavedViewLibrary({graph,graphKey,setNotice});

  const positionKey=[graphKey,view,layoutMode,basis].join(":");
  const activePositions=positionState.key===positionKey?positionState.positions:{};
  const movementHistory=arrangementState.key===positionKey?
    arrangementState.history:emptyLayoutHistory();
  function capturePositions(positions:Record<string,{x:number;y:number}>) {
    setPositionState(previous=>({
      key:positionKey,
      positions:{...(previous.key===positionKey?previous.positions:{}),...positions}
    }));
  }
  function beginNodeMovement(positions:LayoutPositions) {
    dragStartRef.current={key:positionKey,positions:{...activePositions,...positions}};
  }
  function finishNodeMovement(positions:LayoutPositions) {
    const from=dragStartRef.current;
    dragStartRef.current=null;
    if(!from||from.key!==positionKey)return;
    const next={...activePositions,...positions};
    setArrangementState(previous=>({
      key:positionKey,history:recordLayoutMovement(
        previous.key===positionKey?previous.history:emptyLayoutHistory(),
        from.positions,next)
    }));
  }
  function undoNodeMovement() {
    const change=undoLayoutMovement(movementHistory,activePositions);
    if(!change)return;
    setArrangementState({key:positionKey,history:change.history});
    setPositionState({key:positionKey,positions:change.positions});
    setPositionRevision(value=>value+1);
  }
  function redoNodeMovement() {
    const change=redoLayoutMovement(movementHistory,activePositions);
    if(!change)return;
    setArrangementState({key:positionKey,history:change.history});
    setPositionState({key:positionKey,positions:change.positions});
    setPositionRevision(value=>value+1);
  }
  function resetNodeArrangement() {
    setPositionState({key:positionKey,positions:{}});
    setArrangementState({key:positionKey,history:emptyLayoutHistory()});
    setPositionRevision(value=>value+1);
    setNotice("Reset the on-screen arrangement. Saved perspectives remain unchanged.");
  }
  const pftAssets=useMemo(()=>matchAssetPack(graph,PFT_VISUAL_PACK),[graph]);
  const atlasCoverage=useMemo(()=>view==="atlas"?buildUkAtlas(graph):null,[graph,view]);
  // Match exact source IDs, so artwork is never attached to another dataset by name.
  const pftCompatible=pftAssets.matched>=5;
  const pftMapReference=pftCompatible&&PFT_VISUAL_PACK.basemap?
    visualAssetUrl(PFT_VISUAL_PACK,PFT_VISUAL_PACK.basemap):undefined;
  const showPftArtwork=pftCompatible&&illustrated;
  const story=activeStory?.title||activeStory?.introduction ? activeStory : undefined;
  const storyCoverUrl=story?.coverUrl || (pftCompatible&&PFT_VISUAL_PACK.frontPage?
    visualAssetUrl(PFT_VISUAL_PACK,PFT_VISUAL_PACK.frontPage.hero):undefined);
  const storyTitleText=story?.title || (pftCompatible?PFT_VISUAL_PACK.frontPage?.title:graph.title);
  const storyIntroText=story?.introduction || (pftCompatible?PFT_VISUAL_PACK.frontPage?.introduction:graph.description);
  const presentedGraph=useMemo(()=>{
    if(sourceExplorerCandidate)return graph;
    const withArtwork=showPftArtwork?applyAssetPack(graph,PFT_VISUAL_PACK):graph;
    return applyNodeStyleImages(withArtwork,nodeStyles);
  },[graph,showPftArtwork,nodeStyles,sourceExplorerCandidate]);
  const proposedChanges=useMemo(()=>importMode==="replace"&&importPreview?.graph?
    compareGraphDocuments(graph,importPreview.graph):null,[graph,importPreview,importMode]);
  const hasRemovals=!!proposedChanges &&
    (proposedChanges.nodes.removed>0 || proposedChanges.edges.removed>0);
  const current = useMemo(() => view === "collaborations" ?
    collaborationGraph(presentedGraph, basis) : presentedGraph, [presentedGraph, view, basis]);
  const activeTypes = view === "collaborations" ? (["organisation"] as NodeType[]) : types;
  const filtered = useMemo(() => sourceExplorerCandidate ?
    {graph:{...graph,nodes:[],edges:[]},contextNodeIds:[]}:
    filterGraph(current,{types:activeTypes,query,region,focusId,
      includeNeighbours:context}),
  [sourceExplorerCandidate,graph,current,activeTypes.join("|"),query,region,focusId,context]);
  const selected = filtered.graph.nodes.find(n => n.id === selectedId) ?? null;
  const selectedEdge = filtered.graph.edges.find(e => e.id === selectedEdgeId) ?? null;
  function changeNodeAppearance(id:string,value:NodeStyleOverride|undefined) {
    setNodeStyles(current=>{
      const next={...current};
      if(!value||Object.keys(value).length===0)delete next[id];
      else next[id]=value;
      return next;
    });
  }
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
  const entityOptions = useMemo(() => traceOpen&&!sourceExplorerCandidate ?
    [...graph.nodes].sort((a,b)=>a.label.localeCompare(b.label)):[],
  [graph,traceOpen,sourceExplorerCandidate]);
  const reachableDestinations = useMemo(() => traceOpen&&!sourceExplorerCandidate&&traceFrom ?
    findReachableDestinations(graph,traceFrom,{
      maxHops:5,excludeTypes:excludedRelationType?[excludedRelationType]:[]
    }):[],[graph,traceFrom,excludedRelationType,traceOpen,sourceExplorerCandidate]);
  const distanceGroups = useMemo(() => {
    const groups=new Map<number,typeof reachableDestinations>();
    for(const entity of reachableDestinations)groups.set(entity.hops,[
      ...(groups.get(entity.hops)??[]),entity
    ]);
    return [...groups.entries()];
  },[reachableDestinations]);
  const relationTypes = useMemo(() => traceOpen&&!sourceExplorerCandidate ?
    [...new Set(graph.edges.filter(e=>!e.inferred).map(e=>e.type))].sort():[],
  [graph,traceOpen,sourceExplorerCandidate]);
  const [junctionPanelOpen,setJunctionPanelOpen]=useState(false);
  const junctions = useMemo(() => junctionPanelOpen&&!sourceExplorerCandidate ?
    findStructuralJunctions(graph):[],[graph,junctionPanelOpen,sourceExplorerCandidate]);
  const featuredJunctions = useMemo(() => junctions.filter(item =>
    ["organisation","project"].includes(graph.nodes.find(n=>n.id===item.nodeId)?.type ?? "")).slice(0,6),
  [junctions,graph]);
  function exploreRoutes(fromId:string,toId:string,omitType=excludedRelationType) {
    if(!fromId||!toId||fromId===toId ||
      !findReachableDestinations(graph,fromId,{maxHops:5,
        excludeTypes:omitType?[omitType]:[]}).some(item=>item.nodeId===toId)) {
      clearTrail();
      setConnectionMessage("Choose one of the reachable destinations below.");
      return;
    }
    const found=findRecordedRoutes(graph,fromId,toId,{
      maxHops:5,maxRoutes:3,excludeTypes:omitType?[omitType]:[]
    });
    setConnectionTrails(found);setActiveRouteIndex(0);
    if(!found.length) {
      setConnectionMessage("A recorded route could not be displayed. Try another destination.");
      return;
    }
    setConnectionMessage("Shortest recorded route first. Paths show source records, not independently verified collaborations.");
    setView("landscape");setQuery("");setRegion("");setTypes(TYPE_KEYS);
    setContext(true);setFocusId(null);setSelectedId(null);setSelectedEdgeId(null);
  }
  function traceEntities(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    exploreRoutes(traceFrom,traceTo);
  }
  function clearTrail() {
    setConnectionTrails([]);setActiveRouteIndex(0);setConnectionMessage("");
  }
  function startTraceFromNode(id:string) {
    setTraceOpen(true);
    setTraceFrom(id);setTraceTo("");clearTrail();
    tracePanelRef.current?.scrollIntoView({behavior:"smooth",block:"center"});
  }
  function exploreJunction(id: string) {
    setView("landscape");setQuery("");setRegion("");setTypes(TYPE_KEYS);
    setContext(true);setFocusId(null);pickNode(id);clearTrail();
  }
  const regions = useMemo(() => sourceExplorerCandidate?[]:
    [...new Set(graph.nodes.map(n => n.region).filter((v):v is string=>!!v))].sort(),
  [graph,sourceExplorerCandidate]);
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
  const totalTypes = useMemo(() => sourceExplorerCandidate?[]:TYPE_KEYS.map(type=>({
    type,count:graph.nodes.filter(n=>n.type===type).length
  })),[graph,sourceExplorerCandidate]);

  function toggleType(type: NodeType) {
    setSelectedId(null);setSelectedEdgeId(null);
    setTypes(previous => previous.includes(type) ? previous.filter(v => v !== type) : [...previous, type]);
  }

  function saveCurrentPerspective(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name=newName.trim().slice(0,60);
    if(!name) return;
    if(perspectives.length>=40){setNotice("40 saved views is the current local limit.");return;}
    const cover=storyCover.trim();
    if(cover&&!/^https:\/\/[^\s]+$/i.test(cover)) {
      setNotice("Cover images must use HTTPS.");return;
    }
    const record:SavedPerspective={
      id:crypto.randomUUID(),name,graphKey,view,basis,region,query:query.slice(0,200),
      types:[...types],context,layout:layoutMode,labels:labelDensity,createdAt:Date.now(),
      ...(view==="atlas"?{}:{positions:activePositions}),
      ...(Object.keys(nodeStyles).length?{nodeStyles}:{}),
      presentation:{
        title:storyTitle.trim().slice(0,100),
        introduction:storyIntroduction.trim().slice(0,1200),
        ...(cover?{coverUrl:cover}:{}),
        illustrated,
        atlasMode,
        atlasKind
      }
    };
    if(savePerspectives([...perspectives,record])){
      setShowSave(false);setNewName("");
      setActiveStory(record.presentation);
      setStoryTitle("");setStoryIntroduction("");setStoryCover("");
      setNotice("Saved perspective ‘"+name+"’ in this browser.");
    }
  }

  function openPerspective(item: SavedPerspective) {
    if(item.graphKey!==graphKey) return;
    setView(item.view);setBasis(item.basis);setRegion(item.region);setQuery(item.query);
    setTypes(item.types);setContext(item.context);setLayoutMode(item.layout);
    setLabelDensity(item.labels);setSelectedId(null);setSelectedEdgeId(null);setFocusId(null);
    setPositionState({key:[graphKey,item.view,item.layout,item.basis].join(":"),
      positions:item.positions??{}});
    setPositionRevision(value=>value+1);
    setActiveStory(item.presentation);setIllustrated(item.presentation?.illustrated??true);
    setAtlasMode(item.presentation?.atlasMode??"stories");
    setAtlasKind(item.presentation?.atlasKind??"project");
    setNodeStyles(item.nodeStyles??{});
    setArrangementState({key:"",history:emptyLayoutHistory()});
    setNotice("Opened ‘"+item.name+"’. Source data is unchanged.");
  }

  function resetExplorer(next:GraphDocument) {
    setDetailedToolsOpen(false);
    setGraph(next);setActiveStory(undefined);
    setPortablePreview(null);
    setNodeStyles({});
    setArrangementState({key:"",history:emptyLayoutHistory()});
    setPositionState({key:"",positions:{}});
    setPositionRevision(value=>value+1);
    setAtlasMode("stories");setAtlasKind("project");
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
  }

  async function applyImport(){
    const preview=importPreview;
    if(importBusy||!preview?.graph||preview.issues.some(i=>i.severity==="error")||
      !preview.graph.nodes.length||(importMode==="replace"&&hasRemovals&&!acknowledgeRemovals))
      return;
    if(importMode==="new"&&localMaps.length>=MAX_LOCAL_MAPS)return;
    const proposed={...preview.graph,title:importMapName.trim().slice(0,100)||preview.graph.title};
    setImportBusy(true);setImportStage("Saving the complete network in this browser…");
    let storageId:string|undefined;
    const generation=importRequestRef.current;
    try{
      if(importNeedsIndexedDb||shouldStoreGeneralGraph(proposed)){
        // Use a stable map ID as the IndexedDB key when replacing. Complete
        // writes finish before changing the active map or dismissing the import.
        storageId=importMode==="replace"?
          (localMaps.find(m=>m.id===activeMapId)?.generalDatasetId??crypto.randomUUID()):
          crypto.randomUUID();
        await saveGeneralGraph(storageId,proposed);
      }
      // A user may have navigated away while an IndexedDB write was pending.
      if(generation!==importRequestRef.current)return;
      const success=importMode==="new"?
        createNewMap(proposed,undefined,undefined,storageId):
        updateGraph(proposed,storageId);
      if(!success){
        // Existing replacement records may be overwritten; do not delete an
        // old map's backing store on failure. The user can retry safely.
        setNotice("Could not update your saved map library. The complete graph is "+
          "preserved in browser storage; export a backup before clearing anything.");
        return;
      }
      closeImport();
      setNotice((importMode==="new"?"Created new map ‘":"Updated map ‘")+proposed.title+
        "’ with all "+proposed.nodes.length+" entities and "+proposed.edges.length+
        " relationships. Complete data stays in this browser.");
    }catch(error){
      setNotice(error instanceof Error?error.message:"Unable to store the complete network.");
    }finally{setImportBusy(false);setImportStage("");}
  }

  function resetDemo() {
    if(createNewMap(ORIGINAL))setNotice("Created a separate illustrative map; your other maps remain saved.");
  }
  function openCommunityExample() {
    if(createNewMap(COMMUNITY_EXAMPLE)) {
      setNotice("Opened a separate fictional community network. Try Network, Connections and Places; your other maps are preserved.");
      closeImport();
    }
  }
  function openPftVisualExample() {
    if(createNewMap(PFT_VISUAL_EXAMPLE)) {
      setIllustrated(true);
      setNotice("Opened the PFT illustration showcase. Links are SYNTHETIC layout examples, not recorded PFT connections. Your other maps are saved.");
      closeImport();
    }
  }

  const largeActiveView=sourceExplorerCandidate||
    (view==="collaborations"&&(filtered.graph.nodes.length>260||
      filtered.graph.edges.length>650));
  const usingSourceExplorer=sourceExplorerCandidate;

  if(experienceSpace==="home")return <main className="shell mossline-home">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">✳</span><span>mossline<span className="brand-period">.</span></span><small>alpha 2.18</small></div>
      <div className="topbar-right"><span className="local-tag"><span className="signal"/> Browser-local studio</span>
        <a href="https://github.com/tomcwxyz/Mossline" target="_blank" rel="noreferrer">Open source ↗</a>
      </div>
    </header>
    <input ref={fileRef} type="file" hidden multiple
      accept=".csv,.json,application/json,text/csv"
      aria-label="Import a spreadsheet or Kumu network"
      onChange={e=>{setExperienceSpace("studio");void onImport(e);}}/>
    {notice&&<div className="notice" role="status"><span>{notice}</span>
      <button type="button" aria-label="Dismiss message" onClick={()=>setNotice("")}>×</button>
    </div>}
    {oversizedSavedMaps&&<p className="notice" role="alert">An oversized browser map library was found.
      <a href="/recover">Back it up or recover it before continuing ↗</a></p>}
    <StartScreen maps={(hasSavedMapLibrary?localMaps:[]).map(m=>({id:m.id,title:m.title,
      nodes:m.sourceCounts?.nodes??m.graph.nodes.length,
      edges:m.sourceCounts?.edges??m.graph.edges.length,
      updatedAt:m.createdAt,funding:!!m.fundingDatasetId,
      summary:m.fundingAnalysis?m.fundingAnalysis.grants.toLocaleString("en-GB")+
        " grants in complete dataset":undefined}))}
      onOpen={id=>{void selectLocalMap(id);setExperienceSpace("studio");}}
      onImport={()=>fileRef.current?.click()}
      onFunding={()=>{setFundingInitialFile(null);setShowFundingWorkbench(true);setExperienceSpace("studio");}}
      onCommunity={()=>{openCommunityExample();setExperienceSpace("studio");}}
      onSampleSheet={()=>{tryExampleDiscovery();setExperienceSpace("studio");}}
      onPft={()=>{openPftVisualExample();setExperienceSpace("studio");}}
      onRecovery={()=>{window.location.href="/recover";}}/>
  </main>;

  return <main className={"shell mossline-studio"+
    (!showFundingWorkbench&&!importPreview&&!discovery?" mobile-explore":"")}>
    <header className="topbar">
      <div className="brand"><span className="brand-mark">✳</span><span>mossline<span className="brand-period">.</span></span><small>alpha 2.18</small></div>
      <div className="topbar-right">
        <button className="studio-home-link" type="button"
          onClick={()=>{closeImport();setShowFundingWorkbench(false);setExperienceSpace("home");}}>
          ← All maps</button>
        <span className="local-tag"><span className="signal" /> Saved in this browser</span>
      </div>
    </header>
    <section className={"heading"+
      (!showFundingWorkbench&&!importPreview&&!discovery?" mobile-exploring":"")}>
      <div>
        <p className="eyebrow">{showFundingWorkbench||importPreview||discovery?
          "Create a network · your existing maps are preserved":
          <>A place to understand what connects us {graphKey===DEMO_KEY&&
            <>· <span className="demo-indicator">Fictional demonstration data</span></>}</>}</p>
        <h1>{showFundingWorkbench?"Explore a funding landscape":
          importPreview||discovery?"Discover your data":graph.title}
          <span className="heading-period">.</span></h1>
        <p className="subtitle">{showFundingWorkbench?
          "Bring a grants spreadsheet and discover the relationships between funders, awards and organisations.":
          importPreview||discovery?
          "Review what was found, check the proposed relationships and choose whether to create a new map.":
          graph.description}</p>
      </div>
      <div className="actions">
        <label className="map-library-chooser">Current map
          <select value={activeMapId??""} onChange={e=>{void selectLocalMap(e.target.value);}}
            aria-label="Switch between maps saved in this browser">
            {localMaps.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </label>
        <input aria-label="Discover data from a Kumu JSON export or a CSV spreadsheet"
          ref={fileRef} type="file" multiple accept=".json,.csv,application/json,text/csv"
          hidden onChange={onImport}/>
        <button className="button-primary" type="button"
          onClick={()=>fileRef.current?.click()}>↑ Import data</button>
        <details className="studio-action-menu">
          <summary>More actions</summary>
          <div className="studio-action-popover">
            <button type="button" onClick={()=>fileRef.current?.click()}>Import spreadsheet or Kumu network</button>
            <button type="button" onClick={()=>{setFundingInitialFile(null);setShowFundingWorkbench(v=>!v);}}>
              {showFundingWorkbench?"Close funding import":"Import funding awards"}</button>
            <button type="button" onClick={tryExampleDiscovery}>Try a sample spreadsheet</button>
            {fullFundingView?<a href="/recover">↓ Back up full funding dataset</a>:
              <button type="button" onClick={()=>saveJson(graph)}>↓ Export this map</button>}
            <a href="/recover">Manage backups and saved maps ↗</a>
          </div>
        </details>
      </div>
    </section>
    {importBusy&&<div className="notice" role="status">
      <span>{importStage||"Preparing the complete network…"}</span>
      <button type="button" disabled={importStage.startsWith("Saving")}
        onClick={closeImport}>{importStage.startsWith("Saving")?"Saving…":"Cancel"}</button>
    </div>}
    {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div>}
    {oversizedSavedMaps&&<div className="funding-csv-coverage" role="alert">
      <strong>Your previous browser maps were preserved without loading them.</strong>
      <p>The saved collection is too large to restore automatically without risking
        another freeze. Export an untouched backup before clearing that cached collection.
        The new importer will still analyse large files in the background.</p>
      <div className="actions">
        <button className="button-outline" type="button" onClick={()=>{
          const raw=window.localStorage.getItem(MAP_LIBRARY_STORAGE_KEY);
          if(!raw){setNotice("No saved map backup was found.");return;}
          const blob=new Blob([raw],{type:"application/json"});
          const url=URL.createObjectURL(blob);
          const a=document.createElement("a");
          a.href=url;a.download="mossline-browser-map-library-backup.json";a.click();
          URL.revokeObjectURL(url);setSavedMapBackupMade(true);
        }}>↓ Export saved maps backup</button>
        <button className="button-outline" type="button" disabled={!savedMapBackupMade}
          onClick={()=>{
            if(!window.confirm("Delete the oversized saved map collection from this browser? Only proceed after checking your downloaded backup."))return;
            if(resetOversizedCache())
              setNotice("Large local cache reset. You can now create a new, smaller map.");
          }}>Reset oversized cached maps</button>
      </div>
    </div>}

    {showFundingWorkbench&&<FundingWorkbench initialFile={fundingInitialFile}
      onClose={()=>{setShowFundingWorkbench(false);setFundingInitialFile(null);}}
      onCreate={(next,fullAnalysis,datasetId)=>{
        if(!createNewMap(next,fullAnalysis,datasetId))return false;
        setNotice("Funding landscape created. The Network view opens all eligible grants and recorded relationships; optional detailed analysis is available below.");
        return true;
      }}/>}
    {(importPreview || discovery) && <section className="import-preview" aria-label="Data discovery and import preview">
      <div className="import-title">
        <div><p className="eyebrow">Explore what Mossline found</p>
          <h2>{discovery?.kind==="kumu-configuration" ? "Understanding your Kumu project" :
            discovery?.kind==="csv-table" ? "Map your existing data" : "Import preview"}</h2>
          {importPreview && <p>{importPreview.counts.nodes} entities · {importPreview.counts.edges} relationships</p>}
        </div>
        <button className="button-outline" onClick={closeImport}>Close</button>
      </div>
      <p className="help">Nothing has been changed. We can create a separate map from this data,
        keeping your current map safely in Your maps. Full CSV/Kumu mapping runs in a
        background worker; the complete resulting graph is saved in this browser.</p>
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
        <GuidedDiscovery key={mappingSession} file={mappingFile} discovery={discovery}
          initialProposal={initialMapped} onBuild={buildMappedInWorker}
          onPreview={previewMappedGraph} onChange={()=>{
            setImportPreview(null);setAcknowledgeRemovals(false);
          }}/>}
      {importPreview && importPreview.issues.length>0 && <div className="friendly-import-findings">
        <h3>Things worth knowing</h3>
        {importPreview.issues.some(i=>/non-public/i.test(i.message)) &&
          <p>Some records were marked non-public, so we've left those out.</p>}
        {importPreview.issues.some(i=>/region|description/i.test(i.message)) &&
          <p>Some places or descriptions could mean different things across rows.
            We've preserved the source evidence rather than making arbitrary choices.</p>}
        {importPreview.issues.some(i=>/relationship pair\(s\)|duplicate/i.test(i.message)) &&
          <p>Some relationships appear more than once. Their original records remain available to inspect.</p>}
        {importPreview.issues.some(i=>i.severity==="error") &&
          <p>We couldn't build a usable map yet. Expand the technical details below for the specific issue.</p>}
        <details className="technical-import-findings">
          <summary>Technical details · {importPreview.issues.length} findings</summary>
          <ul>{importPreview.issues.map((issue,index)=><li key={index}>
            <strong>{issue.severity}:</strong> {issue.message}</li>)}</ul>
        </details>
      </div>}
      {importPreview && importPreview.issues.length === 0 && <p className="help">No import blockers found in the fields checked. This doesn't verify the source claims.</p>}
      {importMode==="replace" && proposedChanges && <div className="import-change-report">
        <h3>What changes compared with this browser's current map?</h3>
        <p>Counts use stable record identities. Reordered source rows aren't treated as new links.
          Differences in data fields count as updates; source row numbers do not.</p>
        <div className="change-metrics">
          <div><strong>Entities</strong><span>+{proposedChanges.nodes.added} added</span>
            <span>~{proposedChanges.nodes.updated} updated</span>
            <span>−{proposedChanges.nodes.removed} removed</span></div>
          <div><strong>Relationships</strong><span>+{proposedChanges.edges.added} added</span>
            <span>~{proposedChanges.edges.updated} updated</span>
            <span>−{proposedChanges.edges.removed} removed</span></div>
        </div>
        {proposedChanges.nodes.addedExamples.length>0 && <p><strong>New entities:</strong> {proposedChanges.nodes.addedExamples.join(" · ")}</p>}
        {proposedChanges.nodes.removedExamples.length>0 && <p><strong>Missing from proposed map:</strong> {proposedChanges.nodes.removedExamples.join(" · ")}</p>}
        {proposedChanges.edges.removedExamples.length>0 && <p><strong>Removed links (examples):</strong> {proposedChanges.edges.removedExamples.join(" · ")}</p>}
        {hasRemovals && <label className="import-removal-consent">
          <input type="checkbox" checked={acknowledgeRemovals}
            onChange={event=>setAcknowledgeRemovals(event.target.checked)}/>
          I understand this replacement will remove {proposedChanges.nodes.removed} entities and
          {" "}{proposedChanges.edges.removed} relationships from the current browser map.
          I have reviewed or exported the existing map.
        </label>}
      </div>}
      {importPreview?.graph && <details className="import-coverage"
        onToggle={event=>setShowImportCoverage(event.currentTarget.open)}>
        <summary>Explore detailed data coverage</summary>
        {showImportCoverage&&<CoverageReport graph={importPreview.graph} />}
      </details>}
      {importPreview?.graph && <div className="import-destination">
        <h3>What would you like to do with this network?</h3>
        <label className="import-choice">
          <input type="radio" checked={importMode==="new"} onChange={()=>{
            setImportMode("new");setAcknowledgeRemovals(false);
          }}/>
          <span><strong>Create a new map</strong><small>Keep your existing map. Recommended when exploring a new dataset.</small></span>
        </label>
        <label className="import-choice">
          <input type="radio" checked={importMode==="replace"} onChange={()=>setImportMode("replace")}/>
          <span><strong>Update the map I'm viewing</strong><small>Review differences and explicitly approve any removals.</small></span>
        </label>
        <label htmlFor="import-map-name">Map name
          <input id="import-map-name" value={importMapName} maxLength={100}
            onChange={e=>setImportMapName(e.target.value)} placeholder="Give this map a name"/>
        </label>
        {importMode==="new"&&localMaps.length>=MAX_LOCAL_MAPS&&
          <p role="alert">This browser already has eight maps. Export one before creating another.</p>}
        <button className="button-primary" type="button"
          disabled={importBusy||!importPreview.graph || !importPreview.graph.nodes.length ||
            importPreview.issues.some(i=>i.severity==="error") ||
            (importMode==="new"&&localMaps.length>=MAX_LOCAL_MAPS) ||
            (importMode==="replace"&&hasRemovals&&!acknowledgeRemovals)}
          onClick={()=>{void applyImport();}}>
          {importMode==="new"?"Create new map and explore →":"Confirm updates to current map →"}
        </button>
      </div>}
    </section>}
    {(pftCompatible||story) && <section className="perspective-narrative" aria-label="Perspective story">
      {storyCoverUrl&&<img loading="lazy" src={storyCoverUrl}
        alt="Illustration introducing this network perspective" />}
      <div className="perspective-narrative-copy">
        <p className="eyebrow">{story?"Your saved story":"Visual companion · Progressive Farming Trust"}</p>
        <h2>{storyTitleText}</h2>
        <p>{storyIntroText}</p>
        {!story&&pftCompatible&&<p className="pft-guidance">{PFT_VISUAL_PACK.frontPage?.guidance}</p>}
        <span>{pftCompatible?pftAssets.matched+" original illustrations available · ":""}
          Presentation only · Source records unchanged</span>
      </div>
    </section>}
    {!showFundingWorkbench&&!importPreview&&!discovery&&<>
    <nav className="studio-primary-views" aria-label="Choose how to explore this network">
        <div className="view-switch">
          <button className={view === "landscape" ? "on" : ""} onClick={() => { setView("landscape"); setSelectedId(null); setFocusId(null); }}>✳ <span>Network</span></button>
          <button className={view === "collaborations" ? "on" : ""} onClick={() => { setView("collaborations"); setSelectedId(null); setFocusId(null); }}>◎ <span>Connections</span></button>
          <button className={view === "atlas" ? "on" : ""} onClick={() => {setView("atlas");setSelectedId(null);setFocusId(null);}}>
            ◉ <span>Places{atlasCoverage&&atlasCoverage.placed.length>0?" · "+atlasCoverage.placed.length:""}</span>
          </button>
        </div>
    </nav>
    <section className="workspace">
      <button type="button" className="studio-mobile-filter-toggle"
        aria-controls="studio-filters" aria-expanded={mobileFiltersOpen}
        onClick={()=>setMobileFiltersOpen(true)}>☷ Find, filter &amp; tools</button>
      {mobileFiltersOpen&&<button type="button" className="studio-mobile-filter-backdrop"
        aria-label="Close map filters" onClick={()=>setMobileFiltersOpen(false)}/>}
      <aside id="studio-filters" ref={mobileFiltersRef} tabIndex={-1}
        className={"sidebar studio-simplified-sidebar"+(mobileFiltersOpen?" mobile-open":"")}>
        <button type="button" className="studio-mobile-filter-close"
          onClick={()=>setMobileFiltersOpen(false)}>← Back to network</button>
        <p className="eyebrow">Explore this network</p>
        {usingSourceExplorer?<p className="help">This workspace explores the complete
          source network. Use Find or Ask this network on the canvas to follow
          any entity and its recorded relationships. Choose a grouped overview or
          inspect individual connections in the network.</p>:<>
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
        </> : <details className="studio-inline-disclosure">
          <summary>Entity types</summary>
          <div className="type-list">
          {totalTypes.filter(item => item.count > 0).map(({ type, count }) => <label key={type} className="type-item">
            <input type="checkbox" checked={types.includes(type)} onChange={() => toggleType(type)} />
            <span className={"small-dot " + type} /><span>{TYPE_LABELS[type]}</span><span className="type-count">{count}</span>
          </label>)}
        </div></details>}
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

        </>}

        {!usingSourceExplorer&&<details className="studio-tool-group">
          <summary>Saved views <span>{savedForMap.length} saved</span></summary>
        <section className="perspectives-panel" aria-label="Saved perspectives">
          <div className="filter-heading"><p className="eyebrow">Saved perspectives</p>
            <button type="button" onClick={()=>{setShowSave(v=>!v);setNewName(view==="landscape"?"My landscape":view==="atlas"?"My UK atlas":"My collaborations");}}>+ Save</button></div>
          {showSave && <form className="perspective-form" onSubmit={saveCurrentPerspective}>
            <label htmlFor="save-view-name">Name this perspective</label>
            <input className="search" id="save-view-name" maxLength={60} required value={newName}
              onChange={e=>setNewName(e.target.value)} placeholder="e.g. Northern connections"/>
            <label htmlFor="perspective-story-title">Story heading (optional)</label>
            <input className="search" id="perspective-story-title" maxLength={100}
              value={storyTitle} onChange={e=>setStoryTitle(e.target.value)}
              placeholder="What are we exploring?"/>
            <label htmlFor="perspective-story-text">Introduce this view</label>
            <textarea id="perspective-story-text" className="search" rows={3}
              maxLength={1200} value={storyIntroduction}
              onChange={e=>setStoryIntroduction(e.target.value)}
              placeholder="Give readers a story or question to explore"/>
            {assets.length>0&&<label htmlFor="perspective-story-asset">Or use a saved artwork image
              <select className="search" id="perspective-story-asset" value=""
                onChange={event=>{
                  const asset=assets.find(a=>a.id===event.target.value);
                  if(asset)setStoryCover(asset.url);
                }}>
                <option value="">Choose artwork…</option>
                {assets.map(asset=><option key={asset.id} value={asset.id}>
                  {asset.name} · {asset.licence}
                </option>)}
              </select>
            </label>}
            <label htmlFor="perspective-story-cover">Cover artwork (HTTPS URL)</label>
            <input className="search" id="perspective-story-cover" type="url"
              value={storyCover} onChange={e=>setStoryCover(e.target.value)}
              placeholder="https://…"/>
            <p className="help">Your filters, story, node appearance and arrangement are saved here.
              Drag nodes on Landscape or Collaborations before saving.
              Positions belong to this view only; source data is unchanged.</p>
            <div><button className="button-primary" type="submit">Save view</button>
              <button className="text-button" type="button" onClick={()=>setShowSave(false)}>Cancel</button></div>
          </form>}
          {savedForMap.length===0 && <p className="help">Save a named perspective to keep your network arrangement, node styling, search and filters.</p>}
          {savedForMap.map(item=><div key={item.id} className="saved-perspective">
            <button type="button" onClick={()=>openPerspective(item)}>
              <span>{item.name}</span><small>{item.view} · {item.layout}</small></button>
            <button className="remove-perspective" type="button" aria-label={"Delete "+item.name}
              onClick={()=>savePerspectives(perspectives.filter(p=>p.id!==item.id))}>×</button>
          </div>)}
          <div className="portable-perspectives">
            <p className="eyebrow">Take your perspectives with you</p>
            <input type="file" hidden ref={perspectiveFileRef}
              accept=".json,application/json" aria-label="Import Mossline perspectives"
              onChange={previewPerspectiveImport}/>
            <div className="portable-actions">
              <button type="button" onClick={downloadPerspectives}
                disabled={savedForMap.length===0}>↓ Export views</button>
              <button type="button" onClick={()=>perspectiveFileRef.current?.click()}>
                ↑ Import views</button>
            </div>
            {portablePreview&&<div className="portable-confirm" aria-label="Review perspective import">
              <strong>{portablePreview.perspectives.length} views ready to add</strong>
              <p>{portablePreview.perspectives.map(item=>item.name).join(" · ")}</p>
              <small>{portablePreview.assets.length} linked artwork references.
                Files will be added to this browser; existing views are preserved.
                External pictures may contact their hosting services when displayed.</small>
              <div className="portable-actions">
                <button type="button" onClick={confirmPerspectiveImport}>Confirm import</button>
                <button type="button" onClick={()=>setPortablePreview(null)}>Cancel</button>
              </div>
            </div>}
            <p className="help">Exports contain saved view settings, entity IDs and image URLs —
              not the underlying map data. Import onto the same network in another browser.
              Export your map separately if you need to move its data too.</p>
          </div>
          <p className="help">Saved here until exported · scoped to this dataset · no changes to source data</p>
        </section>
        </details>}
        {!usingSourceExplorer&&<details className="studio-tool-group">
          <summary>Share, publish &amp; style</summary>
        <ShareViewPanel graph={filtered.graph} view={view}
          layout={layoutMode} labels={labelDensity} illustrated={illustrated}
          title={storyTitleText||graph.title} introduction={storyIntroText||undefined}
          coverUrl={storyCoverUrl} positions={activePositions} nodeStyles={nodeStyles}/>
        <HostedPublishPanel graph={filtered.graph} view={view}
          layout={layoutMode} labels={labelDensity} illustrated={illustrated}
          title={storyTitleText||graph.title} introduction={storyIntroText||undefined}
          coverUrl={storyCoverUrl} positions={activePositions} nodeStyles={nodeStyles}/>
        <AssetLibraryPanel assets={assets} onAdd={addArtwork}
          onRemove={id=>saveArtwork(assets.filter(asset=>asset.id!==id))}/>
        </details>}
        {!usingSourceExplorer&&<details className="studio-tool-group" open={traceOpen}
          onToggle={e=>setTraceOpen(e.currentTarget.open)}>
          <summary>Follow a connection</summary>
        <section ref={tracePanelRef} className="trace-panel" aria-label="Follow recorded connections from an entity">
          <div className="trace-head"><p className="eyebrow">Follow a connection</p><span>Explore what’s reachable</span></div>
          <p className="help">Choose something you know. Mossline shows who and what is connected through recorded relationships.</p>
          <form className="trace-form" onSubmit={traceEntities}>
            <label htmlFor="trace-from">1 · Start with</label>
            <select id="trace-from" className="search" required value={traceFrom} onChange={e => {setTraceFrom(e.target.value);setTraceTo("");clearTrail();}}>
              <option value="">Choose your starting point</option>
              {entityOptions.map(n => <option key={n.id} value={n.id}>{n.label} · {n.type}</option>)}
            </select>
            <label htmlFor="trace-to">2 · Find connections to</label>
            <select id="trace-to" className="search" required
              disabled={!traceFrom || !reachableDestinations.length}
              value={reachableDestinations.some(n=>n.nodeId===traceTo)?traceTo:""}
              onChange={e=>{setTraceTo(e.target.value);clearTrail();if(e.target.value)exploreRoutes(traceFrom,e.target.value);}}>
              <option value="">{!traceFrom?"Choose a starting point first":
                reachableDestinations.length?"Choose a reachable destination":"No destinations within five links"}</option>
              {distanceGroups.map(([hops,entities])=><optgroup key={hops}
                label={hops===1?"Directly connected · 1 link":hops+" recorded links away"}>
                {entities.map(n=><option key={n.nodeId} value={n.nodeId}>{n.label} · {n.type}</option>)}
              </optgroup>)}
            </select>
            {traceFrom&&<p className="trace-destinations" role="status">
              {reachableDestinations.length>0 ? <>
                {reachableDestinations.length} reachable {reachableDestinations.length===1?"entity":"entities"} within five links.
                {" "}{distanceGroups[0]?.[0]===1?distanceGroups[0][1].length:0} directly connected.
              </> : <>No reachable destinations with these settings. Try another starting point or filter.</>}
            </p>}
            <label htmlFor="trace-exclude">Optional · Exclude a relationship type</label>
            <select id="trace-exclude" className="search" value={excludedRelationType}
              onChange={event=>{setExcludedRelationType(event.target.value);setTraceTo("");clearTrail();}}>
              <option value="">Use all recorded relationships</option>
              {relationTypes.map(type=><option value={type} key={type}>Exclude: {type}</option>)}
            </select>
            <button type="submit" className="trace-action"
              disabled={!traceFrom || !reachableDestinations.some(n=>n.nodeId===traceTo)}>
              Explore selected route →
            </button>
          </form>
          {traceFrom&&reachableDestinations.some(d=>d.hops===1)&&
            <div className="trace-quick-picks" aria-label="Quick picks from direct connections">
              <p>Or start with a direct connection</p>
              {reachableDestinations.filter(d=>d.hops===1).slice(0,4).map(d=>
                <button type="button" key={d.nodeId} onClick={()=>{
                  setTraceTo(d.nodeId);exploreRoutes(traceFrom,d.nodeId);
                }}>{d.label} <span aria-hidden="true">↗</span></button>)}
            </div>}
          {graphKey===DEMO_KEY && <button type="button" className="trace-example" onClick={() => {
            setTraceFrom("o1");setExcludedRelationType("");setTraceTo("o3");
            exploreRoutes("o1","o3","");
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
        </details>}
        {!usingSourceExplorer&&<details className="junction-panel"
          onToggle={event=>setJunctionPanelOpen(event.currentTarget.open)}>
          <summary>Structural junctions {junctionPanelOpen&&<span>{featuredJunctions.length} shown</span>}</summary>
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
        </details>}
        <div className="sidebar-divider" />
        <div className="sidebar-bottom">
          <p className="eyebrow">Your data stays yours</p>
          <p className="help">Maps are saved in this browser. Download a backup before clearing browser data or changing devices.</p>
          <a className="text-button" href="/recover">Manage map backups ↗</a>
          {graphKey===DEMO_KEY&&<button className="text-button" onClick={resetDemo}>Restore example ↗</button>}
        </div>
      </aside>
      <div className={"map-panel"+(illustrated?" editorial-style":"")}>
        <div className="map-topline">
          <span><span className="signal" /> {view === "landscape" ? "Living network" :
            view === "atlas" ? "Geographic atlas" : "Shared associations"}</span>
          <span>{usingSourceExplorer?
            "Complete source network · all entities and relationships":
            activeFundingMap?.fundingDatasetId?
              "Focused detail only · choose Network for the full dataset":
              filtered.graph.nodes.length+" entities · "+filtered.graph.edges.length+" relationships"}</span>
          <button type="button" className="mobile-map-options-toggle"
            aria-controls="studio-map-options" aria-expanded={mobileMapOptionsOpen}
            onClick={()=>setMobileMapOptionsOpen(v=>!v)}>
            {mobileMapOptionsOpen?"Hide map settings":"Map settings"}
          </button>
          <div id="studio-map-options" className={"map-options"+
            (mobileMapOptionsOpen?" mobile-open":"")}>
            {view==="landscape"&&!fullFundingView&&
              (graph.nodes.length>260||graph.edges.length>650)&&
              <button type="button" className="whole-network-entry"
                aria-pressed={detailedToolsOpen}
                onClick={()=>setDetailedToolsOpen(v=>!v)}>
                {detailedToolsOpen?"← Back to full graph":"Detailed mapping tools"}
              </button>}
            {view==="landscape"&&!fullFundingView&&!largeActiveView&&
              !detailedToolsOpen&&
              <button type="button" className="whole-network-entry"
                aria-pressed={wholeNetworkOpen} onClick={()=>setWholeNetworkOpen(v=>!v)}>
                {wholeNetworkOpen?"← Standard canvas":"Explore full network"}
              </button>}
            {view!=="atlas"&&!usingSourceExplorer&&<label>Layout <select aria-label="Network layout" value={layoutMode}
              onChange={event => setLayoutMode(event.target.value as NetworkLayout)}>
              <option value="organic">Organic</option><option value="radial">Radial</option><option value="regions">Regions</option>
            </select></label>}
            {view!=="atlas"&&!usingSourceExplorer&&<label>Labels <select aria-label="Network labels" value={labelDensity}
              onChange={event => setLabelDensity(event.target.value as LabelDensity)}>
              <option value="essential">Essential</option><option value="all">All</option>
            </select></label>}
            {view!=="atlas"&&!usingSourceExplorer&&<label>Style <select aria-label="Network visual style"
              value={illustrated?"editorial":"classic"}
              onChange={event=>setIllustrated(event.target.value==="editorial")}>
              <option value="editorial">Editorial</option>
              <option value="classic">Classic</option>
            </select></label>}
            {view!=="atlas"&&!usingSourceExplorer&&<div className="arrangement-tools" role="group" aria-label="Arrangement history">
              <button type="button" disabled={!movementHistory.past.length}
                onClick={undoNodeMovement} title="Undo last manual node movement">↶ Undo</button>
              <button type="button" disabled={!movementHistory.future.length}
                onClick={redoNodeMovement} title="Redo manual node movement">↷ Redo</button>
              <button type="button" onClick={resetNodeArrangement}>Reset arrangement</button>
            </div>}
          </div>
        </div>
        {view==="landscape"&&detailedToolsOpen&&!fullFundingView&&
          (graph.nodes.length>260||graph.edges.length>650)&&
          <p className="help" role="status">Detailed editing and filters are available
            for the full source map. Rendering and arranging every element here
            may be slower on a phone. Your saved source records are unchanged.
            Return to Full graph for worker-backed rendering.</p>}
        {view==="collaborations"&&largeActiveView?
          <ConnectionsExplorer graph={current} sourceGraph={graph}/> :
        fullFundingView?
          <WholeGraphExplorer datasetId={activeFundingMap!.fundingDatasetId!}
            initialMode="full"/> :
        view!=="atlas"&&((view==="landscape"&&wholeNetworkOpen)||largeActiveView)?
          <WholeGraphExplorer graph={view==="landscape"?graph:filtered.graph}
            initialMode={view==="landscape"?"full":"overview"}/> :
        view==="atlas" ?
          <AtlasCanvas graph={filtered.graph} selectedId={selectedId}
            onSelect={pickNode} onPickEdge={pickEdge}
            mode={atlasMode} onModeChange={setAtlasMode}
            kind={atlasKind} onKindChange={setAtlasKind}
            referenceArtwork={pftMapReference?{url:pftMapReference,
              label:"PFT illustrated UK map"}:undefined}/> :
          <GraphCanvas graph={filtered.graph} contextNodeIds={filtered.contextNodeIds}
            selectedId={selectedId} selectedEdgeId={selectedEdgeId}
            pathNodeIds={connectionTrail?.nodeIds ?? []}
            pathEdgeIds={connectionTrail?.steps.map(step=>step.edgeId)??[]}
            junctionNodeIds={showJunctions?junctions.map(item=>item.nodeId):[]}
            onSelect={pickNode} onSelectEdge={pickEdge}
            view={view} layoutMode={layoutMode} labelDensity={labelDensity}
            illustrated={illustrated} nodeStyles={nodeStyles}
            savedPositions={activePositions} positionRevision={positionRevision}
            onPositionsChange={capturePositions}
            onDragBegin={beginNodeMovement} onDragCommit={finishNodeMovement} />}
        <div className="map-bottomline"><span>{view==="atlas"?
          "Source-provided locations only · Choose a marker to see its recorded relationships" :
          "Drag nodes to arrange · Save a perspective to keep the layout · Source records stay unchanged"}</span>
          <span>{view==="atlas"?"Approximate geographic projection":"Recorded relationships, with evidence"}</span></div>
        {view==="landscape"&&!usingSourceExplorer&&
          <details className="network-ai-disclosure"
            onToggle={event=>setStandardAiOpen(event.currentTarget.open)}>
            <summary>Ask this network · Semantic discovery &amp; AI</summary>
            {standardAiOpen&&<NetworkAI graph={graph} onExplore={id=>{
              setView("landscape");setQuery("");setRegion("");setTypes(TYPE_KEYS);
              setFocusId(null);pickNode(id);
            }}/>} 
          </details>}
        <details className="mobile-map-description">
          <summary>About this map</summary>
          <p>{graph.description||"Explore the recorded entities and relationships in this map."}</p>
        </details>
      </div>
      <aside className="inspector">
        {usingSourceExplorer?<div className="empty-inspector">
          <p className="eyebrow">Explore the complete network</p>
          <h2>Follow a thread.</h2>
          <p>Choose a group, entity or relationship in the whole-network canvas.
            Details open alongside the network as you explore, without reducing
            the graph to a small selection.</p>
        </div>:
        selectedEdge ? <RelationshipInspector edge={selectedEdge} source={graph}
          onPick={pickNode} onEvidence={exploreEvidence} /> :
        selected ? <>
          <NodeInspector node={selected} graph={filtered.graph} source={graph}
            onPick={pickNode} onPickEdge={pickEdge} onTraceFrom={startTraceFromNode}/>
          {view!=="atlas"&&<NodeAppearanceEditor node={selected}
            value={nodeStyles[selected.id]??{}} assets={assets}
            onChange={changeNodeAppearance}/>}
        </> :
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
    <details className="example-library">
      <summary>Explore example networks · community and farming</summary>
      <p>Examples demonstrate what Mossline can do with different kinds of data.
        They are fictional, optional and never overwrite your current map.</p>
      <div className="example-community">
        <div><strong>Neighbourhood Connections</strong>
          <span>15 entities · 16 relationships · UK locations · no special artwork or data format</span></div>
        <button type="button" className="button-outline" onClick={openCommunityExample}>
          Open community example →</button>
      </div>
      <PftVisualShowcase onOpenSample={openPftVisualExample}/>
    </details>
    <details className="studio-deep-dive" open={insightsOpen}
      onToggle={e=>setInsightsOpen(e.currentTarget.open)}>
      <summary>Explore analysis, evidence &amp; funding patterns</summary>
      {insightsOpen&&<>
    <FundingInsights graph={graph}
      fullAnalysis={localMaps.find(item=>item.id===activeMapId)?.fundingAnalysis}
      datasetId={localMaps.find(item=>item.id===activeMapId)?.fundingDatasetId}
      onViewProjection={applyFundingProjection}
      showWholeGraph={false}
      onExplore={id=>{
      setView("landscape");setTypes(TYPE_KEYS);setRegion("");setQuery("");setFocusId(null);
      setSelectedId(id);setSelectedEdgeId(null);
    }}/>

      </>}
    </details>
    </>}
    <footer className="footer"><span>mossline — make sense of connected worlds.</span><span>Open by design · Read-only MCP · Locally saved perspectives</span></footer>
  </main>;
}
