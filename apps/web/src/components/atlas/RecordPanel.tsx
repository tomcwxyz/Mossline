"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  APPROXIMATE_KEY, approximatePlace, titleCaseName, describeApproximatePlace, describeIdentifier, evidenceReceipt, isRecorded, readAtlasLocation,
  type FundingFlow, type GraphDocument, type GraphEdge, type GraphNode, type SourceOrigin
} from "@mossline/graph-core";
import { TYPE_LABEL, formatMoney } from "./palette";

export function TypeMark({ type }: { type: GraphNode["type"] }) {
  return <svg className={"ml-type-mark ml-type-mark--" + type} viewBox="0 0 12 12" aria-hidden="true">
    {type === "project" ? <rect x="1.5" y="1.5" width="9" height="9" rx="2"/> :
      type === "funder" ? <path d="M6 .6L11.4 6 6 11.4.6 6z"/> :
      type === "place" ? <path d="M6 1l5.2 9.4H.8z"/> :
      type === "person" ? <circle cx="6" cy="6" r="4.2" className="ml-type-mark-ring"/> :
      <circle cx="6" cy="6" r="5"/>}
  </svg>;
}
type ConfirmInput = { reviewer: string; reason: string; relationship: string };
type Props = {
  source: GraphDocument; view: GraphDocument; node: GraphNode | null; flows: FundingFlow[];
  leads: { node: GraphNode; degree: number }[]; totalRecords: number; totalRecorded: number;
  onPick: (id: string) => void; onFollow: (id: string) => void;
  onConfirm: (edge: GraphEdge, input: ConfirmInput) => void;
};

const receiptText = (r: SourceOrigin) => [r.fileName ?? r.system, r.recordNumber ? "#" + r.recordNumber : r.recordId].join(" · ");
const HIDDEN_PROPERTIES = new Set([APPROXIMATE_KEY]);

