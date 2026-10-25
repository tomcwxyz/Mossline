"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { evidenceReceipt, isRecorded, recordedYear, type FundingFlow, type GraphDocument, type GraphNode, type Grouping } from "@mossline/graph-core";
import { PALETTES, SHAPE, formatMoney, mix, type AtlasTheme } from "./palette";

export interface YearRange { from: number | null; to: number | null }
type Row = { year: number; total: number; segments: { key: string; count: number }[] };

function yearRows(graph: GraphDocument, splitByType: boolean) {
  const byYear = new Map<number, Map<string, number>>();
  let undated = 0;
  const typeTotals = new Map<string, number>();
  for (const e of graph.edges) {
    if (!isRecorded(e)) continue;
    const y = recordedYear(e);
    if (y === null) { undated++; continue; }
    const key = splitByType ? e.type : "all";
    typeTotals.set(key, (typeTotals.get(key) ?? 0) + 1);
    const m = byYear.get(y) ?? new Map<string, number>();
    m.set(key, (m.get(key) ?? 0) + 1); byYear.set(y, m);
  }
  const top = [...typeTotals].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
  const keys = splitByType && typeTotals.size > 5 ? [...top, "other"] : top;
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const rows: Row[] = [];
  if (years.length) for (let y = years[0]; y <= years[years.length - 1]; y++) {
    const m = byYear.get(y) ?? new Map<string, number>();
    const segments = keys.map(k => ({ key: k, count: k === "other"
      ? [...m].filter(([t]) => !top.includes(t)).reduce((s, [, c]) => s + c, 0) : m.get(k) ?? 0 }));
    rows.push({ year: y, total: segments.reduce((s, x) => s + x.count, 0), segments });
  }
  return { rows, undated, keys };
}

/** Recorded relationships per month, for maps whose dates fall within a few years. */
type MonthRow = { key: string; year: number; month: number; total: number };
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthRows(graph: GraphDocument, years: number[]): { rows: MonthRow[]; yearOnly: number } {
  const counts = new Map<string, number>();
  let yearOnly = 0;
  for (const e of graph.edges) {
    if (!isRecorded(e)) continue;
    const when = recordedWhen(e.properties);
    if (!when) continue;
    if (!when.precise) { yearOnly++; continue; }
    const y = Math.floor(when.t), m = Math.min(11, Math.floor((when.t - y) * 12 + 1e-6));
    counts.set(y + "-" + m, (counts.get(y + "-" + m) ?? 0) + 1);
  }
  const rows: MonthRow[] = [];
  for (const y of years) for (let m = 0; m < 12; m++) rows.push({ key: y + "-" + m, year: y, month: m, total: counts.get(y + "-" + m) ?? 0 });
  return { rows, yearOnly };
}
function MonthBars({ rows, height, colour }: { rows: MonthRow[]; height: number; colour: string }) {
  const max = Math.max(1, ...rows.map(r => r.total));
  return <div className="ml-yearbars ml-monthbars" style={{ height }} role="img"
    aria-label={"Recorded relationships per month: " + rows.filter(r => r.total).map(r => MONTH_NAMES[r.month] + " " + r.year + " " + r.total).join(", ")}>
    {rows.map(r => <div key={r.key} className="ml-yearbar" title={MONTH_NAMES[r.month] + " " + r.year + ": " + r.total + " recorded"}>
      <div className="ml-yearbar-stack"><i style={{ height: (r.total / max * 100) + "%", background: colour }}/></div>
      <span className="ml-yearbar-tick">{r.month === 0 ? r.year : rows.length <= 24 ? MONTHS[r.month] : ""}</span>
    </div>)}
  </div>;
}

