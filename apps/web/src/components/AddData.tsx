"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { describeIdentifier, type GraphDocument, type NodeType, type Shape, type UseMode } from "@mossline/graph-core";
import type { AddCommand, AddMessage, AddReport, MapFile, TableInfo } from "../workers/add-data.worker";
import { useAtlasTheme } from "./atlas/theme";
import { ThemeButton, Wordmark } from "./atlas/Wordmark";
import { TypeMark } from "./atlas/RecordPanel";
import { TYPE_LABEL, TYPE_PLURAL } from "./atlas/palette";

/**
 * One way in for every kind of file: 360Giving grants, register downloads,
 * Kumu maps and ordinary spreadsheets. Each table is read by a shape (what a
 * row means), joined to the rest on identifiers, and checked by the person
 * before anything is saved.
 */
const SAMPLE_FILES = ["360giving-grants.csv", "360giving-grants.json", "publicextract.charity.txt", "publicextract.charity_trustee.txt",
  "publicextract.charity_classification.txt", "companies-house.csv", "kumu-map.xlsx"];
const REGISTER = /^(charity-commission|companies-house)/;
const ALWAYS_FILL = new Set(["charity-commission-classification", "charity-commission-area", "charity-commission-trustees"]);
const NAMES_PEOPLE = new Set(["charity-commission-trustees"]);
const TYPES: NodeType[] = ["organisation", "project", "funder", "person", "place", "topic", "other"];
const ATTRIBUTION = "Approximate places use postcode data from the ONS Postcode Directory: contains OS data © Crown copyright and database right 2026; " +
  "contains Royal Mail data © Royal Mail copyright and database right 2026; source: Office for National Statistics, Open Government Licence v3.0. " +
  "Northern Ireland postcodes are not included.";

type Plan = { include: boolean; match: number; use: UseMode; labelColumn: string; type: NodeType | "" };
type Phase = "choose" | "plan" | "review";
export type AddTarget = "add" | "new";

const bytes = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB";
const count = (n: number, one: string, many = one + "s") => n.toLocaleString("en-GB") + " " + (n === 1 ? one : many);
const shapeOf = (t: TableInfo, p: Plan): Shape => {
  const m = t.matches[p.match]?.shape;
  if (!m || t.matches[p.match].builtIn || !m.records.length) return m;
  const [first, ...rest] = m.records;
  return { ...m, records: [{ ...first, ...(p.labelColumn ? { label: "{" + p.labelColumn + "}" } : {}),
    ...(p.type ? { type: p.type, typeFallback: p.type } : {}) }, ...rest] };
};

