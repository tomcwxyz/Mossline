"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import { isRecorded, recordedYear, type FundingFlow, type GraphDocument } from "@mossline/graph-core";
import { PALETTES, formatMoney, type AtlasTheme } from "./palette";

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
  const total = graph.edges.filter(isRecorded).length;
  const palette = PALETTES[theme];
  const filtered = range.from !== null || range.to !== null;
  return <section className="ml-timestrip" aria-label="Time">
    <div className="ml-timestrip-head">
      <strong>Relationships recorded per year</strong>
      <span className="ml-mono">{filtered ? `${range.from ?? "…"}–${range.to ?? "…"} · ` : ""}showing {inView.toLocaleString("en-GB")} of {total.toLocaleString("en-GB")}
        {undated ? ` · ${undated.toLocaleString("en-GB")} undated` : ""}</span>
      {filtered && <button type="button" className="ml-link-button" onClick={() => onRange({ from: null, to: null })}>Clear dates</button>}
      <RangeSelectors rows={rows} range={range} onRange={onRange}/>
    </div>
    {rows.length ? <YearBars rows={rows} colours={{ all: palette.moss }} range={range} onRange={onRange}
      height={52} labelEvery={rows.length > 16 ? 4 : rows.length > 8 ? 2 : 1}/> :
      <p className="ml-timestrip-empty">No dates are recorded on these relationships.</p>}
  </section>;
}

/** The Timeline lens: the same brush, at full size, split by relationship type. */
export function TimelineLens({ graph, flows, range, onRange, theme }: {
  graph: GraphDocument; flows: FundingFlow[]; range: YearRange; onRange: (r: YearRange) => void; theme: AtlasTheme;
}) {
  const palette = PALETTES[theme];
  const { rows, undated, keys } = useMemo(() => yearRows(graph, true), [graph]);
  const ramp = [palette.types.organisation, palette.types.project, palette.types.funder, palette.types.person, palette.types.place, palette.pencil];
  const colours = Object.fromEntries(keys.map((k, i) => [k, ramp[i % ramp.length]]));
  const money = useMemo(() => {
    const byYear = new Map<number, number>();
    let currency: string | null = null;
    for (const f of flows) if (f.amount !== null && f.year !== null && f.currency) {
      currency ??= f.currency;
      if (f.currency === currency) byYear.set(f.year, (byYear.get(f.year) ?? 0) + f.amount);
    }
    return { byYear, currency };
  }, [flows]);
  const moneyMax = Math.max(1, ...money.byYear.values());
  return <section className="ml-chart-page" aria-label="Timeline">
    <div className="ml-chart-head">
      <div>
        <h2 className="ml-chart-title">When things happened</h2>
        <p className="ml-chart-sub">Recorded relationships by the year your source gives them. Drag across the bars to filter
          every lens to a range. {undated > 0 && <>{undated.toLocaleString("en-GB")} relationships have no date and are never given an invented one.</>}</p>
      </div>
      <RangeSelectors rows={rows} range={range} onRange={onRange}/>
    </div>
    {rows.length ? <>
      <YearBars rows={rows} colours={colours} range={range} onRange={onRange} height={260}
        labelEvery={rows.length > 24 ? 4 : rows.length > 12 ? 2 : 1}/>
      <ul className="ml-type-key">{keys.map(k => <li key={k}><i style={{ background: colours[k] }}/>{k === "other" ? "Other relationships" : k}</li>)}</ul>
      {money.currency && money.byYear.size > 0 && <div className="ml-money-years">
        <h3 className="ml-section-title">Recorded awards by year</h3>
        <ol>{rows.map(r => {
          const v = money.byYear.get(r.year) ?? 0;
          return <li key={r.year}><span className="ml-mono">{r.year}</span>
            <span className="ml-money-bar"><i style={{ width: (v / moneyMax * 100) + "%", background: palette.types.funder }}/></span>
            <span className="ml-mono">{v ? formatMoney(v, money.currency) : "—"}</span></li>;
        })}</ol>
      </div>}
    </> : <p className="ml-chart-sub">No dates are recorded on these relationships.</p>}
  </section>;
}
