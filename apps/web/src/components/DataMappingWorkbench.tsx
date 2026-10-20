"use client";

import { useState } from "react";
import {
  buildMappedGraph, type ColumnMapping, type DataDiscovery, type ImportFile,
  type MappedPreview, type NodeType, type RelationshipRule
} from "@mossline/graph-core";

type CsvDiscovery = Extract<DataDiscovery, {kind:"csv-table"}>;
const types:NodeType[]=["organisation","project","funder","person","place","topic","methodology","outcome","other"];
const labelType=(value:NodeType)=>value.charAt(0).toUpperCase()+value.slice(1);

export function DataMappingWorkbench({file,discovery,onPreview,onChange}:{
  file:ImportFile;
  discovery:CsvDiscovery;
  onPreview:(preview:MappedPreview)=>void;
  onChange:()=>void;
}) {
  const [mapping,setMapping]=useState<ColumnMapping>(discovery.mapping);
  const [lastPreview,setLastPreview]=useState<MappedPreview|null>(null);
  const columns=discovery.columns.map(c=>c.name);
  const update=(next:ColumnMapping)=>{
    setMapping(next);
    setLastPreview(null);
    onChange();
  };
  const editRule=(index:number,patch:Partial<RelationshipRule>)=>{
    update({...mapping,rules:mapping.rules.map((r,i)=>i===index?{...r,...patch}:r)});
  };
  const columnOptions=(allowEmpty=false)=><>
    {allowEmpty&&<option value="">Not mapped</option>}
    {columns.map(col=><option value={col} key={col}>{col}</option>)}
  </>;
  const typeOptions=types.map(type=><option value={type} key={type}>{labelType(type)}</option>);
  const apply=()=>{
    const result=buildMappedGraph(file,mapping);
    setLastPreview(result);
    onPreview(result);
  };
  return <section className="mapping-workbench" aria-label="Map your spreadsheet into a network">
    <div className="mapping-intro">
      <p className="eyebrow">Discover → Map → Preview → Confirm</p>
      <h3>Teach Mossline what your data means</h3>
      <p>These are suggestions based on your column names, not decisions made for you.
        Choose which values should become entities, and which pairs genuinely describe relationships.</p>
    </div>
    <details className="mapping-columns" open>
      <summary>{discovery.rowCount} rows · {columns.length} columns found</summary>
      <div className="mapping-column-list">
        {discovery.columns.map(col=><div key={col.name}>
          <strong>{col.name}</strong>
          <span>{col.filled}/{discovery.rowCount} filled · {col.distinct} distinct</span>
          <small>{col.examples.length?col.examples.join(" · "):"No populated examples"}</small>
        </div>)}
      </div>
    </details>
    <div className="mapping-controls">
      <label>What kind of table is this?
        <select value={mapping.mode} onChange={e=>update({...mapping,mode:e.target.value as ColumnMapping["mode"]})}>
          <option value="relationships">Rows describe relationships between things</option>
          <option value="entities">Rows describe individual entities</option>
        </select>
      </label>
      {mapping.mode==="entities" ? <div className="mapping-field-grid">
        <label>Entity name column
          <select value={mapping.nameColumn} onChange={e=>update({...mapping,nameColumn:e.target.value})}>{columnOptions()}</select>
        </label>
        <label>Default entity type
          <select value={mapping.nodeType} onChange={e=>update({...mapping,nodeType:e.target.value as NodeType})}>{typeOptions}</select>
        </label>
        <label>Type/category column (optional)
          <select value={mapping.typeColumn} onChange={e=>update({...mapping,typeColumn:e.target.value})}>{columnOptions(true)}</select>
        </label>
      </div> : <div className="mapping-rules">
        <p className="mapping-explainer">Each rule reads two columns on the same row. Add separate rules if a table has organisations, projects and funders.</p>
        {mapping.rules.map((rule,i)=><div className="mapping-rule" key={i}>
          <div className="mapping-rule-heading">
            <strong>Relationship {i+1}</strong>
            <button type="button" onClick={()=>update({...mapping,rules:mapping.rules.filter((_,j)=>i!==j)})}
              aria-label={"Remove relationship rule "+(i+1)}>Remove</button>
          </div>
          <div className="mapping-field-grid">
            <label>From column
              <select value={rule.fromColumn} onChange={e=>editRule(i,{fromColumn:e.target.value})}>{columnOptions()}</select>
            </label>
            <label>From entity type
              <select value={rule.fromType} onChange={e=>editRule(i,{fromType:e.target.value as NodeType})}>{typeOptions}</select>
            </label>
            <label>To column
              <select value={rule.toColumn} onChange={e=>editRule(i,{toColumn:e.target.value})}>{columnOptions()}</select>
            </label>
            <label>To entity type
              <select value={rule.toType} onChange={e=>editRule(i,{toType:e.target.value as NodeType})}>{typeOptions}</select>
            </label>
            <label className="mapping-wide">What does this relationship actually mean?
              <input value={rule.type} maxLength={100} onChange={e=>editRule(i,{type:e.target.value})}
                placeholder="e.g. delivers, participates in, funded by" required />
            </label>
          </div>
        </div>)}
        <button type="button" className="mapping-add" onClick={()=>{
          const from=columns[0]??"",to=columns.find(c=>c!==from)??"";
          update({...mapping,rules:[...mapping.rules,{
            fromColumn:from,toColumn:to,fromType:"organisation",toType:"project",type:"related to"
          }]});
        }}>+ Add another relationship</button>
      </div>}
      <div className="mapping-field-grid">
        <label>Region column (optional)
          <select value={mapping.regionColumn} onChange={e=>update({...mapping,regionColumn:e.target.value})}>{columnOptions(true)}</select>
        </label>
        <label>Description column (optional)
          <select value={mapping.descriptionColumn} onChange={e=>update({...mapping,descriptionColumn:e.target.value})}>{columnOptions(true)}</select>
        </label>
        {mapping.mode==="relationships" && mapping.regionColumn && <label className="mapping-wide">
          Which kind of entity does that region describe?
          <select value={mapping.regionTarget}
            onChange={e=>update({...mapping,regionTarget:e.target.value as ColumnMapping["regionTarget"]})}>
            <option value="source">From-column entities</option>
            <option value="target">To-column entities</option>
            <option value="both">Both (only if truly applicable)</option>
          </select>
        </label>}
      </div>
    </div>
    <p className="mapping-caution">A shared row is not necessarily proof of collaboration, funding or causation.
      Check the labels and source data before confirming. This work is performed locally in your browser.</p>
    <button className="button-primary" type="button" onClick={apply}>Preview proposed graph →</button>
    {lastPreview&&<p role="status" className="mapping-last">Proposal: {lastPreview.counts.nodes} entities,
      {lastPreview.counts.edges} relationships, {lastPreview.counts.skipped} skipped rows.
      {lastPreview.issues.some(i=>i.severity==="error")?" Correct the mapping and try again.":" Review the result below before confirming."}
    </p>}
  </section>;
}
