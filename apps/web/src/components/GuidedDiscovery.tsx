"use client";

import { useMemo, useState } from "react";
import {
  buildMappedGraph, type ColumnMapping, type DataDiscovery,
  type ImportFile, type MappedPreview
} from "@mossline/graph-core";
import { DataMappingWorkbench } from "./DataMappingWorkbench";

type CsvDiscovery=Extract<DataDiscovery,{kind:"csv-table"}>;

/**
 * Progressive disclosure: preview a plausible network before exposing graph
 * terminology, tables or mapping rules. Source assertions are not verified.
 */
export function GuidedDiscovery({file,discovery,onPreview,onChange}:{
  file:ImportFile;discovery:CsvDiscovery;
  onPreview:(proposal:MappedPreview)=>void;
  onChange:()=>void;
}){
  const [mapping,setMapping]=useState<ColumnMapping>(discovery.mapping);
  const [showAdjust,setShowAdjust]=useState(false);
  const [previewNotice,setPreviewNotice]=useState("");
  const proposal=useMemo(()=>buildMappedGraph(file,mapping),[file,mapping]);
  const columns=discovery.columns.map(c=>c.name);
  const owners=[...new Set(mapping.rules.flatMap(r=>[r.fromColumn,r.toColumn]))];
  const examples=useMemo(()=>{
    if(!proposal.graph)return [];
    const names=new Map(proposal.graph.nodes.map(n=>[n.id,n.label]));
    const kinds=new Set<string>();
    return proposal.graph.edges.filter(edge=>{
      if(kinds.has(edge.type))return false;
      kinds.add(edge.type);return true;
    }).slice(0,3).map(edge=>({
      id:edge.id,from:names.get(edge.source)??edge.source,
      to:names.get(edge.target)??edge.target,type:edge.type
    }));
  },[proposal]);
  function update(next:ColumnMapping){
    setMapping(next);setPreviewNotice("");onChange();
  }
  function preview(){
    const candidate=buildMappedGraph(file,mapping);
    if(candidate.issues.some(x=>x.severity==="error")){
      setPreviewNotice(candidate.issues.find(x=>x.severity==="error")?.message??"Please review your choices.");
    }else setPreviewNotice("Preview prepared below. You can create this as a separate map.");
    onPreview(candidate);
  }
  const select=(current:string,change:(next:string)=>void,emptyLabel:string)=>{
    return <select value={current} onChange={e=>change(e.target.value)}>
      <option value="">{emptyLabel}</option>
      {columns.map(name=><option value={name} key={name}>{name}</option>)}
    </select>;
  };
  return <section className="guided-discovery" aria-label="Discover a possible network">
    <p className="eyebrow">Step 1 · Understand your data</p>
    <h3>Here’s what I think your spreadsheet is telling us.</h3>
    <p className="discovery-lede">I’ve looked at the headings and sample values in <strong>{file.name}</strong>.
      Here’s a possible interpretation to check — no network has been created yet.</p>
    <div className="discovery-preview">
      <div className="discovery-stats">
        <span><strong>{discovery.rowCount}</strong> spreadsheet rows</span>
        <span><strong>{proposal.counts.nodes}</strong> possible things</span>
        <span><strong>{proposal.counts.edges}</strong> recorded connections</span>
      </div>
      {mapping.mode==="relationships"&&examples.length>0 ?
        <div className="discovery-paths">{examples.map(edge=>
          <div className="discovery-path" key={edge.id}>
            <span className="discovery-node">{edge.from}</span>
            <span className="discovery-arrow"><span aria-hidden="true">→</span>{edge.type}</span>
            <span className="discovery-node">{edge.to}</span>
          </div>)}</div> :
        <div className="discovery-entity-list">
          <p>This looks like a list of individual people, organisations or other things.
            We can explore those first, then add relationships when you have them.</p>
          {proposal.graph?.nodes.slice(0,5).map(n=><span key={n.id}>{n.label}</span>)}
        </div>}
      <p className="discovery-provenance">Names come from your file. Connection meanings are suggestions
        from its column names — not verified partnerships, funding or causation.</p>
    </div>
    <div className="discovery-decision">
      <strong>Does this look roughly right?</strong>
      <div className="discovery-buttons">
        <button type="button" className="button-primary" onClick={preview}
          disabled={!proposal.graph || proposal.counts.nodes===0}>
          Yes — show me the network →
        </button>
        <button type="button" className="button-outline" onClick={()=>setShowAdjust(v=>!v)}>
          {showAdjust?"Hide adjustments":"Not quite — help me adjust it"}
        </button>
      </div>
      {previewNotice&&<p role="status">{previewNotice}</p>}
    </div>
    {showAdjust&&<section className="discovery-adjustments" aria-label="Correct Mossline's guesses">
      <h4>Tell Mossline what your columns mean</h4>
      <p>No need to learn a new data structure. You can correct the guesses in ordinary language.</p>
      <label>Does each row describe a connection, or one thing?
        <select value={mapping.mode} onChange={e=>update({...mapping,mode:e.target.value as ColumnMapping["mode"]})}>
          <option value="relationships">A connection between things</option>
          <option value="entities">One individual thing</option>
        </select>
      </label>
      {mapping.mode==="entities"&&<label>Which column has the names?
        {select(mapping.nameColumn,v=>update({...mapping,nameColumn:v}),"Choose name column")}
      </label>}
      {mapping.mode==="relationships"&&mapping.rules.map((rule,i)=><div className="discovery-rule" key={i}>
        <strong>Connection {i+1}</strong>
        <div className="discovery-adjust-grid">
          <label>Connects things in…
            {select(rule.fromColumn,v=>update({...mapping,rules:mapping.rules.map((r,j)=>
              i===j?{...r,fromColumn:v}:r)}),"Choose a column")}
          </label>
          <label>…to things in
            {select(rule.toColumn,v=>update({...mapping,rules:mapping.rules.map((r,j)=>
              i===j?{...r,toColumn:v}:r)}),"Choose a column")}
          </label>
        </div>
        <label>How would you describe that connection?
          <input value={rule.type} maxLength={100} onChange={e=>update({...mapping,rules:
            mapping.rules.map((r,j)=>i===j?{...r,type:e.target.value}:r)})}/>
        </label>
      </div>)}
      <div className="discovery-adjust-grid">
        <label>Where is the location or region (if anywhere)?
          {select(mapping.regionColumn,v=>update({...mapping,regionColumn:v,
            descriptionColumn:mapping.descriptionColumn===v?"":mapping.descriptionColumn}),
            "No region information")}
        </label>
        <label>Is there a column describing something?
          <select value={mapping.descriptionColumn} onChange={e=>update({...mapping,descriptionColumn:e.target.value})}>
            <option value="">No description column</option>
            {columns.filter(c=>c!==mapping.regionColumn).map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      {mapping.mode==="relationships"&&mapping.regionColumn&&<label>Whose region is it?
        <select value={mapping.regionEntityColumn??""} onChange={e=>update({...mapping,
          regionEntityColumn:e.target.value||undefined,
          regionColumn:e.target.value?mapping.regionColumn:""})}>
          <option value="">Don't assume a location</option>
          {owners.map(name=><option value={name} key={name}>The {name} column</option>)}
        </select>
      </label>}
      <p className="discovery-provenance">A project shared by organisations in different places doesn't
        automatically belong to each place. We leave uncertain locations unassigned.</p>
      <button type="button" className="button-primary" onClick={preview}>Preview with these corrections →</button>
    </section>}
    <details className="discovery-advanced">
      <summary>Advanced mapping and saved recipes</summary>
      <p>For people who need precise entity categories, multiple relationship rules, or reusable mapping recipes.</p>
      <DataMappingWorkbench key={JSON.stringify(mapping)} file={file}
        discovery={{...discovery,mapping}} onPreview={onPreview} onChange={onChange}/>
    </details>
  </section>;
}
