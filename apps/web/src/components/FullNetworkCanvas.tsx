"use client";
import {useEffect,useRef} from "react";
import type {FullNetworkGeometry} from "@mossline/graph-core";

type Camera={offsetX:number;offsetY:number;zoom:number};
const vert=`attribute vec2 a_pos;
uniform vec2 u_offset;
uniform vec2 u_viewport;
uniform float u_zoom;
uniform float u_pointSize;
void main(){
 vec2 p=(a_pos+u_offset)*u_zoom;
 gl_Position=vec4(p.x/(u_viewport.x*0.5),-p.y/(u_viewport.y*0.5),0.0,1.0);
 gl_PointSize=u_pointSize;
}`;
const frag=`precision mediump float;
uniform vec4 u_colour;
uniform bool u_circle;
void main(){
 if(u_circle && length(gl_PointCoord-vec2(0.5))>0.5)discard;
 gl_FragColor=u_colour;
}`;
function shader(gl:WebGLRenderingContext,type:number,source:string){
 const result=gl.createShader(type);if(!result)throw Error("WebGL shader unavailable");
 gl.shaderSource(result,source);gl.compileShader(result);
 if(!gl.getShaderParameter(result,gl.COMPILE_STATUS))
   throw Error("Full-network GPU shader could not compile.");
 return result;
}

/** Renders one GPU point per original source entity and one GPU line per
 * original edge. Interaction runs independently of the adaptive summary.
 * Browser fallback stays available if WebGL cannot be initialised.
 */
