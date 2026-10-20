import { z } from "zod";
import { nodeTypeSchema, type GraphDocument } from "./schema";
import type { ColumnMapping } from "./discovery";

const column = z.string().min(1).max(150);
const optionalColumn = z.string().max(150);
export const columnMappingSchema = z.object({
  mode: z.enum(["entities", "relationships"]),
  nameColumn: column,
  nodeType: nodeTypeSchema,
  typeColumn: optionalColumn,
  regionColumn: optionalColumn,
  regionTarget: z.enum(["source", "target", "both"]),
  descriptionColumn: optionalColumn,
  rules: z.array(z.object({
    fromColumn: column, toColumn: column,
    fromType: nodeTypeSchema, toType: nodeTypeSchema,
    type: z.string().min(1).max(100)
  }).strict()).max(20)
}).strict().superRefine((mapping,ctx)=>{
  if(mapping.mode==="relationships" && !mapping.rules.length)
    ctx.addIssue({code:"custom",path:["rules"],message:"At least one relationship rule is required"});
  if(mapping.mode==="relationships") mapping.rules.forEach((rule,i)=>{
    if(rule.fromColumn===rule.toColumn)ctx.addIssue({code:"custom",path:["rules",i],message:"Choose distinct columns"});
  });
});

export const mappingRecipeSchema = z.object({
  kind: z.literal("mossline-mapping-recipe"),
  version: z.literal(1),
  id: z.string().uuid(),
  familyId: z.string().uuid(),
  revision: z.number().int().positive().max(999),
  name: z.string().trim().min(1).max(65),
  createdAt: z.number().int().nonnegative(),
  columns: z.array(column).min(1).max(150),
  mapping: columnMappingSchema
}).strict().superRefine((recipe,ctx)=>{
  if(new Set(recipe.columns).size!==recipe.columns.length)
    ctx.addIssue({code:"custom",path:["columns"],message:"Repeated source column"});
});
export type MappingRecipe = z.infer<typeof mappingRecipeSchema>;
export function parseMappingRecipe(raw:unknown):MappingRecipe { return mappingRecipeSchema.parse(raw); }
export function parseMappingRecipes(raw:unknown):MappingRecipe[] {
  return z.array(mappingRecipeSchema).max(40).parse(raw);
}
export function makeMappingRecipe(
  name:string, columns:string[], mapping:ColumnMapping,
  previous?:MappingRecipe, id: string = crypto.randomUUID(),
  createdAt = Date.now()
):MappingRecipe {
  return mappingRecipeSchema.parse({
    kind:"mossline-mapping-recipe", version:1,
    id, familyId:previous?.familyId??id,
    revision:previous?previous.revision+1:1,
    name:name.trim(), createdAt,
    columns:[...columns],mapping
  });
}
export type RecipeCompatibility = {
  usable:boolean; missing:string[]; added:string[];
  note:string;
};
/** No fuzzy guesses or silent remapping of renamed columns. */
export function checkRecipeColumns(recipe:MappingRecipe,current:string[]):RecipeCompatibility {
  const required = recipe.mapping.mode==="entities" ?
    [recipe.mapping.nameColumn,recipe.mapping.typeColumn,recipe.mapping.regionColumn,recipe.mapping.descriptionColumn] :
    [...recipe.mapping.rules.flatMap(r=>[r.fromColumn,r.toColumn]),
      recipe.mapping.regionColumn,recipe.mapping.descriptionColumn];
  const existing = new Set(current);
  const missing=[...new Set(required.filter(Boolean).filter(c=>!existing.has(c)))];
  const old = new Set(recipe.columns);
  const added=current.filter(c=>!old.has(c));
  return {usable:missing.length===0,missing,added,
    note:missing.length ? "Required columns are missing. Update the mapping manually before previewing." :
      added.length ? "Source contains new columns. Review before reusing this mapping." :
      "Required columns match. Confirm that their meaning has not changed."
  };
}

export type GraphChange = {
  nodes:{added:number;removed:number;updated:number;addedExamples:string[];removedExamples:string[]};
  edges:{added:number;removed:number;updated:number;addedExamples:string[];removedExamples:string[]};
};
/** Identity-based descriptive delta; source row numbers are not semantic edits. */
export function compareGraphDocuments(current:GraphDocument,next:GraphDocument):GraphChange {
  const compare=<T extends {id:string}>(before:T[],after:T[],title:(x:T)=>string,signature:(x:T)=>string)=>{
    const a=new Map(before.map(x=>[x.id,x])),b=new Map(after.map(x=>[x.id,x]));
    const added=after.filter(x=>!a.has(x.id)),removed=before.filter(x=>!b.has(x.id));
    const updated=after.filter(x=>a.has(x.id)&&signature(a.get(x.id)!)!==signature(x));
    return {added:added.length,removed:removed.length,updated:updated.length,
      addedExamples:added.slice(0,5).map(title),removedExamples:removed.slice(0,5).map(title)};
  };
  const normalizedNode=(x:GraphDocument["nodes"][number])=>JSON.stringify([
    x.label,x.type,x.description??"",x.region??"",x.tags,x.imageUrl??"",x.sourceUrl??"",x.properties??{}
  ]);
  const normalizedEdge=(x:GraphDocument["edges"][number])=>JSON.stringify([
    x.source,x.target,x.type,x.description??"",x.direction??"",x.sourceUrl??"",
    x.inferred??false,x.evidenceNodeIds??[],x.properties??{}
  ]);
  const labels=new Map([...current.nodes,...next.nodes].map(n=>[n.id,n.label]));
  return {
    nodes:compare(current.nodes,next.nodes,n=>n.label,normalizedNode),
    edges:compare(current.edges,next.edges,
      e=>(labels.get(e.source)??e.source)+" → "+(labels.get(e.target)??e.target)+" · "+e.type,normalizedEdge)
  };
}
