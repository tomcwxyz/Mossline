import { NextResponse } from "next/server";
import { theListChangesToGraph } from "@mossline/graph-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fixed, read-only public source. No client-selected URL, no Supabase credentials,
 * no admin watch hits, and no unreviewed submissions enter this feed.
 */
const SOURCE = "https://the-list.uk/api/changes";
const PAGE_SIZE = 100;
const MAX_PAGES = 80;

type Page = { changes: unknown[]; total: number; totalPages: number };
async function fetchPage(page: number): Promise<Page> {
  const url = new URL(SOURCE);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(PAGE_SIZE));
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw Error("The List returned HTTP " + response.status + " for page " + page);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object") throw Error("The List returned an unexpected response.");
  const data = body as Record<string, unknown>;
  if (!Array.isArray(data.changes)) throw Error("The List did not return its public changes.");
  const total = Number(data.total);
  const pages = Number(data.totalPages);
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(pages) || pages < 1) {
    throw Error("The List's page counts were not valid.");
  }
  return { changes: data.changes, total, totalPages: pages };
}

export async function GET() {
  try {
    const first = await fetchPage(1);
    if (first.totalPages > MAX_PAGES) throw Error("The List's feed is larger than this alpha importer supports. No partial atlas was produced.");
    const all = [...first.changes];
    for (let start = 2; start <= first.totalPages; start += 4) {
      const pages = await Promise.all(Array.from(
        { length: Math.min(4, first.totalPages - start + 1) },
        (_, i) => fetchPage(start + i)
      ));
      if (pages.some(p => p.totalPages !== first.totalPages || p.total !== first.total))
        throw Error("The List changed during this import. Please try again.");
      for (const page of pages) all.push(...page.changes);
    }
    if (all.length !== first.total) throw Error("The List's published records changed during import. Please retry.");
    const { graph, count, skipped } = theListChangesToGraph(all);
    return NextResponse.json({ graph, count, skipped, source: SOURCE, licence: "CC BY-NC" }, {
      headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach The List.";
    return NextResponse.json({ error: "Couldn't build the atlas from The List right now.", detail: message }, {
      status: 502, headers: { "Cache-Control": "no-store" }
    });
  }
}
