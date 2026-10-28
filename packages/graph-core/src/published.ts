import { z } from "zod";
import { parseGraphDocument, nodeTypeSchema, type GraphDocument } from "./schema";
import { nodeStyleSchema, type NodeStyleOverride } from "./perspectives";
import { readAtlasLocation } from "./geography";
import { edgePolarity } from "./systems";

/** A snapshot is deliberately much smaller than the source graph: no source URLs,
 * import provenance, arbitrary custom properties, private metadata or evidence payloads.
 * A snapshot URL is PUBLIC TO ITS RECIPIENTS. Never use it as an access control.
 */
const httpsImage = z.url().max(2048).refine(value => {
  try {const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password;}
  catch{return false;}
});
const sharedNodeSchema=z.object({
  id:z.string().min(1).max(200),
  label:z.string().min(1).max(180),
  type:nodeTypeSchema,
  description:z.string().max(1200).optional(),
  imageUrl:httpsImage.optional(),
  properties:z.object({"Atlas location":z.string().max(60)}).strict().optional()
}).strict();
const sharedEdgeSchema=z.object({
  id:z.string().min(1).max(200),
  source:z.string().min(1).max(200),
  target:z.string().min(1).max(200),
  type:z.string().min(1).max(120),
  inferred:z.boolean().optional(),
  direction:z.enum(["directed","undirected","mutual"]).optional(),
  /** Cause and effect: part of what the link asserts, like its direction. */
  polarity:z.enum(["+","-"]).optional()
}).strict();
const sharedStyleSchema=nodeStyleSchema;
/**
 * Two sizes. A link that carries the map inside its own address has to stay
 * short (LINK_LIMITS). A copy stored on a Mossline server has no such limit;
 * HOSTED_LIMITS only keep one upload within what a server request can carry.
 */
export const LINK_LIMITS={records:150,links:300} as const;
export const HOSTED_LIMITS={records:20_000,links:60_000} as const;
export type SnapshotLimits={records:number;links:number};
const snapshotSchema=(limits:SnapshotLimits)=>z.object({
  format:z.literal("mossline-shared-view"),
  version:z.literal(1),
  title:z.string().trim().min(1).max(120),
  introduction:z.string().max(1200).optional(),
  coverUrl:httpsImage.optional(),
  view:z.enum(["landscape","collaborations","atlas"]),
  layout:z.enum(["organic","radial","regions"]),
  labels:z.enum(["essential","all"]),
  illustrated:z.boolean(),
  exportedAt:z.string().datetime(),
  nodes:z.array(sharedNodeSchema).min(1).max(limits.records),
  edges:z.array(sharedEdgeSchema).max(limits.links),
  nodeStyles:z.record(z.string().min(1).max(200),sharedStyleSchema).optional(),
  positions:z.record(z.string().min(1).max(200),z.object({
    x:z.number().finite().min(-1000000).max(1000000),
    y:z.number().finite().min(-1000000).max(1000000)
  }).strict()).optional()
}).strict().superRefine((data,ctx)=>{
  const ids=new Set<string>();
  data.nodes.forEach((node,index)=>{
    if(ids.has(node.id))ctx.addIssue({code:"custom",path:["nodes",index,"id"],message:"Repeated node ID"});
    ids.add(node.id);
  });
  const edges=new Set<string>();
  data.edges.forEach((edge,index)=>{
    if(edges.has(edge.id))ctx.addIssue({code:"custom",path:["edges",index,"id"],message:"Repeated edge ID"});
    edges.add(edge.id);
    if(!ids.has(edge.source)||!ids.has(edge.target))
      ctx.addIssue({code:"custom",path:["edges",index],message:"Edge without published endpoints"});
  });
  for(const field of ["nodeStyles","positions"] as const){
    if(Object.keys(data[field]??{}).some(id=>!ids.has(id)))
      ctx.addIssue({code:"custom",path:[field],message:"Unknown node in view styling"});
  }
});
export const publishedSnapshotSchema=snapshotSchema(LINK_LIMITS);
export const hostedSnapshotSchema=snapshotSchema(HOSTED_LIMITS);
export type PublishedSnapshot=z.infer<typeof publishedSnapshotSchema>;
export type PublishSettings={
  view:PublishedSnapshot["view"];
  layout:PublishedSnapshot["layout"];
  labels:PublishedSnapshot["labels"];
  illustrated:boolean;
  title:string;
  introduction?:string;
  coverUrl?:string;
  positions?:Record<string,{x:number;y:number}>;
  nodeStyles?:Record<string,NodeStyleOverride>;
  includeDescriptions:boolean;
  includeImages:boolean;
};

