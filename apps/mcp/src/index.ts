import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import {
  neighbours, parseGraphDocument, searchNodes, shortestPath, collaborationGraph,
  type GraphDocument
} from "@mossline/graph-core";

const DEFAULT_DATA = fileURLToPath(new URL("../../../data/demo.json", import.meta.url));
const DATA_PATH = resolve(process.env.MOSSLINE_DATA_FILE ?? DEFAULT_DATA);

function readMap(): GraphDocument {
  return parseGraphDocument(JSON.parse(readFileSync(DATA_PATH, "utf8")));
}
function result(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
serveStdio(() => {
  const server = new McpServer({ name: "mossline", version: "0.1.0" });
  server.registerTool("list_maps", {
    description: "List locally configured maps (currently one graph document).",
    inputSchema: z.object({})
  }, async () => {
    const graph = readMap();
    return result([{ id: "default", title: graph.title, description: graph.description, entities: graph.nodes.length, relationships: graph.edges.length }]);
  });
  server.registerTool("search_entities", {
    description: "Search by name, region, description and tags.",
    inputSchema: z.object({ query: z.string().default("") })
  }, async ({ query }) => result(searchNodes(readMap(), query)));
  server.registerTool("get_entity", {
    description: "Get a map entity and its directly recorded relationships.",
    inputSchema: z.object({ id: z.string() })
  }, async ({ id }) => {
    const graph = readMap();
    const entity = graph.nodes.find(n => n.id === id);
    if (!entity) return result({ error: "Not found" });
    return result({ entity, neighbours: neighbours(graph, id), edges: graph.edges.filter(e => e.source === id || e.target === id) });
  });
  server.registerTool("get_neighbourhood", {
    description: "Explore a node and its immediate neighbours (one hop).",
    inputSchema: z.object({ id: z.string() })
  }, async ({ id }) => {
    const graph = readMap();
    const node = graph.nodes.find(n => n.id === id);
    if (!node) return result({ error: "Not found" });
    const ids = new Set([id, ...neighbours(graph, id).map(n => n.id)]);
    return result({ nodes: graph.nodes.filter(n => ids.has(n.id)), edges: graph.edges.filter(e => ids.has(e.source) && ids.has(e.target)) });
  });
  server.registerTool("find_paths", {
    description: "Find the shortest undirected relationship path between two entity IDs.",
    inputSchema: z.object({ from: z.string(), to: z.string() })
  }, async ({ from, to }) => {
    const graph = readMap();
    const ids = shortestPath(graph, from, to);
    return result({ path: ids?.map(id => graph.nodes.find(n => n.id === id)) ?? null, hops: ids ? ids.length - 1 : null });
  });
  server.registerTool("get_collaborations", {
    description: "Return organisation-only relationships. Inferred links mean shared associations, NOT verified partnerships.",
    inputSchema: z.object({ basis: z.enum(["all", "project", "funder", "recorded"]).default("all") })
  }, async ({ basis }) => result(collaborationGraph(readMap(), basis)));
  return server;
});
