"use client";

import {useEffect,useMemo,useRef,type PointerEvent as ReactPointerEvent} from "react";
import {focusFullNetwork,type FullNetworkFocus,type FullNetworkGeometry}
  from "@mossline/graph-core";

type Camera={offsetX:number;offsetY:number;zoom:number};
type Point={x:number;y:number};
type Drag={x:number;y:number;offsetX:number;offsetY:number;moved:boolean};
const vertex=`attribute vec2 a_pos;
attribute float a_kind;
varying float v_kind;
uniform vec2 u_offset;
uniform vec2 u_viewport;
uniform float u_zoom;
uniform float u_pointSize;
void main(){
 v_kind=a_kind;
 vec2 p=(a_pos+u_offset)*u_zoom;
 gl_Position=vec4(p.x/(u_viewport.x*.5),-p.y/(u_viewport.y*.5),0.0,1.0);
 gl_PointSize=u_pointSize;
}`;
const fragment=`precision mediump float;
uniform vec4 u_colour;
uniform bool u_circle;
uniform float u_fade;
varying float v_kind;
void main(){
 if(u_circle && length(gl_PointCoord-vec2(.5))>.5)discard;
 vec4 colour=u_colour;
 if(u_circle){
  if(v_kind<.5) colour=vec4(.54,.76,.56,.93);
  else if(v_kind<1.5) colour=vec4(.91,.73,.41,.91);
  else if(v_kind<2.5) colour=vec4(.55,.73,.91,.94);
  else if(v_kind<3.5) colour=vec4(.81,.57,.72,.91);
  else if(v_kind<4.5) colour=vec4(.69,.77,.68,.91);
  else colour=vec4(.79,.81,.65,.90);
  colour.a*=u_fade;
 }
 gl_FragColor=colour;
}`;
function compile(gl:WebGLRenderingContext,type:number,source:string){
 const shader=gl.createShader(type);
 if(!shader)throw Error("No WebGL shader");
 gl.shaderSource(shader,source);gl.compileShader(shader);
 if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error("WebGL shader compilation failed");
 return shader;
}
function midpoint(points:Point[]):Point{
 return {x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2};
}
function distance(points:Point[]):number{
 return Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
}
export function FullNetworkCanvas({geometry,selectedId,onSelect,onUnavailable}:{
 geometry:FullNetworkGeometry;selectedId?:string|null;onSelect:(id:string|null)=>void;
 onUnavailable?:()=>void;
}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const overlay=useRef<HTMLCanvasElement>(null);
 const camera=useRef<Camera>({offsetX:0,offsetY:0,zoom:1});
 const draw=useRef<(()=>void)|null>(null);
 const zoomTo=useRef<(factor:number,x:number,y:number)=>void>(()=>{});
 const animation=useRef<number|null>(null);
 const pick=useRef(onSelect),unavailable=useRef(onUnavailable);
 pick.current=onSelect;unavailable.current=onUnavailable;
 const focus=useMemo(()=>focusFullNetwork(geometry,selectedId),[geometry,selectedId]);
 const currentFocus=useRef<FullNetworkFocus|null>(focus);
 currentFocus.current=focus;
 const index=useMemo(()=>new Map(geometry.ids.map((id,i)=>[id,i])),[geometry]);
 const pointers=useRef(new Map<number,Point>());
 const drag=useRef<Drag|null>(null);
 const pinch=useRef<{mid:Point;distance:number}|null>(null);
 const stopAnimation=()=>{
   if(animation.current!==null){
     cancelAnimationFrame(animation.current);animation.current=null;
   }
 };
 const fit=()=>{
   const surface=canvas.current;if(!surface)return;
   const b=geometry.bounds,w=Math.max(1,surface.clientWidth),h=Math.max(1,surface.clientHeight);
   camera.current={offsetX:-(b.minX+b.maxX)/2,offsetY:-(b.minY+b.maxY)/2,
     zoom:Math.max(.01,Math.min(w/Math.max(1,b.maxX-b.minX),
       h/Math.max(1,b.maxY-b.minY))*.82)};
   draw.current?.();
 };
 useEffect(()=>{
   const surface=canvas.current,foreground=overlay.current;
   if(!surface||!foreground)return;
   const gl=surface.getContext("webgl",{alpha:false,antialias:false,preserveDrawingBuffer:false});
   if(!gl){unavailable.current?.();return;}
   const buffers:WebGLBuffer[]=[];
   let program:WebGLProgram|null=null;
   let observer:ResizeObserver|null=null;
   let pending:number|null=null;
   let uploaded:FullNetworkFocus|null=null;
   try{
     program=gl.createProgram();if(!program)throw Error("WebGL unavailable");
     const v=compile(gl,gl.VERTEX_SHADER,vertex),f=compile(gl,gl.FRAGMENT_SHADER,fragment);
     gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);
     gl.deleteShader(v);gl.deleteShader(f);
     if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error("Cannot link graph renderer");
     const makeBuffer=(data:Float32Array|Uint8Array,usage:number)=>{
       const buffer=gl.createBuffer();
       if(!buffer)throw Error("Browser GPU memory unavailable");
       buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
       gl.bufferData(gl.ARRAY_BUFFER,data as BufferSource,usage);
       return buffer;
     };
     const backgroundLines=makeBuffer(geometry.segments,gl.STATIC_DRAW);
     const backgroundPoints=makeBuffer(geometry.positions,gl.STATIC_DRAW);
     const backgroundTypes=makeBuffer(geometry.types,gl.STATIC_DRAW);
     const selectedLines=makeBuffer(new Float32Array(0),gl.DYNAMIC_DRAW);
     const selectedPoints=makeBuffer(new Float32Array(0),gl.DYNAMIC_DRAW);
     const selectedTypes=makeBuffer(new Uint8Array(0),gl.DYNAMIC_DRAW);
     const position=gl.getAttribLocation(program,"a_pos");
     const kind=gl.getAttribLocation(program,"a_kind");
     const offset=gl.getUniformLocation(program,"u_offset");
     const viewport=gl.getUniformLocation(program,"u_viewport");
     const zoom=gl.getUniformLocation(program,"u_zoom");
     const pointSize=gl.getUniformLocation(program,"u_pointSize");
     const colour=gl.getUniformLocation(program,"u_colour");
     const circle=gl.getUniformLocation(program,"u_circle");
     const fade=gl.getUniformLocation(program,"u_fade");
     let initial=true;
     const update=()=>{
       const selection=currentFocus.current;
       if(selection===uploaded)return;
       uploaded=selection;
       gl.bindBuffer(gl.ARRAY_BUFFER,selectedLines);
       gl.bufferData(gl.ARRAY_BUFFER,selection?.lines??new Float32Array(0),gl.DYNAMIC_DRAW);
       gl.bindBuffer(gl.ARRAY_BUFFER,selectedPoints);
       gl.bufferData(gl.ARRAY_BUFFER,selection?.nodes??new Float32Array(0),gl.DYNAMIC_DRAW);
       gl.bindBuffer(gl.ARRAY_BUFFER,selectedTypes);
       gl.bufferData(gl.ARRAY_BUFFER,selection?.types??new Uint8Array(0),gl.DYNAMIC_DRAW);
     };
     const pointAttribute=(points:WebGLBuffer,types:WebGLBuffer)=>{
       gl.bindBuffer(gl.ARRAY_BUFFER,points);
       gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
       gl.bindBuffer(gl.ARRAY_BUFFER,types);
       gl.enableVertexAttribArray(kind);
       gl.vertexAttribPointer(kind,1,gl.UNSIGNED_BYTE,false,0,0);
     };
     const lineAttribute=(buffer:WebGLBuffer)=>{
       gl.disableVertexAttribArray(kind);gl.vertexAttrib1f(kind,0);
       gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
       gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
     };
     const render=()=>{
       if(!canvas.current||!overlay.current)return;
       const w=Math.max(1,surface.clientWidth),h=Math.max(1,surface.clientHeight);
       const ratio=Math.min(2,window.devicePixelRatio||1);
       const pw=Math.max(1,Math.round(w*ratio)),ph=Math.max(1,Math.round(h*ratio));
       if(surface.width!==pw||surface.height!==ph){
         surface.width=pw;surface.height=ph;
         foreground.width=pw;foreground.height=ph;
         foreground.style.width=w+"px";foreground.style.height=h+"px";
       }
       if(initial){fit();initial=false;}
       const c=camera.current,selection=currentFocus.current;
       gl.viewport(0,0,pw,ph);
       gl.clearColor(.07,.16,.14,1);gl.clear(gl.COLOR_BUFFER_BIT);
       gl.useProgram(program);gl.uniform2f(viewport,w,h);
       gl.uniform2f(offset,c.offsetX,c.offsetY);gl.uniform1f(zoom,c.zoom);
       gl.enableVertexAttribArray(position);
       gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
       gl.uniform1f(fade,1);
       gl.uniform1i(circle,0);gl.uniform1f(pointSize,1);
       gl.uniform4f(colour,.54,.70,.61,selection ? .07 : .20);
       lineAttribute(backgroundLines);
       gl.drawArrays(gl.LINES,0,geometry.edgeCount*2);
       gl.uniform1i(circle,1);
       gl.uniform1f(fade,selection?.13:1);
       gl.uniform1f(pointSize,Math.max(2.5,Math.min(8,c.zoom*8)));
       pointAttribute(backgroundPoints,backgroundTypes);
       gl.drawArrays(gl.POINTS,0,geometry.nodeCount);
       if(selection){
         update();
         gl.uniform1i(circle,0);gl.uniform1f(pointSize,1);
         gl.uniform4f(colour,1,.81,.48,.94);
         lineAttribute(selectedLines);
         gl.drawArrays(gl.LINES,0,selection.relationships*2);
         gl.uniform1i(circle,1);gl.uniform1f(fade,1);
         gl.uniform1f(pointSize,Math.max(6,Math.min(13,c.zoom*11)));
         pointAttribute(selectedPoints,selectedTypes);
         gl.drawArrays(gl.POINTS,0,selection.neighbourIndices.length);
       }
       const context=foreground.getContext("2d");if(!context)return;
       context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,w,h);
       if(!selection)return;
       const i=selection.nodeIndex;
       const x=w/2+(geometry.positions[i*2]+c.offsetX)*c.zoom;
       const y=h/2+(geometry.positions[i*2+1]+c.offsetY)*c.zoom;
       if(x<-100||y<-100||x>w+100||y>h+100)return;
       context.beginPath();context.arc(x,y,14,0,Math.PI*2);
       context.strokeStyle="#ffdd91";context.lineWidth=3;context.stroke();
       context.font="bold 12px system-ui";
       const label=geometry.labels[i]??geometry.ids[i];
       const labelWidth=Math.min(w-36,context.measureText(label).width+16);
       const labelX=Math.max(5,Math.min(w-labelWidth-5,x+18));
       const labelY=Math.max(5,Math.min(h-29,y-18));
       context.fillStyle="#173d31";context.fillRect(labelX,labelY,labelWidth,25);
       context.fillStyle="#fff3d5";
       context.save();context.beginPath();context.rect(labelX+5,labelY,Math.max(0,labelWidth-10),25);
       context.clip();context.fillText(label,labelX+8,labelY+17);context.restore();
     };
     const schedule=()=>{
       if(pending!==null)return;
       pending=requestAnimationFrame(()=>{pending=null;render();});
     };
     draw.current=schedule;
     render();observer=new ResizeObserver(schedule);observer.observe(surface);
   }catch{
     draw.current=null;unavailable.current?.();
   }
   return ()=>{
     observer?.disconnect();
     if(pending!==null)cancelAnimationFrame(pending);
     draw.current=null;
     buffers.forEach(buffer=>gl.deleteBuffer(buffer));
     if(program)gl.deleteProgram(program);
   };
 },[geometry]);
 useEffect(()=>{
   const surface=canvas.current;
   if(!surface)return;
   // React delegates wheel events as passive; a native non-passive listener
   // keeps the page from scrolling when a user zooms over the network itself.
   const handleWheel=(event:WheelEvent)=>{
     event.preventDefault();
     stopAnimation();
     const rect=surface.getBoundingClientRect();
     const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?rect.height:1);
     const factor=Math.exp(-Math.max(-240,Math.min(240,delta))*.002);
     zoomTo.current(factor,event.clientX-rect.left,event.clientY-rect.top);
   };
   surface.addEventListener("wheel",handleWheel,{passive:false});
   return ()=>surface.removeEventListener("wheel",handleWheel);
 },[]);
 useEffect(()=>{
   stopAnimation();draw.current?.();
   if(!selectedId)return;
   const i=index.get(selectedId),surface=canvas.current;
   if(i===undefined||!surface)return;
   const from={...camera.current};
   const target:Camera={offsetX:-geometry.positions[i*2],offsetY:-geometry.positions[i*2+1],
     zoom:Math.max(from.zoom,Math.min(5,Math.max(1.45,
       Math.min(surface.clientWidth,surface.clientHeight)/360)))};
   if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){
     camera.current=target;draw.current?.();return;
   }
   let start:number|null=null;
   const step=(time:number)=>{
     if(start===null)start=time;
     const t=Math.min(1,(time-start)/320);
     const easing=1-Math.pow(1-t,3);
     camera.current={
       offsetX:from.offsetX+(target.offsetX-from.offsetX)*easing,
       offsetY:from.offsetY+(target.offsetY-from.offsetY)*easing,
       zoom:from.zoom+(target.zoom-from.zoom)*easing
     };
     draw.current?.();
     animation.current=t<1?requestAnimationFrame(step):null;
   };
   animation.current=requestAnimationFrame(step);
   return stopAnimation;
 },[selectedId,geometry,index]);
 zoomTo.current=(factor:number,x:number,y:number)=>{
   const surface=canvas.current;if(!surface)return;
   const c=camera.current,w=surface.clientWidth,h=surface.clientHeight;
   const worldX=(x-w/2)/c.zoom-c.offsetX;
   const worldY=(y-h/2)/c.zoom-c.offsetY;
   c.zoom=Math.max(.02,Math.min(70,c.zoom*factor));
   c.offsetX=(x-w/2)/c.zoom-worldX;
   c.offsetY=(y-h/2)/c.zoom-worldY;
   draw.current?.();
 };
 const pointerDown=(event:ReactPointerEvent<HTMLCanvasElement>)=>{
   stopAnimation();
   event.currentTarget.setPointerCapture(event.pointerId);
   pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
   const positions=[...pointers.current.values()];
   if(positions.length===1){
     drag.current={x:event.clientX,y:event.clientY,
       offsetX:camera.current.offsetX,offsetY:camera.current.offsetY,moved:false};
     pinch.current=null;
   }else if(positions.length===2){
     drag.current=null;
     pinch.current={mid:midpoint(positions),distance:Math.max(1,distance(positions))};
   }
 };
 const pointerMove=(event:React.PointerEvent<HTMLCanvasElement>)=>{
   if(!pointers.current.has(event.pointerId))return;
   pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
   const positions=[...pointers.current.values()];
   if(positions.length===2){
     const middle=midpoint(positions),length=Math.max(1,distance(positions));
     const previous=pinch.current;
     if(previous){
       camera.current.offsetX+=(middle.x-previous.mid.x)/camera.current.zoom;
       camera.current.offsetY+=(middle.y-previous.mid.y)/camera.current.zoom;
       const rect=event.currentTarget.getBoundingClientRect();
       zoomTo.current(length/previous.distance,middle.x-rect.left,middle.y-rect.top);
     }
     pinch.current={mid:middle,distance:length};
     return;
   }
   const start=drag.current;
   if(positions.length===1&&start){
     const dx=event.clientX-start.x,dy=event.clientY-start.y;
     if(Math.abs(dx)+Math.abs(dy)>6)start.moved=true;
     if(start.moved){
       camera.current.offsetX=start.offsetX+dx/camera.current.zoom;
       camera.current.offsetY=start.offsetY+dy/camera.current.zoom;
       draw.current?.();
     }
   }
 };
 const pointerEnd=(event:React.PointerEvent<HTMLCanvasElement>,cancelled=false)=>{
   const wasSingle=pointers.current.size===1;
   const point=drag.current;
   pointers.current.delete(event.pointerId);
   const remaining=[...pointers.current.values()];
   pinch.current=null;drag.current=null;
   if(remaining.length===1){
     drag.current={...remaining[0],offsetX:camera.current.offsetX,
       offsetY:camera.current.offsetY,moved:true};
   }
   if(cancelled||!wasSingle||!point||point.moved)return;
   const rect=event.currentTarget.getBoundingClientRect();
   const c=camera.current;
   const wx=(event.clientX-rect.left-rect.width/2)/c.zoom-c.offsetX;
   const wy=(event.clientY-rect.top-rect.height/2)/c.zoom-c.offsetY;
   const maxDistance=Math.max(8,16/c.zoom),maxSq=maxDistance*maxDistance;
   let match=-1,nearest=maxSq;
   for(let i=0;i<geometry.nodeCount;i++){
     const dx=geometry.positions[i*2]-wx,dy=geometry.positions[i*2+1]-wy;
     const squared=dx*dx+dy*dy;
     if(squared<nearest){nearest=squared;match=i;}
   }
   pick.current(match>=0?geometry.ids[match]:null);
 };
 return <div className="whole-graph-stage full-network-stage">
   <canvas ref={canvas} className="full-network-canvas" role="img"
     aria-label={"Full graph: "+geometry.nodeCount+" source entities and "+
       geometry.edgeCount+" recorded and inferred relationship lines. Select a point to focus its recorded connections. Pinch or scroll to zoom; drag to pan."}
     onPointerDown={pointerDown} onPointerMove={pointerMove}
     onPointerUp={event=>pointerEnd(event)}
     onPointerCancel={event=>pointerEnd(event,true)}
     onDoubleClick={event=>{
       event.preventDefault();stopAnimation();
       const rect=event.currentTarget.getBoundingClientRect();
       zoomTo.current(1.8,event.clientX-rect.left,event.clientY-rect.top);
     }}/>
   <canvas ref={overlay} className="full-network-overlay" aria-hidden="true"/>
   <div className="graph-tools" aria-label="Full-network navigation">
     <button type="button" onClick={()=>{
       stopAnimation();const s=canvas.current;
       if(s)zoomTo.current(1.5,s.clientWidth/2,s.clientHeight/2);
     }} aria-label="Zoom in">+</button>
     <button type="button" onClick={()=>{
       stopAnimation();const s=canvas.current;
       if(s)zoomTo.current(1/1.5,s.clientWidth/2,s.clientHeight/2);
     }} aria-label="Zoom out">−</button>
     <button type="button" onClick={()=>{
       stopAnimation();fit();
     }} aria-label="Fit whole network">⤢</button>
   </div>
   <div className="full-network-gesture-hint" aria-hidden="true">
     Scroll or pinch to zoom · Drag to pan · Tap a node to explore
   </div>
 </div>;
}
