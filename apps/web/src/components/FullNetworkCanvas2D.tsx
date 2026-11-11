"use client";

import {drawNetworkLabels} from "../lib/network-labels";

import {useEffect,useMemo,useRef,useState,
  type PointerEvent as ReactPointerEvent} from "react";
import {focusFullNetwork,visibleAtlasNodeLabels,atlasDetailLevel,
  type FullNetworkGeometry,type GraphNode} from "@mossline/graph-core";

type Camera={x:number;y:number;zoom:number};
type Point={x:number;y:number};
type Pointers=Map<number,Point>;
const COLOURS=["#87be94","#e5bd79","#88b4df","#d6a3bb","#acc7a9",
  "#d5d2a1","#b7cbb3","#d5c18f","#b4bd98"];
const clamp=(value:number,low:number,high:number)=>Math.min(high,Math.max(low,value));

/** Complete, source-preserving Canvas 2D renderer for devices without WebGL.
 * All nodes and every edge are drawn from the existing worker-built geometry.
 * This is slower than WebGL on giant networks but must never silently replace
 * the source graph with an aggregated picture based on device capabilities.
 */
export function FullNetworkCanvas2D({geometry,selectedId,onSelect,sizeMode="connections",
  lineMode="focus",focusAreaId,onAreaSelect,onUnavailable,
  selectedPreview,selectedRelationships=0,onDetails}:{
    geometry:FullNetworkGeometry;selectedId?:string|null;
    onSelect:(id:string|null)=>void;
    sizeMode?:"connections"|"amount";lineMode?:"subtle"|"visible"|"focus";
    focusAreaId?:string|null;onAreaSelect?:(id:string|null)=>void;
    onUnavailable?:()=>void;
    selectedPreview?:GraphNode|null;selectedRelationships?:number;onDetails?:()=>void;
  }){
  const canvas=useRef<HTMLCanvasElement>(null);
  const camera=useRef<Camera>({x:0,y:0,zoom:1});
  const paint=useRef<()=>void>(()=>{});
  const pointers=useRef<Pointers>(new Map());
  const gestureMoved=useRef(false);
  const lastFocused=useRef<string|null>(null);
  const pick=useRef(onSelect),areaPick=useRef(onAreaSelect);
  pick.current=onSelect;areaPick.current=onAreaSelect;
  const focus=useMemo(()=>focusFullNetwork(geometry,selectedId),[geometry,selectedId]);
  const neighbourIds=useMemo(()=>new Set<number>(focus?.neighbourIndices??[]),[focus]);
  const selectedIndex=focus?.nodeIndex??-1;
  const [level,setLevel]=useState("Landscape");
  const [hovered,setHovered]=useState<string|null>(null);
  const fit=()=>{
    const surface=canvas.current;if(!surface)return;
    const b=geometry.bounds;
    const w=Math.max(1,surface.clientWidth),h=Math.max(1,surface.clientHeight);
    camera.current={x:-(b.minX+b.maxX)/2,y:-(b.minY+b.maxY)/2,
      zoom:Math.max(.01,Math.min(w/Math.max(1,b.maxX-b.minX),
        h/Math.max(1,b.maxY-b.minY))*.82)};
    paint.current();
  };
  const zoomAt=(factor:number,x:number,y:number)=>{
    const surface=canvas.current;if(!surface)return;
    const c=camera.current,w=surface.clientWidth,h=surface.clientHeight;
    const wx=(x-w/2)/c.zoom-c.x,wy=(y-h/2)/c.zoom-c.y;
    c.zoom=clamp(c.zoom*factor,.02,70);
    c.x=(x-w/2)/c.zoom-wx;c.y=(y-h/2)/c.zoom-wy;
    paint.current();
  };
  useEffect(()=>{
    // The camera starts fitted for each new source geometry, never from a stub.
    const surface=canvas.current;if(!surface)return;
    fit();
    const observer=new ResizeObserver(()=>{fit();});
    observer.observe(surface);
    const wheel=(event:WheelEvent)=>{
      event.preventDefault();
      const rect=surface.getBoundingClientRect();
      zoomAt(Math.exp(-event.deltaY*.001),event.clientX-rect.left,
        event.clientY-rect.top);
    };
    surface.addEventListener("wheel",wheel,{passive:false});
    return ()=>{observer.disconnect();surface.removeEventListener("wheel",wheel);};
    // A renderer-only setting must never reset the user's camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[geometry]);

  useEffect(()=>{
    const surface=canvas.current;
    if(!surface)return;
    const context=surface.getContext("2d",{alpha:false});
    if(!context){onUnavailable?.();return;}
    const render=()=>{
      const w=Math.max(1,surface.clientWidth),h=Math.max(1,surface.clientHeight);
      // Cap backing pixels on memory-limited devices; all graph records stay.
      const ratio=Math.min(2,Math.max(1,window.devicePixelRatio||1));
      const pixelWidth=Math.max(1,Math.round(w*ratio));
      const pixelHeight=Math.max(1,Math.round(h*ratio));
      if(surface.width!==pixelWidth||surface.height!==pixelHeight){
        surface.width=pixelWidth;surface.height=pixelHeight;
      }
      context.setTransform(ratio,0,0,ratio,0,0);
      context.fillStyle="#112c27";context.fillRect(0,0,w,h);
      const c=camera.current;
      const screen=(x:number,y:number):Point=>({
        x:w/2+(x+c.x)*c.zoom,y:h/2+(y+c.y)*c.zoom
      });
      const focusEdge=(edge:number)=>{
        const a=geometry.endpoints[edge*2],b=geometry.endpoints[edge*2+1];
        return geometry.recorded[edge]===1&&
          (a===selectedIndex||b===selectedIndex);
      };
      // Two source-aware line passes; no sampling or edge-count truncation.
      // Batching avoids thousands of canvas stroke calls.
      for(let pass=0;pass<3;pass++){
        context.beginPath();
        for(let e=0;e<geometry.edgeCount;e++){
          const active=selectedIndex>=0&&focusEdge(e);
          if(pass===0&&(geometry.recorded[e]!==1||active))continue;
          if(pass===1&&(geometry.recorded[e]===1||active))continue;
          if(pass===2&&!active)continue;
          const k=e*4,a=screen(geometry.segments[k],geometry.segments[k+1]);
          const b=screen(geometry.segments[k+2],geometry.segments[k+3]);
          if((a.x<0&&b.x<0)||(a.x>w&&b.x>w)||
            (a.y<0&&b.y<0)||(a.y>h&&b.y>h))continue;
          context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);
        }
        context.lineWidth=pass===2?1.65:0.75;
        context.strokeStyle=pass===2?"rgba(255,215,139,.92)":
          pass===1?"rgba(217,187,128,.19)":
          selectedIndex>=0?"rgba(126,170,146,.065)":
          lineMode==="visible"?"rgba(135,188,151,.31)":
          lineMode==="subtle"?"rgba(135,188,151,.13)":
          "rgba(135,188,151,.23)";
        context.stroke();
      }
      if(geometry.areas.length&&c.zoom<1.4){
        context.font="600 12px system-ui, sans-serif";
        context.textAlign="center";
        for(const area of geometry.areas){
          const p=screen(area.x,area.y);
          if(p.x<0||p.x>w||p.y<0||p.y>h)continue;
          const radius=Math.max(15,area.radius*c.zoom);
          context.beginPath();context.arc(p.x,p.y,radius,0,Math.PI*2);
          context.fillStyle="rgba(65,122,86,.08)";context.fill();
          context.fillStyle="#e3e4bd";
          context.fillText(area.label.slice(0,30),p.x,p.y,Math.max(42,radius*2));
        }
      }
      // Geometry is read directly, including isolated entities and large
      // grouped areas. Draw the highlighted subset last for legibility.
      for(let pass=0;pass<2;pass++){
        for(let i=0;i<geometry.nodeCount;i++){
          const active=selectedIndex>=0&&neighbourIds.has(i);
          if(pass===0&&active||pass===1&&!active)continue;
          const p=screen(geometry.positions[i*2],geometry.positions[i*2+1]);
          if(p.x< -15||p.x>w+15||p.y< -15||p.y>h+15)continue;
          const kind=geometry.types[i]??8;
          const dataSize=(sizeMode==="amount"?geometry.amountSizes:geometry.degreeSizes)[i]??3.5;
          const radius=clamp(dataSize*.39,2.0,7.8)*(selectedIndex===i?1.5:1);
          context.globalAlpha=selectedIndex<0||active?1:.24;
          context.fillStyle=COLOURS[kind]??COLOURS[8];
          context.beginPath();
          if(kind===2){context.moveTo(p.x,p.y-radius);
            context.lineTo(p.x+radius,p.y);context.lineTo(p.x,p.y+radius);
            context.lineTo(p.x-radius,p.y);context.closePath();}
          else if(kind===1){context.rect(p.x-radius,p.y-radius,radius*2,radius*2);}
          else context.arc(p.x,p.y,radius,0,Math.PI*2);
          context.fill();
          if(i===selectedIndex){
            context.strokeStyle="#ffe2a3";context.lineWidth=2.3;context.stroke();
          }
        }
      }
      context.globalAlpha=1;
      const labels=visibleAtlasNodeLabels(geometry,c.zoom,c.x,c.y,w,h,18);
      drawNetworkLabels(context,labels,index=>geometry.degreeSizes[index]>9,w,h,c.zoom);
      const next=atlasDetailLevel(geometry,c.zoom);
      setLevel(previous=>{
        const name=next==="area"?"Area":next==="entity"?"Entity":"Landscape";
        return previous===name?previous:name;
      });
    };
    paint.current=render;
    render();
    return ()=>{paint.current=()=>{};};
  },[geometry,selectedIndex,neighbourIds,sizeMode,lineMode,onUnavailable]);

  useEffect(()=>{
    if(!selectedId){lastFocused.current=null;return;}
    if(lastFocused.current===selectedId)return;
    const index=geometry.ids.indexOf(selectedId);
    const surface=canvas.current;if(index<0||!surface)return;
    lastFocused.current=selectedId;
    const c=camera.current;
    const zoom=Math.max(c.zoom,Math.min(1.45,15));
    const pointX=geometry.positions[index*2],pointY=geometry.positions[index*2+1];
    camera.current={x:-pointX,y:-pointY,zoom};paint.current();
  },[selectedId,geometry]);
  useEffect(()=>{
    if(!focusAreaId)return;
    const area=geometry.areas.find(a=>a.id===focusAreaId);
    if(!area||!canvas.current)return;
    const side=Math.min(canvas.current.clientWidth,canvas.current.clientHeight);
    camera.current={x:-area.x,y:-area.y,
      zoom:clamp(side/Math.max(80,area.radius*2.4),.08,12)};
    paint.current();
  },[focusAreaId,geometry]);

  const nearest=(x:number,y:number):number=>{
    const surface=canvas.current;if(!surface)return -1;
    const c=camera.current,w=surface.clientWidth,h=surface.clientHeight;
    const wx=(x-w/2)/c.zoom-c.x,wy=(y-h/2)/c.zoom-c.y;
    const limit=(Math.max(9,14)/c.zoom)**2;
    let best=-1,bestDistance=limit;
    for(let i=0;i<geometry.nodeCount;i++){
      const dx=geometry.positions[i*2]-wx,dy=geometry.positions[i*2+1]-wy;
      const d=dx*dx+dy*dy;
      if(d<bestDistance){best=i;bestDistance=d;}
    }
    return best;
  };
  const previousPinch=useRef<{x:number;y:number;distance:number}|null>(null);
  const pointerDown=(e:ReactPointerEvent<HTMLCanvasElement>)=>{
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    gestureMoved.current=false;
    if(pointers.current.size>1)gestureMoved.current=true;
  };
  const pointerMove=(e:ReactPointerEvent<HTMLCanvasElement>)=>{
    const old=pointers.current.get(e.pointerId);if(!old)return;
    pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const points=[...pointers.current.values()];
    if(points.length===2){
      const rect=e.currentTarget.getBoundingClientRect();
      const midpoint={x:(points[0].x+points[1].x)/2-rect.left,
        y:(points[0].y+points[1].y)/2-rect.top};
      const distance=Math.hypot(points[0].x-points[1].x,
        points[0].y-points[1].y);
      if(previousPinch.current){
        zoomAt(distance/Math.max(1,previousPinch.current.distance),
          midpoint.x,midpoint.y);
        const c=camera.current;
        c.x+=(midpoint.x-previousPinch.current.x)/c.zoom;
        c.y+=(midpoint.y-previousPinch.current.y)/c.zoom;
        paint.current();
      }
      previousPinch.current={...midpoint,distance};
      gestureMoved.current=true;return;
    }
    const dx=e.clientX-old.x,dy=e.clientY-old.y;
    if(Math.hypot(dx,dy)>2)gestureMoved.current=true;
    if(gestureMoved.current){
      camera.current.x+=dx/camera.current.zoom;
      camera.current.y+=dy/camera.current.zoom;
      paint.current();
    }
  };
  const pointerUp=(e:ReactPointerEvent<HTMLCanvasElement>)=>{
    const sole=pointers.current.size===1&&!gestureMoved.current;
    pointers.current.delete(e.pointerId);
    if(pointers.current.size<2)previousPinch.current=null;
    if(!sole)return;
    const rect=e.currentTarget.getBoundingClientRect();
    const x=e.clientX-rect.left,y=e.clientY-rect.top;
    const hit=nearest(x,y);
    if(hit>=0){pick.current(geometry.ids[hit]);return;}
    const c=camera.current;
    const wx=(x-rect.width/2)/c.zoom-c.x,wy=(y-rect.height/2)/c.zoom-c.y;
    if(c.zoom<1.4){
      const area=geometry.areas.find(a=>
        Math.hypot(a.x-wx,a.y-wy)<=a.radius);
      if(area){areaPick.current?.(area.id);return;}
    }
    pick.current(null);
  };
  return <div className="whole-graph-stage full-network-stage">
    <canvas ref={canvas} className="full-network-canvas" role="img"
      aria-label={"Complete network compatibility view: "+geometry.nodeCount+
        " source entities and "+geometry.edgeCount+
        " original relationships. Drag to pan, pinch to zoom, tap to inspect."}
      onPointerDown={pointerDown} onPointerMove={pointerMove}
      onPointerUp={pointerUp} onPointerCancel={e=>{
        pointers.current.delete(e.pointerId);previousPinch.current=null;
      }} onPointerLeave={()=>setHovered(null)}
      onDoubleClick={e=>{
        const rect=e.currentTarget.getBoundingClientRect();
        zoomAt(1.8,e.clientX-rect.left,e.clientY-rect.top);
      }}/>
    <div className="atlas-scale-indicator" aria-live="off">
      <span className="atlas-scale-dot"/>{level} · 2D compatibility mode
    </div>
    {selectedPreview&&<aside className="atlas-entity-preview"
      aria-label={"Selected "+selectedPreview.type}>
      <div className="atlas-entity-kicker">
        <span>{selectedPreview.type}</span>
        <button type="button" aria-label="Clear selection"
          onClick={()=>pick.current(null)}>×</button>
      </div>
      <h4>{selectedPreview.label}</h4>
      {selectedPreview.description&&<p>{selectedPreview.description.slice(0,220)}</p>}
      <div className="atlas-entity-links">
        <strong>{selectedRelationships.toLocaleString("en-GB")}</strong>
        <span>source relationship records</span>
      </div>
      <button type="button" className="atlas-preview-details" onClick={onDetails}>
        Explore evidence and connections →</button>
    </aside>}
    <div className="graph-tools" aria-label="Full-network navigation">
      {focusAreaId&&<button type="button" aria-label="Return to landscape"
        onClick={()=>{fit();areaPick.current?.(null);}}>↶</button>}
      <button type="button" aria-label="Zoom in" onClick={()=>{
        const s=canvas.current;if(s)zoomAt(1.5,s.clientWidth/2,s.clientHeight/2);
      }}>+</button>
      <button type="button" aria-label="Zoom out" onClick={()=>{
        const s=canvas.current;if(s)zoomAt(1/1.5,s.clientWidth/2,s.clientHeight/2);
      }}>−</button>
      <button type="button" aria-label="Fit whole network" onClick={fit}>⤢</button>
    </div>
    <div className="full-network-gesture-hint" aria-hidden="true">
      All source entities and relationships · Drag to pan · Pinch to zoom
    </div>
  </div>;
}
