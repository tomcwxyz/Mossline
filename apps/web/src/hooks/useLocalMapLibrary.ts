"use client";

import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from "react";
import {parseGraphDocument,type GraphDocument,type FundingFullAnalysis}
  from "@mossline/graph-core";
import {MAP_LIBRARY_STORAGE_KEY,LEGACY_GRAPH_STORAGE_KEY}
  from "../lib/browser-storage-keys";
import {loadGeneralGraph,generalMapCounts} from "../lib/general-map-store";
import {MAX_AUTO_RESTORE_CHARS,MAX_LOCAL_MAPS,readStoredMapLibrary,
  serialiseMapLibrary,type LocalMap,type SharedLink} from "../lib/map-library";

export type LocalMapLibraryOptions={
  initialGraph:GraphDocument;
  setGraph:Dispatch<SetStateAction<GraphDocument>>;
  resetExplorer:(graph:GraphDocument)=>void;
  setNotice:Dispatch<SetStateAction<string>>;
  onMapSelected:()=>void;
};

/** Owns the browser-local map list, with no changes to its format or lifecycle.
 * Imported large graphs remain in the original IndexedDB store; the map list
 * only carries their stable IDs and node/edge counts.
 */
export function useLocalMapLibrary({
  initialGraph,setGraph,resetExplorer,setNotice,onMapSelected
}:LocalMapLibraryOptions){
  const [hasSavedMapLibrary,setHasSavedMapLibrary]=useState(false);
  const [localMaps,setLocalMaps]=useState<LocalMap[]>([]);
  const [oversizedSavedMaps,setOversizedSavedMaps]=useState(false);
  const [savedMapBackupMade,setSavedMapBackupMade]=useState(false);
  const [activeMapId,setActiveMapId]=useState<string|null>(null);
  const hydrationRef=useRef(0);

  async function hydrateGeneralMap(entry:LocalMap){
    if(!entry.generalDatasetId)return entry;
    if(entry.graph.nodes.length||entry.graph.edges.length)return entry;
    const graph=await loadGeneralGraph(entry.generalDatasetId);
    return {...entry,graph};
  }

  useEffect(()=>{
    let loaded=initialGraph;
    try{
      const saved=window.localStorage.getItem(LEGACY_GRAPH_STORAGE_KEY);
      if(saved&&saved.length<=MAX_AUTO_RESTORE_CHARS){
        loaded=parseGraphDocument(JSON.parse(saved));
        setHasSavedMapLibrary(true);
      }
    }catch{
      // A damaged previous-version cache must not destroy a valid library.
    }
    try{
      const raw=window.localStorage.getItem(MAP_LIBRARY_STORAGE_KEY);
      if(raw){
        if(raw.length>MAX_AUTO_RESTORE_CHARS){
          setOversizedSavedMaps(true);
          setNotice("A large saved map collection was preserved but not loaded automatically. Export a backup before resetting it.");
          const initial:LocalMap={id:crypto.randomUUID(),title:loaded.title,
            graph:loaded,createdAt:Date.now()};
          setGraph(loaded);setLocalMaps([initial]);setActiveMapId(initial.id);
          return;
        }
        const data=readStoredMapLibrary(raw);
        if(data){
          const maps=data.maps;
          const active=maps.find(m=>m.id===data.activeId)??maps[0];
          setHasSavedMapLibrary(true);
          setLocalMaps(maps);setActiveMapId(active.id);setGraph(active.graph);
          if(active.generalDatasetId){
            const generation=++hydrationRef.current;
            void hydrateGeneralMap(active).then(hydrated=>{
              if(generation!==hydrationRef.current)return;
              setLocalMaps(previous=>previous.map(m=>m.id===hydrated.id?hydrated:m));
              setGraph(hydrated.graph);
            }).catch(error=>setNotice(error instanceof Error?error.message:
              "Could not restore the complete network from browser storage."));
          }
          return;
        }
      }
    }catch{
      setNotice("Your browser's saved map collection could not be read. The previous single-map data remains available.");
    }
    const initial:LocalMap={id:crypto.randomUUID(),title:loaded.title,
      graph:loaded,createdAt:Date.now()};
    setGraph(loaded);setLocalMaps([initial]);setActiveMapId(initial.id);
    // Mount hydration intentionally mirrors the existing v1 lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Cancels an in-flight load on unmount, including when the workspace closes.
  useEffect(()=>()=>{hydrationRef.current++;},[]);

  function persistMapLibrary(nextMaps:LocalMap[],nextActive:LocalMap):boolean{
    if(oversizedSavedMaps){
      setNotice("The oversized map collection is protected. Export its backup and reset it before saving new maps.");
      return false;
    }
    try{
      window.localStorage.setItem(MAP_LIBRARY_STORAGE_KEY,
        JSON.stringify(serialiseMapLibrary(nextMaps,nextActive.id)));
      window.localStorage.removeItem(LEGACY_GRAPH_STORAGE_KEY);
      setHasSavedMapLibrary(true);
      setLocalMaps(nextMaps);setActiveMapId(nextActive.id);
      resetExplorer(nextActive.graph);
      return true;
    }catch{
      setNotice("Unable to save the map collection in browser storage. Export your current map before continuing.");
      return false;
    }
  }

  /** `shared` replaces the map's link to its account copy, e.g. after fetching a newer version. */
  function updateGraph(next:GraphDocument,generalDatasetId?:string,shared?:SharedLink):boolean{
    const current=localMaps.find(x=>x.id===activeMapId);
    const link=shared??current?.shared;
    const entry:LocalMap=current?
      {id:current.id,createdAt:current.createdAt,title:next.title,graph:next,
        ...(link?{shared:link}:{}),
        ...(generalDatasetId?{generalDatasetId,sourceCounts:generalMapCounts(next)}:{})}:
      {id:crypto.randomUUID(),title:next.title,createdAt:Date.now(),graph:next,
        ...(generalDatasetId?{generalDatasetId,sourceCounts:generalMapCounts(next)}:{})};
    const updated=current?localMaps.map(x=>x.id===current.id?entry:x):[...localMaps,entry];
    return persistMapLibrary(updated,entry);
  }
  function createNewMap(next:GraphDocument,fundingAnalysis?:FundingFullAnalysis,
    fundingDatasetId?:string,generalDatasetId?:string,shared?:SharedLink):boolean{
    if(localMaps.length>=MAX_LOCAL_MAPS){
      setNotice("This browser has eight maps. Export one before creating another.");
      return false;
    }
    const entry:LocalMap={id:crypto.randomUUID(),createdAt:Date.now(),
      title:next.title,graph:next,fundingAnalysis,fundingDatasetId,
      ...(shared?{shared}:{}),
      ...(generalDatasetId?{generalDatasetId,sourceCounts:generalMapCounts(next)}:{})};
    return persistMapLibrary([...localMaps,entry],entry);
  }
  /** Links (or unlinks) a map in this browser to its copy in a Mossline account, without reopening it. */
  function setShared(id:string,shared:SharedLink|undefined):boolean{
    if(oversizedSavedMaps)return false;
    const maps=localMaps.map(m=>{
      if(m.id!==id)return m;
      const {shared:_old,...rest}=m;
      return shared?{...rest,shared}:rest;
    });
    try{
      window.localStorage.setItem(MAP_LIBRARY_STORAGE_KEY,JSON.stringify(serialiseMapLibrary(maps,activeMapId??id)));
      setLocalMaps(maps);
      return true;
    }catch{return false;}
  }
  function applyFundingProjection(next:GraphDocument):boolean{
    const current=localMaps.find(m=>m.id===activeMapId);
    if(!current?.fundingDatasetId||!current.fundingAnalysis)return false;
    const entry:LocalMap={...current,graph:next};
    const maps=localMaps.map(m=>m.id===current.id?entry:m);
    return persistMapLibrary(maps,entry);
  }
  async function selectLocalMap(id:string){
    const entry=localMaps.find(x=>x.id===id);
    if(!entry)return;
    const generation=++hydrationRef.current;
    try{
      const loaded=await hydrateGeneralMap(entry);
      if(generation!==hydrationRef.current)return;
      const maps=localMaps.map(m=>m.id===id?loaded:m);
      if(persistMapLibrary(maps,loaded)){
        setNotice("Opened ‘"+loaded.title+"’. Your other maps are still saved in this browser.");
        onMapSelected();
      }
    }catch(error){
      setNotice(error instanceof Error?error.message:"Could not reopen the complete network.");
    }
  }
  function resetOversizedCache(){
    if(!savedMapBackupMade||!oversizedSavedMaps)return false;
    try{
      window.localStorage.removeItem(MAP_LIBRARY_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_GRAPH_STORAGE_KEY);
      setOversizedSavedMaps(false);setSavedMapBackupMade(false);
      return true;
    }catch{
      setNotice("Unable to reset browser map storage. Your saved maps were not deliberately changed.");
      return false;
    }
  }
  return {
    hasSavedMapLibrary,localMaps,oversizedSavedMaps,
    savedMapBackupMade,setSavedMapBackupMade,activeMapId,
    updateGraph,createNewMap,applyFundingProjection,selectLocalMap,resetOversizedCache,setShared
  };
}
