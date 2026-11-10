import type {MapFile,TableInfo} from "../workers/add-data.worker";
import type {UseMode} from "@mossline/graph-core";

type ProposedPlan = Record<string,{include:boolean;use:UseMode}>;

/**
 * Simple imports can go straight to the *review*, not straight to saving.
 * Unreadable, incomplete or ambiguous input still gets the editable mapping step.
 * This is deliberately deterministic: it makes no AI call or data upload.
 */
export function canReviewDirectly(
  tables:readonly TableInfo[],
  maps:readonly MapFile[],
  problems:readonly {file:string;message:string}[],
  plans:ProposedPlan,
  hasExistingRecords:boolean
):boolean {
  if(problems.length || (!tables.length && !maps.length))return false;
  const hasRecords=hasExistingRecords || maps.length>0 ||
    tables.some(t=>plans[t.name]?.include&&plans[t.name].use==="records"&&(t.matches[0]?.shape.records.length??0)>0);
  if(!hasRecords)return false;
  return tables.every(t=>{
    const plan=plans[t.name],first=t.matches[0];
    if(!plan?.include || !first || first.missing.length ||
      (!first.shape.records.length && !first.shape.links.length))return false;
    // Two equally strong recognised interpretations need a person's choice.
    if(first.builtIn && t.matches.slice(1).some(m=>m.builtIn&&m.score===first.score))return false;
    if(t.large&&plan.use!=="fill")return false;
    return true;
  });
}
