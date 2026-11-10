"use client";

import type {AtlasLens,GraphDocument} from "@mossline/graph-core";
import {useMemo} from "react";
import {mossyOverview} from "../lib/mossy-findings";

export function MossyFindings({graph,onPick,onLens,onBrowse}:{
  graph:GraphDocument;
  onPick:(id:string)=>void;
  onLens:(lens:AtlasLens)=>void;
  onBrowse:()=>void;
}){
  const report=useMemo(()=>mossyOverview(graph),[graph]);
  // Lead with the strongest evidence for this particular dataset, not a fixed list.
  // The same source observation must never appear twice.
  const lead=report.findings.find(item=>item.lens===report.recommended)??report.findings[0];
  const remaining=report.findings.filter(item=>item.id!==lead.id).slice(0,3);
  const explore=(item:typeof lead)=>{
    onLens(item.lens);
    if(item.recordId)onPick(item.recordId);
    else if(item.id==="records")onBrowse();
  };
  return <div className="ml-empty-panel ml-findings" aria-label="What Mossy found">
    <p className="ml-eyebrow">Your data, explored</p>
    <h2>What Mossy found</h2>
    <p>Mossy recognised <strong>{report.records.toLocaleString("en-GB")} records</strong> and
      <strong> {report.relationships.toLocaleString("en-GB")} source-recorded relationships</strong>.
      These observations come from the records, not an AI guess.</p>
    <div className="ml-findings-recommend">
      <span className="ml-eyebrow">Start here</span>
      <h3>{lead.heading}</h3>
      <p>{lead.detail}</p>
      <button type="button" onClick={()=>explore(lead)}>{lead.label} →</button>
    </div>
    {remaining.length>0&&<>
      <h3 className="ml-section-title">Other things to explore</h3>
      <ul className="ml-findings-list">{remaining.map(item=><li key={item.id}>
        <strong>{item.heading}</strong><p>{item.detail}</p>
        <button type="button" onClick={()=>explore(item)}>{item.label} →</button>
      </li>)}</ul>
    </>}
    {(report.missingPlaces>0||report.noConnections>0)&&<div className="ml-findings-gaps">
      <strong>What could make this richer?</strong>
      <p>{report.missingPlaces>0?report.missingPlaces+" records cannot yet be placed on the map. ":""}
        {report.noConnections>0?report.noConnections+" records have no recorded links. ":""}
        You can add or correct records without altering the original source data.</p>
    </div>}
    <p className="ml-hint">Select anything in the atlas to see where its information came from.
      Or <button type="button" className="ml-link-button" onClick={onBrowse}>browse every record</button>.</p>
    <div className="ml-grammar-note"><p><span className="ml-key-ink"/> Solid lines are recorded in the source.</p>
      <p><span className="ml-key-pencil"/> Dotted lines are suggestions, not facts.</p></div>
  </div>;
}
