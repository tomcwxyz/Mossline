"use client";

import {useMemo,useState} from "react";
import {buildFundingThemeClusters,type FundingFullAnalysis,type GraphDocument} from "@mossline/graph-core";

export function FundingClusters({graph,fullAnalysis,onExplore}:{
  graph:GraphDocument;fullAnalysis?:FundingFullAnalysis;onExplore:(id:string)=>void
}){
  const localReport=useMemo(()=>buildFundingThemeClusters(graph,6),[graph]);
  const report=fullAnalysis?.themes??localReport;
  const fullDataset=!!fullAnalysis&&fullAnalysis.grants>localReport.totalGrants;
  const graphIds=useMemo(()=>new Set(graph.nodes.map(n=>n.id)),[graph]);
  const names=useMemo(()=>new Map(graph.nodes.map(n=>[n.id,n.label])),[graph]);
  const graphButton=(id:string,label:string)=><button type="button"
    disabled={!graphIds.has(id)} title={graphIds.has(id)?"Explore this entity in the network":
      "Included in full-data analysis, but not in the reduced network view"}
    onClick={()=>onExplore(id)}>{label}</button>;
  const [filter,setFilter]=useState<"all"|"funders"|"source">("all");
  const [showMore,setShowMore]=useState(false);
  const [selected,setSelected]=useState("");
  const found=report.clusters.filter(cluster=>{
    if(filter==="funders"&&cluster.funderCount<2)return false;
    if(filter==="source"&&cluster.tagEvidence===0)return false;
    return !selected||cluster.id===selected;
  });
  const visible=found.slice(0,showMore?24:9);
  if(!report.totalGrants)return null;
  function exportClusters(){
    const data={format:"mossline-funding-theme-hypotheses",version:1,
      source:graph.title,method:report.method,coverage:{
        totalGrants:report.totalGrants,classifiedGrants:report.classifiedGrants,
        unclassifiedGrants:report.unclassifiedGrants
      },
      warning:"These are recorded source tags and tentative phrase-rule groupings, not validated themes or evidence of funding gaps.",
      clusters:report.clusters};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement("a");anchor.href=url;
    anchor.download="mossline-funding-theme-hypotheses.json";anchor.click();
    URL.revokeObjectURL(url);
  }
  return <section className="funding-clusters" aria-label="Explore theme clusters across the funding landscape">
    <div className="funding-cluster-intro">
      <div><p className="eyebrow">Landscape view · themes and connections</p>
        <h2>Where does funding gather?</h2>
        <p className="funding-cluster-scope">{fullDataset?
          "Full-source thematic analysis · all "+report.totalGrants+" unique eligible organisational grants":
          "Thematic analysis · "+report.totalGrants+" grants in this map"}</p>
        <p>Explore groups of grants with similar recorded themes or matching descriptive
          phrases. These are <strong>possible themes to investigate</strong>, not claims
          that the recipients collaborate or that local needs are met.</p>
      </div>
      <button type="button" className="button-outline" onClick={exportClusters}>Export thematic evidence ↓</button>
    </div>
    <div className="funding-cluster-coverage">
      <div><strong>{report.clusters.length}</strong><span>Potential themes found</span></div>
      <div><strong>{report.classifiedGrants}</strong><span>Grants with at least one match</span></div>
      <div><strong>{report.unclassifiedGrants}</strong><span>Unclassified grants</span></div>
      <div><strong>{report.multipleThemeGrants}</strong><span>Grants across multiple themes</span></div>
    </div>
    <div className="funding-cluster-controls">
      <label>Explore theme
        <select value={selected} onChange={e=>setSelected(e.target.value)}>
          <option value="">All possible themes</option>
          {report.clusters.map(c=><option key={c.id} value={c.id}>{c.title} · {c.grantCount} grants</option>)}
        </select>
      </label>
      <label>Show
        <select value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}>
          <option value="all">All theme suggestions</option>
          <option value="funders">Themes spanning multiple funders</option>
          <option value="source">Themes explicitly tagged in source</option>
        </select>
      </label>
    </div>
    {report.unclassifiedGrants>0&&<p className="funding-cluster-caveat">
      {Math.round(report.unclassifiedGrants/report.totalGrants*100)}% of
      {fullDataset?" eligible source awards":" mapped awards"} cannot yet be classified
      by the available evidence. This is missing information, not a funding gap.
      {fullDataset?" Theme totals include grants not shown in the reduced network.":""}
    </p>}
    <div className="funding-cluster-grid">
      {visible.map(c=><article className="funding-cluster-card" key={c.id}>
        <div className="funding-cluster-card-title">
          <h3>{c.title}</h3>
          <span>{c.id.startsWith("source:")?"Source theme":"Candidate phrase theme"}</span>
        </div>
        <div className="funding-cluster-metrics">
          <div><strong>{c.grantCount}</strong><span>Grants</span></div>
          <div><strong>{c.funderCount}</strong><span>Funders</span></div>
          <div><strong>{c.recipientCount}</strong><span>Recipients</span></div>
        </div>
        <p>{c.tagEvidence>0?c.tagEvidence+" source-tagged grants":"No original theme tag"} ·
          {" "}{c.phraseEvidence} phrase-based matches</p>
        {c.awardsByCurrency.length>0&&<p className="funding-cluster-amounts">
          Recorded award amounts: {c.awardsByCurrency.map(a=>{
            try{return new Intl.NumberFormat("en-GB",{style:"currency",currency:a.currency,
              maximumFractionDigits:0}).format(a.total)+" ("+a.knownAmounts+" grants)";}
            catch{return a.currency+" "+a.total+" ("+a.knownAmounts+" grants)";}
          }).join(" · ")}
        </p>}
        <details className="funding-cluster-detail">
          <summary>Explore organisations and evidence</summary>
          {fullDataset&&<p className="funding-cluster-scope">
            Some full-data records may not be in the reduced network canvas.
            Their evidence remains visible here, but network exploration is available
            only for records included in the visual selection.</p>}
          <div>
            <h4>Funders appearing in this theme</h4>
            <ul>{c.funderIds.slice(0,12).map(id=><li key={id}>
              {graphButton(id,names.get(id)??id)}</li>)}</ul>
            {c.funderIds.length>12&&<small>And {c.funderIds.length-12} more funders</small>}
            <h4>Organisations receiving awards from multiple funders within this theme</h4>
            {c.organisationBridges.length===0?<p>No multi-funder recipients recorded for this theme.</p>:
              <ul>{c.organisationBridges.map(item=><li key={item.recipientId}>
                {graphButton(item.recipientId,names.get(item.recipientId)??item.recipientId)}
                {" "}· {item.funderCount} funders
              </li>)}</ul>}
            <h4>Examples from grant records</h4>
            <ul>{c.evidence.map(e=><li key={e.grantId} className="funding-cluster-evidence">
              {graphButton(e.grantId,e.title)}
              <small>{names.get(e.funderId)??e.funderId} → {names.get(e.recipientId)??e.recipientId}</small>
              <p>{e.description||"No narrative description recorded"}</p>
              <small>Matched because of {e.reason==="source-tag"?"source tag":"phrase rule"}:
                {" "}{e.phrase}</small>
            </li>)}</ul>
          </div>
        </details>
      </article>)}
    </div>
    {found.length>9&&<button type="button" className="funding-more"
      onClick={()=>setShowMore(v=>!v)}>{showMore?"Show fewer":"Show more themes"}</button>}
    {found.length===0&&<p className="funding-cluster-caveat">
      No themes match those filters. You can try another view or add more descriptive grant data.
    </p>}
    <p className="funding-method-note">This method combines explicit source tags with interpretable
      phrase matches in grant titles and descriptions. A grant can be in several clusters,
      so financial totals must not be summed across clusters. Unclassified awards may still
      be highly relevant. Mossline does not claim that the absence of recorded funding means
      an unmet need.</p>
  </section>;
}
