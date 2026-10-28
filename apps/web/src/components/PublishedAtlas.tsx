"use client";

import { useMemo } from "react";
import { applyNodeStyleImages, sharedSnapshotGraph, type PublishedSnapshot } from "@mossline/graph-core";
import { FieldAtlasWorkspace } from "./FieldAtlasWorkspace";

/**
 * A published map, opened in the same atlas people publish from, read-only.
 * Nothing is read from or written to the visitor's browser storage.
 */
export function PublishedAtlas({ snapshot }: { snapshot: PublishedSnapshot }) {
  const graph = useMemo(() => applyNodeStyleImages(sharedSnapshotGraph(snapshot), snapshot.nodeStyles ?? {}), [snapshot]);
  const home = () => { window.location.href = "/"; };
  return <FieldAtlasWorkspace graph={graph} readOnly onBack={home} onImport={home} onAdvanced={home}/>;
}