/** Every source row behind a record, with the identifiers used to join them. */
function Sources({ node }: { node: GraphNode }) {
  const receipts = node.receipts?.length ? node.receipts : node.origin ? [node.origin] : [];
  const approx = readAtlasLocation(node) ? null : approximatePlace(node);
  const props = Object.entries(node.properties ?? {}).filter(([k]) => !HIDDEN_PROPERTIES.has(k));
  return <section className="ml-panel-section ml-sources">
    <h3 className="ml-section-title">Where this comes from · {receipts.length || "no source row"}</h3>
    {(node.identifiers?.length ?? 0) > 0 && <ul className="ml-identifiers" aria-label="Identifiers">
      {node.identifiers!.map(id => <li key={id} title={id}>{describeIdentifier(id)}</li>)}</ul>}
    {approx && <p className="ml-approx-note"><span className="ml-key-hollow" aria-hidden="true"/>{describeApproximatePlace(approx)}</p>}
    <ul className="ml-receipt-list">{receipts.map((r, i) => <li key={i}>
      {r.fields && Object.keys(r.fields).length ? <details><summary><span className="ml-receipt">{receiptText(r)}</span>
        {r.shape && <small>{r.shape}</small>}</summary>
        <dl>{Object.entries(r.fields).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></details>
        : <><span className="ml-receipt">{receiptText(r)}</span>{r.shape && <small>{r.shape}</small>}</>}
    </li>)}</ul>
    {receipts.length === 0 && <p className="ml-small">No source row reference supplied.</p>}
    {node.sourceUrl && <a className="ml-source-link" href={node.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a>}
    {props.length > 0 && <details className="ml-source-detail"><summary>All recorded values · {props.length}</summary>
      <dl>{props.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd></div>)}</dl>
    </details>}
  </section>;
}

function Receipt({ edge }: { edge: GraphEdge }) {
  const text = evidenceReceipt(edge);
  return <span className="ml-receipt" title={text}>{text}</span>;
}

export function RecordPanel({ source, view, node, flows, leads, totalRecords, totalRecorded, onPick, onFollow, onConfirm }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [candidate, setCandidate] = useState<string | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [reason, setReason] = useState("");
  const [relationship, setRelationship] = useState("partnership");
  const byId = useMemo(() => new Map(source.nodes.map(n => [n.id, n])), [source]);
  const links = useMemo(() => node ? view.edges.filter(e => e.source === node.id || e.target === node.id) : [], [view, node]);
  const recorded = links.filter(isRecorded);
  const pencil = links.filter(e => !isRecorded(e))
    .sort((a, b) => (b.evidenceNodeIds?.length ?? 0) - (a.evidenceNodeIds?.length ?? 0));
  const fundersByRecipient = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const f of flows) m.set(f.recipientId, (m.get(f.recipientId) ?? new Set()).add(f.funderId));
    return m;
  }, [flows]);
  // Funders of this record, directly or through a project it is recorded as linked to.
  const funderIds = useMemo(() => {
    const set = new Set<string>(node ? fundersByRecipient.get(node.id) ?? [] : []);
    if (node) for (const e of links) {
      if (!isRecorded(e)) continue;
      const other = e.source === node.id ? e.target : e.source;
      if (byId.get(other)?.type === "project") for (const f of fundersByRecipient.get(other) ?? []) set.add(f);
    }
    return set;
  }, [node, links, fundersByRecipient, byId]);
  const funderFlows = useMemo(() => node?.type === "funder" ? flows.filter(f => f.funderId === node.id) : [], [node, flows]);

  if (!node) return <div className="ml-empty-panel">
    <p className="ml-eyebrow">Start exploring</p>
    <h2>Find a starting point</h2>
    <p>This atlas holds {totalRecords.toLocaleString("en-GB")} records and {totalRecorded.toLocaleString("en-GB")} recorded
      relationships. Choose a record, then follow its links and check the evidence behind each one.</p>
    {leads.length > 0 && <>
      <h3 className="ml-section-title">Best connected</h3>
      <ul className="ml-lead-list">{leads.map(({ node: n, degree }) => <li key={n.id}>
        <button type="button" onClick={() => onPick(n.id)}><TypeMark type={n.type}/><span>{n.label}</span>
          <small>{degree} recorded</small></button></li>)}</ul>
    </>}
    <p className="ml-hint">Or press <kbd>/</kbd> to search, or open <strong>Browse records</strong> for a full list.</p>
    <div className="ml-grammar-note">
      <p><span className="ml-key-ink"/> Solid lines are recorded in your source.</p>
      <p><span className="ml-key-pencil"/> Dotted lines are suggestions, not facts.</p>
    </div>
  </div>;

  const place = (node.properties?.Town as string | undefined) ?? (node.properties?.["Head office"] as string | undefined) ??
    (node.properties?.Postcode as string | undefined);
  const valued = funderFlows.filter(f => f.amount !== null && f.currency);
  const currency = valued[0]?.currency ?? null;
  const total = valued.filter(f => f.currency === currency).reduce((s, f) => s + (f.amount ?? 0), 0);
  const years = funderFlows.map(f => f.year).filter((y): y is number => y !== null);
  const byTheme = new Map<string, number>();
  for (const f of valued) if (f.currency === currency) byTheme.set(f.themes[0] ?? "No theme recorded", (byTheme.get(f.themes[0] ?? "No theme recorded") ?? 0) + (f.amount ?? 0));
  const themeRows = [...byTheme].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const largest = [...valued].filter(f => f.currency === currency).sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)).slice(0, 4);
  const shownRecorded = showAll ? recorded : recorded.slice(0, 6);
  const otherOf = (e: GraphEdge) => byId.get(e.source === node.id ? e.target : e.source);

  return <div className="ml-record-panel">
    <p className={"ml-eyebrow ml-eyebrow--" + node.type}><TypeMark type={node.type}/> {TYPE_LABEL[node.type]}</p>
    <h2>{node.label}</h2>
    {(place || node.region) && <p className="ml-place">{[place && titleCaseName(place), node.region].filter(Boolean).join(" · ")}
      {node.type === "funder" && years.length > 0 && <> · grants {Math.min(...years)}–{Math.max(...years)}</>}</p>}
    <p className="ml-description">{node.description || "No description recorded in the source."}</p>
    {node.tags.length > 0 && <ul className="ml-tags">{node.tags.map(t => <li key={t}>{t}</li>)}</ul>}

    <div className="ml-stats">
      {node.type === "funder" ? <>
        <div><strong>{funderFlows.length.toLocaleString("en-GB")}</strong><span>grants</span></div>
        <div><strong>{currency ? formatMoney(total, currency) : "—"}</strong><span>{currency ? "awarded" : "no amounts"}</span></div>
        <div><strong>{new Set(funderFlows.map(f => f.recipientId)).size.toLocaleString("en-GB")}</strong><span>recipients</span></div>
      </> : <>
        <div><strong>{recorded.length.toLocaleString("en-GB")}</strong><span>recorded</span></div>
        <div><strong>{funderIds.size.toLocaleString("en-GB")}</strong><span>funders</span></div>
        <div className="ml-stat-pencil"><strong>{pencil.length.toLocaleString("en-GB")}</strong><span>suggested</span></div>
      </>}
    </div>
    <button type="button" className="ml-primary ml-follow-trigger" onClick={() => onFollow(node.id)}>
      Follow a recorded connection →</button>

    {node.type === "funder" && themeRows.length > 0 && <section className="ml-panel-section">
      <h3 className="ml-section-title">By theme</h3>
      <ul className="ml-mini-bars">{themeRows.map(([t, v]) => <li key={t}><span>{t}</span>
        <i><b style={{ width: (v / themeRows[0][1] * 100) + "%" }}/></i><span className="ml-mono">{formatMoney(v, currency)}</span></li>)}</ul>
    </section>}
    {node.type === "funder" && largest.length > 0 && <section className="ml-panel-section">
      <h3 className="ml-section-title">Largest grants</h3>
      <ul className="ml-link-list">{largest.map(f => {
        const r = byId.get(f.recipientId); const edge = source.edges.find(e => e.id === f.edgeIds[0]);
        return <li key={f.id}><button type="button" onClick={() => r && onPick(r.id)}>
          <strong>{r?.label ?? f.recipientId}</strong>
          <small>{[r?.properties?.Town as string | undefined ?? r?.region, f.year, formatMoney(f.amount ?? 0, currency)].filter(Boolean).join(" · ")}</small>
        </button>{edge && <Receipt edge={edge}/>}</li>;
      })}</ul>
    </section>}

    <section className="ml-panel-section">
      <h3 className="ml-section-title ml-section-title--ink"><span className="ml-key-ink"/>Recorded · {recorded.length.toLocaleString("en-GB")}</h3>
      {recorded.length === 0 && <p className="ml-small">No recorded relationships in the current view.</p>}
      <ul className="ml-link-list">{shownRecorded.map(e => {
        const other = otherOf(e); const year = e.properties ? Object.entries(e.properties)
          .find(([k]) => /date|year/i.test(k))?.[1] : undefined;
        return <li key={e.id}><button type="button" onClick={() => other && onPick(other.id)}>
          <strong>{other?.label ?? "Unknown record"}</strong>
          <small>{e.type}{year ? " · " + String(year).slice(0, 4) : ""}{e.origin?.system === "annotation" ? " · reviewer-confirmed" : ""}</small>
        </button><Receipt edge={e}/>{e.sourceUrl && <a className="ml-source-link" href={e.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a>}</li>;
      })}</ul>
      {recorded.length > 6 && <button type="button" className="ml-link-button" onClick={() => setShowAll(v => !v)}>
        {showAll ? "Show fewer" : `Show ${recorded.length - 6} more`}</button>}
    </section>

    {pencil.length > 0 && <section className="ml-panel-section ml-pencil-box">
      <h3 className="ml-section-title ml-section-title--pencil"><span className="ml-key-pencil"/>Shares a funder or project with · {pencil.length.toLocaleString("en-GB")}</h3>
      <p className="ml-small">Same funder or project, recorded separately. Not a partnership unless a source says so.</p>
      <ul className="ml-link-list">{pencil.slice(0, 8).map(e => {
        const other = otherOf(e);
        const via = (e.evidenceNodeIds ?? []).map(id => byId.get(id)?.label ?? id);
        return <li key={e.id}>
          <button type="button" onClick={() => other && onPick(other.id)}><strong>{other?.label ?? "Related record"}</strong>
            <small>via {via.slice(0, 2).join(", ")}{via.length > 2 ? ` and ${via.length - 2} more` : ""}</small></button>
          {candidate === e.id ? <form className="ml-confirm" onSubmit={(event: FormEvent) => {
            event.preventDefault(); onConfirm(e, { reviewer, reason, relationship }); setCandidate(null); setReason("");
          }}>
            <label>Relationship<input required maxLength={120} value={relationship} onChange={ev => setRelationship(ev.target.value)}/></label>
            <label>Reviewed by<input required minLength={2} value={reviewer} onChange={ev => setReviewer(ev.target.value)}/></label>
            <label>Evidence and reason<textarea required minLength={10} value={reason} onChange={ev => setReason(ev.target.value)}/></label>
            <p className="ml-small">This adds a separate, auditable annotation. The imported source stays unchanged.</p>
            <div className="ml-confirm-actions"><button type="submit" className="ml-primary">Confirm relationship</button>
              <button type="button" onClick={() => setCandidate(null)}>Cancel</button></div>
          </form> : <button type="button" className="ml-link-button" onClick={() => setCandidate(e.id)}>Confirm with evidence…</button>}
        </li>;
      })}</ul>
      {pencil.length > 8 && <p className="ml-small">{pencil.length - 8} more suggestions; select one of the records above to explore further.</p>}
    </section>}

    <Sources node={node}/>
  </div>;
}
