"use client";

import {useEffect,type RefObject} from "react";
import type {Core} from "cytoscape";
import {zoomCytoscapeAtCentre,VIEWPORT_BUTTON_ZOOM_FACTOR}
  from "../lib/cytoscape-viewport";

/** Cytoscape owns wheel zoom; prevent the outer document from scrolling only
 * while the pointer is over the graph, with a non-passive native listener.
 */
export function useContainGraphWheel(root:RefObject<HTMLDivElement|null>):void{
  useEffect(()=>{
    const element=root.current;
    if(!element)return;
    const blockScroll=(event:WheelEvent)=>event.preventDefault();
    element.addEventListener("wheel",blockScroll,{passive:false});
    return ()=>element.removeEventListener("wheel",blockScroll);
  },[root]);
}

export function CytoscapeNavigationControls({cyRef,ready,fitPadding=65,
  ariaLabel="Network navigation",hasSelection=false,onClearSelection}:{
    cyRef:RefObject<Core|null>;ready:boolean;fitPadding?:number;ariaLabel?:string;
    hasSelection?:boolean;onClearSelection?:()=>void;
  }){
  return <div className="graph-tools" aria-label={ariaLabel}>
    <button type="button" disabled={!ready} title="Zoom in" aria-label="Zoom in"
      onClick={()=>{if(cyRef.current)zoomCytoscapeAtCentre(
        cyRef.current,VIEWPORT_BUTTON_ZOOM_FACTOR);}}>+</button>
    <button type="button" disabled={!ready} title="Zoom out" aria-label="Zoom out"
      onClick={()=>{if(cyRef.current)zoomCytoscapeAtCentre(
        cyRef.current,1/VIEWPORT_BUTTON_ZOOM_FACTOR);}}>−</button>
    <button type="button" disabled={!ready} title="Fit network to view"
      aria-label="Fit network to view"
      onClick={()=>cyRef.current?.fit(undefined,fitPadding)}>⤢</button>
    {hasSelection&&onClearSelection&&
      <button type="button" disabled={!ready} title="Clear selection"
        aria-label="Clear selection" onClick={onClearSelection}>×</button>}
  </div>;
}
