"use client";

import {useMemo} from "react";
import {auditGraph,explainRelationship,
  type GraphDocument,type GraphNode,type GraphEdge,type GraphAudit,type EvidencePath}
  from "@mossline/graph-core";

/** Read-only audit, entity and relationship inspectors. Rendering concerns stay
 * separate from MapStudio's persistence and interaction orchestration. */
export function CoverageReport({ graph }: { graph: GraphDocument }) {
  const audit: GraphAudit = useMemo(() => auditGraph(graph), [graph]);
  const { coverage, totals } = audit;
  return <div className="coverage-report">
    <p className="coverage-disclaimer">Coverage describes fields in this dataset; it is not an assessment of truth, accuracy or impact.</p>
    <div className="coverage-grid">
      <div><strong>{totals.nodes}</strong><span>Entities</span></div>
      <div><strong>{totals.recorded}</strong><span>Recorded links</span></div>
      <div><strong>{coverage.nodesWithOrigin} / {totals.nodes}</strong><span>Entities with source ID</span></div>
      <div><strong>{coverage.relationshipsWithOrigin} / {totals.relationships}</strong><span>Links with source ID</span></div>
      <div><strong>{coverage.nodesWithDescription} / {totals.nodes}</strong><span>Descriptions</span></div>
      <div><strong>{coverage.nodesWithRegion} / {totals.nodes}</strong><span>Regions</span></div>
    </div>
    <div className="coverage-details">
      <p><strong>{audit.isolated.length}</strong> entities without a connection in this dataset</p>
      <p><strong>{audit.duplicateLabels.length}</strong> labels shared by more than one entity</p>
      <p><strong>{audit.categories.other}</strong> entities classified as Other</p>
      {audit.isolated.length > 0 && <details>
        <summary>Show unconnected entities</summary>
        <ul>{audit.isolated.slice(0,15).map(n=><li key={n.id}>{n.label}</li>)}</ul>
        {audit.isolated.length>15 && <p>Showing the first 15; use the source dataset for the full list.</p>}
      </details>}
      {audit.duplicateLabels.length > 0 && <details>
        <summary>Show repeated labels</summary>
        <ul>{audit.duplicateLabels.slice(0,15).map(group=><li key={group.label}>
          {group.label} ({group.ids.length} entities)
        </li>)}</ul>
      </details>}
      {audit.sources.length > 0 && <details>
        <summary>Source files and record counts</summary>
        <ul>{audit.sources.map(source=><li key={source.system+":"+source.fileName}>
          {source.fileName ?? source.system.toUpperCase()} · {source.nodes} entities · {source.relationships} links
        </li>)}</ul>
        <p>CSV references use logical record numbers, not physical line numbers. Kumu references use array positions.</p>
      </details>}
    </div>
  </div>;
}

export function NodeInspector({ node, graph, source, onPick, onPickEdge, onTraceFrom }: {
  node: GraphNode;
  graph: GraphDocument;
  source: GraphDocument;
  onPick: (id: string) => void;
  onPickEdge: (id: string) => void;
  onTraceFrom: (id: string) => void;
}) {
  const related = graph.edges.filter(e => e.source === node.id || e.target === node.id);
  const links = related.flatMap(edge => {
    const neighbour = graph.nodes.find(item => item.id === (edge.source === node.id ? edge.target : edge.source));
    return neighbour ? [{ neighbour, edge }] : [];
  });
  return <div className="inspector-inner">
    <div className={"inspector-cover " + node.type}>
      {node.imageUrl ? <img src={node.imageUrl} alt="" referrerPolicy="no-referrer" loading="lazy" /> :
        <div className="inspector-cover-art" aria-hidden="true">✳</div>}
      <span>{node.type}</span>
    </div>
    <p className="eyebrow">{node.type}{node.region ? " · " + node.region : ""}</p>
    <h2>{node.label}</h2>
    <button type="button" className="inspect-trace-start" onClick={()=>onTraceFrom(node.id)}>
      Explore connections from here →
    </button>
    <p className="description">{node.description ?? "No description yet. Add context to your data source."}</p>
    <div className="inspector-stats">
      <div><strong>{related.filter(e=>!e.inferred).length}</strong><small>Recorded links</small></div>
      <div><strong>{related.filter(e=>e.inferred).length}</strong><small>Shared associations</small></div>
    </div>
    {node.tags.length>0 && <div className="inspector-tags">{node.tags.map(tag=>
      <span key={tag}>{tag}</span>)}</div>}
    {node.sourceUrl && <a href={node.sourceUrl} target="_blank" rel="noreferrer">View source ↗</a>}
    {node.origin && <p className="help">Imported from {node.origin.system.toUpperCase()} · source record {node.origin.recordId}
      {node.origin.fileName && <> · file {node.origin.fileName}</>}
      {node.origin.recordNumber && <> · record {node.origin.recordNumber}</>}
    </p>}
    {node.properties && Object.keys(node.properties).length > 0 && <details className="original-fields">
      <summary>Original source fields ({Object.keys(node.properties).length})</summary>
      <dl>{Object.entries(node.properties).map(([key,value]) =>
        <div key={key}><dt>{key}</dt><dd>{typeof value === "string" ? value : JSON.stringify(value) ?? "—"}</dd></div>)}</dl>
    </details>}
    <div className="inspector-section">
      <p className="eyebrow">Relationships · {links.length}</p>
      {links.length === 0 && <p className="muted">No connected entities in the current map.</p>}
      {links.map(({neighbour, edge}) => {
        const supporting = (edge.evidenceNodeIds ?? []).map(id => source.nodes.find(n => n.id === id)?.label ?? id).join(", ");
        return <div className="relation-row" key={edge.id}>
          <button className="relation" onClick={() => onPick(neighbour.id)}>
            <span className={"small-dot " + neighbour.type} />
            <span><strong>{neighbour.label}</strong><small>{edge.type}{edge.inferred ? " · inferred" : ""}</small>
              {supporting && <small>Shared through: {supporting}</small>}
            </span>
            <span aria-hidden="true">↗</span>
          </button>
          <button className="relation-evidence" onClick={() => onPickEdge(edge.id)}
            aria-label={"Explain relationship with " + neighbour.label}>Why?</button>
        </div>;
      })}
    </div>
  </div>;
}

