"use client";

import { parseGraphDocument, type Edit, type GraphDocument, type RemoteEdit } from "@mossline/graph-core";

/** Talking to Mossline's shared-map endpoints. Maps travel gzip-compressed both ways. */
export type MapRole = "owner" | "editor" | "viewer";
export type SharedMapSummary = { id: string; title: string; role: MapRole; owner: string; nodes: number; edges: number;
  sourceVersion: number; members: number; updatedAt: string };
export type MapMember = { email: string; role: "editor" | "viewer"; joined: boolean; name: string };
export type SharedMapInfo = { id: string; title: string; sourceVersion: number; nodes: number; edges: number; owner: string;
  updatedAt: string; role: MapRole; members: MapMember[] };

export class SharedMapError extends Error { constructor(message: string, readonly status: number) { super(message); } }

async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
  let r: Response;
  try { r = await fetch(path, { cache: "no-store", credentials: "same-origin", ...init }); }
  catch { throw new SharedMapError("Can't reach Mossline. Check your connection.", 0); }
  const data = await r.json().catch(() => ({})) as T & { error?: string };
  if (!r.ok) throw new SharedMapError(data.error ?? "Something went wrong. Try again.", r.status);
  return data;
}
const send = (body: unknown) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function pack(title: string, graph: GraphDocument): Promise<Blob> {
  const stream = new Blob([JSON.stringify({ title, graph })]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
}
async function unpack(response: Response): Promise<GraphDocument> {
  const stream = response.body!.pipeThrough(new DecompressionStream("gzip"));
  const body = JSON.parse(await new Response(stream).text()) as { graph: unknown };
  return parseGraphDocument(body.graph);
}

export const sharedMaps = {
  list: () => json<{ maps: SharedMapSummary[]; canCreate: boolean }>("/api/maps"),
  info: (id: string) => json<SharedMapInfo>("/api/maps/" + id),
  create: async (title: string, graph: GraphDocument) => json<{ id: string; sourceVersion: number }>("/api/maps",
    { method: "POST", headers: { "Content-Type": "application/gzip" }, body: await pack(title, graph) }),
  source: async (id: string): Promise<{ graph: GraphDocument; version: number }> => {
    const r = await fetch("/api/maps/" + id + "/source", { cache: "no-store", credentials: "same-origin" });
    if (!r.ok) {
      const data = await r.json().catch(() => ({})) as { error?: string };
      throw new SharedMapError(data.error ?? "Couldn't open the map.", r.status);
    }
    return { version: Number(r.headers.get("X-Mossline-Source-Version")) || 1, graph: await unpack(r) };
  },
  replaceSource: async (id: string, version: number, title: string, graph: GraphDocument) =>
    json<{ sourceVersion: number }>("/api/maps/" + id + "/source?version=" + version,
      { method: "PUT", headers: { "Content-Type": "application/gzip" }, body: await pack(title, graph) }),
  remove: (id: string) => json<{ deleted: boolean }>("/api/maps/" + id, { method: "DELETE" }),
  edits: (id: string, since: number) => json<{ edits: RemoteEdit[]; version: number; sourceVersion: number }>("/api/maps/" + id + "/edits?since=" + since),
  pushEdits: (id: string, edits: Edit[], since: number) => json<{ edits: RemoteEdit[]; version: number; sourceVersion: number }>(
    "/api/maps/" + id + "/edits?since=" + since, { method: "POST", ...send({ edits }) }),
  toggle: (id: string, editId: string, undone: boolean) => json<{ ok: boolean }>("/api/maps/" + id + "/edits",
    { method: "PATCH", ...send({ id: editId, undone }) }),
  invite: (id: string, email: string, role: "editor" | "viewer") => json<{ members: MapMember[]; emailed: boolean }>(
    "/api/maps/" + id + "/members", { method: "POST", ...send({ email, role }) }),
  removeMember: (id: string, email: string) => json<{ members: MapMember[] }>(
    "/api/maps/" + id + "/members?email=" + encodeURIComponent(email), { method: "DELETE" })
};

export const sharedMapLink = (id: string) => window.location.origin + "/?map=" + id;
