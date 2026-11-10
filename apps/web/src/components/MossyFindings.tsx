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
  const lensName={network:"connections",map:"places",themes:"themes",funding:"funding",timeline:"changes over time"}[report.recommended];
  return <div className="ml-empty-panel ml-findings" aria-label="What Mossy found">
    <p className="ml-eyebrow">Your data, explored</p>
    <h2>What Mossy found</h2>
    <p>Mossy recognised <strong>{report.records.toLocaleString("en-GB")} records</strong> and
      <strong> {report.relationships.toLocaleString("en-GB")} source-recorded relationships</strong>.
      These observations come from the records, not an AI guess.</p>
    <div className="ml-findings-recommend">
      <span className="ml-eyebrow">A good place to begin</span>
      <button type="button" onClick={()=>onLens(report.recommended)}>Explore {lensName} →</button>
    </div>
    <h3 className="ml-section-title">Worth exploring</h3>
    <ul className="ml-findings-list">{report.findings.slice(0,4).map(item=><li key={item.id}>
      <strong>{item.heading}</strong><p>{item.detail}</p>
      <button type="button" onClick={()=>{onLens(item.lens);if(item.recordId)onPick(item.recordId);else if(item.id==="records")onBrowse();}}>
        {item.label} →</button>
    </li>)}</ul>
    {(report.missingPlaces>0||report.noConnections>0)&&<div className="ml-findings-gaps">
      <strong>What could make this richer?</strong>
      <p>{report.missingPlaces>0?report.missingPlaces+" records lack source-given coordinates. ":""}
        {report.noConnections>0?report.noConnections+" records have no recorded links. ":""}
        You can add or correct records without altering the original source data.</p>
    </div>}
    <p className="ml-hint">Select anything in the atlas to see where its information came from.
      Or <button type="button" className="ml-link-button" onClick={onBrowse}>browse every record</button>.</p>
    <div className="ml-grammar-note"><p><span className="ml-key-ink"/> Solid lines are recorded in the source.</p>
      <p><span className="ml-key-pencil"/> Dotted lines are suggestions, not facts.</p></div>
  </div>;
}
