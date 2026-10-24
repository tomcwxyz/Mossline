"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphDocument } from "@mossline/graph-core";
import { isRecorded } from "@mossline/graph-core";

type Props = {
  graph: GraphDocument;
  selectedId: string | null;
  onPick: (id: string | null) => void;
  onUnavailable: () => void;
};
const COLORS: Record<string,string> = {
  organisation:"#4F7A44", project:"#B87A2B", funder:"#2F5F86",
  place:"#857D6B",person:"#8F5E86",topic:"#6F746C",other:"#6F746C",
  methodology:"#6F746C",outcome:"#6F746C"
};
/** Sigma is a replaceable drawing adapter. GraphDocument remains immutable. */
export function FieldAtlasSigma({graph,selectedId,onPick,onUnavailable}: Props) {
  const container=useRef<HTMLDivElement>(null);
  const sigmaRef=useRef<import("sigma").default|null>(null);
  const graphRef=useRef<import("graphology").default|null>(null);
  const chosen=useRef(onPick);
  chosen.current=onPick;
  const selected=useRef<string|null>(selectedId);
  selected.current=selectedId;
  const [ready,setReady]=useState(false);
  const [error,setError]=useState("");
  const numberOfRecorded=useMemo(()=>graph.edges.filter(isRecorded).length,[graph]);

  useEffect(()=>{
    let cancelled=false;
    let renderer:import("sigma").default|null=null;
    let worker:Worker|null=null;
    (async()=>{
      try{
        const [{default:Sigma},{default:Graph}] = await Promise.all([
          import("sigma"),import("graphology")
        ]);
        if(cancelled||!container.current)return;
        const data=new Graph({type:"mixed",multi:true,allowSelfLoops:true});
        const degree=new Map(graph.nodes.map(n=>[n.id,0]));
        for(const e of graph.edges)if(isRecorded(e)){
          degree.set(e.source,(degree.get(e.source)??0)+1);
          degree.set(e.target,(degree.get(e.target)??0)+1);
        }
        // Stable initial layout: type gives a rough starting area.
        // ForceAtlas2 then uses actual recorded relationships in a worker.
        const groups=new Map<string,number>();
        graph.nodes.forEach((n,i)=>{
          const group=["organisation","project","funder","person","place"].indexOf(n.type);
          const type=group<0?5:group;
          const j=groups.get(n.type)??0;groups.set(n.type,j+1);
          const angle=j*2.3999632297;
          const r=Math.sqrt(j)*3.5;
          const x=Math.cos(type*Math.PI/3)*120+Math.cos(angle)*r;
          const y=Math.sin(type*Math.PI/3)*120+Math.sin(angle)*r;
          data.addNode(n.id,{x,y,label:n.label,
            size:Math.min(15,3.5+1.2*Math.sqrt(degree.get(n.id)??0)),
            color:COLORS[n.type]??COLORS.other,
            nodeType:n.type});
        });
        graph.edges.forEach(e=>{
          if(!data.hasNode(e.source)||!data.hasNode(e.target))return;
          data.addEdgeWithKey(e.id,e.source,e.target,{
            size:e.inferred?0.65:0.45,
            color:e.inferred?"#806849":"#6F746C",
            // The pencil type is intentionally different even in greyscale.
            type:e.inferred?"dashed":"line",
            inferred:e.inferred===true
          });
        });
        if(cancelled)return;
        graphRef.current=data;
        renderer=new Sigma(data,container.current,{
          nodeReducer:(id,display)=>{
            const pick=selected.current;
            if(!pick)return display;
            const linked=id===pick || data.hasEdge(id,pick) || data.hasEdge(pick,id);
            return {...display,color:linked?display.color:"#ADB3A9",
              highlighted:id===pick,forceLabel:id===pick};
          },
          edgeReducer:(id,display)=>{
            const pick=selected.current;
            if(!pick)return display;
            const [source,target]=data.extremities(id);
            return {...display,hidden:source!==pick&&target!==pick};
          },
          settings:{renderEdgeLabels:false,
          labelDensity:0.12,
          labelGridCellSize:135,
          labelRenderedSizeThreshold:9,
          hideEdgesOnMove:true,
          hideLabelsOnMove:true,
          minCameraRatio:0.025,maxCameraRatio:15}
        });
        sigmaRef.current=renderer;
        renderer.on("clickNode",({node})=>chosen.current(node));
        renderer.on("clickStage",()=>chosen.current(null));
        setReady(true);
        // A dedicated layout worker starts after the first complete render.
        // If worker cannot launch, the deterministic positions remain usable.
        try{
          worker=new Worker(new URL("../workers/atlas-layout.worker.ts",import.meta.url),{type:"module"});
          worker.onmessage=(event:MessageEvent<{kind:string;positions?:Array<[string,number,number]>}>)=>{
            if(cancelled||!graphRef.current||event.data.kind!=="positions")return;
            for(const [id,x,y] of event.data.positions??[]){
              if(graphRef.current.hasNode(id)&&Number.isFinite(x)&&Number.isFinite(y))
                graphRef.current.mergeNodeAttributes(id,{x,y});
            }
            renderer?.refresh();
          };
          worker.postMessage({kind:"layout",
            nodes:graph.nodes.map(n=>n.id),
            edges:graph.edges.filter(isRecorded).map(e=>[e.source,e.target]),
            initial:graph.nodes.map(n=>{
              const attrs=data.getNodeAttributes(n.id);
              return [n.id,attrs.x,attrs.y];
            })
          });
        }catch{/* usable stable layout already rendered */}
      }catch(e){
        if(cancelled)return;
        setError(e instanceof Error?e.message:"Network renderer unavailable");
        onUnavailable();
      }
    })();
    return ()=>{cancelled=true;worker?.terminate();renderer?.kill();
      sigmaRef.current=null;graphRef.current=null;};
  },[graph,onUnavailable]);

  useEffect(()=>{
    const s=sigmaRef.current,g=graphRef.current;
    if(!s||!g)return;
    s.refresh();
  },[selectedId,ready]);

  return <section className="ml-sigma-surface" aria-label="Complete Sigma network">
    <div ref={container} className="ml-sigma-viewport" role="img"
      aria-label={`Complete network of ${graph.nodes.length} entities and ${graph.edges.length} source relationships`}/>
    <div className="ml-sigma-key">
      <span>{graph.nodes.length.toLocaleString("en-GB")} source entities</span>
      <span>{numberOfRecorded.toLocaleString("en-GB")} recorded links</span>
      <span>{(graph.edges.length-numberOfRecorded).toLocaleString("en-GB")} suggestions</span>
      {!ready&&!error&&<span>Preparing graph…</span>}
      {error&&<span role="alert">GPU unavailable · accessible list remains available</span>}
    </div>
  </section>;
}
