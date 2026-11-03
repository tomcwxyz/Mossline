"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "../../hooks/useAccount";
import { AccountShell } from "./AccountShell";

type Overview = {
  counts: { users: number; orgs: number; paid: number; maps: number; publications: number };
  orgs: { id: string; name: string; plan: "free" | "organisation"; planUntil: string | null; planSource: string | null;
    members: number; maps: number; publications: number; created: string }[];
  publications: { slug: string; title: string; owner: string; updatedAt: string }[];
};
const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(path, { cache: "no-store", credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...init });
  const data = await r.json().catch(() => ({})) as T & { error?: string };
  if (!r.ok) throw Error(data.error ?? "Something went wrong");
  return data;
}

/**
 * For the people running this Mossline: who's on which plan, putting
 * organisations on a plan by hand (paid by invoice), and taking down
 * published maps reported under the acceptable use policy.
 */
export function Admin() {
  const { state } = useAccount();
  const user = state.status === "ready" ? state.user : null;
  const [data, setData] = useState<Overview | null>(null);
  const [problem, setProblem] = useState("");
  const [until, setUntil] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState("");
  const load = useCallback(async () => {
    try { setData(await call<Overview>("/api/admin")); } catch (e) { setProblem(e instanceof Error ? e.message : "Couldn't load."); }
  }, []);
  useEffect(() => { if (user?.operator) void load(); }, [user?.operator, load]);
  const plan = async (orgId: string, p: "free" | "organisation") => {
    setProblem("");
    try { await call("/api/admin/plan", { method: "POST", body: JSON.stringify({ orgId, plan: p, until: until[orgId] || null, source: "invoice" }) }); await load(); }
    catch (e) { setProblem(e instanceof Error ? e.message : "Couldn't change the plan."); }
  };
  const takeDown = async (slug: string) => {
    try { await call("/api/admin/publications?slug=" + slug, { method: "DELETE" }); setConfirm(""); await load(); }
    catch (e) { setProblem(e instanceof Error ? e.message : "Couldn't take it down."); }
  };

  return <AccountShell title="Running Mossline">
    <section className="ml-account-card ml-account-card--wide" aria-labelledby="admin-title">
      <p className="ml-start-eyebrow">Operator</p>
      <h1 id="admin-title">Running Mossline</h1>
      {state.status === "ready" && !user?.operator && <p className="ml-account-note">This page is for the people running this Mossline.</p>}
      {problem && <p className="ml-add-error" role="alert">{problem}</p>}
      {data && <>
        <dl className="ml-plan-usage ml-admin-counts">
          <div><dt>Accounts</dt><dd>{data.counts.users}</dd></div>
          <div><dt>Organisations</dt><dd>{data.counts.orgs}</dd></div>
          <div><dt>Paying</dt><dd>{data.counts.paid}</dd></div>
          <div><dt>Maps kept</dt><dd>{data.counts.maps}</dd></div>
          <div><dt>Published</dt><dd>{data.counts.publications}</dd></div>
        </dl>
        <section className="ml-account-section" aria-labelledby="admin-orgs">
          <h2 id="admin-orgs">Organisations</h2>
          <p className="ml-small">To put an organisation that pays by invoice on the plan, set the date it runs until and choose
            Organisation plan. Leave the date empty for no end date.</p>
          <ul className="ml-account-maps">{data.orgs.map(o => <li key={o.id}>
            <div><strong>{o.name}</strong>
              <small>{o.plan === "organisation" ? "Organisation plan" + (o.planUntil ? " until " + when(o.planUntil) : "") + (o.planSource ? " · " + o.planSource : "") : "Free"}
                {" "}· {o.members} people · {o.maps} maps · {o.publications} published · since {when(o.created)}</small></div>
            <div className="ml-edit-actions">
              <label className="ml-edit-field"><span className="ml-visually-hidden">Plan runs until, for {o.name}</span>
                <input type="date" value={until[o.id] ?? ""} onChange={e => setUntil(u => ({ ...u, [o.id]: e.target.value }))}/></label>
              <button type="button" className="ml-quiet" onClick={() => void plan(o.id, "organisation")}>Organisation plan</button>
              {o.plan === "organisation" && <button type="button" className="ml-quiet" onClick={() => void plan(o.id, "free")}>Free</button>}
            </div>
          </li>)}</ul>
        </section>
        <section className="ml-account-section" aria-labelledby="admin-pubs">
          <h2 id="admin-pubs">Published maps</h2>
          <p className="ml-small">Take a map down only after a report under the <a href="/legal/acceptable-use">acceptable use policy</a>.
            Tell the publisher what was taken down and why.</p>
          <ul className="ml-account-maps">{data.publications.map(p => <li key={p.slug}>
            <div><strong><a href={"/p/" + p.slug} target="_blank" rel="noreferrer">{p.title}</a></strong>
              <small>{p.owner} · updated {when(p.updatedAt)}</small></div>
            {confirm === p.slug ? <div className="ml-edit-actions">
              <button type="button" className="ml-quiet ml-danger" onClick={() => void takeDown(p.slug)}>Take down</button>
              <button type="button" className="ml-quiet" onClick={() => setConfirm("")}>Keep</button></div>
              : <button type="button" className="ml-quiet ml-edit-remove" onClick={() => setConfirm(p.slug)}>Take down…</button>}
          </li>)}</ul>
        </section>
      </>}
    </section>
  </AccountShell>;
}