/** Bars of recorded relationships per year, with a brush to choose a range. */
function YearBars({ rows, colours, range, onRange, height, labelEvery }: {
  rows: Row[]; colours: Record<string, string>; range: YearRange;
  onRange: (r: YearRange) => void; height: number; labelEvery: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);
  const max = Math.max(1, ...rows.map(r => r.total));
  const n = rows.length;
  const yearAt = (event: PointerEvent<HTMLDivElement>) => {
    const b = box.current!.getBoundingClientRect();
    const i = Math.min(n - 1, Math.max(0, Math.floor((event.clientX - b.left) / b.width * n)));
    return rows[i].year;
  };
  const active = drag ? { from: Math.min(drag.a, drag.b), to: Math.max(drag.a, drag.b) } : range;
  const inRange = (y: number) => (active.from === null || y >= active.from) && (active.to === null || y <= active.to);
  const filtered = active.from !== null || active.to !== null;
  if (!n) return null;
  return <div ref={box} className="ml-yearbars" style={{ height }} role="img"
    aria-label="Recorded relationships per year. Drag to choose a range, or use the year selectors."
    onPointerDown={e => { const y = yearAt(e); box.current?.setPointerCapture(e.pointerId); setDrag({ a: y, b: y }); }}
    onPointerMove={e => { if (drag) setDrag({ ...drag, b: yearAt(e) }); }}
    onPointerUp={() => {
      if (!drag) return;
      const from = Math.min(drag.a, drag.b), to = Math.max(drag.a, drag.b);
      setDrag(null);
      if (from === to && range.from === from && range.to === to) onRange({ from: null, to: null });
      else onRange({ from, to });
    }}>
    {rows.map((r, i) => <div key={r.year} className={"ml-yearbar" + (filtered && inRange(r.year) ? " is-in" : "") +
      (filtered && !inRange(r.year) ? " is-out" : "")} title={r.year + ": " + r.total + " recorded"}>
      <div className="ml-yearbar-stack">
        {r.segments.map(s => <i key={s.key} style={{ height: (s.count / max * 100) + "%", background: colours[s.key] ?? colours.all }}/>)}
      </div>
      <span className="ml-yearbar-tick">{i % labelEvery === 0 || i === n - 1 ? r.year : ""}</span>
    </div>)}
  </div>;
}
function RangeSelectors({ rows, range, onRange }: { rows: Row[]; range: YearRange; onRange: (r: YearRange) => void }) {
  return <div className="ml-range-selectors">
    <label>From<select aria-label="From year" value={range.from ?? ""} onChange={e => onRange({ ...range, from: e.target.value ? Number(e.target.value) : null })}>
      <option value="">Earliest</option>{rows.map(r => <option key={r.year} value={r.year}>{r.year}</option>)}</select></label>
    <label>To<select aria-label="To year" value={range.to ?? ""} onChange={e => onRange({ ...range, to: e.target.value ? Number(e.target.value) : null })}>
      <option value="">Latest</option>{rows.map(r => <option key={r.year} value={r.year}>{r.year}</option>)}</select></label>
  </div>;
}

/** The strip along the bottom of every canvas lens. */
export function TimeStrip({ graph, range, onRange, inView, theme }: {
  graph: GraphDocument; range: YearRange; onRange: (r: YearRange) => void; inView: number; theme: AtlasTheme;
}) {
  const { rows, undated } = useMemo(() => yearRows(graph, false), [graph]);
  const months = useMemo(() => rows.length && rows.length <= 2 ? monthRows(graph, rows.map(r => r.year)) : null, [graph, rows]);
  const total = graph.edges.filter(isRecorded).length;
  const palette = PALETTES[theme];
  const filtered = range.from !== null || range.to !== null;
  return <section className="ml-timestrip" aria-label="Time">
    <div className="ml-timestrip-head">
      <strong>Relationships recorded per {months ? "month" : "year"}</strong>
      <span className="ml-mono">{filtered ? `${range.from ?? "…"}–${range.to ?? "…"} · ` : ""}showing {inView.toLocaleString("en-GB")} of {total.toLocaleString("en-GB")}
        {undated ? ` · ${undated.toLocaleString("en-GB")} undated` : ""}</span>
      {filtered && <button type="button" className="ml-link-button" onClick={() => onRange({ from: null, to: null })}>Clear dates</button>}
      <RangeSelectors rows={rows} range={range} onRange={onRange}/>
    </div>
    {months ? <MonthBars rows={months.rows} height={52} colour={palette.moss}/> :
      rows.length ? <YearBars rows={rows} colours={{ all: palette.moss }} range={range} onRange={onRange}
      height={52} labelEvery={rows.length > 16 ? 4 : rows.length > 8 ? 2 : 1}/> :
      <p className="ml-timestrip-empty">No dates are recorded on these relationships.</p>}
  </section>;
}

