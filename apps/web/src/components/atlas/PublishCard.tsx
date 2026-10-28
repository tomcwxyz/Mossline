"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPublishedSnapshot, HOSTED_LIMITS, type GraphDocument, type PublishedSnapshot } from "@mossline/graph-core";
import { account, useAccount, type OwnedPublication } from "../../hooks/useAccount";

/** What one upload can carry; a whole map normally fits. Long review lists are cut on screen only. */
const MAX_RECORDS = HOSTED_LIMITS.records, MAX_LINKS = HOSTED_LIMITS.links, MAX_BYTES = 4_000_000, SHOW = 200;
const megabytes = (n: number) => (n / 1_000_000).toLocaleString("en-GB", { maximumFractionDigits: 1 }) + " MB";

/**
 * Publishing from the atlas: what is drawn now (recorded links only), reviewed
 * item by item, put online under the signed-in account. Updating replaces an
 * earlier publication of yours at the same link.
 */
export function PublishCard({ graph, title, mapId, onClose }: { graph: GraphDocument; title: string; mapId?: string; onClose: () => void }) {
  const { state } = useAccount();
  const user = state.status === "ready" ? state.user : null;
  const [mine, setMine] = useState<OwnedPublication[] | null>(null);
  const [target, setTarget] = useState("");
  const [name, setName] = useState(title.slice(0, 120));
  const [descriptions, setDescriptions] = useState(false);
  const [images, setImages] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState<{ slug: string; updated: boolean } | null>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (done) doneRef.current?.scrollIntoView({ block: "nearest" }); }, [done]);

  useEffect(() => {
    if (!user?.canPublish) return;
    account.publications().then(setMine).catch(() => setMine([]));
  }, [user?.canPublish]);

  const recorded = useMemo(() => ({ ...graph, edges: graph.edges.filter(e => !e.inferred) }), [graph]);
  const tooBig = recorded.nodes.length > MAX_RECORDS || recorded.edges.length > MAX_LINKS;
  const prepared = useMemo((): { snapshot: PublishedSnapshot | null; error: string } => {
    if (!recorded.nodes.length) return { snapshot: null, error: "Nothing is drawn, so there's nothing to publish." };
    if (tooBig) return { snapshot: null, error: "" };
    if (!name.trim()) return { snapshot: null, error: "Give the map a title." };
    try {
      const make = (view: "atlas" | "landscape") => createPublishedSnapshot(recorded, { view, layout: "organic", labels: "essential",
        illustrated: false, title: name, includeDescriptions: descriptions, includeImages: images }, new Date(), HOSTED_LIMITS);
      // A map with recorded places opens on the map; one without opens on the network.
      const placed = make("atlas");
      const snapshot = placed.nodes.some(n => n.properties) ? placed : make("landscape");
      const bytes = new TextEncoder().encode(JSON.stringify({ snapshot })).length;
      if (bytes > MAX_BYTES) return { snapshot: null, error: "This view comes to " + megabytes(bytes) + ", more than the " +
        megabytes(MAX_BYTES) + " one upload can carry." + (descriptions ? " Leave out descriptions, or" : "") + " narrow it down with search or the filters first." };
      return { snapshot, error: "" };
    } catch { return { snapshot: null, error: "Some records can't be published as they are (a name or description is too long)." }; }
  }, [recorded, tooBig, name, descriptions, images]);
  useEffect(() => { setChecked(false); setDone(null); }, [prepared.snapshot, target]);

  const snapshot = prepared.snapshot;
  const labelOf = useMemo(() => new Map(recorded.nodes.map(n => [n.id, n.label])), [recorded]);
  // Coming back from signing in reopens this map.
  const next = mapId ? "/?open=" + encodeURIComponent(mapId) : "/";
  const link = (slug: string) => window.location.origin + "/p/" + slug;

  async function send() {
    if (!snapshot || !checked || busy) return;
    setBusy(true); setProblem("");
    try {
      if (target) {
        const current = mine?.find(m => m.slug === target);
        if (!current) throw Error("That publication is no longer in your account.");
        const r = await account.update(target, current.revision, snapshot);
        setMine(list => list?.map(m => m.slug === target ? { ...m, revision: r.revision, title: snapshot.title } : m) ?? null);
        setDone({ slug: target, updated: true });
      } else {
        const r = await account.publish(snapshot);
        setMine(list => [{ slug: r.slug, title: snapshot.title, nodes: snapshot.nodes.length, edges: snapshot.edges.length,
          revision: r.revision, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...(list ?? [])]);
        setDone({ slug: r.slug, updated: false });
      }
      setChecked(false);
    } catch (e) { setProblem(e instanceof Error ? e.message : "Couldn't publish. Try again."); }
    finally { setBusy(false); }
  }

  return <aside className="ml-overlay-card ml-publish-card" aria-labelledby="publish-title">
    <div className="ml-unplaced-head"><strong id="publish-title">Publish online</strong>
      <button type="button" className="ml-link-button" onClick={onClose} aria-label="Close publishing">×</button></div>

    {state.status === "loading" && <p className="ml-small" role="status">Checking…</p>}
    {state.status === "off" && <p className="ml-small">Publishing isn&apos;t switched on for this Mossline. Share view still copies a link to this view.</p>}
    {state.status === "ready" && !user && <>
      <p className="ml-small">Put a reviewed copy of this view online at a link anyone can open. You&apos;ll need to sign in;
        nothing else in Mossline needs an account.</p>
      <a className="ml-solid ml-account-button" href={"/sign-in?next=" + encodeURIComponent(next)}>Sign in to publish</a>
    </>}
    {user && !user.canPublish && <p className="ml-small">{user.email} isn&apos;t set up to publish here. Ask whoever runs this Mossline to add it.</p>}

    {user?.canPublish && <>
      {!!mine?.length && <label className="ml-edit-field"><span>Publish as</span>
        <select value={target} onChange={e => { setTarget(e.target.value); const m = mine.find(x => x.slug === e.target.value); if (m) setName(m.title); }}>
          <option value="">A new map with its own link</option>
          {mine.map(m => <option key={m.slug} value={m.slug}>Update “{m.title}”</option>)}
        </select></label>}
      <label className="ml-edit-field"><span>Title</span>
        <input value={name} maxLength={120} onChange={e => setName(e.target.value)}/></label>

      {tooBig ? <p className="ml-publish-limit" role="status">This view has {recorded.nodes.length.toLocaleString("en-GB")} records
        and {recorded.edges.length.toLocaleString("en-GB")} recorded links. A published map holds up to {MAX_RECORDS.toLocaleString("en-GB")}
        records and {MAX_LINKS.toLocaleString("en-GB")} links: narrow it down with search or the filters first.</p> : <>
        <p className="ml-small">Publishes what&apos;s drawn now: <strong>{recorded.nodes.length} records</strong> and
          {" "}<strong>{recorded.edges.length} recorded links</strong>. Suggested links, your files, tags, amounts, sources and
          notes stay here.</p>
        <label className="ml-check"><input type="checkbox" checked={descriptions} onChange={e => setDescriptions(e.target.checked)}/>
          {" "}Include descriptions</label>
        <label className="ml-check"><input type="checkbox" checked={images} onChange={e => setImages(e.target.checked)}/>
          {" "}Include pictures (shown from where they&apos;re hosted)</label>
      </>}
      {prepared.error && <p className="ml-small" role="status">{prepared.error}</p>}

      {snapshot && <>
        <details className="ml-publish-review">
          <summary>Check everything that will be public</summary>
          <p className="ml-small">Names, types and links{snapshot.nodes.some(n => n.properties) ? ", plus map locations" : ""}
            {descriptions ? ", descriptions" : ""}{images ? ", picture addresses" : ""}.</p>
          <ul tabIndex={0} aria-label="Records to publish">{snapshot.nodes.slice(0, SHOW).map(n => <li key={n.id}>{n.label} <small>{n.type}</small>
            {n.description && <small> · {n.description}</small>}</li>)}</ul>
          <ul tabIndex={0} aria-label="Links to publish">{snapshot.edges.slice(0, SHOW).map(e => <li key={e.id}>{labelOf.get(e.source)} {e.direction === "directed" ? "→" : "–"}
            {" "}{labelOf.get(e.target)} <small>{e.type}</small></li>)}</ul>
          {(snapshot.nodes.length > SHOW || snapshot.edges.length > SHOW) && <p className="ml-small">Showing the first {SHOW} of each. Everything listed in the counts above is published.</p>}
        </details>
        <label className="ml-check"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}/>
          {" "}I&apos;ve checked this and have permission to publish it.</label>
        <button type="button" className="ml-solid" disabled={!checked || busy} onClick={() => void send()}>
          {busy ? "Publishing…" : target ? "Update the published map" : "Publish"}</button>
      </>}

      {problem && <p className="ml-add-error" role="alert">{problem}</p>}
      {done && <div className="ml-publish-done" role="status" ref={doneRef}>
        <strong>{done.updated ? "Updated. The same link shows the new version." : "Published."}</strong>
        <input readOnly value={link(done.slug)} aria-label="Link to the published map" onFocus={e => e.target.select()}/>
        <div className="ml-edit-actions">
          <button type="button" className="ml-quiet" onClick={() => void navigator.clipboard?.writeText(link(done.slug)).catch(() => {})}>Copy link</button>
          <a className="ml-quiet ml-account-button" href={"/p/" + done.slug} target="_blank" rel="noreferrer">Open ↗</a>
        </div>
      </div>}
      <p className="ml-small ml-publish-foot">Anyone with the link can see it. Signed in as {user.name || user.email} ·
        {" "}<a href="/account" target="_blank" rel="noreferrer">your account ↗</a></p>
    </>}
  </aside>;
}