function EvidenceTrail({ path, source }: { path: EvidencePath | null; source: GraphDocument }) {
  if (!path) return <p className="relationship-unresolved">No supporting source-record path found.</p>;
  const names = new Map(source.nodes.map(n => [n.id, n.label]));
  const edges = new Map(source.edges.map(e => [e.id, e.type]));
  return <ol className="relationship-trail">
    {path.nodeIds.map((id, index) => <li key={id + "-" + index}>
      {index > 0 && <span className="trail-verb">{edges.get(path.edgeIds[index - 1]) ?? "linked to"}</span>}
      <span>{names.get(id) ?? id}</span>
    </li>)}
  </ol>;
}

export function RelationshipInspector({ edge, source, onPick, onEvidence }: {
  edge: GraphEdge;
  source: GraphDocument;
  onPick: (id: string) => void;
  onEvidence: (id: string) => void;
}) {
  const explanation = explainRelationship(source, edge);
  return <div className="inspector-inner relationship-inspector">
    <div className="relationship-header-illustration" aria-hidden="true"><span>◎</span></div>
    <p className="eyebrow">Why are these connected?</p>
    <h2>{explanation.status === "inferred" ? "A shared association." : "A recorded relationship."}</h2>
    <div className="relationship-parties">
      <button type="button" onClick={() => onPick(edge.source)}>{explanation.source?.label ?? edge.source}</button>
      <span aria-hidden="true">↔</span>
      <button type="button" onClick={() => onPick(edge.target)}>{explanation.target?.label ?? edge.target}</button>
    </div>
    <div className={"relationship-status " + explanation.status}>
      {explanation.status === "inferred" ? "Inferred from source records" : "Recorded in dataset"}
    </div>
    <p className="description">{explanation.summary}</p>
    {edge.description && <p className="description">{edge.description}</p>}
    {explanation.status === "recorded" ? <>
      <div className="relationship-facts">
        <p><strong>Relationship</strong> {edge.type}</p>
        <p><strong>Direction</strong> {edge.direction ?? "directed"}</p>
        {edge.origin && <p><strong>Source record</strong> {edge.origin.system.toUpperCase()} · {edge.origin.recordId}
          {edge.origin.fileName && <> · {edge.origin.fileName}</>}
          {edge.origin.recordNumber && <> · record {edge.origin.recordNumber}</>}
        </p>}
      </div>
      {edge.sourceUrl && <a href={edge.sourceUrl} target="_blank" rel="noreferrer">Inspect source record ↗</a>}
      {edge.properties && Object.keys(edge.properties).length > 0 &&
        <details className="original-fields">
          <summary>Original relationship fields</summary>
          <dl>{Object.entries(edge.properties).map(([key, value]) => <div key={key}>
            <dt>{key}</dt><dd>{typeof value === "string" ? value : JSON.stringify(value) ?? "—"}</dd>
          </div>)}</dl>
        </details>}
    </> : <>
      <div className="inspector-section">
        <p className="eyebrow">Supporting records · {explanation.supports.length}</p>
        {explanation.supports.length === 0 &&
          <p className="relationship-unresolved">This association has no supporting record IDs. Treat it as unsubstantiated.</p>}
        {explanation.supports.map(support => <section key={support.nodeId} className="evidence-card">
          <p className="evidence-kind">{support.type}</p>
          <h3>{support.label}</h3>
          <div className="evidence-side"><p>First entity’s path</p><EvidenceTrail path={support.fromSource} source={source}/></div>
          <div className="evidence-side"><p>Second entity’s path</p><EvidenceTrail path={support.fromTarget} source={source}/></div>
          <button type="button" className="evidence-explore" onClick={() => onEvidence(support.nodeId)}>
            Explore {support.type} in the landscape ↗
          </button>
        </section>)}
      </div>
    </>}
    <p className="relationship-caveat">This view explains the records present in Mossline. It does not verify the underlying claims.</p>
  </div>;
}

