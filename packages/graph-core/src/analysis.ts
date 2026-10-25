import type { GraphDocument } from "./schema";
import type { ConnectionStep, ConnectionTrail } from "./relationships";

export interface RouteOptions {
  maxHops?: number;
  maxRoutes?: number;
  /** Exact relationship types omitted from the analysis. Not keyword matching. */
  excludeTypes?: string[];
  /** Only walk directed links the way they point (cause → effect, activity → outcome). */
  followDirection?: boolean;
}

export interface ReachableDestination {
  nodeId: string;
  label: string;
  type: GraphDocument["nodes"][number]["type"];
  /** The shortest number of recorded relationships needed to reach this entity. */
  hops: number;
}

/**
 * All destinations reachable from a chosen entity within a bounded number
 * of SOURCE-RECORDED relationships, ignoring inferred collaboration shortcuts.
 * Discovery is undirected, but following a path still shows the original
 * direction of every source record. Every offered destination has a path.
 */
export function findReachableDestinations(
  graph: GraphDocument, fromId: string, options: Pick<RouteOptions,"maxHops"|"excludeTypes"> = {}
): ReachableDestination[] {
  const maxHops=options.maxHops??5;
  if(!Number.isInteger(maxHops)||maxHops<1||maxHops>8)return [];
  const nodes=new Map(graph.nodes.map(n=>[n.id,n]));
  if(!nodes.has(fromId))return [];
  const blocked=new Set(options.excludeTypes??[]);
  const adjacent=new Map<string,Set<string>>();
  for(const edge of graph.edges) {
    if(edge.inferred||blocked.has(edge.type)||edge.source===edge.target||
      !nodes.has(edge.source)||!nodes.has(edge.target))continue;
    if(!adjacent.has(edge.source))adjacent.set(edge.source,new Set());
    if(!adjacent.has(edge.target))adjacent.set(edge.target,new Set());
    adjacent.get(edge.source)!.add(edge.target);
    adjacent.get(edge.target)!.add(edge.source);
  }
  const queue=[fromId],visited=new Map([[fromId,0]]);
  for(let i=0;i<queue.length;i++) {
    const id=queue[i],hops=visited.get(id)!;
    if(hops>=maxHops)continue;
    for(const target of adjacent.get(id)??[]) {
      if(visited.has(target))continue;
      visited.set(target,hops+1);
      queue.push(target);
    }
  }
  return [...visited].filter(([id])=>id!==fromId)
    .map(([id,hops])=>({nodeId:id,label:nodes.get(id)!.label,
      type:nodes.get(id)!.type,hops}))
    .sort((a,b)=>a.hops-b.hops||a.label.localeCompare(b.label)||
      a.nodeId.localeCompare(b.nodeId));
}

/**
 * Return a small set of distinct simple routes (shortest first) through recorded
 * relationships. Edges are traversed both ways for discovery but retain their
 * original direction. Inferred associations are excluded by definition.
 *
 * Results are not exhaustive: candidate expansion is capped to keep browser
 * work bounded even for dense or malformed imported networks.
 */
export function findRecordedRoutes(
  graph: GraphDocument, from: string, to: string, options: RouteOptions = {}
): ConnectionTrail[] {
  const maxHops = options.maxHops ?? 5;
  const maxRoutes = options.maxRoutes ?? 3;
  if (!Number.isInteger(maxHops) || maxHops < 0 || maxHops > 8 ||
      !Number.isInteger(maxRoutes) || maxRoutes < 1 || maxRoutes > 10) return [];
  const ids = new Set(graph.nodes.map(n => n.id));
  if (!ids.has(from) || !ids.has(to)) return [];
  if (from === to) return [{ nodeIds: [from], steps: [] }];
  const blocked = new Set(options.excludeTypes ?? []);
  const adjacent = new Map<string, ConnectionStep[]>();
  for (const edge of graph.edges) {
    if (edge.inferred || blocked.has(edge.type)) continue;
    const direction = edge.direction ?? "directed";
    const forward: ConnectionStep = {
      edgeId: edge.id, fromId: edge.source, toId: edge.target,
      relation: edge.type, direction, forward: true
    };
    const reverse: ConnectionStep = { ...forward, fromId: edge.target, toId: edge.source, forward: false };
    adjacent.set(edge.source, [...(adjacent.get(edge.source) ?? []), forward]);
    // Following direction: a directed link is only walked the way it points.
    if (!options.followDirection || direction !== "directed")
      adjacent.set(edge.target, [...(adjacent.get(edge.target) ?? []), reverse]);
  }
  // Stable output independent of CSV row ordering.
  for (const links of adjacent.values()) links.sort((a, b) =>
    a.toId.localeCompare(b.toId) || a.edgeId.localeCompare(b.edgeId));

  // Find one shortest path without enumerating exponentially many alternatives.
  // This guarantees that every reachable destination offered by the selector
  // can actually be opened, even in dense datasets.
  const visited=new Set([from]);
  const trailTo=new Map<string,ConnectionStep>();
  const queue=[from];
  for(let i=0;i<queue.length&&!visited.has(to);i++) {
    const current=queue[i];
    let hops=0;
    for(let node=current;node!==from;node=trailTo.get(node)!.fromId)hops++;
    if(hops>=maxHops)continue;
    for(const step of adjacent.get(current)??[]) {
      if(visited.has(step.toId))continue;
      visited.add(step.toId);trailTo.set(step.toId,step);queue.push(step.toId);
    }
  }
  if(!visited.has(to))return [];
  const shortestSteps:ConnectionStep[]=[];
  for(let node=to;node!==from;node=trailTo.get(node)!.fromId)shortestSteps.push(trailTo.get(node)!);
  shortestSteps.reverse();
  const shortest:ConnectionTrail={nodeIds:[from,...shortestSteps.map(s=>s.toId)],steps:shortestSteps};
  if(maxRoutes===1)return [shortest];

  const pending: ConnectionTrail[] = [{ nodeIds: [from], steps: [] }];
  const results: ConnectionTrail[] = [shortest];
  const seenRoutes = new Set<string>([shortest.nodeIds.join("\u0000")]);
  const MAX_CANDIDATES = 20000;
  let expanded = 0;
  for (let i = 0; i < pending.length && expanded < MAX_CANDIDATES; i++, expanded++) {
    const route = pending[i];
    const end = route.nodeIds[route.nodeIds.length - 1];
    if (end === to) {
      const key = route.nodeIds.join("\u0000");
      if (!seenRoutes.has(key)) {
        seenRoutes.add(key);
        results.push(route);
      }
      if (results.length >= maxRoutes) break;
      continue;
    }
    if (route.steps.length >= maxHops) continue;
    for (const step of adjacent.get(end) ?? []) {
      if (route.nodeIds.includes(step.toId)) continue; // No loops through the same entity.
      pending.push({nodeIds: [...route.nodeIds, step.toId], steps: [...route.steps, step]});
    }
    // A graph can be highly connected: refuse runaway memory/time work.
    if (pending.length > MAX_CANDIDATES * 5) break;
  }
  return results;
}

