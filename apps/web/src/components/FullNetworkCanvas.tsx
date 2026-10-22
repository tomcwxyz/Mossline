"use client";

import {useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent} from "react";
import {focusFullNetwork,atlasDetailLevel,visibleAtlasNodeLabels,canvasPixelRatio,
  buildSmoothStrokeVertices,STROKE_STRIDE,
  type FullNetworkFocus,type FullNetworkGeometry,type GraphNode,
  type AtlasDetail} from "@mossline/graph-core";

type Camera={offsetX:number;offsetY:number;zoom:number};
type Point={x:number;y:number};
type Drag={x:number;y:number;offsetX:number;offsetY:number;moved:boolean};
const vertex=`attribute vec2 a_pos;
attribute float a_kind;
attribute float a_size;
varying float v_kind;
varying float v_pointPixels;
uniform vec2 u_offset;
uniform vec2 u_viewport;
uniform float u_zoom;
uniform float u_pointScale;
uniform float u_pixelRatio;
void main(){
 v_kind=a_kind;
 vec2 p=(a_pos+u_offset)*u_zoom;
 gl_Position=vec4(p.x/(u_viewport.x*.5),-p.y/(u_viewport.y*.5),0.0,1.0);
 // gl_PointSize is measured in *physical framebuffer pixels*, not CSS pixels.
 gl_PointSize=clamp(a_size*u_pointScale*u_pixelRatio,
   2.0*u_pixelRatio,24.0*u_pixelRatio);
 v_pointPixels=gl_PointSize;
}`;
const fragment=`precision mediump float;
uniform vec4 u_colour;
uniform bool u_circle;
uniform float u_fade;
varying float v_kind;
varying float v_pointPixels;
void main(){
 vec4 colour=u_colour;
 if(u_circle){
  vec2 point=gl_PointCoord*2.0-1.0;
  float boundary;
  if(v_kind>1.5 && v_kind<2.5){
   // Diamond — funder
   boundary=abs(point.x)+abs(point.y)-.86;
  }else if(v_kind>.5 && v_kind<1.5){
   // Square — award or project
   boundary=max(abs(point.x),abs(point.y))-.83;
  }else if(v_kind>2.5 && v_kind<3.5){
   // Triangle — person
   boundary=max(max(point.y-.75,-point.y-.76),
     abs(point.x)-(.76-point.y)*.57);
  }else if(v_kind>3.5 && v_kind<4.5){
   // Hexagon — place
   boundary=max(max(abs(point.x)-.82,abs(point.y)-.88),
     abs(point.x)*.58+abs(point.y)-.91);
  }else{
   // Round — organisation and other entities
   boundary=length(point)-.88;
  }
  // Analytic alpha coverage: smooth silhouettes even without multisample
  // support. A physical-pixel-sized ramp preserves crispness at high DPR.
  float feather=clamp(1.4/max(1.0,v_pointPixels),.024,.30);
  float coverage=1.0-smoothstep(-feather,feather,boundary);
  if(coverage<.012)discard;
  if(v_kind<.5) colour=vec4(.54,.76,.56,.93);
  else if(v_kind<1.5) colour=vec4(.91,.73,.41,.91);
  else if(v_kind<2.5) colour=vec4(.55,.73,.91,.94);
  else if(v_kind<3.5) colour=vec4(.81,.57,.72,.91);
  else if(v_kind<4.5) colour=vec4(.69,.77,.68,.91);
  else colour=vec4(.79,.81,.65,.90);
  colour.a*=u_fade*coverage;
 }
 gl_FragColor=colour;
}`;
// GPU-expanded quadratic strokes use screen-space triangles instead of
// platform-dependent WebGL1 line widths. Every triangle corresponds to an
// original recorded or inferred edge, never to a new relationship.
const strokeVertex=`attribute vec2 a_first;
attribute vec2 a_second;
attribute vec3 a_curve;
uniform vec2 u_offset;
uniform vec2 u_viewport;
uniform float u_zoom;
uniform float u_width;
uniform float u_soft;
varying float v_across;
void main(){
 vec2 from=(a_first+u_offset)*u_zoom;
 vec2 to=(a_second+u_offset)*u_zoom;
 vec2 delta=to-from;
 float distance=max(length(delta),.0001);
 vec2 normal=vec2(-delta.y,delta.x)/distance;
 float t=a_curve.x;
 float bend=a_curve.z*min(28.0,distance*.13);
 vec2 centre=mix(from,to,t)+normal*(4.0*t*(1.0-t)*bend);
 vec2 tangent=delta+normal*(4.0*(1.0-2.0*t)*bend);
 float tangentLength=max(length(tangent),.0001);
 vec2 perpendicular=vec2(-tangent.y,tangent.x)/tangentLength;
 v_across=a_curve.y*(u_width*.5+u_soft);
 vec2 p=centre+perpendicular*v_across;
 gl_Position=vec4(p.x/(u_viewport.x*.5),
   -p.y/(u_viewport.y*.5),0.0,1.0);
}`;
const strokeFragment=`precision mediump float;
uniform vec4 u_strokeColour;
uniform float u_width;
uniform float u_soft;
varying float v_across;
void main(){
 float alpha=1.0-smoothstep(max(0.0,u_width*.5-u_soft),
   u_width*.5+u_soft,abs(v_across));
 if(alpha<.015)discard;
 gl_FragColor=vec4(u_strokeColour.rgb,u_strokeColour.a*alpha);
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
export function FullNetworkCanvas({geometry,selectedId,onSelect,onUnavailable,
  sizeMode="connections",lineMode="focus",focusAreaId,selectedPreview,
  selectedRelationships=0,onDetails,onAreaSelect}:{
 geometry:FullNetworkGeometry;selectedId?:string|null;onSelect:(id:string|null)=>void;
 onUnavailable?:()=>void;sizeMode?:"connections"|"amount";
 lineMode?:"subtle"|"visible"|"focus";focusAreaId?:string|null;
 selectedPreview?:GraphNode|null;selectedRelationships?:number;
 onDetails?:()=>void;onAreaSelect?:(id:string|null)=>void;
}){
 const [detail,setDetail]=useState<AtlasDetail>("landscape");
 const [hovered,setHovered]=useState<{id:string;label:string;type:number;x:number;y:number}|null>(null);
 const hoverAt=useRef(0);
 const areaSelect=useRef(onAreaSelect);
 areaSelect.current=onAreaSelect;
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
 const sizeModeRef=useRef(sizeMode);sizeModeRef.current=sizeMode;
 const lineModeRef=useRef(lineMode);lineModeRef.current=lineMode;
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
   const gl=surface.getContext("webgl",{alpha:false,antialias:true,
     preserveDrawingBuffer:false,depth:false,stencil:false}) ??
     surface.getContext("webgl",{alpha:false,antialias:false,
       preserveDrawingBuffer:false,depth:false,stencil:false});
   if(!gl){unavailable.current?.();return;}
   const buffers:WebGLBuffer[]=[];
   let program:WebGLProgram|null=null;
   let strokeProgram:WebGLProgram|null=null;
   let observer:ResizeObserver|null=null;
   let pending:number|null=null;
   let uploaded:FullNetworkFocus|null=null;
   try{
     program=gl.createProgram();if(!program)throw Error("WebGL unavailable");
     const v=compile(gl,gl.VERTEX_SHADER,vertex),f=compile(gl,gl.FRAGMENT_SHADER,fragment);
     gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);
     gl.deleteShader(v);gl.deleteShader(f);
     if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error("Cannot link graph renderer");
     strokeProgram=gl.createProgram();
     if(!strokeProgram)throw Error("Cannot create smooth stroke renderer");
     const sv=compile(gl,gl.VERTEX_SHADER,strokeVertex);
     const sf=compile(gl,gl.FRAGMENT_SHADER,strokeFragment);
     gl.attachShader(strokeProgram,sv);gl.attachShader(strokeProgram,sf);
     gl.linkProgram(strokeProgram);gl.deleteShader(sv);gl.deleteShader(sf);
     if(!gl.getProgramParameter(strokeProgram,gl.LINK_STATUS))
       throw Error("Cannot link smooth stroke renderer");
     const makeBuffer=(data:Float32Array|Uint8Array,usage:number)=>{
       const buffer=gl.createBuffer();
       if(!buffer)throw Error("Browser GPU memory unavailable");
       buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
       gl.bufferData(gl.ARRAY_BUFFER,data as BufferSource,usage);
       return buffer;
     };
     const backgroundLines=makeBuffer(geometry.strokeVertices,gl.STATIC_DRAW);
     const heroIndices=geometry.prominentIndices;
     const heroPositions=new Float32Array(heroIndices.length*2);
     const heroTypes=new Uint8Array(heroIndices.length);
     const heroDegreeSizes=new Float32Array(heroIndices.length);
     const heroAmountSizes=new Float32Array(heroIndices.length);
     for(let i=0;i<heroIndices.length;i++){
       const id=heroIndices[i];
       heroPositions[i*2]=geometry.positions[id*2];
       heroPositions[i*2+1]=geometry.positions[id*2+1];
       heroTypes[i]=geometry.types[id];
       heroDegreeSizes[i]=geometry.degreeSizes[id];
       heroAmountSizes[i]=geometry.amountSizes[id];
     }
     const heroPoints=makeBuffer(heroPositions,gl.STATIC_DRAW);
     const heroKinds=makeBuffer(heroTypes,gl.STATIC_DRAW);
     const heroDegrees=makeBuffer(heroDegreeSizes,gl.STATIC_DRAW);
     const heroAmounts=makeBuffer(heroAmountSizes,gl.STATIC_DRAW);
     const backgroundPoints=makeBuffer(geometry.positions,gl.STATIC_DRAW);
     const backgroundTypes=makeBuffer(geometry.types,gl.STATIC_DRAW);
     const degreeSizes=makeBuffer(geometry.degreeSizes,gl.STATIC_DRAW);
     const amountSizes=makeBuffer(geometry.amountSizes,gl.STATIC_DRAW);
     const selectedLines=makeBuffer(new Float32Array(0),gl.DYNAMIC_DRAW);
     let selectedVertexCount=0;
     const selectedPoints=makeBuffer(new Float32Array(0),gl.DYNAMIC_DRAW);
     const selectedTypes=makeBuffer(new Uint8Array(0),gl.DYNAMIC_DRAW);
     const selectedDegreeSizes=makeBuffer(new Float32Array(0),gl.DYNAMIC_DRAW);
     const selectedAmountSizes=makeBuffer(new Float32Array(0),gl.DYNAMIC_DRAW);
     const position=gl.getAttribLocation(program,"a_pos");
     const kind=gl.getAttribLocation(program,"a_kind");
     const sizeAttr=gl.getAttribLocation(program,"a_size");
     const offset=gl.getUniformLocation(program,"u_offset");
     const viewport=gl.getUniformLocation(program,"u_viewport");
     const zoom=gl.getUniformLocation(program,"u_zoom");
     const pointScale=gl.getUniformLocation(program,"u_pointScale");
     const pixelRatio=gl.getUniformLocation(program,"u_pixelRatio");
     const colour=gl.getUniformLocation(program,"u_colour");
     const circle=gl.getUniformLocation(program,"u_circle");
     const fade=gl.getUniformLocation(program,"u_fade");
     const strokeFirst=gl.getAttribLocation(strokeProgram,"a_first");
     const strokeSecond=gl.getAttribLocation(strokeProgram,"a_second");
     const strokeCurve=gl.getAttribLocation(strokeProgram,"a_curve");
     const strokeOffset=gl.getUniformLocation(strokeProgram,"u_offset");
     const strokeViewport=gl.getUniformLocation(strokeProgram,"u_viewport");
     const strokeZoom=gl.getUniformLocation(strokeProgram,"u_zoom");
     const strokeWidth=gl.getUniformLocation(strokeProgram,"u_width");
     const strokeSoft=gl.getUniformLocation(strokeProgram,"u_soft");
     const strokeColour=gl.getUniformLocation(strokeProgram,"u_strokeColour");
     let initial=true;
     const update=()=>{
       const selection=currentFocus.current;
       if(selection===uploaded)return;
       uploaded=selection;
       gl.bindBuffer(gl.ARRAY_BUFFER,selectedLines);
       const smoothSelection=selection?
         buildSmoothStrokeVertices(selection.lines,selection.sourceEdgeIndices):
         new Float32Array(0);
       selectedVertexCount=smoothSelection.length/STROKE_STRIDE;
       gl.bufferData(gl.ARRAY_BUFFER,smoothSelection,gl.DYNAMIC_DRAW);
       gl.bindBuffer(gl.ARRAY_BUFFER,selectedPoints);
       gl.bufferData(gl.ARRAY_BUFFER,selection?.nodes??new Float32Array(0),gl.DYNAMIC_DRAW);
       gl.bindBuffer(gl.ARRAY_BUFFER,selectedTypes);
       gl.bufferData(gl.ARRAY_BUFFER,selection?.types??new Uint8Array(0),gl.DYNAMIC_DRAW);
       gl.bindBuffer(gl.ARRAY_BUFFER,selectedDegreeSizes);
       gl.bufferData(gl.ARRAY_BUFFER,selection?.degreeSizes??new Float32Array(0),gl.DYNAMIC_DRAW);
       gl.bindBuffer(gl.ARRAY_BUFFER,selectedAmountSizes);
       gl.bufferData(gl.ARRAY_BUFFER,selection?.amountSizes??new Float32Array(0),gl.DYNAMIC_DRAW);
     };
     const pointAttribute=(points:WebGLBuffer,types:WebGLBuffer,sizes:WebGLBuffer)=>{
       gl.bindBuffer(gl.ARRAY_BUFFER,points);
       gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
       gl.bindBuffer(gl.ARRAY_BUFFER,types);
       gl.enableVertexAttribArray(kind);
       gl.vertexAttribPointer(kind,1,gl.UNSIGNED_BYTE,false,0,0);
       gl.bindBuffer(gl.ARRAY_BUFFER,sizes);
       gl.enableVertexAttribArray(sizeAttr);
       gl.vertexAttribPointer(sizeAttr,1,gl.FLOAT,false,0,0);
     };
     const drawSmoothStrokes=(
       buffer:WebGLBuffer,vertices:number,
       c:Camera,w:number,h:number,dpr:number,
       rgba:[number,number,number,number],thickness:number
     )=>{
       if(!vertices)return;
       gl.disableVertexAttribArray(position);
       gl.disableVertexAttribArray(kind);
       gl.disableVertexAttribArray(sizeAttr);
       gl.useProgram(strokeProgram);
       gl.uniform2f(strokeOffset,c.offsetX,c.offsetY);
       gl.uniform2f(strokeViewport,w,h);
       gl.uniform1f(strokeZoom,c.zoom);
       gl.uniform1f(strokeWidth,thickness);
       gl.uniform1f(strokeSoft,.9/dpr);
       gl.uniform4f(strokeColour,...rgba);
       gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
       gl.enableVertexAttribArray(strokeFirst);
       gl.enableVertexAttribArray(strokeSecond);
       gl.enableVertexAttribArray(strokeCurve);
       gl.vertexAttribPointer(strokeFirst,2,gl.FLOAT,false,STROKE_STRIDE*4,0);
       gl.vertexAttribPointer(strokeSecond,2,gl.FLOAT,false,STROKE_STRIDE*4,8);
       gl.vertexAttribPointer(strokeCurve,3,gl.FLOAT,false,STROKE_STRIDE*4,16);
       gl.drawArrays(gl.TRIANGLES,0,vertices);
       gl.disableVertexAttribArray(strokeFirst);
       gl.disableVertexAttribArray(strokeSecond);
       gl.disableVertexAttribArray(strokeCurve);
       gl.useProgram(program);
       gl.enableVertexAttribArray(position);
     };
     const render=()=>{
       if(!canvas.current||!overlay.current)return;
       const w=Math.max(1,surface.clientWidth),h=Math.max(1,surface.clientHeight);
       const ratio=canvasPixelRatio(w,h,window.devicePixelRatio||1);
       const pw=Math.max(1,Math.round(w*ratio)),ph=Math.max(1,Math.round(h*ratio));
       if(surface.width!==pw||surface.height!==ph){
         surface.width=pw;surface.height=ph;
         foreground.width=pw;foreground.height=ph;
         foreground.style.width=w+"px";foreground.style.height=h+"px";
       }
       if(initial){fit();initial=false;}
       const c=camera.current,selection=currentFocus.current;
       const level=atlasDetailLevel(geometry,c.zoom);
       setDetail(previous=>previous===level?previous:level);
       gl.viewport(0,0,pw,ph);
       gl.clearColor(.07,.16,.14,1);gl.clear(gl.COLOR_BUFFER_BIT);
       gl.useProgram(program);gl.uniform2f(viewport,w,h);
       gl.uniform1f(pixelRatio,ratio);
       gl.uniform2f(offset,c.offsetX,c.offsetY);gl.uniform1f(zoom,c.zoom);
       gl.enableVertexAttribArray(position);
       gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
       gl.uniform1f(fade,1);
       gl.uniform1i(circle,0);gl.uniform1f(pointScale,1);
       const lineOpacity=selection?.05:lineModeRef.current==="focus"?0:
         lineModeRef.current==="visible"?.34:.11;
       if(lineOpacity>0){
         drawSmoothStrokes(backgroundLines,
           geometry.strokeVertices.length/STROKE_STRIDE,c,w,h,ratio,
           [.57,.75,.63,lineOpacity],
           lineModeRef.current==="visible"?1.15:.8);
       }
       gl.uniform1i(circle,1);
       gl.uniform1f(fade,selection?.13:
         level==="landscape"?(heroIndices.length?.25:.57):
         level==="area"?.75:1);
       gl.uniform1f(pointScale,level==="landscape"?.70:
         geometry.nodeCount>1200&&c.zoom<1?.82:1);
       pointAttribute(backgroundPoints,backgroundTypes,
         sizeModeRef.current==="amount"?amountSizes:degreeSizes);
       gl.drawArrays(gl.POINTS,0,geometry.nodeCount);
       if(!selection&&level==="landscape"&&heroIndices.length){
         pointAttribute(heroPoints,heroKinds,
           sizeModeRef.current==="amount"?heroAmounts:heroDegrees);
         // Two restrained passes give genuine hubs a softly luminous
         // silhouette; source nodes never disappear or become fake groups.
         gl.uniform1f(pointScale,1.75);gl.uniform1f(fade,.13);
         gl.drawArrays(gl.POINTS,0,heroIndices.length);
         gl.uniform1f(pointScale,1.15);gl.uniform1f(fade,.98);
         gl.drawArrays(gl.POINTS,0,heroIndices.length);
       }
       if(selection){
         update();
         drawSmoothStrokes(selectedLines,selectedVertexCount,c,w,h,ratio,
           [1,.81,.48,.96],2.4);
         gl.uniform1i(circle,1);gl.uniform1f(fade,1);
         gl.uniform1f(pointScale,1.4);
         pointAttribute(selectedPoints,selectedTypes,
           sizeModeRef.current==="amount"?selectedAmountSizes:selectedDegreeSizes);
         gl.drawArrays(gl.POINTS,0,selection.neighbourIndices.length);
       }
       const context=foreground.getContext("2d");if(!context)return;
       context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,w,h);

       // Atlas scale draws aggregated recorded links only at landscape level.
       // The complete original node and edge geometry remains unchanged.
       if(geometry.arrangement!=="types"&&geometry.areas.length){
         const toScreen=(x:number,y:number)=>({
           x:w/2+(x+c.offsetX)*c.zoom,y:h/2+(y+c.offsetY)*c.zoom
         });
         const areas=new Map(geometry.areas.map(area=>[area.id,area]));
         if(!selection&&level==="landscape"){
           const links=geometry.areaLinks.slice(0,w<650?14:26);
           const max=links[0]?.count??1;
           for(const link of links){
             const a=areas.get(link.sourceId),b=areas.get(link.targetId);
             if(!a||!b)continue;
             const p=toScreen(a.x,a.y),q=toScreen(b.x,b.y);
             const dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1;
             // Curve offset is tied to endpoints, never to fictional edges.
             const bend=Math.min(45,len*.14);
             context.beginPath();context.moveTo(p.x,p.y);
             context.quadraticCurveTo((p.x+q.x)/2-dy/len*bend,
               (p.y+q.y)/2+dx/len*bend,q.x,q.y);
             context.strokeStyle=geometry.arrangement==="themes"?
               "rgba(225,190,116,.23)":"rgba(151,199,162,.22)";
             context.lineWidth=.8+2.2*Math.log1p(link.count)/Math.log1p(max);
             context.lineCap="round";context.stroke();
           }
         }
         const significant=geometry.areas.slice()
           .sort((a,b)=>b.count-a.count)
           .slice(0,level==="landscape"?(w<600?5:10):geometry.areas.length);
         const occupied:{x:number;y:number;w:number;h:number}[]=[];
         const palette=[
           ["#9abe95","#a5c99e"],["#d8b77f","#e2cc9d"],
           ["#80b3bd","#a9d0d5"],["#b6a0c3","#d0c2d9"]
         ];
         for(let i=0;i<significant.length;i++){
           const area=significant[i],p=toScreen(area.x,area.y);
           const radius=Math.max(8,area.radius*c.zoom);
           if(p.x+radius<0||p.y+radius<0||p.x-radius>w||p.y-radius>h)continue;
           const swatch=palette[i%palette.length];
           context.beginPath();
           context.ellipse(p.x,p.y,radius*1.04,radius*.90,0,0,Math.PI*2);
           context.fillStyle=geometry.arrangement==="themes"?
             "rgba(210,179,108,.045)":"rgba(143,192,156,.035)";
           context.fill();
           context.strokeStyle=swatch[0]+"49";
           context.lineWidth=1.2;context.setLineDash([3,6]);
           context.stroke();context.setLineDash([]);
           if(level==="entity")continue;
           const text=area.label.length>29?area.label.slice(0,27)+"…":area.label;
           const textCount=" · "+area.count.toLocaleString("en-GB");
           const full=text+textCount;
           context.font="600 11px system-ui";
           const labelW=Math.min(w-24,context.measureText(full).width+27);
           const bx=Math.max(8,Math.min(w-labelW-8,p.x-labelW/2));
           const possibilities=[p.y-radius-29,p.y+radius+8,p.y-12,p.y+17];
           for(const y of possibilities){
             if(y<8||y>h-32)continue;
             if(occupied.some(r=>bx<r.x+r.w+5&&bx+labelW+5>r.x&&
               y<r.y+r.h+5&&y+26+5>r.y))continue;
             occupied.push({x:bx,y,w:labelW,h:26});
             context.fillStyle="rgba(18,50,40,.95)";
             context.fillRect(bx,y,labelW,26);
             context.fillStyle=swatch[0];context.fillRect(bx,y,3,26);
             context.font="600 11px system-ui";
             context.save();context.beginPath();
             context.rect(bx+7,y+2,Math.max(0,labelW-14),23);context.clip();
             context.fillStyle="#f3ebcf";
             context.fillText(full,bx+11,y+17);context.restore();
             break;
           }
         }
       }
       if(!selection){
         const labels=visibleAtlasNodeLabels(geometry,c.zoom,
           c.offsetX,c.offsetY,w,h,w<650?8:26);
         for(const node of labels){
           const isHub=geometry.degreeSizes[node.index]>9;
           context.fillStyle=isHub?"rgba(20,56,43,.89)":"rgba(21,48,41,.77)";
           context.font=isHub?"600 11px system-ui":"10px system-ui";
           const tw=context.measureText(node.label).width;
           context.fillRect(node.x-3,node.y-2,tw+10,18);
           context.fillStyle=isHub?"#f2e6b7":"#d5e5d0";
           context.fillText(node.label,node.x+2,node.y+11);
         }
       }
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
     if(strokeProgram)gl.deleteProgram(strokeProgram);
   };
 },[geometry]);
 useEffect(()=>{draw.current?.();},[sizeMode,lineMode]);
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
 useEffect(()=>{
   if(!focusAreaId||!canvas.current)return;
   const area=geometry.areas.find(item=>item.id===focusAreaId);
   if(!area)return;
   stopAnimation();
   const surface=canvas.current,from={...camera.current};
   const maxZoom=Math.min(surface.clientWidth,surface.clientHeight)/
     (2*Math.max(55,area.radius)+110);
   const target:Camera={offsetX:-area.x,offsetY:-area.y,
     zoom:Math.max(.08,Math.min(12,maxZoom))};
   const reduceMotion=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
   if(reduceMotion){camera.current=target;draw.current?.();return;}
   let start:number|null=null;
   const step=(time:number)=>{
     if(start===null)start=time;
     const t=Math.min(1,(time-start)/320),k=1-(1-t)**3;
     camera.current={offsetX:from.offsetX+(target.offsetX-from.offsetX)*k,
       offsetY:from.offsetY+(target.offsetY-from.offsetY)*k,
       zoom:from.zoom+(target.zoom-from.zoom)*k};
     draw.current?.();
     animation.current=t<1?requestAnimationFrame(step):null;
   };
   animation.current=requestAnimationFrame(step);
   return stopAnimation;
 },[focusAreaId,geometry]);
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
 const pickAt=(x:number,y:number,w:number,h:number,threshold=15)=>{
   const c=camera.current;
   const wx=(x-w/2)/c.zoom-c.offsetX,wy=(y-h/2)/c.zoom-c.offsetY;
   const maxSq=(threshold/c.zoom)**2;
   let match=-1,nearest=maxSq;
   for(let i=0;i<geometry.nodeCount;i++){
     const dx=geometry.positions[i*2]-wx,dy=geometry.positions[i*2+1]-wy;
     const squared=dx*dx+dy*dy;
     if(squared<nearest){nearest=squared;match=i;}
   }
   return match;
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
 const pointerMove=(event:ReactPointerEvent<HTMLCanvasElement>)=>{
   if(!pointers.current.size&&event.pointerType==="mouse"){
     const now=performance.now();
     if(now-hoverAt.current>95){
       hoverAt.current=now;
       const rect=event.currentTarget.getBoundingClientRect();
       const x=event.clientX-rect.left,y=event.clientY-rect.top;
       const i=pickAt(x,y,rect.width,rect.height,12);
       setHovered(i<0?null:{id:geometry.ids[i],label:geometry.labels[i],
         type:geometry.types[i],x,y});
     }
   }
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
   const x=event.clientX-rect.left,y=event.clientY-rect.top;
   const match=pickAt(x,y,rect.width,rect.height);
   if(match>=0){pick.current(geometry.ids[match]);return;}
   if(geometry.arrangement!=="types"){
     const c=camera.current;
     const wx=(x-rect.width/2)/c.zoom-c.offsetX;
     const wy=(y-rect.height/2)/c.zoom-c.offsetY;
     const area=geometry.areas
       .filter(a=>Math.hypot(a.x-wx,a.y-wy)<=a.radius)
       .sort((a,b)=>Math.hypot(a.x-wx,a.y-wy)-Math.hypot(b.x-wx,b.y-wy))[0];
     if(area){areaSelect.current?.(area.id);return;}
   }
   pick.current(null);
 };
 return <div className="whole-graph-stage full-network-stage">
   <canvas ref={canvas} className="full-network-canvas" role="img"
     aria-label={"Full graph: "+geometry.nodeCount+" source entities and "+
       geometry.edgeCount+" recorded and inferred relationship lines. Select a point to focus its recorded connections. Pinch or scroll to zoom; drag to pan."}
     onPointerDown={pointerDown} onPointerMove={pointerMove}
     onPointerLeave={()=>setHovered(null)}
     onPointerUp={event=>pointerEnd(event)}
     onPointerCancel={event=>pointerEnd(event,true)}
     onDoubleClick={event=>{
       event.preventDefault();stopAnimation();
       const rect=event.currentTarget.getBoundingClientRect();
       zoomTo.current(1.8,event.clientX-rect.left,event.clientY-rect.top);
     }}/>
   <canvas ref={overlay} className="full-network-overlay" aria-hidden="true"/>
   <div className="atlas-scale-indicator" aria-live="off">
     <span className="atlas-scale-dot"/>
     {detail==="landscape"?"Landscape":detail==="area"?"Area":"Entity"}
     <span className="atlas-scale-tip"> · scroll to explore</span>
   </div>
   {hovered&&!selectedPreview&&
     <div className="atlas-hover-hint" style={{left:Math.min(
       (canvas.current?.clientWidth??650)-200,hovered.x+15),
       top:Math.max(8,hovered.y-42)}} role="status">
       <strong>{hovered.label}</strong>
       <small>{["Organisation","Project / grant","Funder","Person","Place",
         "Topic","Method","Outcome","Other"][hovered.type]??"Entity"} · click to explore</small>
     </div>}
   {selectedPreview&&
     <aside className="atlas-entity-preview" aria-label={"Selected "+selectedPreview.type}>
       <div className="atlas-entity-kicker">
         <span>{selectedPreview.type}</span>
         <button type="button" aria-label="Clear selection"
           onClick={()=>pick.current(null)}>×</button>
       </div>
       <h4>{selectedPreview.label}</h4>
       {selectedPreview.description&&
         <p>{selectedPreview.description.slice(0,220)}
           {selectedPreview.description.length>220?"…":""}</p>}
       {selectedPreview.region&&<p className="atlas-entity-meta">
         {selectedPreview.region}</p>}
       {selectedPreview.tags.length>0&&<div className="atlas-entity-tags">
         {selectedPreview.tags.slice(0,4).map(tag=><span key={tag}>{tag}</span>)}
       </div>}
       <div className="atlas-entity-links">
         <strong>{selectedRelationships.toLocaleString("en-GB")}</strong>
         <span>source relationship records</span>
       </div>
       <button className="atlas-preview-details" type="button"
         onClick={onDetails}>Explore evidence and connections →</button>
       {selectedPreview.sourceUrl&&<a href={selectedPreview.sourceUrl}
         target="_blank" rel="noopener noreferrer">Open source record ↗</a>}
     </aside>}
   <div className="graph-tools" aria-label="Full-network navigation">
     {focusAreaId&&<button type="button" className="atlas-back-button"
       aria-label="Return to landscape" title="Return to landscape"
       onClick={()=>{
         stopAnimation();fit();areaSelect.current?.(null);pick.current(null);
       }}>↶</button>}
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
