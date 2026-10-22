"use client";

import {useEffect,useMemo,useRef,useState,type ChangeEvent} from "react";
import {
  parseAssetLibrary,parsePerspectives,makePerspectiveBundle,readPerspectiveBundle,
  type GraphDocument,type SavedPerspective,type LibraryAsset,type PerspectiveBundle
} from "@mossline/graph-core";
import {ARTWORK_STORAGE_KEY,PERSPECTIVES_STORAGE_KEY}
  from "../lib/browser-storage-keys";

/** Personal saved views and artwork live in their original browser storage.
 * The graph and its evidence remain separate; importing a perspective
 * never updates an underlying source network.
 */
export function useSavedViewLibrary({graph,graphKey,setNotice}:{
  graph:GraphDocument;graphKey:string;setNotice:(message:string)=>void;
}){
  const [perspectives,setPerspectives]=useState<SavedPerspective[]>([]);
  const [assets,setAssets]=useState<LibraryAsset[]>([]);
  const [portablePreview,setPortablePreview]=useState<PerspectiveBundle|null>(null);
  const perspectiveFileRef=useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved=window.localStorage.getItem(PERSPECTIVES_STORAGE_KEY);
      if(saved) setPerspectives(parsePerspectives(JSON.parse(saved)));
    } catch { setNotice("Saved perspectives could not be read. Original browser data was preserved."); }
  }, []);
  useEffect(()=>{
    try {
      const stored=window.localStorage.getItem(ARTWORK_STORAGE_KEY);
      if(stored)setAssets(parseAssetLibrary(JSON.parse(stored)));
    }catch{
      setNotice("The saved artwork library could not be read; it was left unchanged.");
    }
  },[]);

  const savedForMap=useMemo(()=>perspectives.filter(p=>p.graphKey===graphKey)
    .sort((a,b)=>b.createdAt-a.createdAt),[perspectives,graphKey]);

  function saveArtwork(next:LibraryAsset[]):boolean {
    try {
      const checked=parseAssetLibrary(next);
      window.localStorage.setItem(ARTWORK_STORAGE_KEY,JSON.stringify(checked));
      setAssets(checked);
      return true;
    }catch{
      setNotice("Could not save the artwork library. Existing entries were preserved.");
      return false;
    }
  }
  function addArtwork(asset:LibraryAsset):boolean {
    if(assets.length>=60||assets.some(a=>a.url===asset.url))return false;
    return saveArtwork([...assets,asset]);
  }
  function downloadPerspectives(){
    if(savedForMap.length===0){setNotice("Save a perspective before exporting.");return;}
    try{
      const bundle=makePerspectiveBundle(graph,savedForMap,assets);
      const blob=new Blob([JSON.stringify(bundle,null,2)],{type:"application/json"});
      const href=URL.createObjectURL(blob);
      const link=document.createElement("a");
      link.href=href;link.download="mossline-perspectives-"+graphKey+".json";
      link.click();
      URL.revokeObjectURL(href);
      setNotice("Exported "+savedForMap.length+" perspectives and "+assets.length+" artwork references. No graph records were included.");
    }catch{
      setNotice("Could not export this perspective bundle.");
    }
  }
  async function previewPerspectiveImport(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];
    event.target.value="";
    if(!file)return;
    setPortablePreview(null);
    if(file.size>1024*1024){setNotice("Perspective bundles must be 1 MB or smaller.");return;}
    try{
      const bundle=readPerspectiveBundle(JSON.parse(await file.text()),graph);
      if(perspectives.length+bundle.perspectives.length>40)
        throw Error("Not enough space for these views (40 local views maximum).");
      const newImages=bundle.assets.filter(asset=>!assets.some(a=>a.url===asset.url));
      if(assets.length+newImages.length>60)
        throw Error("Not enough space for artwork references (60 maximum).");
      setPortablePreview(bundle);
      setNotice("Reviewed import available. Confirm below to add the views without replacing existing ones.");
    }catch(err){
      setNotice(err instanceof Error?err.message:"Invalid perspective bundle.");
    }
  }
  function confirmPerspectiveImport(){
    if(!portablePreview)return;
    try {
      const checked=readPerspectiveBundle(portablePreview,graph);
      const updatedViews=parsePerspectives([...perspectives,...checked.perspectives.map(item=>({
        ...item,id:crypto.randomUUID()
      }))]);
      const ids=new Set(assets.map(a=>a.id));
      const updatedAssets=parseAssetLibrary([...assets,...checked.assets.filter(a=>
        !assets.some(existing=>existing.url===a.url)).map(asset=>{
          const id=ids.has(asset.id)?crypto.randomUUID():asset.id;
          ids.add(id);
          return {...asset,id};
        })]);
      const oldPerspectives=window.localStorage.getItem(PERSPECTIVES_STORAGE_KEY);
      const oldAssets=window.localStorage.getItem(ARTWORK_STORAGE_KEY);
      try {
        window.localStorage.setItem(PERSPECTIVES_STORAGE_KEY,JSON.stringify(updatedViews));
        window.localStorage.setItem(ARTWORK_STORAGE_KEY,JSON.stringify(updatedAssets));
      }catch(error){
        try {
          if(oldPerspectives===null)window.localStorage.removeItem(PERSPECTIVES_STORAGE_KEY);
          else window.localStorage.setItem(PERSPECTIVES_STORAGE_KEY,oldPerspectives);
          if(oldAssets===null)window.localStorage.removeItem(ARTWORK_STORAGE_KEY);
          else window.localStorage.setItem(ARTWORK_STORAGE_KEY,oldAssets);
        }catch{/* Browser storage may be unavailable; existing state is retained in memory. */}
        throw error;
      }
      setPerspectives(updatedViews);
      setAssets(updatedAssets);
      setPortablePreview(null);
      setNotice("Imported "+checked.perspectives.length+" new perspectives. Existing views and source graph were not overwritten.");
    }catch(err){
      setNotice(err instanceof Error?err.message:"Unable to import the bundle.");
    }
  }
  function savePerspectives(next: SavedPerspective[]) {
    try {
      const validated=parsePerspectives(next);
      window.localStorage.setItem(PERSPECTIVES_STORAGE_KEY,JSON.stringify(validated));
      setPerspectives(validated);
      return true;
    } catch { setNotice("Unable to save views in browser storage."); return false; }
  }


  return {
    perspectives,assets,portablePreview,setPortablePreview,perspectiveFileRef,
    savedForMap,savePerspectives,saveArtwork,addArtwork,
    downloadPerspectives,previewPerspectiveImport,confirmPerspectiveImport
  };
}