export interface StructuralJunction {
  nodeId: string;
  degree: number;
  /** Number of groups left inside its original component if removed. */
  separatedGroups: number;
}

/**
 * Articulation points of the UNDIRECTED, recorded-only network.
 * Structural bottlenecks do not imply causal importance, leadership or trust.
 * Tarjan DFS is linear in vertices + edges, including disconnected graphs.
 */
/** Tarjan articulation points, implemented with an explicit DFS stack.
 * Deep organisation or project chains can contain tens of thousands of nodes:
 * recursive DFS would overflow an Android/desktop JavaScript call stack.
 * Each recorded undirected adjacency is visited a constant number of times.
 */
export function findStructuralJunctions(graph: GraphDocument): StructuralJunction[] {
  const adjacent=new Map(graph.nodes.map(node=>[node.id,new Set<string>()]));
  for(const edge of graph.edges){
    if(edge.inferred||edge.source===edge.target)continue;
    adjacent.get(edge.source)?.add(edge.target);
    adjacent.get(edge.target)?.add(edge.source);
  }
  type Frame={id:string;next:number;adjacent:string[]};
  const discovered=new Map<string,number>(),low=new Map<string,number>();
  const parent=new Map<string,string>(),children=new Map<string,number>();
  const separatingChildren=new Map<string,number>();
  const result:StructuralJunction[]=[];
  let tick=0;
  for(const root of adjacent.keys()){
    if(discovered.has(root))continue;
    discovered.set(root,++tick);low.set(root,tick);
    const stack:Frame[]=[{id:root,next:0,adjacent:[...(adjacent.get(root)??[])]}];
    while(stack.length){
      const frame=stack[stack.length-1];
      if(frame.next<frame.adjacent.length){
        const next=frame.adjacent[frame.next++];
        if(!discovered.has(next)){
          parent.set(next,frame.id);
          children.set(frame.id,(children.get(frame.id)??0)+1);
          discovered.set(next,++tick);low.set(next,tick);
          stack.push({id:next,next:0,adjacent:[...(adjacent.get(next)??[])]});
        }else if(next!==parent.get(frame.id)){
          low.set(frame.id,Math.min(low.get(frame.id)!,discovered.get(next)!));
        }
        continue;
      }
      stack.pop();
      const ancestor=parent.get(frame.id);
      if(ancestor){
        low.set(ancestor,Math.min(low.get(ancestor)!,low.get(frame.id)!));
        if(low.get(frame.id)!>=discovered.get(ancestor)!)
          separatingChildren.set(ancestor,(separatingChildren.get(ancestor)??0)+1);
      }
      const isRoot=!parent.has(frame.id);
      const childCount=children.get(frame.id)??0;
      const cutCount=separatingChildren.get(frame.id)??0;
      if((isRoot&&childCount>1)||(!isRoot&&cutCount>0)){
        result.push({nodeId:frame.id,degree:adjacent.get(frame.id)?.size??0,
          separatedGroups:isRoot?childCount:cutCount+1});
      }
    }
  }
  return result.sort((a,b)=>b.separatedGroups-a.separatedGroups||
    b.degree-a.degree||a.nodeId.localeCompare(b.nodeId));
}
