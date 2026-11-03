"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { GraphDocument } from "@mossline/graph-core";
import type { AccountState } from "../../hooks/useAccount";
import { keepSharedEditsHere, moveLocalEditsToShared, type SyncStatus } from "../../hooks/useMapEdits";
import type { SharedLink } from "../../lib/map-library";
import { sharedMapLink, sharedMaps, type SharedMapInfo } from "../../lib/shared-maps-client";

/**
 * Keeping a map in an account and working on it with others. Saving copies the
 * whole map to this Mossline's server, so it says exactly what goes and asks
 * first. Everything else about the map stays as it was in this browser.
 */
export function ShareMapCard({ graph, mapId, shared, account, status, onLinked, onClose }: {
  graph: GraphDocument; mapId?: string; shared?: SharedLink; account: AccountState; status: SyncStatus;
  onLinked: (link: SharedLink | undefined) => void; onClose: () => void;
}) {
  const user = account.status === "ready" ? account.user : null;
  const [info, setInfo] = useState<SharedMapInfo | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [confirmEnd, setConfirmEnd] = useState(false);

  const load = useCallback(async () => {
    if (!shared) return;
    try { setInfo(await sharedMaps.info(shared.id)); } catch (e) { setProblem(e instanceof Error ? e.message : "Couldn't load who has this map."); }
  }, [shared]);
  useEffect(() => { setInfo(null); void load(); }, [load]);

  async function run(task: () => Promise<void>) {
    setBusy(true); setProblem(""); setNotice("");
    try { await task(); } catch (e) { setProblem(e instanceof Error ? e.message : "Something went wrong. Try again."); }
    finally { setBusy(false); }
  }
  const save = () => run(async () => {
    if (!mapId) throw Error("Save this map in your browser first.");
    const created = await sharedMaps.create(graph.title || "Untitled map", graph);
    const moved = await moveLocalEditsToShared(mapId, created.id);
    onLinked({ id: created.id, role: "owner", sourceVersion: created.sourceVersion });
    setNotice("Saved to your account" + (moved ? ", with the " + moved + " change" + (moved === 1 ? "" : "s") + " made here" : "") +
      ". Invite people below, or open it on another device from Mossline's front page.");
  });
  const invite = (event: FormEvent) => { event.preventDefault(); void run(async () => {
    const r = await sharedMaps.invite(shared!.id, email.trim(), role);
    setInfo(i => i && { ...i, members: r.members });
    setNotice(r.emailed ? "Invitation emailed to " + email.trim() + "." :
      "Added " + email.trim() + ". Send them the link to the map; they sign in with that address.");
    setEmail("");
  }); };
  const remove = (who: string) => run(async () => {
    const r = await sharedMaps.removeMember(shared!.id, who);
    setInfo(i => i && { ...i, members: r.members });
  });
  const leave = () => run(async () => {
    await sharedMaps.removeMember(shared!.id, user!.email);
    if (mapId) keepSharedEditsHere(mapId, shared!.id);
    onLinked(undefined);
    setNotice("You've left the map. Your copy stays in this browser, without other people's future changes.");
  });
  const stop = () => run(async () => {
    await sharedMaps.remove(shared!.id);
    if (mapId) keepSharedEditsHere(mapId, shared!.id);
    onLinked(undefined);
    setNotice("Deleted from your account, with everyone's access to it. The copy in this browser stays.");
  });
  const syncLine = status.state === "synced" ? "Up to date" : status.state === "syncing" ? "Bringing it up to date…"
    : status.state === "offline" ? status.message : "";

  return <aside className="ml-overlay-card ml-publish-card ml-share-card" aria-labelledby="share-map-title">
    <div className="ml-unplaced-head"><strong id="share-map-title">{shared ? "Sharing this map" : "Save to your account"}</strong>
      <button type="button" className="ml-link-button" onClick={onClose} aria-label="Close sharing">×</button></div>

    {problem && <p className="ml-add-error" role="alert">{problem}</p>}
    {notice && <p className="ml-account-note" role="status">{notice}</p>}

    {!shared && <>
      {account.status === "loading" && <p className="ml-small" role="status">Checking…</p>}
      {(account.status === "off" || (account.status === "ready" && !account.sharedMaps)) &&
        <p className="ml-small">Saving maps to an account isn&apos;t switched on for this Mossline. Your maps stay in this browser.</p>}
      {account.status === "ready" && account.sharedMaps && !user && <>
        <p className="ml-small">Keep this map in your account to open it on other devices and work on it with other people.</p>
        <a className="ml-solid ml-account-button" href={"/sign-in?next=" + encodeURIComponent(mapId ? "/?open=" + mapId : "/")}>Sign in</a>
      </>}
      {account.status === "ready" && account.sharedMaps && user && !user.canPublish &&
        <p className="ml-small">{user.email} can open maps people share with it, but can&apos;t save maps of its own here.</p>}
      {account.status === "ready" && account.sharedMaps && user?.canPublish && <>
        <p className="ml-small">Open this map on other devices and work on it with people you invite. Everyone&apos;s changes
          appear for everyone within a few seconds, each with who made it.</p>
        <div className="ml-publish-limit">
          <strong>What this copies to the server</strong>
          <p>All {graph.nodes.length.toLocaleString("en-GB")} records and {graph.edges.length.toLocaleString("en-GB")} links,
            with every field from your files, and the changes made here. Only you and the people you invite can open it.
            You can delete it at any time.</p>
        </div>
        <label className="ml-check"><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}/>
          {" "}I&apos;m allowed to keep this data on this Mossline&apos;s server.</label>
        <button type="button" className="ml-solid" disabled={!agreed || busy || !mapId} onClick={() => void save()}>
          {busy ? "Saving…" : "Save to my account"}</button>
      </>}
    </>}

    {shared && <>
      <p className="ml-small">{info ? (shared.role === "owner" ? "In your account" : "In " + info.owner + "'s account") +
        " · you can " + (shared.role === "viewer" ? "view it" : "change it") : "Loading…"}
        {syncLine && <><br/><span className="ml-share-sync">{syncLine}</span></>}</p>
      <div className="ml-edit-actions">
        <button type="button" className="ml-quiet" onClick={() => navigator.clipboard?.writeText(sharedMapLink(shared.id))
          .then(() => setNotice("Link copied. It opens the map for people you've invited.")).catch(() => setNotice(sharedMapLink(shared.id)))}>
          Copy link</button>
      </div>
      {info && <section className="ml-share-people" aria-label="People with this map">
        <h3 className="ml-section-title">People</h3>
        <ul>
          <li><span><strong>{info.owner}</strong><small>owner</small></span></li>
          {info.members.map(m => <li key={m.email}><span><strong>{m.name || m.email}</strong>
            <small>{m.role === "editor" ? "can edit" : "can view"}{m.joined ? "" : " · invited"}{m.name ? " · " + m.email : ""}</small></span>
            {shared.role === "owner" && <button type="button" className="ml-link-button" disabled={busy}
              onClick={() => void remove(m.email)} aria-label={"Remove " + m.email}>Remove</button>}</li>)}
        </ul>
      </section>}
      {shared.role === "owner" && <form className="ml-edit-form" onSubmit={invite} aria-label="Invite someone">
        <label className="ml-edit-field"><span>Invite by email</span>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="off"/></label>
        <div className="ml-edit-row">
          <label className="ml-edit-field"><span>They can</span>
            <select value={role} onChange={e => setRole(e.target.value as "editor" | "viewer")}>
              <option value="editor">View and edit</option><option value="viewer">View only</option></select></label>
          <button type="submit" className="ml-solid ml-share-invite" disabled={busy}>Invite</button>
        </div>
        <p className="ml-small">They sign in with that address. They can&apos;t publish or invite others.</p>
      </form>}
      <div className="ml-edit-confirm">
        {shared.role === "owner" ? <>
          <strong>Stop sharing</strong>
          <p>Deletes the map from your account and everyone&apos;s access to it. Copies already in people&apos;s browsers stay there.</p>
          <label className="ml-check"><input type="checkbox" checked={confirmEnd} onChange={e => setConfirmEnd(e.target.checked)}/> Delete it from my account</label>
          <button type="button" className="ml-danger ml-quiet ml-account-delete" disabled={!confirmEnd || busy} onClick={() => void stop()}>Stop sharing</button>
        </> : <>
          <strong>Leave this map</strong>
          <p>Your copy stays in this browser, without anyone&apos;s future changes.</p>
          <button type="button" className="ml-quiet ml-account-delete" disabled={busy} onClick={() => void leave()}>Leave</button>
        </>}
      </div>
    </>}
  </aside>;
}