export function FullNetworkCanvas({geometry,selectedId,onSelect,onUnavailable}:{
 geometry:FullNetworkGeometry;selectedId?:string|null;
 onSelect:(id:string)=>void;onUnavailable?:()=>void;
}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const overlay=useRef<HTMLCanvasElement>(null);
 const cam=useRef<Camera>({offsetX:0,offsetY:0,zoom:1});
 const draw=useRef<(()=>void)|null>(null);
 const selected=useRef(selectedId);
 const onPick=useRef(onSelect),onGpuFailure=useRef(onUnavailable);
 selected.current=selectedId;onPick.current=onSelect;onGpuFailure.current=onUnavailable;
 const pickIndex=useRef(new Map<string,number>());
 useEffect(()=>{
  const surface=canvas.current,foreground=overlay.current;
  if(!surface||!foreground)return;
  const gl=surface.getContext("webgl",{alpha:false,antialias:false,
    preserveDrawingBuffer:false});
  if(!gl){draw.current=null;onGpuFailure.current?.();return;}
  let program:WebGLProgram|null=null,lineBuffer:WebGLBuffer|null=null,
      pointBuffer:WebGLBuffer|null=null,observer:ResizeObserver|null=null;
  try{
   program=gl.createProgram();if(!program)throw Error("No WebGL programme");
   gl.attachShader(program,shader(gl,gl.VERTEX_SHADER,vert));
   gl.attachShader(program,shader(gl,gl.FRAGMENT_SHADER,frag));gl.linkProgram(program);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error("WebGL linking failed");
   lineBuffer=gl.createBuffer();pointBuffer=gl.createBuffer();
   if(!lineBuffer||!pointBuffer)throw Error("Insufficient graphics memory");
   gl.bindBuffer(gl.ARRAY_BUFFER,lineBuffer);
   gl.bufferData(gl.ARRAY_BUFFER,geometry.segments,gl.STATIC_DRAW);
   gl.bindBuffer(gl.ARRAY_BUFFER,pointBuffer);
   gl.bufferData(gl.ARRAY_BUFFER,geometry.positions,gl.STATIC_DRAW);
   pickIndex.current=new Map(geometry.ids.map((id,i)=>[id,i]));
   const attr=gl.getAttribLocation(program,"a_pos");
   const offset=gl.getUniformLocation(program,"u_offset");
   const viewport=gl.getUniformLocation(program,"u_viewport");
   const zoom=gl.getUniformLocation(program,"u_zoom");
   const size=gl.getUniformLocation(program,"u_pointSize");
   const colour=gl.getUniformLocation(program,"u_colour");
   const circle=gl.getUniformLocation(program,"u_circle");
   let initial=true;
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
    if(initial){
      const b=geometry.bounds;
      cam.current={offsetX:-(b.minX+b.maxX)/2,offsetY:-(b.minY+b.maxY)/2,
        zoom:Math.min(w/Math.max(1,b.maxX-b.minX),h/Math.max(1,b.maxY-b.minY))*.82};
      initial=false;
    }
    const c=cam.current;
    gl.viewport(0,0,pw,ph);gl.clearColor(.07,.16,.14,1);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform2f(viewport,w,h);gl.uniform2f(offset,c.offsetX,c.offsetY);
    gl.uniform1f(zoom,c.zoom);gl.enableVertexAttribArray(attr);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1i(circle,0);gl.uniform1f(size,1);
    gl.uniform4f(colour,.54,.70,.61,.18);
    gl.bindBuffer(gl.ARRAY_BUFFER,lineBuffer);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
    gl.drawArrays(gl.LINES,0,geometry.edgeCount*2);
    gl.uniform1i(circle,1);
    gl.uniform1f(size,Math.max(2.5,Math.min(8,c.zoom*8)));
    gl.uniform4f(colour,.85,.85,.68,.85);
    gl.bindBuffer(gl.ARRAY_BUFFER,pointBuffer);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
    gl.drawArrays(gl.POINTS,0,geometry.nodeCount);
    const ctx=foreground.getContext("2d");if(!ctx)return;
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
    if(!selected.current)return;
    const index=pickIndex.current.get(selected.current);if(index===undefined)return;
    const x=w/2+(geometry.positions[index*2]+c.offsetX)*c.zoom;
    const y=h/2+(geometry.positions[index*2+1]+c.offsetY)*c.zoom;
    if(x<-100||y<-100||x>w+100||y>h+100)return;
    ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.lineWidth=3;
    ctx.strokeStyle="#ffdd91";ctx.stroke();
    ctx.font="bold 12px system-ui";const label=geometry.ids[index];
    const size=ctx.measureText(label).width;
    ctx.fillStyle="#173d31";ctx.fillRect(x+17,y-18,size+16,25);
    ctx.fillStyle="#fff3d5";ctx.fillText(label,x+25,y);
   };
   draw.current=render;render();
   observer=new ResizeObserver(render);observer.observe(surface);
  }catch{
   draw.current=null;onGpuFailure.current?.();
  }
  return ()=>{
    observer?.disconnect();draw.current=null;
    if(lineBuffer)gl.deleteBuffer(lineBuffer);
    if(pointBuffer)gl.deleteBuffer(pointBuffer);
    if(program)gl.deleteProgram(program);
  };
 },[geometry]);
 useEffect(()=>{
   if(selectedId){
     const i=pickIndex.current.get(selectedId);
     if(i!==undefined){
       cam.current.offsetX=-geometry.positions[i*2];
       cam.current.offsetY=-geometry.positions[i*2+1];
       cam.current.zoom=Math.max(cam.current.zoom,1.3);
     }
   }
   draw.current?.();
 },[selectedId,geometry]);
 const gesture=useRef<{x:number;y:number;offsetX:number;offsetY:number;moved:boolean}|null>(null);
 const zoomAround=(factor:number,x:number,y:number)=>{
  const surface=canvas.current;if(!surface)return;
  const c=cam.current,w=surface.clientWidth,h=surface.clientHeight;
  const nx=(x-w/2)/c.zoom-c.offsetX,ny=(y-h/2)/c.zoom-c.offsetY;
  c.zoom=Math.max(.025,Math.min(70,c.zoom*factor));
  c.offsetX=(x-w/2)/c.zoom-nx;c.offsetY=(y-h/2)/c.zoom-ny;
  draw.current?.();
 };
 return <div className="whole-graph-stage full-network-stage">
  <canvas ref={canvas} className="full-network-canvas" role="img"
    aria-label={"Full graph: "+geometry.nodeCount+" original entities and "+
      geometry.edgeCount+" original relationships drawn individually"}
    onPointerDown={e=>{
      e.currentTarget.setPointerCapture(e.pointerId);
      gesture.current={x:e.clientX,y:e.clientY,offsetX:cam.current.offsetX,
        offsetY:cam.current.offsetY,moved:false};
    }}
    onPointerMove={e=>{
      const start=gesture.current;if(!start)return;
      if(Math.abs(e.clientX-start.x)+Math.abs(e.clientY-start.y)>6)start.moved=true;
      cam.current.offsetX=start.offsetX+(e.clientX-start.x)/cam.current.zoom;
      cam.current.offsetY=start.offsetY+(e.clientY-start.y)/cam.current.zoom;
      draw.current?.();
    }}
    onPointerUp={e=>{
      const start=gesture.current;gesture.current=null;
      if(!start||start.moved)return;
      const rect=e.currentTarget.getBoundingClientRect();
      const x=e.clientX-rect.left,y=e.clientY-rect.top;
      const w=rect.width,h=rect.height,c=cam.current;
      const wx=(x-w/2)/c.zoom-c.offsetX,wy=(y-h/2)/c.zoom-c.offsetY;
      const radius=Math.max(8,16/c.zoom),r2=radius*radius;
      let best=-1,bestD=r2;
      for(let i=0;i<geometry.nodeCount;i++){
        const dx=geometry.positions[i*2]-wx,dy=geometry.positions[i*2+1]-wy,d=dx*dx+dy*dy;
        if(d<bestD){bestD=d;best=i;}
      }
      if(best>=0)onPick.current(geometry.ids[best]);
    }}
    onPointerCancel={()=>{gesture.current=null;}}
    onWheel={e=>{
      e.preventDefault();
      const rect=e.currentTarget.getBoundingClientRect();
      zoomAround(Math.exp(-e.deltaY*.001),e.clientX-rect.left,e.clientY-rect.top);
    }}/>
  <canvas ref={overlay} className="full-network-overlay" aria-hidden="true"/>
  <div className="graph-tools">
    <button type="button" onClick={()=>{
      const surface=canvas.current;
      if(surface)zoomAround(1.35,surface.clientWidth/2,surface.clientHeight/2);
    }} aria-label="Zoom in">+</button>
    <button type="button" onClick={()=>{
      const surface=canvas.current;
      if(surface)zoomAround(1/1.35,surface.clientWidth/2,surface.clientHeight/2);
    }} aria-label="Zoom out">−</button>
    <button type="button" onClick={()=>{
      const surface=canvas.current;if(!surface)return;
      const b=geometry.bounds;
      cam.current={offsetX:-(b.minX+b.maxX)/2,offsetY:-(b.minY+b.maxY)/2,
        zoom:Math.min(surface.clientWidth/Math.max(1,b.maxX-b.minX),
          surface.clientHeight/Math.max(1,b.maxY-b.minY))*.82};
      draw.current?.();
    }} aria-label="Fit whole network">⤢</button>
  </div>
 </div>;
}
