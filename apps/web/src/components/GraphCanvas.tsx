"use client";

import { useEffect, useRef, useState } from "react";
import type { Core } from "cytoscape";
import type { GraphDocument } from "@mossline/graph-core";

export type NetworkLayout = "organic" | "radial";
export type LabelDensity = "essential" | "all";

interface Props {
  graph: GraphDocument;
  contextNodeIds: string[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  view: "landscape" | "collaborations";
  layoutMode: NetworkLayout;
  labelDensity: LabelDensity;
}

type Point = { x: number; y: number };

/** Cytoscape only renders a projection. The graph data remains immutable here. */
export function GraphCanvas({
  graph, contextNodeIds, selectedId, onSelect, view, layoutMode, labelDensity
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const onSelectRef = useRef(onSelect);
  const viewKeyRef = useRef("");
  const positionCacheRef = useRef(new Map<string, Map<string, Point>>());
  const labelsRef = useRef(labelDensity);
  const selectedRef = useRef(selectedId);
  const [ready, setReady] = useState(false);

  onSelectRef.current = onSelect;
  labelsRef.current = labelDensity;
  selectedRef.current = selectedId;

  function refreshLabels(cy: Core) {
    const all = labelsRef.current === "all" || cy.zoom() > 1.25 || cy.nodes().length < 22;
    cy.nodes().forEach(node => {
      const show = all || node.hasClass("key-node") || node.id() === selectedRef.current ||
        (selectedRef.current !== null && node.connectedEdges().connectedNodes().some(n => n.id() === selectedRef.current));
      if (show) node.removeClass("label-hidden");
      else node.addClass("label-hidden");
    });
  }

  useEffect(() => {
    let cancelled = false;
    void import("cytoscape").then(({ default: cytoscape }) => {
      if (cancelled || !rootRef.current) return;
      const cy = cytoscape({
        container: rootRef.current,
        elements: [],
        wheelSensitivity: 0.16,
        minZoom: 0.18,
        maxZoom: 3.5,
        boxSelectionEnabled: false,
        style: [
          { selector: "node", style: {
            "background-color": "#779a7c", "border-color": "#d0e0c9", "border-width": 2,
            "label": "data(label)", "color": "#f0f5e9", "font-size": 12,
            "font-family": "Arial, sans-serif", "font-weight": 500,
            "text-wrap": "wrap", "text-max-width": "125px", "text-margin-y": 9,
            "text-valign": "bottom", "width": 36, "height": 36,
            "text-outline-color": "#143028", "text-outline-width": 2.2,
            "overlay-opacity": 0, "transition-property": "opacity, border-width, border-color",
            "transition-duration": "0.17s"
          } },
          { selector: "node[imageUrl]", style: {
            "background-image": "data(imageUrl)", "background-fit": "cover",
            "background-clip": "node", "border-width": 3, "width": 54, "height": 54
          } },
          { selector: "node.organisation", style: { "background-color": "#88b793", "border-color": "#c9e3c9", "width": 40, "height": 40 } },
          { selector: "node.project", style: { "background-color": "#d9b675", "border-color": "#f4e0b6", "shape": "round-rectangle", "width": 31, "height": 31 } },
          { selector: "node.funder", style: { "background-color": "#80a8cb", "border-color": "#d4e5ef", "shape": "diamond", "width": 30, "height": 30 } },
          { selector: "node.person", style: { "background-color": "#cba5b5" } },
          { selector: "node.place", style: { "background-color": "#99b6a6", "shape": "hexagon", "width": 27, "height": 27 } },
          { selector: "node.context", style: { "opacity": 0.32 } },
          { selector: "node.key-node", style: { "border-width": 4, "width": 50, "height": 50,
            "font-weight": 700, "font-size": 13 } },
          { selector: "node.label-hidden", style: { "text-opacity": 0 } },
          { selector: "node.active", style: { "border-color": "#f7e9b4", "border-width": 6, "opacity": 1,
            "z-index": 20, "text-opacity": 1 } },
          { selector: "node.nearby", style: { "opacity": 1, "text-opacity": 1 } },
          { selector: "node.dimmed", style: { "opacity": 0.15 } },
          { selector: "edge", style: {
            "width": 1.4, "line-color": "#8ca497", "opacity": 0.43,
            "curve-style": "bezier", "target-arrow-shape": "triangle",
            "target-arrow-color": "#8ca497", "arrow-scale": 0.48
          } },
          { selector: 'edge[direction = "undirected"]', style: { "target-arrow-shape": "none" } },
          { selector: 'edge[direction = "mutual"]', style: { "source-arrow-shape": "triangle", "source-arrow-color": "#8ca497" } },
          { selector: "edge[?inferred]", style: { "line-style": "dashed", "line-color": "#d1b47a",
            "target-arrow-shape": "none", "source-arrow-shape": "none", "opacity": 0.3 } },
          { selector: "edge.active", style: { "width": 2.5, "opacity": 0.95,
            "line-color": "#efd49a", "target-arrow-color": "#efd49a" } },
          { selector: "edge.dimmed", style: { "opacity": 0.035 } }
        ]
      });
      cy.on("tap", "node", event => onSelectRef.current(event.target.id()));
      cy.on("tap", event => { if (event.target === cy) onSelectRef.current(null); });
      cy.on("zoom", () => refreshLabels(cy));
      cy.on("dragfree", "node", event => {
        const key = viewKeyRef.current;
        const saved = positionCacheRef.current.get(key) ?? new Map<string, Point>();
        saved.set(event.target.id(), { ...event.target.position() });
        positionCacheRef.current.set(key, saved);
      });
      cyRef.current = cy;
      setReady(true);
    });
    return () => {
      cancelled = true;
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !ready) return;
    const key = view + ":" + layoutMode;
    const oldKey = viewKeyRef.current;
    if (oldKey && oldKey !== key) {
      const snapshot = positionCacheRef.current.get(oldKey) ?? new Map<string, Point>();
      cy.nodes().forEach(node => snapshot.set(node.id(), { ...node.position() }));
      positionCacheRef.current.set(oldKey, snapshot);
    }
    const cached = positionCacheRef.current.get(key);
    const cachedCount = graph.nodes.filter(n => cached?.has(n.id)).length;
    const reuse = !!cached && cachedCount === graph.nodes.length && graph.nodes.length > 0;
    const context = new Set(contextNodeIds);
    const degrees = new Map<string, number>();
    for (const e of graph.edges) {
      degrees.set(e.source, (degrees.get(e.source) ?? 0) + 1);
      degrees.set(e.target, (degrees.get(e.target) ?? 0) + 1);
    }
    const degreeThreshold = [...degrees.values()].sort((a, b) => b - a)[Math.min(7, degrees.size - 1)] ?? Infinity;
    cy.elements().remove();
    cy.add([
      ...graph.nodes.map(node => ({
        data: { id: node.id, label: node.label, ...(node.imageUrl ? { imageUrl: node.imageUrl } : {}),
          degree: degrees.get(node.id) ?? 0 },
        position: cached?.get(node.id),
        classes: [node.type, context.has(node.id) ? "context" : "",
          (degrees.get(node.id) ?? 0) > 1 && (degrees.get(node.id) ?? 0) >= degreeThreshold ? "key-node" : ""]
          .filter(Boolean).join(" ")
      })),
      ...graph.edges.map(edge => ({ data: {
        id: edge.id, source: edge.source, target: edge.target, inferred: edge.inferred ?? false,
        direction: edge.direction ?? "directed"
      } }))
    ]);

    if (cy.nodes().length) {
      if (reuse) {
        cy.layout({ name: "preset", fit: false }).run();
      } else if (layoutMode === "radial") {
        cy.layout({ name: "concentric", animate: false, fit: false, padding: 80,
          minNodeSpacing: 55, concentric: node => node.degree(), levelWidth: () => 2 }).run();
      } else {
        cy.layout({ name: "cose", animate: false, randomize: false, fit: false, padding: 65,
          nodeRepulsion: () => 130000, idealEdgeLength: () => 110,
          edgeElasticity: () => 85, gravity: 0.32, numIter: 1100 }).run();
      }
      if (!reuse || oldKey !== key) cy.fit(undefined, 65);
      const saved = positionCacheRef.current.get(key) ?? new Map<string, Point>();
      cy.nodes().forEach(node => saved.set(node.id(), { ...node.position() }));
      positionCacheRef.current.set(key, saved);
    }
    viewKeyRef.current = key;
    cy.resize();
    refreshLabels(cy);
  }, [graph, contextNodeIds, layoutMode, view, ready]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !ready) return;
    cy.elements().removeClass("active nearby dimmed");
    if (selectedId) {
      const node = cy.getElementById(selectedId);
      if (node.length) {
        cy.elements().addClass("dimmed");
        node.removeClass("dimmed").addClass("active");
        node.connectedEdges().removeClass("dimmed").addClass("active");
        node.connectedEdges().connectedNodes().removeClass("dimmed").addClass("nearby");
      }
    }
    refreshLabels(cy);
  }, [selectedId, graph, ready, labelDensity]);

  const zoom = (factor: number) => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.zoom({ level: Math.min(3.5, Math.max(0.18, cy.zoom() * factor)),
      renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  };

  return <div className="graph-stage">
    <div ref={rootRef} aria-label="Interactive network map. Click an entity to inspect it, drag to pan and scroll to zoom." role="img" className="graph-canvas" />
    <div className="graph-tools" aria-label="Network navigation">
      <button type="button" onClick={() => zoom(1.35)} aria-label="Zoom in" title="Zoom in">+</button>
      <button type="button" onClick={() => zoom(1 / 1.35)} aria-label="Zoom out" title="Zoom out">−</button>
      <button type="button" onClick={() => cyRef.current?.fit(undefined, 65)} aria-label="Fit network to view" title="Fit to view">⤢</button>
    </div>
    <div className="graph-legend" aria-label="Network legend">
      <span><i className="legend-symbol organisation" /> Organisation</span>
      <span><i className="legend-symbol project" /> Project</span>
      <span><i className="legend-symbol funder" /> Funder</span>
      {view === "collaborations" && <span><i className="legend-symbol inferred" /> Shared association</span>}
    </div>
  </div>;
}
