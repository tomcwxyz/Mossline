"use client";

import { useEffect, useRef, useState } from "react";
import type { Core } from "cytoscape";
import type { GraphDocument } from "@mossline/graph-core";

interface Props {
  graph: GraphDocument;
  contextNodeIds: string[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/** The renderer never mutates the canonical graph. Cytoscape is loaded client-side. */
export function GraphCanvas({ graph, contextNodeIds, selectedId, onSelect }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let disposed = false;
    void import("cytoscape").then(({ default: cytoscape }) => {
      if (disposed || !rootRef.current) return;
      const cy = cytoscape({
        container: rootRef.current,
        elements: [],
        wheelSensitivity: 0.18,
        minZoom: 0.25,
        maxZoom: 3,
        style: [
          { selector: "node", style: {
            "background-color": "#779a7c", "border-color": "#d0e0c9", "border-width": 2,
            "label": "data(label)", "color": "#e8f1e7", "font-size": 11,
            "text-wrap": "wrap", "text-max-width": "115px", "text-margin-y": 9,
            "text-valign": "bottom", "width": 31, "height": 31,
            "text-outline-color": "#132d28", "text-outline-width": 2,
            "overlay-opacity": 0
          } },
          { selector: "node[imageUrl]", style: {
            "background-image": "data(imageUrl)", "background-fit": "cover", "background-clip": "node",
            "border-width": 3, "width": 50, "height": 50
          } },
          { selector: "node.organisation", style: { "background-color": "#77af86", "width": 37, "height": 37 } },
          { selector: "node.project", style: { "background-color": "#d5b06c", "border-color": "#f1dca9", "shape": "round-rectangle" } },
          { selector: "node.funder", style: { "background-color": "#80a8cb", "border-color": "#c5d9eb", "shape": "diamond" } },
          { selector: "node.person", style: { "background-color": "#cba5b5" } },
          { selector: "node.place", style: { "background-color": "#a6afa5", "shape": "hexagon" } },
          { selector: "node.context", style: { "opacity": 0.34 } },
          { selector: "node.active", style: { "border-color": "#f6e9b6", "border-width": 5, "width": 47, "height": 47, "opacity": 1 } },
          { selector: "edge", style: {
            "width": 1.35, "line-color": "#66877a", "opacity": 0.66,
            "curve-style": "bezier", "target-arrow-shape": "triangle",
            "target-arrow-color": "#66877a", "arrow-scale": 0.55
          } },
          { selector: 'edge[direction = "undirected"]', style: { "target-arrow-shape": "none" } },
          { selector: 'edge[direction = "mutual"]', style: { "source-arrow-shape": "triangle", "source-arrow-color": "#66877a" } },
          { selector: "edge[?inferred]", style: { "line-style": "dashed", "line-color": "#c4aa78", "target-arrow-shape": "none", "source-arrow-shape": "none" } },
          { selector: "edge.active", style: { "width": 3, "opacity": 1, "line-color": "#ecdbab", "target-arrow-color": "#ecdbab" } }
        ]
      });
      cy.on("tap", "node", event => onSelectRef.current(event.target.id()));
      cy.on("tap", event => { if (event.target === cy) onSelectRef.current(null); });
      cyRef.current = cy;
      setReady(true);
    });
    return () => { disposed = true; cyRef.current?.destroy(); cyRef.current = null; };
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !ready) return;
    cy.elements().remove();
    const context = new Set(contextNodeIds);
    cy.add([
      ...graph.nodes.map(node => ({
        data: { id: node.id, label: node.label, ...(node.imageUrl ? { imageUrl: node.imageUrl } : {}) },
        classes: node.type + (context.has(node.id) ? " context" : "")
      })),
      ...graph.edges.map(edge => ({ data: {
        id: edge.id, source: edge.source, target: edge.target, inferred: edge.inferred ?? false,
        direction: edge.direction ?? "directed"
      } }))
    ]);
    if (cy.nodes().length) cy.layout({ name: "cose", animate: false, randomize: false, fit: true, padding: 75 }).run();
    cy.resize();
  }, [graph, contextNodeIds, ready]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !ready) return;
    cy.elements().removeClass("active");
    if (!selectedId) return;
    const selected = cy.getElementById(selectedId);
    selected.addClass("active");
    selected.connectedEdges().addClass("active");
  }, [selectedId, graph, ready]);

  return <div ref={rootRef} aria-label="Interactive network visualisation; use the entity list to navigate without a pointer" role="img" className="graph-canvas" />;
}