export function AddData({ base, baseTitle, canAddToBase, startWith = "new", intent = "general", onClose, onCommit, onLargeFunding }: {
  base: GraphDocument | null; baseTitle: string; canAddToBase: boolean; startWith?: AddTarget; intent?: "general" | "funding";
  /** Saves the result; resolves to true, or to a message saying why it could not. */
  onClose: () => void; onCommit: (graph: GraphDocument, target: AddTarget, title: string, summary: string) => Promise<true | string>;
  onLargeFunding?: () => void;
}) {
  const [theme, chooseTheme] = useAtlasTheme();
  const worker = useRef<Worker | null>(null);
  const request = useRef(0);
  const [phase, setPhase] = useState<Phase>("choose");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [maps, setMaps] = useState<(MapFile & { include: boolean })[]>([]);
  const [problems, setProblems] = useState<{ file: string; message: string }[]>([]);
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  const [report, setReport] = useState<AddReport | null>(null);
  const [merge, setMerge] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<AddTarget>(canAddToBase ? startWith : "new");
  const [title, setTitle] = useState("");
  const [consent, setConsent] = useState(false);
  const [exactNote, setExactNote] = useState("");
  const [dragging, setDragging] = useState(false);
  const pending = useRef<Map<number, (m: AddMessage) => void>>(new Map());
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const w = new Worker(new URL("../workers/add-data.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (event: MessageEvent<AddMessage>) => {
      const m = event.data;
      if (m.id !== request.current) return;
      if (m.kind === "stage") { setBusy(m.message); return; }
      const done = pending.current.get(m.id);
      pending.current.delete(m.id);
      setBusy("");
      if (m.kind === "failed") { setError(m.message); return; }
      done?.(m);
    };
    w.onerror = () => { setBusy(""); setError("The file reader stopped unexpectedly. Try fewer or smaller files."); };
    return () => { w.terminate(); worker.current = null; };
  }, []);
  useEffect(() => { heading.current?.focus(); }, [phase]);

  const send = useCallback((command: AddCommand, start: string, then: (m: AddMessage) => void) => {
    if (!worker.current) return;
    request.current = command.id;
    pending.current.set(command.id, then);
    setError(""); setBusy(start);
    worker.current.postMessage(command);
  }, []);

  /* ---- 1. Files ---------------------------------------------------------- */
  const readFiles = useCallback((files: File[], name?: string) => {
    if (!files.length) return;
    send({ kind: "read", id: ++request.current, files }, "Opening your files…", m => {
      if (m.kind !== "tables") return;
      const register = (t: TableInfo) => REGISTER.test(t.matches[0]?.shape.id ?? "");
      const others = m.tables.some(t => !register(t)) || m.maps.length > 0;
      const haveRecords = (target === "add" && (base?.nodes.length ?? 0) > 0) || others;
      const next: Record<string, Plan> = {};
      for (const t of m.tables) {
        const id = t.matches[0]?.shape.id ?? "";
        const fill = t.large || ALWAYS_FILL.has(id) || (register(t) && haveRecords);
        next[t.name] = { include: true, match: 0, use: fill ? "fill" : "records", labelColumn: "", type: "" };
      }
      setTables(m.tables); setMaps(m.maps.map(x => ({ ...x, include: true }))); setProblems(m.problems);
      setPlans(next); setReport(null); setMerge(new Set());
      setTitle(t => name ?? (t || (m.tables[0]?.file.replace(/\.(csv|tsv|txt|json|xlsx)$/i, "").replace(/[_.-]+/g, " ") ?? m.maps[0]?.title ?? "New map")));
      if (m.tables.length || m.maps.length) setPhase("plan");
    });
  }, [send, target, base]);
  async function trySamples() {
    setBusy("Fetching the sample files…");
    try {
      const files = await Promise.all(SAMPLE_FILES.map(async name => {
        const res = await fetch("/samples/" + name);
        if (!res.ok) throw Error(name);
        return new File([await res.blob()], name);
      }));
      readFiles(files, "Invented sample data");
    } catch { setBusy(""); setError("Could not fetch the sample files."); }
  }
  const onDrop = (event: DragEvent) => { event.preventDefault(); setDragging(false); readFiles(Array.from(event.dataTransfer.files)); };

  /* ---- 2. Plan ------------------------------------------------------------ */
  const update = (name: string, change: Partial<Plan>) => setPlans(p => ({ ...p, [name]: { ...p[name], ...change } }));
  const chosen = tables.filter(t => plans[t.name]?.include);
  const anyRecords = chosen.some(t => plans[t.name].use === "records") || maps.some(m => m.include) || (target === "add" && !!base?.nodes.length);
  function preview() {
    const baseGraph = target === "add" ? base : null;
    send({ kind: "apply", id: ++request.current, base: baseGraph, title: title.trim() || "New map", maps: maps.filter(m => m.include).map(m => m.file),
      plans: chosen.map(t => ({ table: t.name, shape: shapeOf(t, plans[t.name]), use: plans[t.name].use })) },
    "Reading every row…", m => {
      if (m.kind !== "result") return;
      setReport(m.report); setMerge(new Set()); setConsent(false); setExactNote(""); setPhase("review");
    });
  }

  /* ---- 3. Review ---------------------------------------------------------- */
  function lookUpExact() {
    send({ kind: "exact", id: ++request.current }, "Looking up postcodes…", m => {
      if (m.kind !== "exact-done" || !report) return;
      setReport({ ...report, places: m.places });
      setExactNote(m.failed ?? ("Placed " + count(m.found, "record") + " at their postcode" +
        (m.asked > m.found ? "; " + count(m.asked - m.found, "postcode") + " not found and left as before." : ".")));
      setConsent(false);
    });
  }
  function finish() {
    const merges = (report?.sameName ?? []).filter(c => merge.has(c.a + "\u0000" + c.b)).map(c => [c.a, c.b] as [string, string]);
    send({ kind: "finish", id: ++request.current, merges }, "Saving…", async m => {
      if (m.kind !== "graph") return;
      setBusy("Saving in this browser…");
      const t = report?.totals;
      const parts = t ? [t.newRecords ? count(t.newRecords, "new record") : "", t.filledIn ? t.filledIn.toLocaleString("en-GB") + " filled in" : "",
        t.newLinks ? count(t.newLinks, "new recorded link") : "", merges.length ? count(merges.length, "pair") + " merged" : ""].filter(Boolean) : [];
      const summary = (parts.length ? parts.join(", ") + ". " : "") + "Every record keeps a receipt for its source rows.";
      const saved = await onCommit(m.graph, target, title.trim() || "New map", summary.charAt(0).toUpperCase() + summary.slice(1));
      setBusy("");
      if (saved !== true) setError(saved + " Your files are still open here.");
    });
  }

  const steps: [Phase, string][] = [["choose", "Files"], ["plan", "What each adds"], ["review", "Check and add"]];
  const stepIndex = steps.findIndex(s => s[0] === phase);
  const places = report?.places;
  const approxCount = places ? (places.placed["postcode sector"] ?? 0) + (places.placed["postcode district"] ?? 0) : 0;
  const exactCount = places?.placed.postcode ?? 0;
  const toLookUp = places?.postcodesToLookUp.length ?? 0;
  const addedByType = useMemo(() => {
    const m = new Map<NodeType, number>();
    for (const t of report?.tables ?? []) for (const [k, v] of Object.entries(t.added)) m.set(k as NodeType, (m.get(k as NodeType) ?? 0) + (v ?? 0));
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [report]);

  return <main className="ml-atlas ml-add" data-theme={theme}>
    <header className="ml-home-header ml-add-header">
      <Wordmark/>
      <span className="ml-add-title">Add data{target === "add" && canAddToBase ? <> to <strong>{baseTitle}</strong></> : null}</span>
      <div className="ml-home-header-actions">
        <span className="ml-local"><i aria-hidden="true"/>Read in this browser</span>
        <ThemeButton theme={theme} onChange={chooseTheme}/>
        <button type="button" className="ml-quiet" onClick={onClose}>Close</button>
      </div>
    </header>

    <div className="ml-add-body">
      <ol className="ml-add-steps" aria-label="Steps">
        {steps.map(([id, label], i) => <li key={id} aria-current={i === stepIndex ? "step" : undefined} className={i < stepIndex ? "is-done" : ""}>
          {i < stepIndex ? <button type="button" onClick={() => setPhase(id)} disabled={!!busy}><b>{i + 1}</b>{label}</button>
            : <span><b>{i + 1}</b>{label}</span>}</li>)}
      </ol>

      {error && <p className="ml-add-error" role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss">×</button></p>}
      {busy && <p className="ml-add-busy" role="status"><span className="ml-add-spinner" aria-hidden="true"/>{busy}</p>}

      {phase === "choose" && <section className="ml-add-choose" aria-labelledby="add-h">
        <div className="ml-add-intro">
          <p className="ml-start-eyebrow">{intent === "funding" ? "Grants and funders" : "Your records, any shape"}</p>
          <h1 id="add-h" ref={heading} tabIndex={-1}>{intent === "funding" ? "Bring in grants data" : "Bring in your data"}</h1>
          <p className="ml-add-lede">Add one file or several at once. Mossline works out what each table is, joins them on registered
            numbers and other identifiers, and shows you what will change before anything is saved.</p>
        </div>
        <label className={"ml-add-drop" + (dragging ? " is-over" : "")} onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)} onDrop={onDrop}>
          <input type="file" multiple accept=".csv,.tsv,.txt,.json,.xlsx,text/csv,application/json" className="ml-visually-hidden"
            onChange={e => { readFiles(Array.from(e.currentTarget.files ?? [])); e.currentTarget.value = ""; }}/>
          <svg viewBox="0 0 64 48" aria-hidden="true"><path d="M10 38L22 14L34 30L42 22L54 38Z" className="ml-add-drop-wash"/>
            <circle cx="22" cy="14" r="4" className="ml-sk-org"/><rect x="38.5" y="18.5" width="7" height="7" rx="1.4" className="ml-sk-project"/>
            <path d="M22 14Q34 8 42 22" className="ml-sk-ink"/></svg>
          <strong>Drop files here, or choose files</strong>
          <small>CSV, tab-separated text, Excel (.xlsx) or JSON · several at once is fine</small>
        </label>
        <div className="ml-add-knows">
          <h2 className="ml-section-title">Recognised straight away</h2>
          <ul>
            <li><TypeMark type="funder"/><span><strong>360Giving grants</strong><small>From GrantNav or a funder&rsquo;s own file, CSV or JSON</small></span></li>
            <li><TypeMark type="organisation"/><span><strong>Charity Commission register</strong><small>The register, trustees, &lsquo;what and who&rsquo; and areas of operation tables</small></span></li>
            <li><TypeMark type="organisation"/><span><strong>Companies House</strong><small>Free company data or an advanced search download</small></span></li>
            <li><TypeMark type="project"/><span><strong>Kumu</strong><small>Excel export with Elements and Connections, or a JSON blueprint</small></span></li>
            <li><TypeMark type="other"/><span><strong>Any other spreadsheet</strong><small>A row per organisation, project or person, or a row per link</small></span></li>
          </ul>
          <p className="ml-small">Very large register files (hundreds of megabytes) are read in passes and only rows about your
            records are kept.</p>
        </div>
        <div className="ml-add-try">
          <button type="button" className="ml-quiet" onClick={() => void trySamples()} disabled={!!busy}>Try it with sample files</button>
          <span className="ml-small">Seven small files in these formats. Every name and number in them is invented.</span>
        </div>
        {intent === "funding" && onLargeFunding && <p className="ml-small ml-add-legacy">More than 100,000 grants in one file?
          <button type="button" className="ml-link-button" onClick={onLargeFunding}>Use the complete funding explorer</button></p>}
        <p className="ml-start-privacy">Nothing is uploaded. Files are read on this device and saved only in this browser.</p>
      </section>}

      {phase === "plan" && <section className="ml-add-stack" aria-labelledby="plan-h">
        <div className="ml-add-intro">
          <h1 id="plan-h" ref={heading} tabIndex={-1}>What each file adds</h1>
          <p className="ml-add-lede">Check how each table has been read. <strong>Add as records</strong> brings every row in.
            <strong> Fill in</strong> only uses rows about records you already have, here or in your other files.</p>
        </div>
        {problems.length > 0 && <ul className="ml-add-problems">{problems.map(p => <li key={p.file}><strong>{p.file}</strong> {p.message}</li>)}</ul>}
        {maps.map(m => <article key={m.file} className="ml-add-table">
          <header><label className="ml-add-include"><input type="checkbox" checked={m.include}
            onChange={e => setMaps(all => all.map(x => x.file === m.file ? { ...x, include: e.target.checked } : x))}/>
            <span><strong>{m.title}</strong><small className="ml-mono">{m.file} · Mossline map · {count(m.nodes, "record")} · {count(m.edges, "link")}</small></span></label></header>
          <p className="ml-add-each">Its records and links are added as they are; anything already present is left alone.</p>
        </article>)}
        {tables.map(t => {
          const plan = plans[t.name];
          if (!plan) return null;
          const match = t.matches[plan.match];
          const shape = shapeOf(t, plan);
          const used = new Set([...JSON.stringify(shape).matchAll(/\{([^}]+)\}/g)].flatMap(x => x[1].split("|").map(s => s.trim().toLowerCase())));
          const columns = t.headings.filter(h => used.has(h.toLowerCase())).slice(0, 6);
          const shown = columns.length ? columns : t.headings.slice(0, 6);
          return <article key={t.name} className={"ml-add-table" + (plan.include ? "" : " is-off")}>
            <header>
              <label className="ml-add-include"><input type="checkbox" checked={plan.include} onChange={e => update(t.name, { include: e.target.checked })}/>
                <span><strong>{t.name}</strong>
                  <small className="ml-mono">{t.rows === null ? "large file" : count(t.rows, "row")} · {bytes(t.bytes)} · {t.format.toUpperCase()}</small></span></label>
              {match && <span className={"ml-add-badge" + (match.builtIn ? "" : " ml-add-badge--pencil")}>{match.builtIn ? "Recognised" : "Suggested"}</span>}
            </header>
            {plan.include && match && <div className="ml-add-grid">
              <div className="ml-add-read">
                <label className="ml-add-field"><span>Read as</span>
                  <select value={plan.match} onChange={e => update(t.name, { match: Number(e.target.value), labelColumn: "", type: "" })}>
                    {t.matches.map((m, i) => <option key={i} value={i}>{m.builtIn ? m.shape.name : "Suggested: " + m.shape.name.toLowerCase()}</option>)}
                  </select></label>
                <p className="ml-add-each">{shape.each}</p>
                {shape.about && <p className="ml-small">{shape.about}</p>}
                {!match.builtIn && shape.records.length > 0 && <div className="ml-add-adjust">
                  <label className="ml-add-field"><span>Name column</span>
                    <select value={plan.labelColumn || (shape.records[0].label.match(/^\{([^}|]+)\}$/)?.[1] ?? "")}
                      onChange={e => update(t.name, { labelColumn: e.target.value })}>
                      {t.headings.map(h => <option key={h} value={h}>{h}</option>)}</select></label>
                  {!/\{/.test(shape.records[0].type) && <label className="ml-add-field"><span>Each row is</span>
                    <select value={plan.type || shape.records[0].type} onChange={e => update(t.name, { type: e.target.value as NodeType })}>
                      {TYPES.map(x => <option key={x} value={x}>{TYPE_LABEL[x].toLowerCase()}</option>)}</select></label>}
                </div>}
                {match.missing.length > 0 && <p className="ml-add-warn">Some of the columns this reading expects are missing:
                  {" " + match.missing.map(x => x.replace(/[{}]/g, "").split("|")[0]).join(", ")}.</p>}
                {NAMES_PEOPLE.has(shape.id) && <p className="ml-add-warn">These rows name individuals. Add them only if you need them,
                  and keep the map private.</p>}
              </div>
              <fieldset className="ml-add-use">
                <legend className="ml-visually-hidden">How to use {t.name}</legend>
                <label className={plan.use === "records" ? "is-on" : ""}><input type="radio" name={"use-" + t.name} checked={plan.use === "records"}
                  disabled={t.large} onChange={() => update(t.name, { use: "records" })}/>
                  <span><strong>Add as records</strong><small>Every row, as new records and links</small></span></label>
                <label className={plan.use === "fill" ? "is-on" : ""}><input type="radio" name={"use-" + t.name} checked={plan.use === "fill"}
                  onChange={() => update(t.name, { use: "fill" })}/>
                  <span><strong>Fill in</strong><small>Only rows about records you already have</small></span></label>
                {t.large && <p className="ml-small">Large file: it is used to fill in, reading only the rows about your records.</p>}
              </fieldset>
            </div>}
            {plan.include && t.sample.length > 0 && <details className="ml-add-sample"><summary>First rows</summary>
              <div className="ml-add-sample-scroll"><table><thead><tr>{shown.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
                <tbody>{t.sample.slice(0, 4).map((row, i) => <tr key={i}>{shown.map(h => <td key={h}>{row[t.headings.indexOf(h)] ?? ""}</td>)}</tr>)}</tbody>
              </table></div></details>}
          </article>;
        })}
        <div className="ml-add-target">
          <h2 className="ml-section-title">Where it goes</h2>
          <div className="ml-add-target-options" role="radiogroup" aria-label="Where to add">
            <label className={target === "add" ? "is-on" : ""}><input type="radio" name="target" checked={target === "add"} disabled={!canAddToBase}
              onChange={() => setTarget("add")}/>
              <span><strong>Add to {baseTitle}</strong><small>{canAddToBase ? "Joins with the " + count(base?.nodes.length ?? 0, "record") + " already there"
                : "This map holds a complete funding dataset and cannot be added to here"}</small></span></label>
            <label className={target === "new" ? "is-on" : ""}><input type="radio" name="target" checked={target === "new"} onChange={() => setTarget("new")}/>
              <span><strong>Create a new map</strong><small>Your other maps are left as they are</small></span></label>
          </div>
          {target === "new" && <label className="ml-add-field ml-add-name"><span>Map name</span>
            <input value={title} maxLength={100} onChange={e => setTitle(e.target.value)}/></label>}
        </div>
        <div className="ml-add-actions">
          <button type="button" className="ml-quiet" onClick={() => setPhase("choose")} disabled={!!busy}>← Choose different files</button>
          <button type="button" className="ml-primary" onClick={preview} disabled={!!busy || (!chosen.length && !maps.some(m => m.include)) || !anyRecords}>
            Check what this adds →</button>
        </div>
        {!anyRecords && chosen.length > 0 && <p className="ml-small ml-add-right">Everything is set to fill in, and there are no records yet to fill in.
          Set at least one table to <strong>Add as records</strong>.</p>}
      </section>}

      {phase === "review" && report && <section className="ml-add-stack" aria-labelledby="review-h">
        <div className="ml-add-intro">
          <h1 id="review-h" ref={heading} tabIndex={-1}>Check before adding</h1>
          <p className="ml-add-lede">Nothing has been saved yet. {target === "add" ? <>This will change <strong>{baseTitle}</strong>.</> : <>This will create <strong>{title || "a new map"}</strong>.</>}</p>
        </div>
        <div className="ml-add-totals">
          <div><strong>{report.totals.newRecords.toLocaleString("en-GB")}</strong><span>new records</span></div>
          <div><strong>{report.totals.filledIn.toLocaleString("en-GB")}</strong><span>filled in</span></div>
          <div><strong>{report.totals.newLinks.toLocaleString("en-GB")}</strong><span>new recorded links</span></div>
          <div><strong>{report.sameName.length.toLocaleString("en-GB")}</strong><span>names to check</span></div>
        </div>
        {addedByType.length > 0 && <ul className="ml-add-types">{addedByType.map(([type, n]) =>
          <li key={type}><TypeMark type={type}/>{n.toLocaleString("en-GB")} {(n === 1 ? TYPE_LABEL[type] : TYPE_PLURAL[type]).toLowerCase()}</li>)}</ul>}

        <div className="ml-add-review-grid">
          <section className="ml-add-panel">
            <h2 className="ml-section-title">File by file</h2>
            <ul className="ml-add-ledger">{report.tables.map(t => <li key={t.table}>
              <div className="ml-add-ledger-head"><strong>{t.table}</strong><span className="ml-mono">{t.shape} · {t.use === "fill" ? "fill in" : "add"}</span></div>
              <p>Used {t.used.toLocaleString("en-GB")} of {count(t.rows, "row")}
                {Object.keys(t.added).length > 0 && <> · added {Object.entries(t.added).map(([k, v]) => v + " " + ((v === 1 ? TYPE_LABEL : TYPE_PLURAL)[k as NodeType]).toLowerCase()).join(", ")}</>}
                {t.filledIn > 0 && <> · filled in {count(t.filledIn, "record")}</>}
                {t.links > 0 && <> · {count(t.links, "link")}</>}</p>
              {t.skipped.length > 0 && <ul className="ml-add-skips">{t.skipped.map(s => <li key={s.reason}>{s.reason} · {s.count.toLocaleString("en-GB")}</li>)}</ul>}
              {t.unresolvedLinks > 0 && <p className="ml-add-warn">{count(t.unresolvedLinks, "link")} could not be joined: the record named at one end
                was not found, or more than one record has that name.</p>}
            </li>)}
              {report.mapsAdded > 0 && <li><div className="ml-add-ledger-head"><strong>{count(report.mapsAdded, "Mossline map")}</strong></div>
                <p>Records and links added as they were.</p></li>}</ul>
          </section>

          <section className="ml-add-panel">
            <h2 className="ml-section-title"><span className="ml-key-ink"/>Joined on identifiers</h2>
            {report.joins.length ? <ul className="ml-add-joins">{report.joins.slice(0, 8).map(j => <li key={j.text}>
              <span>{j.text}</span><b>{j.count.toLocaleString("en-GB")}</b></li>)}</ul>
              : <p className="ml-small">No records were matched across files. Records only join when they share a registered number or other identifier.</p>}
            <p className="ml-small">Matched by registered charity number, company number or 360Giving org-id. Never by name alone.</p>
          </section>
        </div>

        {report.sameName.length > 0 && <section className="ml-add-panel ml-add-same">
          <h2 className="ml-section-title"><span className="ml-key-pencil"/>Same name, no shared identifier</h2>
          <p className="ml-small">These may be the same organisation recorded twice, or two different ones. Tick only the pairs you know are the same;
            the rest stay separate.</p>
          <ul>{report.sameName.slice(0, 60).map(c => {
            const key = c.a + "\u0000" + c.b;
            return <li key={key}><label>
              <input type="checkbox" checked={merge.has(key)} onChange={e => setMerge(s => { const n = new Set(s); if (e.target.checked) n.add(key); else n.delete(key); return n; })}/>
              <span><strong>{c.label}</strong>
                <small><TypeMark type={(c.aType || "other") as NodeType}/>{c.aSource}{c.aIds.length ? " · " + c.aIds.map(describeIdentifier).join(", ") : " · no identifier"}</small>
                <small><TypeMark type={(c.bType || "other") as NodeType}/>{c.bSource}{c.bIds.length ? " · " + c.bIds.map(describeIdentifier).join(", ") : " · no identifier"}</small></span>
              <em>{merge.has(key) ? "Will be merged" : "Kept separate"}</em></label></li>;
          })}</ul>
          {report.sameName.length > 60 && <p className="ml-small">{report.sameName.length - 60} more pairs are kept separate; review them in the map later.</p>}
        </section>}

        {places && <section className="ml-add-panel ml-add-places">
          <h2 className="ml-section-title">Places</h2>
          <ul className="ml-add-placecounts">
            <li><span className="ml-add-dot"/><b>{places.recorded.toLocaleString("en-GB")}</b> from coordinates in the source</li>
            {exactCount > 0 && <li><span className="ml-add-dot ml-add-dot--hollow"/><b>{exactCount.toLocaleString("en-GB")}</b> at their postcode</li>}
            <li><span className="ml-add-dot ml-add-dot--hollow"/><b>{approxCount.toLocaleString("en-GB")}</b> approximately, at the middle of their postcode area</li>
            {places.notFound.length > 0 && <li><span className="ml-add-dot ml-add-dot--none"/><b>{places.notFound.length.toLocaleString("en-GB")}</b> with a postcode that could not be placed</li>}
            <li><span className="ml-add-dot ml-add-dot--none"/><b>{places.noPlace.toLocaleString("en-GB")}</b> with no place; listed in the margin of the map, not guessed</li>
          </ul>
          {toLookUp > 0 && !consent && <button type="button" className="ml-quiet" onClick={() => setConsent(true)} disabled={!!busy}>
            Look up {count(toLookUp, "postcode")} exactly…</button>}
          {consent && <div className="ml-add-consent" role="group" aria-label="Exact postcode lookup">
            <p><strong>This sends {count(toLookUp, "postcode")} to postcodes.io</strong>, a free public lookup service. Only the postcodes
              are sent, not names or anything else. Do this only if you are comfortable with them leaving this device.</p>
            <div className="ml-add-actions"><button type="button" className="ml-quiet" onClick={() => setConsent(false)}>Cancel</button>
              <button type="button" className="ml-solid" onClick={lookUpExact} disabled={!!busy}>Send postcodes and place exactly</button></div>
          </div>}
          {exactNote && <p className="ml-small" role="status">{exactNote}</p>}
          <p className="ml-add-attribution">{ATTRIBUTION}</p>
        </section>}

        {report.added.length > 0 && <details className="ml-add-panel ml-add-newlist"><summary>New records · first {Math.min(report.added.length, 60)}</summary>
          <ul>{report.added.slice(0, 60).map(n => <li key={n.id}><TypeMark type={n.type as NodeType}/>{n.label}</li>)}</ul></details>}

        <div className="ml-add-actions">
          <button type="button" className="ml-quiet" onClick={() => setPhase("plan")} disabled={!!busy}>← Change how files are read</button>
          <button type="button" className="ml-primary" onClick={finish} disabled={!!busy || (report.totals.newRecords + report.totals.filledIn + report.totals.newLinks === 0 && !report.mapsAdded)}>
            {target === "add" ? "Add to " + baseTitle : "Create the map"}{merge.size ? " · merge " + merge.size : ""}</button>
        </div>
      </section>}
    </div>
  </main>;
}
