"use client";

import { useCallback, useEffect, useState } from "react";
import { emptyEdits, parseEdits, recordEdit, setUndone, type Edit, type EditLayer } from "@mossline/graph-core";

/**
 * The changes made to one map in this browser, kept apart from its imported
 * records and saved under the map's own ID, so adding data again or
 * reopening the map keeps them.
 */
const KEY = "mossline:edits:v1:";
const EDITOR_KEY = "mossline:editor-name";

/** `enabled: false` (a published copy) never reads or writes this browser's storage. */
export function useMapEdits(mapId: string | undefined, enabled = true) {
  const key = KEY + (mapId ?? "unsaved");
  const [layer, setLayer] = useState<EditLayer>(emptyEdits);
  const [ready, setReady] = useState(false);
  const [editor, setEditorState] = useState("");
  useEffect(() => {
    if (!enabled) { setLayer(emptyEdits()); setReady(true); return; }
    try { setLayer(parseEdits(JSON.parse(window.localStorage.getItem(key) ?? "null"))); } catch { setLayer(emptyEdits()); }
    try { setEditorState(window.localStorage.getItem(EDITOR_KEY) ?? ""); } catch { /* storage blocked */ }
    setReady(true);
  }, [key, enabled]);
  const save = useCallback((next: EditLayer) => {
    setLayer(next);
    if (!enabled) return false;
    try { window.localStorage.setItem(key, JSON.stringify(next)); return true; } catch { return false; }
  }, [key, enabled]);
  const add = useCallback((edits: Edit[]) => save(edits.reduce(recordEdit, layer)), [layer, save]);
  const undo = useCallback((id: string, undone = true) => save(setUndone(layer, id, undone)), [layer, save]);
  const replace = useCallback((next: EditLayer) => save(next), [save]);
  const setEditor = useCallback((name: string) => {
    setEditorState(name);
    try { window.localStorage.setItem(EDITOR_KEY, name); } catch { /* storage blocked */ }
  }, []);
  return { layer, ready, add, undo, replace, editor, setEditor };
}
