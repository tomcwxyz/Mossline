"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { account, useAccount, type OwnedPublication } from "../../hooks/useAccount";
import { AccountShell } from "./AccountShell";

const count = (n: number, word: string) => n.toLocaleString("en-GB") + " " + word + (n === 1 ? "" : "s");
const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function Account() {
  const { state, refresh } = useAccount();
  const user = state.status === "ready" ? state.user : null;
  const [maps, setMaps] = useState<OwnedPublication[] | null>(null);
  const [notice, setNotice] = useState("");
  const [problem, setProblem] = useState("");
  const [confirming, setConfirming] = useState("");
  const [claimId, setClaimId] = useState("");
  const [claimKey, setClaimKey] = useState("");
  const [deleteOk, setDeleteOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setMaps(await account.publications()); } catch (e) { setProblem(e instanceof Error ? e.message : "Couldn't load your maps."); }
  }, []);
  useEffect(() => { if (user?.canPublish) void load(); }, [user?.canPublish, load]);

  async function run(task: () => Promise<void>) {
    setBusy(true); setProblem(""); setNotice("");
    try { await task(); } catch (e) { setProblem(e instanceof Error ? e.message : "Something went wrong. Try again."); }
    finally { setBusy(false); }
  }
  const link = (slug: string) => window.location.origin + "/p/" + slug;

  async function claim(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      await account.claim(claimId.trim(), claimKey.trim());
      setClaimId(""); setClaimKey(""); setNotice("Map added to your account. Its old management key no longer works.");
      await load();
    });
  }

  return <AccountShell title="Your account">
    <section className="ml-account-card ml-account-card--wide" aria-labelledby="account-title">
      <p className="ml-start-eyebrow">Account</p>
      <h1 id="account-title">Your account</h1>
      {state.status === "loading" && <p className="ml-small" role="status">Checking…</p>}
      {state.status === "off" && <p className="ml-account-note">Accounts aren&apos;t switched on for this Mossline.</p>}
      {state.status === "ready" && !user && <div className="ml-account-note">
        <p>You&apos;re not signed in. You only need an account to publish maps online.</p>
        <a className="ml-solid ml-account-button" href="/sign-in?next=/account">Sign in</a>
      </div>}
      {problem && <p className="ml-add-error" role="alert">{problem}</p>}
      {notice && <p className="ml-account-note" role="status">{notice}</p>}

      {user && <>
        <dl className="ml-account-who">
          {user.name && <div><dt>Name</dt><dd>{user.name}</dd></div>}
          <div><dt>Email</dt><dd>{user.email}</dd></div>
        </dl>
        {!user.canPublish && <p className="ml-account-note">This account can open maps people have shared with it, from
          Mossline&apos;s front page. It can&apos;t publish maps or save its own. Ask whoever runs this Mossline if that&apos;s a mistake.</p>}

        {user.canPublish && <section className="ml-account-section" aria-labelledby="maps-title">
          <h2 id="maps-title">Published maps</h2>
          <p className="ml-small">Anyone with a map&apos;s link can see it. Publish and update maps from the Share menu in a map.</p>
          {maps === null ? <p className="ml-small" role="status">Loading…</p> : maps.length === 0 ?
            <p className="ml-account-empty">Nothing published yet.</p> :
            <ul className="ml-account-maps">{maps.map(m => <li key={m.slug}>
              <div><strong>{m.title}</strong>
                <small>{count(m.nodes, "record")} · {count(m.edges, "link")} ·
                  {" "}updated {when(m.updatedAt)}{m.revision > 1 ? " · version " + m.revision : ""}</small></div>
              <div className="ml-edit-actions">
                <a className="ml-quiet ml-account-button" href={"/p/" + m.slug} target="_blank" rel="noreferrer">Open ↗</a>
                <button type="button" className="ml-quiet" onClick={() => navigator.clipboard?.writeText(link(m.slug))
                  .then(() => setNotice("Link copied.")).catch(() => setNotice(link(m.slug)))}>Copy link</button>
                {confirming === m.slug ? <>
                  <button type="button" className="ml-danger ml-quiet" disabled={busy} onClick={() => void run(async () => {
                    await account.unpublish(m.slug); setConfirming(""); setNotice("“" + m.title + "” is unpublished and deleted from the server.");
                    await load();
                  })}>Unpublish</button>
                  <button type="button" className="ml-quiet" onClick={() => setConfirming("")}>Keep</button>
                </> : <button type="button" className="ml-quiet ml-edit-remove" onClick={() => setConfirming(m.slug)}>Unpublish…</button>}
              </div>
            </li>)}</ul>}
        </section>}

        {user.canPublish && <details className="ml-account-section">
          <summary><h2>Add a map published before accounts</h2></summary>
          <form className="ml-edit-form" onSubmit={claim}>
            <p className="ml-small">Maps published with a management key can move into your account. After that, the key
              stops working and you manage the map here.</p>
            <label className="ml-edit-field"><span>Publication ID <small>the part after /p/ in its link</small></span>
              <input value={claimId} onChange={e => setClaimId(e.target.value)} required maxLength={32} spellCheck={false}/></label>
            <label className="ml-edit-field"><span>Management key</span>
              <input type="password" autoComplete="off" value={claimKey} onChange={e => setClaimKey(e.target.value)} required/></label>
            <button type="submit" className="ml-solid" disabled={busy}>Add to my account</button>
          </form>
        </details>}

        <section className="ml-account-section" aria-labelledby="leave-title">
          <h2 id="leave-title">Sign out or leave</h2>
          <div className="ml-edit-actions">
            <button type="button" className="ml-quiet" disabled={busy} onClick={() => void run(async () => {
              await account.signOut(); await refresh(); setMaps(null); setNotice("Signed out.");
            })}>Sign out</button>
          </div>
          <div className="ml-edit-confirm">
            <strong>Delete your account</strong>
            <p>This deletes your name and email address from Mossline and unpublishes
              {maps?.length === 1 ? " your published map" : maps?.length ? " your " + maps.length + " published maps" : " any maps you've published"}. Copies people have
              already downloaded can&apos;t be recalled. Maps you&apos;ve saved to your account are deleted too, for everyone
              you shared them with, and you leave maps others shared with you. Maps in your browser are not affected.</p>
            <label className="ml-check"><input type="checkbox" checked={deleteOk} onChange={e => setDeleteOk(e.target.checked)}/>
              {" "}I understand. Delete my account.</label>
            <button type="button" className="ml-danger ml-quiet ml-account-delete" disabled={!deleteOk || busy} onClick={() => void run(async () => {
              try { await account.deleteAccount(); }
              catch { throw Error("For safety, sign in again and then delete your account."); }
              await refresh(); setMaps(null); setDeleteOk(false); setNotice("Your account and published maps have been deleted.");
            })}>Delete account</button>
          </div>
        </section>
      </>}
      <a className="ml-small" href="/">← Back to Mossline</a>
    </section>
  </AccountShell>;
}
