import { emptyEdits, type Edit, type EditLayer } from "./edits";

/**
 * A shared map's change list, as one browser sees it: what the server has
 * confirmed (in the order the server received it) plus this browser's changes
 * that haven't reached the server yet. Everyone ends up with the same order,
 * so everyone's map comes out the same.
 */
export interface RemoteEdit { entry: Edit; undone: boolean; seq: number; version: number }
export interface SharedEdits {
  kind: "mossline-shared-edits"; version: 1;
  /** The highest server version this browser has seen. */
  serverVersion: number;
  remote: RemoteEdit[];
  /** Made here, not yet confirmed by the server. */
  pending: Edit[];
  /** Undo or redo of a confirmed change, not yet confirmed. */
  toggles: { id: string; undone: boolean }[];
}

export const emptyShared = (): SharedEdits => ({ kind: "mossline-shared-edits", version: 1, serverVersion: 0, remote: [], pending: [], toggles: [] });

export function parseShared(raw: unknown): SharedEdits {
  const s = raw as Partial<SharedEdits> | null;
  if (!s || s.kind !== "mossline-shared-edits" || !Array.isArray(s.remote) || !Array.isArray(s.pending)) return emptyShared();
  return { ...emptyShared(), ...s, toggles: Array.isArray(s.toggles) ? s.toggles : [] } as SharedEdits;
}

/** Folds in what the server sent: new changes, and undo/redo since. Confirmed local changes stop being pending. */
export function mergeRemote(state: SharedEdits, incoming: RemoteEdit[], serverVersion: number): SharedEdits {
  const byId = new Map(state.remote.map(r => [r.entry.id, r]));
  for (const r of incoming) byId.set(r.entry.id, r);
  const remote = [...byId.values()].sort((a, b) => a.seq - b.seq);
  const confirmed = new Set(remote.map(r => r.entry.id));
  const settled = new Map(remote.map(r => [r.entry.id, r.undone]));
  return {
    ...state,
    serverVersion: Math.max(state.serverVersion, serverVersion),
    remote,
    pending: state.pending.filter(e => !confirmed.has(e.id)),
    toggles: state.toggles.filter(t => settled.get(t.id) !== t.undone)
  };
}

export function addPending(state: SharedEdits, edits: Edit[]): SharedEdits {
  return { ...state, pending: [...state.pending, ...edits] };
}

/** Undo or redo: a pending change is simply changed; a confirmed one waits to be sent. */
export function toggleShared(state: SharedEdits, id: string, undone: boolean): SharedEdits {
  if (state.pending.some(e => e.id === id))
    return { ...state, pending: state.pending.map(e => e.id === id ? { ...e, undone: undone || undefined } : e) };
  return { ...state, toggles: [...state.toggles.filter(t => t.id !== id), { id, undone }] };
}

/** The change list to draw: confirmed changes in server order, then this browser's pending ones. */
export function sharedLayer(state: SharedEdits): EditLayer {
  const toggled = new Map(state.toggles.map(t => [t.id, t.undone]));
  const entries = [
    ...state.remote.map(r => {
      const undone = toggled.get(r.entry.id) ?? r.undone;
      return undone ? { ...r.entry, undone: true } : { ...r.entry, undone: undefined };
    }),
    ...state.pending
  ].map(e => (e.undone ? e : (({ undone: _u, ...rest }) => rest)(e)) as Edit);
  return { ...emptyEdits(), entries };
}
