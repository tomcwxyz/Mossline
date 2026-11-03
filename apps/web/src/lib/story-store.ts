"use client";

import { parseStory, type Story } from "@mossline/graph-core";
import { deleteIndexedDbRecord, getAllIndexedDbRecords, writeIndexedDbRecords, type IndexedDbStoreSpec } from "./indexeddb-store";

/**
 * Stories live in this browser beside their map, in IndexedDB: images make
 * them too big for local storage. Each record is a story plus the map it
 * belongs to.
 */
const STORE: IndexedDbStoreSpec = {
  database: "mossline-stories-v1", store: "stories", version: 1,
  unavailable: "This browser can't keep stories (IndexedDB is unavailable)",
  openError: "Couldn't open story storage", blocked: "Story storage is in use by another tab"
};
type Row = { id: string; mapKey: string; story: Story };
const messages = { aborted: "Couldn't save the story. Your browser may be out of space." };

export async function listStories(mapKey: string): Promise<Story[]> {
  const rows = await getAllIndexedDbRecords<Row>(STORE, "Couldn't read stories");
  const out: Story[] = [];
  for (const r of rows) if (r.mapKey === mapKey) { try { out.push(parseStory(r.story)); } catch { /* a damaged story is left alone */ } }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function saveStory(mapKey: string, story: Story): Promise<Story> {
  const saved = { ...story, updatedAt: new Date().toISOString() };
  await writeIndexedDbRecords<Row>(STORE, [{ id: story.id, mapKey, story: saved }], "put", messages);
  return saved;
}
export async function removeStory(id: string): Promise<void> {
  await deleteIndexedDbRecord(STORE, id, "Couldn't delete the story");
}

/** Shrinks an uploaded image to at most 1600 pixels across, as JPEG, so stories stay light to keep and publish. */
export async function prepareImage(file: File, max = 1600): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw Error("Choose a PNG, JPEG, WebP or GIF image.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("This browser can't prepare images.");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", 0.82);
  if (url.length > 2_000_000) throw Error("That image is still too large after shrinking. Try a smaller one.");
  return url;
}