type LaneMode = "funder" | "theme" | "relationship";
type Event = { id: string; t: number; precise: boolean; year: number; subject: GraphNode; other: GraphNode | null;
  type: string; amount: number | null; currency: string | null; ends: [string, string]; receipt: string };
type Lane = { key: string; label: string; node: GraphNode | null; events: Event[]; total: number | null; currency: string | null };

/** A date the source gives, as a fractional year. Year-only dates are flagged
 *  so they are spread across their year rather than drawn as a precise day. */
const DATE_KEYS = ["awarddate", "dateawarded", "date", "startdate", "fundingdate", "year"];
function recordedWhen(props: Record<string, unknown> | undefined): { t: number; precise: boolean } | null {
  if (!props) return null;
  const norm = new Map(Object.entries(props).map(([k, v]) => [k.toLowerCase().replace(/[^a-z]/g, ""), v]));
  for (const key of DATE_KEYS) {
    const v = norm.get(key);
    if (typeof v === "number" && Number.isInteger(v) && v >= 1800 && v <= 2200) return { t: v, precise: false };
    if (typeof v !== "string") continue;
    const full = v.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
    if (full) {
      const y = +full[1], m = +full[2], d = full[3] ? +full[3] : 15;
      if (y >= 1800 && y <= 2200 && m >= 1 && m <= 12) return { t: y + (m - 1) / 12 + (d - 1) / 365, precise: true };
    }
    const year = v.match(/(?:^|\D)(18\d{2}|19\d{2}|20\d{2}|21\d{2})(?:\D|$)/);
    if (year) return { t: +year[1], precise: false };
  }
  return null;
}
const SUBJECT_ORDER: Record<string, number> = { project: 0, organisation: 1, person: 2, place: 3, funder: 4 };

/** The Timeline lens: swimlanes of dated, recorded relationships. Rows by
 *  funder, theme or relationship; marks are what the source dates. */
