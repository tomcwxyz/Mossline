"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addPending, emptyEdits, emptyShared, mergeRemote, parseEdits, parseShared, recordEdit, setUndone, sharedLayer,
  toggleShared, type Edit, type EditLayer, type SharedEdits } from "@mossline/graph-core";
import { sharedMaps, SharedMapError } from "../lib/shared-maps-client";
import type { SharedLink } from "../lib/map-library";

/**
 * The changes made to one map, kept apart from its imported records.
 *
 * A map only in this browser keeps them here, under the map's own ID, so
 * adding data again or reopening the map keeps them.
 *
 * A shared map keeps them on the server too: changes made here are sent
 * straight away, and everyone else's arrive every few seconds. A copy stays
 * here, so the map still opens offline and catches up later.
 */
const KEY = "mossline:edits:v1:";
const SHARED_KEY = "mossline:shared-edits:v1:";
const EDITOR_KEY = "mossline:editor-name";
const POLL_MS = 10_000;

export type SyncStatus = { state: "local" } | { state: "syncing" } | { state: "synced"; at: number } | { state: "offline"; message: string };

export function useMapEdits(mapId: string | undefined, enabled = true, shared?: SharedLink) {
  const sharedId = enabled ? shared?.id : undefined;
  const key = sharedId ? SHARED_KEY + sharedId : KEY + (mapId ?? "unsaved");
  const [layer, setLayer] = useState<EditLayer>(emptyEdits);
  const [sync, setSync] = useState<SharedEdits>(emptyShared);
  const [status, setStatus] = useState<SyncStatus>({ state: "local" });
  const [ready, setReady] = useState(false);
  /** The imported records' version on the server: newer than this browser's means someone added data. */
  const [remoteSource, setRemoteSource] = useState(0);
  const [editor, setEditorState] = useState("");
  const syncRef = useRef(sync);
  const busy = useRef(false);

  useEffect(() => {
    if (!enabled) { setLayer(emptyEdits()); setReady(true); return; }
    if (sharedId) {
      let cached = emptyShared();
      try { cached = parseShared(JSON.parse(window.localStorage.getItem(key) ?? "null")); } catch { /* start empty */ }
      syncRef.current = cached; setSync(cached); setStatus({ state: "syncing" });
    } else {
      try { setLayer(parseEdits(JSON.parse(window.localStorage.getItem(key) ?? "null"))); } catch { setLayer(emptyEdits()); }
      setStatus({ state: "local" });
    }
    try { setEditorState(window.localStorage.getItem(EDITOR_KEY) ?? ""); } catch { /* storage blocked */ }
    setReady(true);
  }, [key, enabled, sharedId]);

  const keep = useCallback((next: SharedEdits) => {
    syncRef.current = next; setSync(next);
    try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* the server has it */ }
  }, [key]);

  /** Sends what's waiting, then asks for everything new. One round at a time. */
  const flush = useCallback(async () => {
    if (!sharedId || busy.current) return;
    busy.current = true;
    let failed = false;
    try {
      let s = syncRef.current;
      if (s.pending.length) {
        const sent = s.pending.slice(0, 500);
        const r = await sharedMaps.pushEdits(sharedId, sent, s.serverVersion);
        s = mergeRemote(syncRef.current, r.edits, r.version); keep(s);
      }
      for (const t of s.toggles) await sharedMaps.toggle(sharedId, t.id, t.undone);
      const r = await sharedMaps.edits(sharedId, syncRef.current.serverVersion);
      keep(mergeRemote(syncRef.current, r.edits, r.version));
      setRemoteSource(r.sourceVersion);
      setStatus({ state: "synced", at: Date.now() });
    } catch (e) {
      const message = e instanceof SharedMapError && e.status === 401 ? "Sign in again to keep this map in step."
        : e instanceof SharedMapError && e.status === 404 ? "This map is no longer shared with you. Your copy here is kept."
        : e instanceof SharedMapError && e.status === 403 ? e.message
        : "Offline. Changes are kept here and sent when Mossline can be reached.";
      setStatus({ state: "offline", message });
      failed = true;
    } finally {
      busy.current = false;
      // Changes made while this round was out go in the next one, straight away.
      const left = syncRef.current;
      if (!failed && (left.pending.length || left.toggles.length)) window.setTimeout(() => void flushRef.current(), 0);
    }
  }, [sharedId, keep]);
  const flushRef = useRef(flush);
  flushRef.current = flush;

  useEffect(() => {
    if (!sharedId || !ready) return;
    void flush();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void flush(); }, POLL_MS);
    const wake = () => { if (document.visibilityState === "visible") void flush(); };
    window.addEventListener("focus", wake); document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake); window.removeEventListener("online", wake); };
  }, [sharedId, ready, flush]);

  const saveLocal = useCallback((next: EditLayer) => {
    setLayer(next);
    if (!enabled) return false;
    try { window.localStorage.setItem(key, JSON.stringify(next)); return true; } catch { return false; }
  }, [key, enabled]);

  const current = useMemo(() => sharedId ? sharedLayer(sync) : layer, [sharedId, sync, layer]);
  const add = useCallback((edits: Edit[]) => {
    if (sharedId) { keep(addPending(syncRef.current, edits)); void flush(); return true; }
    return saveLocal(edits.reduce(recordEdit, layer));
  }, [sharedId, keep, flush, saveLocal, layer]);
  const undo = useCallback((id: string, undone = true) => {
    if (sharedId) { keep(toggleShared(syncRef.current, id, undone)); void flush(); return true; }
    return saveLocal(setUndone(layer, id, undone));
  }, [sharedId, keep, flush, saveLocal, layer]);
  /** Restoring a backup: on a shared map its changes are added for everyone, never replacing theirs. */
  const replace = useCallback((next: EditLayer) => {
    if (sharedId) {
      const known = new Set(sharedLayer(syncRef.current).entries.map(e => e.id));
      return add(next.entries.filter(e => !known.has(e.id)));
    }
    return saveLocal(next);
  }, [sharedId, add, saveLocal]);
  const setEditor = useCallback((name: string) => {
    setEditorState(name);
    try { window.localStorage.setItem(EDITOR_KEY, name); } catch { /* storage blocked */ }
  }, []);
  return { layer: current, ready, add, undo, replace, editor, setEditor, status, pending: sync.pending.length + sync.toggles.length, refresh: flush, remoteSource };
}

/** Moves changes made before a map was shared onto the server, then lets this browser's own list go. */
export async function moveLocalEditsToShared(mapId: string, sharedId: string): Promise<number> {
  let local: EditLayer = emptyEdits();
  try { local = parseEdits(JSON.parse(window.localStorage.getItem(KEY + mapId) ?? "null")); } catch { /* none */ }
  if (local.entries.length) {
    for (let i = 0; i < local.entries.length; i += 500)
      await sharedMaps.pushEdits(sharedId, local.entries.slice(i, i + 500), 0);
  }
  try { window.localStorage.removeItem(KEY + mapId); } catch { /* fine */ }
  return local.entries.length;
}

/** When a map stops being shared here, this browser keeps the changes it had, as its own list again. */
export function keepSharedEditsHere(mapId: string, sharedId: string): void {
  try {
    const cached = parseShared(JSON.parse(window.localStorage.getItem(SHARED_KEY + sharedId) ?? "null"));
    window.localStorage.setItem(KEY + mapId, JSON.stringify(sharedLayer(cached)));
    window.localStorage.removeItem(SHARED_KEY + sharedId);
  } catch { /* storage blocked: the map still opens */ }
}
