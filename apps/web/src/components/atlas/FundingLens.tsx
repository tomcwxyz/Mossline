"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sankey, sankeyJustify, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from "d3-sankey";
import { fundingTotals, isRecorded, placeName, type FundingFlow, type GraphDocument, type Grouping } from "@mossline/graph-core";
import { PALETTES, formatMoney, type AtlasTheme } from "./palette";

type Props = { graph: GraphDocument; flows: FundingFlow[]; theme: AtlasTheme; selectedId: string | null; onPick: (id: string | null) => void;
  grouping?: Grouping | null; groupLabel?: string };
type Kind = "funder" | "theme" | "region";
type N = { key: string; name: string; kind: Kind; id?: string; missing?: boolean; other?: boolean };
type L = { source: number; target: number; value: number; funderId?: string };
const NO_THEME = "Not grouped", NO_PLACE = "No place recorded";
/** How many named rows each column keeps; the rest are summed into one "other" row, never dropped. */
const KEEP = { funder: 10, theme: 8, region: 8 };

function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(900);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, Math.round(entry.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

export function FundingLens({ graph, flows, theme, selectedId, onPick, grouping, groupLabel = "Theme" }: Props) {
  const palette = PALETTES[theme];
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap);
  // Phones get ranked bars: a flow chart needs more width than a phone has.
  const narrowScreen = width < 640 || (typeof window !== "undefined" && window.innerWidth < 640);
  const byId = useMemo(() => new Map(graph.nodes.map(n => [n.id, n])), [graph]);
  const totals = useMemo(() => fundingTotals(flows), [flows]);
  const currency = totals[0]?.currency ?? null;
  const canMoney = !!currency;
  const [mode, setMode] = useState<"money" | "count">("money");
  const money = mode === "money" && canMoney;
  const used = useMemo(() => money ? flows.filter(f => f.amount !== null && f.currency === currency) : flows, [flows, money, currency]);
  // With a funder chosen, the other columns describe that funder's grants only.
  const chosenFunder = selectedId && byId.get(selectedId)?.type === "funder" ? selectedId : null;
  const scoped = useMemo(() => chosenFunder ? used.filter(f => f.funderId === chosenFunder) : used, [used, chosenFunder]);
  const unvalued = flows.length - (canMoney ? flows.filter(f => f.amount !== null && f.currency === currency).length : 0);

  const value = useMemo(() => (f: FundingFlow) => money ? f.amount ?? 0 : 1, [money]);
  // The middle column is the chosen grouping, unless it would repeat a column either side.
  const middle = !!grouping && grouping.kind !== "funder" && grouping.kind !== "place";
  const themeOf = useMemo(() => (f: FundingFlow) =>
    (grouping ? (f.grantId ? grouping.of.get(f.grantId) : undefined) ?? grouping.of.get(f.recipientId) : f.themes[0]) ?? NO_THEME, [grouping]);
  const regionOf = useMemo(() => {
    const cache = new Map<string, string>();
    return (f: FundingFlow) => {
      let v = cache.get(f.recipientId);
      if (v === undefined) { const n = byId.get(f.recipientId); v = (n && placeName(n)) || NO_PLACE; cache.set(f.recipientId, v); }
      return v;
    };
  }, [byId]);
  /** Ranked totals per column, with the tail folded into one "other" row. */
  const columns = useMemo(() => {
    const sum = (key: (f: FundingFlow) => string, list = scoped) => {
      const m = new Map<string, number>();
      for (const f of list) m.set(key(f), (m.get(key(f)) ?? 0) + value(f));
      return [...m].sort((a, b) => b[1] - a[1]);
    };
    const fold = (rows: [string, number][], keep: number, missing: string) => {
      const named = rows.filter(([k]) => k !== missing), gap = rows.find(([k]) => k === missing);
      const top = named.slice(0, keep), rest = named.slice(keep);
      return { top: top.map(([k]) => k), rows: [...top, ...(rest.length ? [["other", rest.reduce((s, [, v]) => s + v, 0)] as [string, number]] : []),
        ...(gap ? [gap] : [])], others: rest.length };
    };
    return { funder: fold(sum(f => f.funderId, used), KEEP.funder, ""), theme: fold(sum(themeOf), KEEP.theme, NO_THEME),
      region: fold(sum(regionOf), KEEP.region, NO_PLACE), recipient: fold(sum(f => f.recipientId), 10, "") };
  }, [used, scoped, value, themeOf, regionOf]);

  const chart = useMemo(() => {
    if (!used.length || narrowScreen) return null;
    const nodes: N[] = [], index = new Map<string, number>();
    const node = (key: string, name: string, kind: Kind, extra: Partial<N> = {}) => {
      if (!index.has(key)) { index.set(key, nodes.length); nodes.push({ key, name, kind, ...extra }); }
      return index.get(key)!;
    };
    const agg = new Map<string, L>();
    const add = (s: number, t: number, v: number, funderId?: string) => {
      const k = s + ">" + t; const l = agg.get(k) ?? { source: s, target: t, value: 0, funderId };
      l.value += v; agg.set(k, l);
    };
    const fKey = (f: FundingFlow) => columns.funder.top.includes(f.funderId) ? f.funderId : "other";
    const tKey = (f: FundingFlow) => { const t = themeOf(f); return t === NO_THEME || columns.theme.top.includes(t) ? t : "other"; };
    const rKey = (f: FundingFlow) => { const r = regionOf(f); return r === NO_PLACE || columns.region.top.includes(r) ? r : "other"; };
    for (const [k] of chosenFunder ? [[chosenFunder, 0] as [string, number]] : columns.funder.rows) k === "other"
      ? node("f:other", columns.funder.others + " other funders", "funder", { other: true })
      : node("f:" + k, byId.get(k)?.label ?? k, "funder", { id: k });
    if (middle) for (const [k] of columns.theme.rows)
      node("t:" + k, k === "other" ? columns.theme.others + " more" : k, "theme", { missing: k === NO_THEME, other: k === "other" });
    for (const [k] of columns.region.rows)
      node("r:" + k, k === "other" ? columns.region.others + " more places" : k, "region", { missing: k === NO_PLACE, other: k === "other" });
    for (const f of scoped) {
      const fi = index.get("f:" + fKey(f))!, ri = index.get("r:" + rKey(f))!;
      if (middle) { const ti = index.get("t:" + tKey(f))!; add(fi, ti, value(f), f.funderId); add(ti, ri, value(f)); }
      else add(fi, ri, value(f), f.funderId);
    }
    const height = Math.max(360, Math.min(560, nodes.length * 22));
    const left = Math.min(220, width * 0.24), right = Math.min(210, width * 0.22);
    const layout = sankey<N, L>().nodeWidth(10).nodePadding(10).nodeAlign(sankeyJustify)
      .nodeSort(null).extent([[left, 12], [width - right, height - 12]]);
    const graphOut = layout({ nodes: nodes.map(n => ({ ...n })), links: [...agg.values()].map(l => ({ ...l })) });
    return { ...graphOut, height, narrow: false };
  }, [used, scoped, chosenFunder, value, byId, width, columns, themeOf, regionOf, middle, narrowScreen]);

  const highlightFunders = useMemo(() => {
    const set = new Set<string>();
    if (!selectedId) return set;
    const sel = byId.get(selectedId);
    if (sel?.type === "funder") set.add(selectedId);
    else for (const f of flows) if (f.recipientId === selectedId) set.add(f.funderId);
    return set;
  }, [selectedId, byId, flows]);

  // Organisations reached by each funder: direct recipients, or the
  // organisations recorded as delivering a funded project.
  const matrix = useMemo(() => {
    const deliverers = new Map<string, Set<string>>();
    for (const e of graph.edges) if (isRecorded(e)) {
      const s = byId.get(e.source), t = byId.get(e.target);
      if (!s || !t) continue;
      if (s.type === "organisation" && t.type !== "funder") deliverers.set(t.id, (deliverers.get(t.id) ?? new Set()).add(s.id));
      if (t.type === "organisation" && s.type !== "funder") deliverers.set(s.id, (deliverers.get(s.id) ?? new Set()).add(t.id));
    }
    const reach = new Map<string, Set<string>>();
    for (const f of flows) {
      const r = byId.get(f.recipientId);
      const orgs = r?.type === "organisation" ? [r.id] : [...(deliverers.get(f.recipientId) ?? [])];
      const set = reach.get(f.funderId) ?? new Set<string>();
      orgs.forEach(o => set.add(o)); reach.set(f.funderId, set);
    }
    const funders = [...reach].filter(([, s]) => s.size > 0).sort((a, b) => b[1].size - a[1].size).slice(0, 12).map(([id]) => id);
    const cells = funders.map(a => funders.map(b => a === b ? reach.get(a)!.size
      : [...reach.get(a)!].filter(x => reach.get(b)!.has(x)).length));
    const pairs: { a: string; b: string; n: number }[] = [];
    funders.forEach((a, i) => funders.forEach((b, j) => { if (j > i && cells[i][j] > 0) pairs.push({ a, b, n: cells[i][j] }); }));
    return { funders, cells, pairs: pairs.sort((x, y) => y.n - x.n).slice(0, 4),
      max: Math.max(1, ...cells.flatMap((row, i) => row.filter((_, j) => j !== i))) };
  }, [flows, graph, byId]);

  const short = (id: string) => (byId.get(id)?.label ?? id).replace(/ (Foundation|Trust|Fund)$/, "");
  const scopedTotal = scoped.reduce((s, f) => s + value(f), 0);
  const headline = chosenFunder
    ? `${byId.get(chosenFunder)?.label}: ${money && currency ? formatMoney(scopedTotal, currency) + " across " : ""}${scoped.length.toLocaleString("en-GB")} ${scoped.length === 1 ? "grant" : "grants"}`
    : money && currency
    ? `${formatMoney(totals[0].total, currency)} across ${totals[0].valued.toLocaleString("en-GB")} grants`
    : `${flows.length.toLocaleString("en-GB")} recorded funding links`;
  if (!flows.length) return <section className="ml-chart-page" aria-label="Funding">
    <h2 className="ml-chart-title">No recorded funding</h2>
    <p className="ml-chart-sub">No relationships in this view connect a funder to a recipient. Funding appears here when your
      source records a funder relationship or grant awards.</p>
  </section>;
  return <section className="ml-chart-page" aria-label="Funding">
    <div className="ml-chart-head">
      <div>
        <h2 className="ml-chart-title">{headline}</h2>
        {chosenFunder && <button type="button" className="ml-link-button" onClick={() => onPick(null)}>← All funders</button>}
        <p className="ml-chart-sub">From funder{middle ? <>, through {groupLabel.toLowerCase()}{grouping?.suggested ? " (suggested, not in your source)" : ""}</> : ""},
          to where each recipient is. The largest are named; the rest are added up, not left out.
          {money ? " Band widths are money." : " Band widths are numbers of recorded links."}
          {money && unvalued > 0 && <> {unvalued.toLocaleString("en-GB")} links have no recorded {currency} amount and are left out, not counted as zero.</>}</p>
      </div>
      {canMoney && <div className="ml-segmented" role="group" aria-label="Measure">
        <button type="button" aria-pressed={money} onClick={() => setMode("money")}>{formatMoney(0, currency).replace(/0.*/, "") || currency}</button>
        <button type="button" aria-pressed={!money} onClick={() => setMode("count")}>Links</button>
      </div>}
    </div>
    <div ref={wrap} className="ml-sankey-wrap">
      {chart && <svg className="ml-sankey" width={width} height={chart.height} role="group"
        aria-label={"Funding flows: " + headline}>
        {chart.links.map((l: SankeyLink<N, L>, i: number) => {
          const s = l.source as SankeyNode<N, L>;
          const fromFunder = s.kind === "funder";
          const lit = fromFunder && highlightFunders.size > 0 && highlightFunders.has(s.id ?? "");
          const quiet = highlightFunders.size > 0 && !lit;
          return <path key={i} d={sankeyLinkHorizontal()(l) ?? undefined} fill="none"
            stroke={fromFunder ? palette.types.funder : palette.moss}
            strokeOpacity={lit ? 0.58 : quiet ? (fromFunder ? 0.08 : 0.1) : fromFunder ? 0.2 : 0.16}
            strokeWidth={Math.max(1, l.width ?? 1)}>
            <title>{(s.name) + " → " + ((l.target as SankeyNode<N, L>).name) + ": " +
              (money ? formatMoney(l.value, currency) : l.value + " links")}</title>
          </path>;
        })}
        {chart.nodes.map((n: SankeyNode<N, L>) => {
          const x0 = n.x0 ?? 0, x1 = n.x1 ?? 0, y0 = n.y0 ?? 0, y1 = n.y1 ?? 0;
          const fill = n.kind === "funder" ? palette.types.funder : n.kind === "theme" ? palette.moss : palette.types.place;
          const label = (money ? formatMoney(n.value ?? 0, currency) : (n.value ?? 0).toLocaleString("en-GB"));
          const mid = (y0 + y1) / 2;
          const tall = y1 - y0 > 12 || !chart.narrow;
          return <g key={n.key} className={"ml-sankey-node ml-sankey-node--" + n.kind}>
            <rect x={x0} y={y0} width={x1 - x0} height={Math.max(1, y1 - y0)} fill={fill}
              fillOpacity={n.missing ? 0.35 : 1} stroke={n.missing ? fill : "none"} strokeDasharray={n.missing ? "2 2" : undefined}/>
            {n.kind === "funder" && n.id
              ? <foreignObject x={chart.narrow ? x1 + 4 : 0} y={mid - 11} width={chart.narrow ? 160 : x0 - 6} height={22}>
                  <button type="button" className={"ml-sankey-funder" + (highlightFunders.has(n.id) ? " is-selected" : "")}
                    onClick={() => onPick(n.id ?? null)} title={n.name}><em>{n.name}</em><span>{label}</span></button>
                </foreignObject>
              : n.kind === "funder" ? <text x={x0 - 8} y={mid} textAnchor="end" className="ml-sankey-label is-missing"><tspan dy="0.35em">{n.name}</tspan>
                  <tspan dx="6" className="ml-sankey-value">{label}</tspan></text>
              : tall && <text x={n.kind === "region" && !chart.narrow ? x1 + 8 : x1 + 6} y={mid}
                  className={"ml-sankey-label ml-sankey-label--" + n.kind + (n.missing ? " is-missing" : "")}>
                  <tspan dy={n.kind === "theme" ? "-0.1em" : "0.35em"}>{n.name}</tspan>
                  {n.kind === "theme" ? <tspan x={x1 + 6} dy="1.25em" className="ml-sankey-value">{label}</tspan>
                    : <tspan dx="6" className="ml-sankey-value">{label}</tspan>}
                </text>}
          </g>;
        })}
      </svg>}
      {(!chart || chosenFunder) && used.length > 0 && <div className="ml-funding-bars">
        {((chart ? [["Largest recipients", columns.recipient, "recipient"]]
          : chosenFunder ? [["Largest recipients", columns.recipient, "recipient"], ...(middle ? [[groupLabel, columns.theme, "theme"]] : []),
            ["Where recipients are", columns.region, "region"], ["All funders", columns.funder, "funder"]]
          : [["Largest funders", columns.funder, "funder"], ...(middle ? [[groupLabel, columns.theme, "theme"]] : []),
            ["Where recipients are", columns.region, "region"]]) as
          [string, typeof columns.funder, Kind | "recipient"][]).map(([title, col, kind]) => {
          // Scale to the named rows: the summed "other" row would flatten them.
          const max = Math.max(1, ...col.rows.filter(([k]) => k !== "other").map(([, v]) => v));
          return <section key={title}><h3 className="ml-section-title">{title}</h3>
            <ol>{col.rows.map(([k, v]) => {
              const name = k === "other" ? col.others + (kind === "funder" ? " other funders" : " more")
                : kind === "funder" || kind === "recipient" ? byId.get(k)?.label ?? k : k;
              const label = <><span>{name}</span><i><b style={{ width: Math.min(100, v / max * 100) + "%", background: kind === "funder" ? palette.types.funder : kind === "recipient" ? palette.types.organisation : kind === "theme" ? palette.moss : palette.types.place }}/></i>
                <span className="ml-mono">{money ? formatMoney(v, currency) : v.toLocaleString("en-GB")}</span></>;
              return <li key={k} className={k === "other" || k === NO_THEME || k === NO_PLACE ? "is-quiet" : ""}>
                {(kind === "funder" || kind === "recipient") && k !== "other"
                  ? <button type="button" aria-pressed={kind === "funder" ? highlightFunders.has(k) : selectedId === k} onClick={() => onPick(k)}>{label}</button>
                  : <div>{label}</div>}</li>;
            })}</ol></section>;
        })}
      </div>}
    </div>
    {matrix.funders.length > 1 && <div className="ml-cofunding">
      <div>
        <h3 className="ml-section-title">Who funds alongside whom</h3>
        <p className="ml-chart-sub">Each cell counts organisations both funders have reached, directly or through a funded project
          they deliver. The diagonal is each funder&rsquo;s own total. Overlap means the same organisations, not coordinated funding.</p>
        <ol className="ml-overlaps">
          {matrix.pairs.map(p => <li key={p.a + p.b}><span>{byId.get(p.a)?.label} &amp; {byId.get(p.b)?.label}</span><b>{p.n}</b></li>)}
        </ol>
      </div>
      <table className="ml-matrix">
        <caption className="ml-visually-hidden">Organisations reached by both funders</caption>
        <thead><tr><td/>{matrix.funders.map(id => <th key={id} scope="col"><span>{short(id)}</span></th>)}</tr></thead>
        <tbody>{matrix.funders.map((a, i) => <tr key={a}>
          <th scope="row">{short(a)}</th>
          {matrix.cells[i].map((v, j) => {
            const self = i === j, t = self ? 0 : v / matrix.max;
            // Shade stops short of full strength so the figures keep AA contrast in both themes.
            const cap = theme === "night" ? 45 : 55;
            return <td key={j} className={self ? "is-self" : ""}
              style={self ? undefined : { background: `color-mix(in srgb, ${palette.types.funder} ${Math.round(6 + t * (cap - 6))}%, ${palette.raised})` }}>
              {self || t > 0.5 ? v : <span className="ml-visually-hidden">{v}</span>}</td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}