/** Opt-in fields are explicit; source identifiers and relationship assertions remain visible. */
export function createPublishedSnapshot(graph:GraphDocument,settings:PublishSettings,
  date=new Date(),limits:SnapshotLimits=LINK_LIMITS):PublishedSnapshot {
  const ids=new Set(graph.nodes.map(node=>node.id));
  const nodes=graph.nodes.map(node=>{
    const coordinate=settings.view==="atlas"?readAtlasLocation(node):null;
    return {
      id:node.id,label:node.label,type:node.type,
      ...(settings.includeDescriptions&&node.description?{description:node.description}:{}),
      ...(settings.includeImages&&node.imageUrl?.startsWith("https://")?{imageUrl:node.imageUrl}:{}),
      ...(coordinate?{properties:{"Atlas location":coordinate.latitude+","+coordinate.longitude}}:{})
    };
  });
  const edges=graph.edges.filter(edge=>ids.has(edge.source)&&ids.has(edge.target))
    .map(edge=>({id:edge.id,source:edge.source,target:edge.target,type:edge.type,
      ...(edge.inferred!==undefined?{inferred:edge.inferred}:{}),
      ...(edge.direction?{direction:edge.direction}:{}),
      ...(()=>{const p=edgePolarity(edge);return p?{polarity:p}:{};})()}));
  const nodeStyles:Record<string,NodeStyleOverride>={};
  for(const [id,style] of Object.entries(settings.nodeStyles??{})){
    if(!ids.has(id))continue;
    const {imageUrl,...other}=style;
    const next:NodeStyleOverride={...other,
      ...(settings.includeImages&&imageUrl?.startsWith("https://")?{imageUrl}:{})};
    if(Object.keys(next).length)nodeStyles[id]=next;
  }
  const positions=Object.fromEntries(Object.entries(settings.positions??{})
    .filter(([id])=>ids.has(id)));
  return (limits===LINK_LIMITS?publishedSnapshotSchema:snapshotSchema(limits)).parse({
    format:"mossline-shared-view",version:1,
    title:settings.title.trim(),view:settings.view,layout:settings.layout,
    labels:settings.labels,illustrated:settings.illustrated,
    ...(settings.introduction?{introduction:settings.introduction}:{}),
    ...(settings.includeImages&&settings.coverUrl?{coverUrl:settings.coverUrl}:{}),
    exportedAt:date.toISOString(),nodes,edges,
    ...(Object.keys(nodeStyles).length?{nodeStyles}:{}),
    ...(Object.keys(positions).length?{positions}:{})
  });
}
export const parsePublishedSnapshot=(value:unknown):PublishedSnapshot=>
  publishedSnapshotSchema.parse(value);
/** A copy stored on a Mossline server: same fields, room for whole maps. */
export const parseHostedSnapshot=(value:unknown):PublishedSnapshot=>
  hostedSnapshotSchema.parse(value);
export function sharedSnapshotGraph(snapshot:PublishedSnapshot):GraphDocument {
  return parseGraphDocument({version:1,title:snapshot.title,description:snapshot.introduction??"",
    nodes:snapshot.nodes,edges:snapshot.edges.map(({polarity,...edge})=>polarity?{...edge,properties:{polarity}}:edge)});
}
