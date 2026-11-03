"use client";

import { useMemo } from "react";
import { applyNodeStyleImages, sharedSnapshotGraph, type HostedSnapshot } from "@mossline/graph-core";
import { FieldAtlasWorkspace } from "./FieldAtlasWorkspace";

/**
 * A published map, opened in the same atlas people publish from, read-only.
 * Nothing is read from or written to the visitor's browser storage. Embedded
 * in another site, it keeps to a slim header with a way out to the full page.
 */
export function PublishedAtlas({ snapshot, slug, embedded = false }: { snapshot: HostedSnapshot; slug?: string; embedded?: boolean }) {
  const graph = useMemo(() => applyNodeStyleImages(sharedSnapshotGraph(snapshot), snapshot.nodeStyles ?? {}), [snapshot]);
  const home = () => { window.location.href = "/"; };
  return <FieldAtlasWorkspace graph={graph} readOnly onBack={home} onImport={home} onAdvanced={home} story={snapshot.story}
    published={slug ? { slug, embedded } : undefined}/>;
}
