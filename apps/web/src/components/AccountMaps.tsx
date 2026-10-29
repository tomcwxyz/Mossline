"use client";

import { useEffect, useState } from "react";
import { useAccount } from "../hooks/useAccount";
import { sharedMaps, type SharedMapSummary } from "../lib/shared-maps-client";

/**
 * Maps kept in the signed-in account (owned or shared with it) that this
 * browser doesn't have yet. Opening one brings a copy here.
 */
export function AccountMaps({ have, onOpen, busy }: { have: Set<string>; onOpen: (map: SharedMapSummary) => void; busy: string }) {
  const { state } = useAccount();
  const [maps, setMaps] = useState<SharedMapSummary[] | null>(null);
  const user = state.status === "ready" && state.sharedMaps ? state.user : null;
  useEffect(() => {
    if (!user) return;
    sharedMaps.list().then(r => setMaps(r.maps)).catch(() => setMaps([]));
  }, [user]);
  if (state.status !== "ready" || !state.sharedMaps) return null;
  if (!user) return <p className="ml-start-account-hint">Maps in your Mossline account, or shared with you, appear here
    when you <a href="/sign-in?next=/">sign in</a>.</p>;
  const elsewhere = (maps ?? []).filter(m => !have.has(m.id));
  if (!elsewhere.length) return null;
  return <section className="ml-start-maps" aria-labelledby="account-maps">
    <div className="ml-start-maps-head">
      <div><p className="ml-start-eyebrow">In your account</p>
        <h2 id="account-maps">Not in this browser yet</h2></div>
      <span className="ml-start-count">{elsewhere.length}</span>
    </div>
    <div className="ml-start-maplist studio-start-maplist">
      {elsewhere.map(m => <button key={m.id} type="button" disabled={!!busy} onClick={() => onOpen(m)}>
        <svg viewBox="0 0 26 26" aria-hidden="true" className="ml-start-map-mark"><path d="M3 19C8 19 9 8 14 8S20 15 23 6" className="ml-mark-line"/>
          <circle cx="3.5" cy="19" r="2.6" className="ml-mark-a"/><circle cx="14" cy="8" r="2.6" className="ml-mark-b"/>
          <circle cx="22.6" cy="6.4" r="2.6" className="ml-mark-c"/></svg>
        <span className="ml-start-map-name"><strong>{m.title}<em className="ml-start-badge">{m.role === "owner" ? "Yours" : m.role === "editor" ? "Can edit" : "View only"}</em></strong>
          <small>{busy === m.id ? "Opening…" : (m.role === "owner" ? "" : m.owner + " · ") + m.nodes.toLocaleString("en-GB") + " records · " +
            m.edges.toLocaleString("en-GB") + " links"}</small></span>
        <span aria-hidden="true" className="ml-start-arrow">→</span>
      </button>)}
    </div>
  </section>;
}