export function TimelineLens({ graph, flows, range, onRange, theme, selectedId, onPick, grouping, groupLabel = "Themes" }: {
  graph: GraphDocument; flows: FundingFlow[]; range: YearRange; onRange: (r: YearRange) => void; theme: AtlasTheme;
  selectedId: string | null; onPick: (id: string | null) => void; grouping?: Grouping | null; groupLabel?: string;
}) {
  const palette = PALETTES[theme];
  const { rows, undated } = useMemo(() => yearRows(graph, false), [graph]);
  // A year or two of dates reads by month; longer spans by year.
  const months = useMemo(() => rows.length && rows.length <= 2 ? monthRows(graph, rows.map(r => r.year)) : null, [graph, rows]);
  const [mode, setMode] = useState<LaneMode>(flows.length ? "funder" : "theme");
  const [showAll, setShowAll] = useState(false);
  const plot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    const el = plot.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const byId = useMemo(() => new Map(graph.nodes.map(n => [n.id, n])), [graph]);

  const events = useMemo(() => {
    const list: Event[] = [];
    for (const e of graph.edges) {
      if (!isRecorded(e)) continue;
      const when = recordedWhen(e.properties);
      if (!when) continue;
      const a = byId.get(e.source), b = byId.get(e.target);
      if (!a || !b) continue;
      // The subject is the thing that happened: a project before an organisation, never the funder.
      const [subject, other] = (SUBJECT_ORDER[a.type] ?? 5) <= (SUBJECT_ORDER[b.type] ?? 5) ? [a, b] : [b, a];
      const amountRaw = e.properties?.["Amount Awarded"] ?? e.properties?.amountAwarded ?? e.properties?.amount;
      const amount = typeof amountRaw === "number" ? amountRaw : typeof amountRaw === "string" && amountRaw.trim() ? Number(amountRaw.replace(/[^0-9.]/g, "")) || null : null;
      const currency = typeof e.properties?.Currency === "string" ? e.properties.Currency as string : typeof e.properties?.currency === "string" ? e.properties.currency as string : null;
      list.push({ id: e.id, t: when.t, precise: when.precise, year: Math.floor(when.t), subject, other, type: e.type,
        amount, currency, ends: [e.source, e.target], receipt: evidenceReceipt(e) });
    }
    return list;
  }, [graph, byId]);

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of graph.nodes) for (const t of new Set(n.tags)) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  }, [graph]);
  const primaryTag = (n: GraphNode) => n.tags.length
    ? [...new Set(n.tags)].sort((a, b) => (tagCounts.get(b) ?? 0) - (tagCounts.get(a) ?? 0) || a.localeCompare(b))[0] : "No source tag";

  const lanes = useMemo(() => {
    const map = new Map<string, Lane>();
    const lane = (key: string, label: string, node: GraphNode | null) => {
      let l = map.get(key);
      if (!l) { l = { key, label, node, events: [], total: null, currency: null }; map.set(key, l); }
      return l;
    };
    if (mode === "funder") {
      // A grant is recorded by two links (funder → grant → recipient): count it once.
      const flowOf = new Map<string, FundingFlow>();
      for (const f of flows) for (const id of f.edgeIds) flowOf.set(id, f);
      const counted = new Set<string>();
      for (const ev of events) {
        const fl = flowOf.get(ev.id);
        if (!fl || counted.has(fl.id)) continue;
        counted.add(fl.id);
        const funder = [ev.subject, ev.other].find(n => n?.type === "funder") ?? null;
        const funderNode = funder ?? byId.get(fl.funderId) ?? null;
        if (!funderNode) continue;
        const l = lane(funderNode.id, funderNode.label, funderNode);
        l.events.push(ev);
        if (ev.amount !== null && ev.currency) {
          l.currency ??= ev.currency;
          if (ev.currency === l.currency) l.total = (l.total ?? 0) + ev.amount;
        }
      }
    } else if (mode === "theme") {
      for (const ev of events) {
        const g = grouping ? grouping.of.get(ev.subject.id) ?? (ev.other ? grouping.of.get(ev.other.id) : undefined) ?? "Not grouped" : primaryTag(ev.subject);
        lane(g, g, null).events.push(ev);
      }
    } else {
      for (const ev of events) lane(ev.type, ev.type, null).events.push(ev);
    }
    return [...map.values()].sort((a, b) => (b.total ?? 0) - (a.total ?? 0) || b.events.length - a.events.length
      || (a.key === "No source tag" || a.key === "Not grouped" ? 1 : 0) - (b.key === "No source tag" || b.key === "Not grouped" ? 1 : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, flows, mode, byId, tagCounts, grouping]);
  const shownLanes = showAll ? lanes : lanes.slice(0, 12);
  const inLanes = mode === "funder" ? lanes.reduce((s, l) => s + l.events.length, 0) : events.length;

  // x scale: one equal band per year, matching the brush's columns.
  const first = rows[0]?.year ?? 0, n = rows.length || 1, band = width / n;
  const xOf = (t: number) => (t - first) * band;
  const maxAmount = Math.max(1, ...events.map(e => e.amount ?? 0));
  const focus = (ev: Event) => !selectedId || ev.ends.includes(selectedId) || ev.subject.id === selectedId;
  const inRange = (y: number) => (range.from === null || y >= range.from) && (range.to === null || y <= range.to);
  const filtered = range.from !== null || range.to !== null;

  function laneMarks(l: Lane) {
    // Year-only dates are spaced evenly across their year; precise dates sit
    // on their day. Overlaps step into up to three tiers.
    const byYear = new Map<number, Event[]>();
    for (const ev of l.events) if (!ev.precise) byYear.set(ev.year, [...(byYear.get(ev.year) ?? []), ev]);
    const pos = new Map<string, number>();
    for (const [y, list] of byYear) {
      list.sort((a, b) => a.subject.label.localeCompare(b.subject.label));
      list.forEach((ev, i) => pos.set(ev.id, xOf(y) + band * (0.14 + 0.72 * (list.length === 1 ? 0.5 : i / (list.length - 1)))));
    }
    for (const ev of l.events) if (ev.precise) pos.set(ev.id, xOf(ev.t));
    const placed: { x: number; tier: number; r: number }[] = [];
    return [...l.events].sort((a, b) => (pos.get(a.id)! - pos.get(b.id)!)).map(ev => {
      const x = pos.get(ev.id)!;
      const r = ev.amount !== null ? 3 + 7 * Math.sqrt(ev.amount / maxAmount) : 4;
      let tier = 0;
      while (tier < 2 && placed.some(p => p.tier === tier && Math.abs(p.x - x) < p.r + r + 0.5)) tier++;
      placed.push({ x, tier, r });
      return { ev, x, y: 23 + (tier === 0 ? 0 : tier === 1 ? -10 : 10), r };
    });
  }
  /** A busy row is drawn as bars per month (or year): one mark per grant would be a solid smear. */
  const BUSY = 40;
  function laneBars(l: Lane) {
    const perYear = months ? 12 : 1;
    const slots = rows.length * perYear, w = width / slots;
    const sums = new Array<number>(slots).fill(0), counts = new Array<number>(slots).fill(0);
    const useMoney = l.currency !== null;
    for (const ev of l.events) {
      const i = Math.min(slots - 1, Math.max(0, Math.floor((ev.t - first) * perYear)));
      counts[i]++; if (useMoney && ev.currency === l.currency && ev.amount !== null) sums[i] += ev.amount;
    }
    const values = useMoney ? sums : counts;
    const max = Math.max(1, ...values);
    return values.map((v, i) => ({ i, x: i * w + w * 0.14, w: Math.max(1, w * 0.72), h: v ? Math.max(2, v / max * 38) : 0, v, n: counts[i],
      when: months ? MONTH_NAMES[i % 12] + " " + (first + Math.floor(i / 12)) : String(first + i), money: useMoney }));
  }
  const markColour = (node: GraphNode) => palette.types[node.type] ?? palette.types.other;
  const markShape = (ev: Event, x: number, y: number, r: number) => {
    const fill = focus(ev) ? markColour(ev.subject) : mix(markColour(ev.subject), palette.paper, 0.7);
    const common = { fill, stroke: palette.raised, strokeWidth: 1 };
    switch (SHAPE[ev.subject.type]) {
      case "square": return <rect x={x - r * 0.88} y={y - r * 0.88} width={r * 1.76} height={r * 1.76} rx={1.5} {...common}/>;
      case "diamond": return <path d={`M${x} ${y - r * 1.2}L${x + r * 1.2} ${y}L${x} ${y + r * 1.2}L${x - r * 1.2} ${y}Z`} {...common}/>;
      case "triangle": return <path d={`M${x} ${y - r}L${x + r} ${y + r * 0.8}L${x - r} ${y + r * 0.8}Z`} {...common}/>;
      default: return <circle cx={x} cy={y} r={r} {...common}/>;
    }
  };
  const selectedLane = selectedId && mode === "funder" ? selectedId : null;

  return <section className="ml-chart-page ml-timeline" aria-label="Timeline">
    <div className="ml-chart-head">
      <div>
        <h2 className="ml-chart-title">When things happened</h2>
        <p className="ml-chart-sub">Each row is a {mode === "funder" ? "funder, with its grants" : mode === "theme" ? (grouping?.suggested ? "suggested topic (not in your source)" : groupLabel.toLowerCase()) : "kind of relationship"}.
          Busy rows show {months ? "each month" : "each year"} as a bar{flows.length ? ", sized by money where amounts are recorded" : ""}; quieter rows show each dated record.
          {months ? " Use the year selectors to filter every lens." : " Drag across the bars to filter every lens to a range."}</p>
      </div>
      <div className="ml-timeline-controls">
        <div className="ml-segmented" role="group" aria-label="Rows by">
          {flows.length > 0 && <button type="button" aria-pressed={mode === "funder"} onClick={() => setMode("funder")}>Funders</button>}
          <button type="button" aria-pressed={mode === "theme"} onClick={() => setMode("theme")}>{grouping && grouping.kind !== "tags" ? groupLabel : "Themes"}</button>
          <button type="button" aria-pressed={mode === "relationship"} onClick={() => setMode("relationship")}>Relationships</button>
        </div>
        <RangeSelectors rows={rows} range={range} onRange={onRange}/>
      </div>
    </div>
    {rows.length ? <div className="ml-lanes">
      <div className="ml-lane ml-lane--brush">
        <div className="ml-lane-label"><span className="ml-mono">Recorded per {months ? "month" : "year"}</span></div>
        <div ref={plot} className="ml-lane-plot">
          {months ? <MonthBars rows={months.rows} height={64} colour={palette.moss}/>
            : <YearBars rows={rows} colours={{ all: palette.moss }} range={range} onRange={onRange} height={64}
            labelEvery={rows.length > 24 ? 4 : rows.length > 12 ? 2 : 1}/>}
        </div>
      </div>
      {shownLanes.map(l => {
        const busy = l.events.length > BUSY;
        const marks = busy ? [] : laneMarks(l);
        const bars = busy ? laneBars(l) : [];
        const isSel = selectedLane === l.key;
        return <div key={l.key} className={"ml-lane" + (isSel ? " is-selected" : "")}>
          <div className="ml-lane-label">
            {l.node ? <button type="button" onClick={() => onPick(l.node!.id)} aria-pressed={isSel}>{l.label}</button>
              : <span className={mode === "theme" ? "ml-lane-theme" : ""}>{l.label}</span>}
            <small className="ml-mono">{l.events.length.toLocaleString("en-GB")}{mode === "funder" ? " grants" : ""}
              {l.total !== null && l.currency ? " · " + formatMoney(l.total, l.currency) : ""}</small>
          </div>
          <svg className="ml-lane-plot" width={width} height={46} role="img"
            aria-label={`${l.label}: ${l.events.length} dated ${mode === "funder" ? "grants" : "relationships"}`}>
            {rows.map((r, i) => <rect key={r.year} x={i * band} y={0} width={band} height={46}
              className={"ml-lane-band" + (i % 2 ? " is-odd" : "") + (filtered && !inRange(r.year) ? " is-out" : "")}/>)}
            {months && rows.map((_, yi) => Array.from({ length: 11 }, (__, m) =>
              <line key={yi + "-" + m} x1={(yi * 12 + m + 1) * width / (rows.length * 12)} x2={(yi * 12 + m + 1) * width / (rows.length * 12)} y1={4} y2={42} className="ml-lane-month"/>))}
            {!busy && <line x1={0} x2={width} y1={23} y2={23} className="ml-lane-rule"/>}
            {busy && <line x1={0} x2={width} y1={42} y2={42} className="ml-lane-rule"/>}
            {bars.map(b => b.h > 0 && <rect key={b.i} x={b.x} y={42 - b.h} width={b.w} height={b.h} rx={1.5}
              fill={mode === "funder" ? palette.types.funder : palette.moss} fillOpacity={selectedLane && !isSel ? 0.35 : 0.85}>
              <title>{b.when + ": " + b.n.toLocaleString("en-GB") + (b.n === 1 ? " record" : " records") + (b.money && l.currency ? " · " + formatMoney(b.v, l.currency) : "")}</title>
            </rect>)}
            {marks.map(({ ev, x, y, r }) => <g key={ev.id} className="ml-lane-mark" opacity={filtered && !inRange(ev.year) ? 0.25 : 1}
              onClick={() => onPick(ev.subject.id)}>
              {markShape(ev, x, y, r)}
              <title>{[ev.subject.label, ev.type + (ev.other ? " · " + ev.other.label : ""),
                ev.precise ? new Date(Date.UTC(ev.year, 0, 1) + (ev.t - ev.year) * 365 * 864e5).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : String(ev.year),
                ev.amount !== null && ev.currency ? formatMoney(ev.amount, ev.currency) : "", ev.receipt].filter(Boolean).join(" · ")}</title>
            </g>)}
          </svg>
        </div>;
      })}
      {lanes.length > 12 && <button type="button" className="ml-link-button ml-lanes-more" onClick={() => setShowAll(v => !v)}>
        {showAll ? "Show fewer rows" : `Show all ${lanes.length} rows`}</button>}
      <p className="ml-lanes-note">
        {inLanes.toLocaleString("en-GB")} dated {mode === "funder" ? "grants" : "relationships"} drawn.
        {" "}Marks with only a year are spread across that year, not given an invented day.
        {undated > 0 && <> {undated.toLocaleString("en-GB")} recorded relationships have no date and are not drawn.</>}
        {mode === "funder" && <> Mark size follows the recorded amount.</>}
      </p>
    </div> : <p className="ml-chart-sub">No dates are recorded on these relationships.</p>}
  </section>;
}
