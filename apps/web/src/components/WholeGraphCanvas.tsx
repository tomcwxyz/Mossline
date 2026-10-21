"use client";

import {useEffect,useRef,useState} from "react";
import type {Core} from "cytoscape";
import type {AdaptiveGraphProjection} from "@mossline/graph-core";

export function WholeGraphCanvas({projection,selectedId,selectedEdgeId,onPickNode,onPickEdge}:{
  projection:AdaptiveGraphProjection;
  selectedId:string|null;selectedEdgeId:string|null;
  onPickNode:(id:string)=>void;onPickEdge:(id:string)=>void;
}){
  const root=useRef<HTMLDivElement>(null);
  const cyRef=useRef<Core|null>(null);
  const pickNode=useRef(onPickNode),pickEdge=useRef(onPickEdge);
  const [ready,setReady]=useState(false);
  pickNode.current=onPickNode;pickEdge.current=onPickEdge;
  useEffect(()=>{
    let cancelled=false;
    void import("cytoscape").then(({default:cytoscape})=>{
      if(cancelled||!root.current)return;
      const cy=cytoscape({
        container:root.current,elements:[],
        minZoom:0.15,maxZoom:4,wheelSensitivity:0.17,
        style:[
          {selector:"node",style:{
            "label":"data(label)","background-color":"#779a7c",
            "width":33,"height":33,"color":"#f2f6e9",
            "font-size":11,"font-weight":600,"font-family":"Arial, sans-serif",
            "text-wrap":"wrap","text-max-width":"130px","text-valign":"bottom",
            "text-margin-y":7,"text-outline-color":"#143028","text-outline-width":2,
            "border-width":2,"border-color":"#d0e0c9"
          }},
          {selector:"node.cluster",style:{
            "shape":"round-rectangle","background-color":"#36634c",
            "border-color":"#d7c184","border-width":3,
            "width":"data(size)","height":"data(size)",
            "font-size":13,"text-max-width":"160px","text-valign":"center",
            "text-margin-y":0,"text-outline-width":0
          }},
          {selector:"node.funder",style:{"background-color":"#81aacc","shape":"diamond"}},
          {selector:"node.organisation",style:{"background-color":"#88b793"}},
          {selector:"node.project",style:{"background-color":"#d8b574","shape":"round-rectangle"}},
          {selector:"node.selected",style:{"border-width":6,"border-color":"#ffe1a4","z-index":20}},
          {selector:"node.neighbour",style:{"border-width":4,"border-color":"#c2d6bd","opacity":1}},
          {selector:"node.dimmed",style:{"opacity":0.22,"text-opacity":0.12}},
          {selector:"edge.dimmed",style:{"opacity":0.08}},
          {selector:"edge",style:{"width":1.3,"line-color":"#85a78d",
            "target-arrow-shape":"triangle","target-arrow-color":"#85a78d",
            "opacity":0.5,"curve-style":"bezier"}},
          {selector:"edge.summary",style:{"width":"data(width)","line-color":"#c7b481",
            "target-arrow-color":"#c7b481","line-style":"dashed","opacity":0.82}},
          {selector:"edge[direction = 'undirected']",style:{"target-arrow-shape":"none"}},
          {selector:"edge[direction = 'mutual']",style:{"source-arrow-shape":"triangle"}},
          {selector:"edge.selected",style:{"width":5,"line-color":"#ffda92","opacity":1}}
        ]});
      cy.on("tap","node",event=>pickNode.current(event.target.id()));
      cy.on("tap","edge",event=>pickEdge.current(event.target.id()));
      cyRef.current=cy;setReady(true);
    });
    return ()=>{cancelled=true;cyRef.current?.destroy();cyRef.current=null;};
  },[]);
  useEffect(()=>{
    const cy=cyRef.current;if(!cy||!ready)return;
    const previous=new Map<string,{x:number;y:number}>();
    cy.nodes().forEach(n=>{previous.set(n.id(),{...n.position()});});
    const oldCount=cy.nodes().length;
    const {nodes,edges}=projection.graph;
    cy.batch(()=>{
      cy.elements().remove();
      cy.add([
        ...nodes.map(n=>{
          const cluster=n.properties?.mosslineAdaptiveCluster===true;
          const size=cluster?Math.min(100,48+Math.log2(
            Number(n.properties?.mosslineMemberCount)||1)*6):33;
          return {group:"nodes" as const,
            data:{id:n.id,label:n.label,size},
            position:previous.get(n.id),
            classes:[cluster?"cluster":"",n.type].filter(Boolean).join(" ")};
        }),
        ...edges.map(e=>{
          const summary=e.properties?.mosslineAdaptiveSummary===true;
          const count=Number(e.properties?.connectionCount??1);
          return {group:"edges" as const,
            data:{id:e.id,source:e.source,target:e.target,
              direction:e.direction??"directed",width:Math.min(9,1.3+Math.log2(count+1))},
            classes:summary?"summary":""};
        })
      ]);
    });
    if(nodes.length){
      cy.layout({name:"cose",animate:false,randomize:false,fit:false,
        numIter:oldCount?170:320,padding:55,nodeRepulsion:()=>110000,
        idealEdgeLength:()=>135,edgeElasticity:()=>90,gravity:0.28}).run();
      if(!oldCount)cy.fit(undefined,60);
    }
    cy.resize();
  },[projection,ready]);
  // Selection changes update styles, not the underlying network or its layout.
  useEffect(()=>{
    const cy=cyRef.current;
    if(!cy||!ready)return;
    cy.batch(()=>{
      cy.elements().removeClass("selected dimmed neighbour");
      const selected=selectedId&&!selectedEdgeId?cy.getElementById(selectedId):null;
      const edge=selectedEdgeId?cy.getElementById(selectedEdgeId):null;
      if(selected?.length){
        cy.elements().addClass("dimmed");
        selected.removeClass("dimmed").addClass("selected");
        const linked=selected.connectedEdges();
        linked.removeClass("dimmed");
        linked.connectedNodes().removeClass("dimmed").addClass("neighbour");
        selected.removeClass("neighbour");
      }else if(edge?.length){
        cy.elements().addClass("dimmed");
        edge.removeClass("dimmed").addClass("selected");
        edge.connectedNodes().removeClass("dimmed").addClass("neighbour");
      }
    });
    const target=selectedId&&!selectedEdgeId?cy.getElementById(selectedId):null;
    if(target?.length)cy.center(target);
  },[selectedId,selectedEdgeId,projection,ready]);

  return <div className="whole-graph-stage">
    <div ref={root} className="whole-graph-canvas" role="img"
      aria-label="Complete network overview. Select an entity to inspect its original relationships or a group to open it. The adjacent lists support keyboard navigation."/>
    <div className="graph-tools" aria-label="Whole network navigation">
      <button type="button" onClick={()=>{
        const cy=cyRef.current;if(cy)cy.zoom({level:Math.min(4,cy.zoom()*1.3),
          renderedPosition:{x:cy.width()/2,y:cy.height()/2}});
      }} aria-label="Zoom in">+</button>
      <button type="button" onClick={()=>{
        const cy=cyRef.current;if(cy)cy.zoom({level:Math.max(.15,cy.zoom()/1.3),
          renderedPosition:{x:cy.width()/2,y:cy.height()/2}});
      }} aria-label="Zoom out">−</button>
      <button type="button" onClick={()=>cyRef.current?.fit(undefined,60)}
        aria-label="Fit whole network">⤢</button>
    </div>
  </div>;
}
