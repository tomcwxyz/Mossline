"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { newStory, storyId, type Story } from "@mossline/graph-core";
import { listStories, removeStory, saveStory } from "../lib/story-store";
import { mapStories, StoryConflict } from "../lib/shared-maps-client";

/**
 * A map's stories, wherever they're kept:
 * - a published page: the one story it was published with, read only;
 * - a map in this browser: IndexedDB, beside the map;
 * - a shared map: on the server, so everyone with the map sees them. Viewers
 *   read; owners and editors write. Stories still in this browser can be moved in.
 *
 * Typing is saved a moment after it stops, when focus leaves the editor, and
 * when the page is left. Saves to a shared map go one at a time, each over the
 * version last seen; if someone else saved first, theirs is shown and the
 * writer's is kept as a copy, so nothing anyone wrote is lost.
 */
export function useStories({ storeKey, sharedId, readOnly, published, active, onNotice }: {
  storeKey: string; sharedId?: string; readOnly: boolean; published?: Story;
  /** Stories are open: check the shared map for others' changes. */
  active: boolean; onNotice: (message: string) => void;
}) {
  const [stories, setStories] = useState<Story[]>(published ? [published] : []);
  const [canWrite, setCanWrite] = useState(!readOnly);
  /** On a shared map: stories in this browser that aren't in the shared map yet. */
  const [local, setLocal] = useState<Story[]>([]);
  const versions = useRef(new Map<string, number>());
  const pending = useRef<Story | null>(null);
  const saving = useRef(new Set<string>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notice = useRef(onNotice); notice.current = onNotice;
  const failed = (e: unknown, fallback: string) => notice.current(e instanceof Error ? e.message : fallback);

  // ---- Loading ------------------------------------------------------------------
  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    versions.current.clear();
    setStories([]); setLocal([]);
    listStories(storeKey).then(list => { if (!cancelled) (sharedId ? setLocal : setStories)(list); })
      .catch(() => { /* this browser can't keep stories */ });
    return () => { cancelled = true; };
  }, [storeKey, sharedId, readOnly]);

  const refresh = useCallback(async () => {
    if (!sharedId || readOnly) return;
    try {
      const { stories: summaries, canWrite: writer } = await mapStories.list(sharedId);
      setCanWrite(writer);
      const fresh = new Map<string, Story>();
      for (const s of summaries) {
        if (versions.current.get(s.id) === s.version || saving.current.has(s.id) || pending.current?.id === s.id) continue;
        const got = await mapStories.get(sharedId, s.id);
        versions.current.set(s.id, got.version); fresh.set(s.id, got.story);
      }
      const listed = new Set(summaries.map(s => s.id));
      setStories(current => {
        // Someone else deleted a story: it goes, unless it's being saved here right now.
        const kept = current.filter(s => listed.has(s.id) || saving.current.has(s.id) || pending.current?.id === s.id)
          .map(s => fresh.get(s.id) ?? s);
        const added = [...fresh.values()].filter(s => !kept.some(k => k.id === s.id));
        return [...added, ...kept];
      });
    } catch { /* offline for now: the next check will catch up */ }
  }, [sharedId, readOnly]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!sharedId || !active) return;
    void refresh();
    const every = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15_000);
    return () => window.clearInterval(every);
  }, [sharedId, active, refresh]);

  // ---- Saving ---------------------------------------------------------------------
  const write = useCallback((story: Story) => {
    if (!sharedId) return saveStory(storeKey, story).then(() => {}, e => failed(e, "Couldn't save the story."));
    saving.current.add(story.id);
    queue.current = queue.current.then(async () => {
      try {
        versions.current.set(story.id, await mapStories.save(sharedId, story, versions.current.get(story.id) ?? 0));
      } catch (e) {
        if (!(e instanceof StoryConflict)) { failed(e, "Couldn't save the story."); return; }
        // Someone else saved first: show theirs, and keep this one as a copy.
        const copy: Story = { ...story, id: storyId("story:"), title: (story.title + " (your version)").slice(0, 140) };
        try { versions.current.set(copy.id, await mapStories.save(sharedId, copy, 0)); }
        catch (again) { failed(again, "Couldn't keep your version."); return; }
        if (e.current) versions.current.set(story.id, e.current.version);
        setStories(list => [copy, ...list.map(s => s.id === story.id && e.current ? e.current.story : s)
          .filter(s => s.id !== story.id || e.current)]);
        notice.current("Someone else changed “" + story.title + "” while you were writing. Theirs is shown; yours is kept as “" + copy.title + "”.");
      } finally { saving.current.delete(story.id); }
    });
    return queue.current;
  }, [sharedId, storeKey]);

  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const story = pending.current; pending.current = null;
    if (story) void write(story);
  }, [write]);
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, [flush]);

  const change = useCallback((next: Story) => {
    setStories(list => list.map(s => s.id === next.id ? next : s));
    if (readOnly || !canWrite) return;
    if (pending.current && pending.current.id !== next.id) flush();
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 300);
  }, [readOnly, canWrite, flush]);

  const create = useCallback((title: string): Story => {
    flush();
    const s = newStory(title);
    setStories(list => [s, ...list]);
    void write(s);
    return s;
  }, [flush, write]);

  const remove = useCallback((id: string) => {
    if (pending.current?.id === id) { pending.current = null; if (timer.current) clearTimeout(timer.current); }
    setStories(list => list.filter(s => s.id !== id));
    const done = sharedId ? queue.current.then(() => mapStories.remove(sharedId, id)).then(() => { versions.current.delete(id); })
      : removeStory(id);
    done.catch(() => notice.current("Couldn't delete the story."));
  }, [sharedId]);

  /** Moves this browser's stories for the map into the shared map, then removes them here. */
  const moveLocal = useCallback(async () => {
    if (!sharedId) return;
    const moving = local;
    let moved = 0;
    for (const s of moving) {
      try {
        versions.current.set(s.id, await mapStories.save(sharedId, s, 0));
        await removeStory(s.id).catch(() => {});
        setStories(list => list.some(x => x.id === s.id) ? list : [s, ...list]);
        moved++;
      } catch (e) {
        if (e instanceof StoryConflict) { await removeStory(s.id).catch(() => {}); moved++; continue; } // already there
        failed(e, "Couldn't move “" + s.title + "”."); break;
      }
    }
    setLocal(list => list.slice(moved));
    if (moved) notice.current(moved === 1 ? "Story moved into the shared map." : moved + " stories moved into the shared map.");
  }, [sharedId, local]);

  return { stories, canWrite: !readOnly && canWrite, shared: !!sharedId, local, change, create, remove, flush, moveLocal, refresh };
}
