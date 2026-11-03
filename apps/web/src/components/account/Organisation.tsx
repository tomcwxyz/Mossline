"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ofLimit, orgs, useAccount, type OrgState } from "../../hooks/useAccount";
import { AccountShell } from "./AccountShell";

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** Starting, joining, running and paying for an organisation. */
export function Organisation() {
  const { state } = useAccount();
  const user = state.status === "ready" ? state.user : null;
  const [data, setData] = useState<OrgState | null>(null);
  const [problem, setProblem] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async () => {
    try { const d = await orgs.get(); setData(d); setName(d.org?.name ?? ""); }
    catch (e) { setProblem(e instanceof Error ? e.message : "Couldn't load your organisation."); }
  }, []);
  useEffect(() => { if (user) void load(); }, [user, load]);
  // Coming back from paying: the payment provider tells us in a moment, so look again for a little while.
  useEffect(() => {
    if (!user || typeof window === "undefined" || !new URLSearchParams(window.location.search).has("paid")) return;
    setNotice("Thank you. Your payment is being confirmed; the plan shows here within a minute.");
    window.history.replaceState(null, "", "/organisation");
    let tries = 0;
    const timer = window.setInterval(() => { tries++; void load(); if (tries > 10) window.clearInterval(timer); }, 3000);
    return () => window.clearInterval(timer);
  }, [user, load]);

  async function run(task: () => Promise<void>, done?: string) {
    setBusy(true); setProblem(""); setNotice("");
    try { await task(); if (done) setNotice(done); await load(); }
    catch (e) { setProblem(e instanceof Error ? e.message : "Something went wrong. Try again."); }
    finally { setBusy(false); }
  }
  const go = (task: () => Promise<{ url: string }>) => run(async () => { window.location.assign((await task()).url); });

  const org = data?.org ?? null;
  const admin = org?.role === "admin";
  const usage = data?.usage;

  return <AccountShell title="Your organisation">
    <section className="ml-account-card ml-account-card--wide" aria-labelledby="org-title">
      <p className="ml-start-eyebrow">Organisation</p>
      <h1 id="org-title">{org ? org.name : "Your organisation"}</h1>
      {state.status === "loading" && <p className="ml-small" role="status">Checking…</p>}
      {state.status === "off" && <p className="ml-account-note">Accounts aren&apos;t switched on for this Mossline.</p>}
      {state.status === "ready" && !user && <div className="ml-account-note">
        <p>Sign in to start or join an organisation.</p>
        <a className="ml-solid ml-account-button" href="/sign-in?next=/organisation">Sign in</a></div>}
      {problem && <p className="ml-add-error" role="alert">{problem}</p>}
      {notice && <p className="ml-account-note" role="status">{notice}</p>}

      {user && data && !org && <>
        <p className="ml-add-lede">An organisation keeps its maps and published maps together, so everyone in it can work on
          them and nothing is lost when someone leaves.{data.plans ? " The organisation plan is " + data.price + " for everyone in it." : ""}</p>
        {data.joinable.length > 0 && <section className="ml-account-section" aria-labelledby="join-title">
          <h2 id="join-title">Join</h2>
          <ul className="ml-account-maps">{data.joinable.map(o => <li key={o.id}>
            <div><strong>{o.name}</strong><small>{o.how === "invited" ? "You've been invited" + (o.role === "admin" ? " as an admin" : "") : "Open to your email domain"}</small></div>
            <button type="button" className="ml-solid" disabled={busy} onClick={() => void run(async () => { await orgs.join(o.id); }, "Welcome to " + o.name + ".")}>Join</button>
          </li>)}</ul>
        </section>}
        {data.canCreate ? <form className="ml-edit-form ml-account-section" aria-label="Start an organisation" onSubmit={(e: FormEvent) => {
          e.preventDefault(); void run(async () => { await orgs.create(name.trim()); }, "Organisation started. Your maps and published maps are now part of it.");
        }}>
          <h2>Start an organisation</h2>
          <label className="ml-edit-field"><span>Name</span><input required maxLength={120} value={name} onChange={e => setName(e.target.value)}/></label>
          <button type="submit" className="ml-solid ml-account-delete" disabled={busy || !name.trim()}>Start it</button>
          <p className="ml-small">You&apos;ll be its admin. Anything you&apos;ve already published or kept in your account moves into it.</p>
        </form> : data.joinable.length === 0 && <p className="ml-account-note">This account can join an organisation it&apos;s invited to, but can&apos;t start one.</p>}
      </>}

      {user && org && usage && <>
        <section className="ml-account-section" aria-labelledby="plan-title">
          <h2 id="plan-title">Plan</h2>
          <div className="ml-plan-box">
            <p><strong>{org.plan === "organisation" ? "Organisation plan" : "Free plan"}</strong>
              {org.plan === "organisation" && org.planUntil && <> · {org.billing && org.planSource === "stripe" ? "renews or ends" : "runs until"} {when(org.planUntil)}</>}
              {org.plan === "organisation" && !org.planUntil && <> · arranged with us</>}</p>
            {data.plans && <dl className="ml-plan-usage">
              <div><dt>Published maps</dt><dd>{ofLimit(usage.publications, usage.limits.publications)}</dd></div>
              <div><dt>Maps kept here</dt><dd>{ofLimit(usage.savedMaps, usage.limits.savedMaps)}</dd></div>
              <div><dt>People per map</dt><dd>{usage.limits.peoplePerMap ?? "Unlimited"}</dd></div>
            </dl>}
          </div>
          {admin && data.plans && <div className="ml-edit-actions">
            {org.plan !== "organisation" && data.billing && <button type="button" className="ml-solid" disabled={busy} onClick={() => void go(orgs.checkout)}>
              Upgrade: {data.price}</button>}
            {org.billing && data.billing && <button type="button" className="ml-quiet" disabled={busy} onClick={() => void go(orgs.portal)}>
              Manage billing and invoices</button>}
          </div>}
          {admin && data.plans && org.plan !== "organisation" && <p className="ml-small">
            {data.billing ? "Paid yearly by card through Stripe. " : ""}Prefer an invoice? See the <a href="/pricing">pricing page</a> and
            {" "}get in touch.</p>}
        </section>

        <section className="ml-account-section" aria-labelledby="people-title">
          <h2 id="people-title">People</h2>
          <ul className="ml-account-maps">{data.members.map(m => <li key={m.userId}>
            <div><strong>{m.name || m.email}</strong>
              <small>{m.role === "admin" ? "Admin" : "Member"}{m.name ? " · " + m.email : ""} · joined {when(m.joined)}</small></div>
            {admin && m.email !== user.email && <div className="ml-edit-actions">
              <button type="button" className="ml-quiet" disabled={busy} onClick={() => void run(async () => { await orgs.setRole(m.userId, m.role === "admin" ? "member" : "admin"); })}>
                {m.role === "admin" ? "Make member" : "Make admin"}</button>
              <button type="button" className="ml-quiet ml-edit-remove" disabled={busy} onClick={() => void run(async () => { await orgs.remove(m.userId); }, "Removed. What they made stays with the organisation.")}
                aria-label={"Remove " + (m.name || m.email)}>Remove</button>
            </div>}
          </li>)}
          {data.invites.map(i => <li key={i.email}><div><strong>{i.email}</strong><small>Invited{i.role === "admin" ? " as an admin" : ""}</small></div>
            {admin && <button type="button" className="ml-quiet" disabled={busy} onClick={() => void run(async () => { await orgs.cancelInvite(i.email); })}
              aria-label={"Cancel invitation to " + i.email}>Cancel</button>}</li>)}</ul>
          {admin && <form className="ml-edit-form" aria-label="Invite someone to the organisation" onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void run(async () => { const r = await orgs.invite(email.trim(), role);
              setEmail(""); setNotice(r.emailed ? "Invitation emailed." : "Invited. Ask them to sign in with that address and accept on their account page."); });
          }}>
            <div className="ml-edit-row">
              <label className="ml-edit-field"><span>Invite by email</span>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="off"/></label>
              <label className="ml-edit-field"><span>As</span>
                <select value={role} onChange={e => setRole(e.target.value as "member" | "admin")}>
                  <option value="member">Member</option><option value="admin">Admin</option></select></label>
            </div>
            <button type="submit" className="ml-solid ml-account-delete" disabled={busy}>Invite</button>
          </form>}
          {admin && data.domain && <label className="ml-check">
            <input type="checkbox" checked={org.joinDomain === data.domain} disabled={busy}
              onChange={e => void run(async () => { await orgs.update({ openToDomain: e.target.checked }); })}/>
            {" "}Let anyone who signs in with an @{data.domain} address join</label>}
        </section>

        {admin && <form className="ml-edit-form ml-account-section" aria-label="Rename the organisation" onSubmit={(e: FormEvent) => {
          e.preventDefault(); void run(async () => { await orgs.update({ name: name.trim() }); }, "Renamed.");
        }}>
          <h2>Name</h2>
          <div className="ml-edit-row"><label className="ml-edit-field"><span>Organisation name</span>
            <input required maxLength={120} value={name} onChange={e => setName(e.target.value)}/></label>
            <button type="submit" className="ml-quiet ml-share-invite" disabled={busy || !name.trim() || name.trim() === org.name}>Rename</button></div>
        </form>}

        <section className="ml-account-section ml-edit-confirm">
          <strong>Leave {org.name}</strong>
          <p>{data.members.length === 1 ? "You're the only person in it, so it will close. Your maps and published maps go back to your own account."
            : "What you made stays with the organisation."}</p>
          <label className="ml-check"><input type="checkbox" checked={leaving} onChange={e => setLeaving(e.target.checked)}/> Leave the organisation</label>
          <button type="button" className="ml-quiet ml-account-delete ml-danger" disabled={!leaving || busy}
            onClick={() => void run(async () => { await orgs.leave(); setLeaving(false); }, "You've left.")}>Leave</button>
        </section>
      </>}
      <a className="ml-small" href="/account">← Your account</a>
    </section>
  </AccountShell>;
}
