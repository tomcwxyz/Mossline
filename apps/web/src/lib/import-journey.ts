import type {MapFile,TableInfo} from "../workers/add-data.worker";
import type {UseMode} from "@mossline/graph-core";

type ProposedPlan = Record<string,{include:boolean;use:UseMode}>;

const CLEAR_LABELS = new Set([
  "name","label","title","organisation","organisationname","organization","organizationname",
  "charityname","companyname","project","projectname","person","personname","entity","entityname",
  "venue","venuename","place","placename","location","locationname","activity","activityname",
  "event","eventname","initiative","initiativename","programme","programmename","funder",
  "fundername","recipient","recipientname"
]);
const normalise = (value:string) => value.toLowerCase().replace(/[^a-z0-9]/g,"");

/** A guessed reading needs an intelligible name column, not just an arbitrary first field. */
function recognisableSuggestion(table:TableInfo):boolean {
  const reading=table.matches[0];
  if(reading.builtIn)return true;
  if(reading.shape.records.some(record=>{
    const label=record.label.trim();
    const field=label.startsWith("{")&&label.endsWith("}")?label.slice(1,-1).split("|")[0]:"";
    return !!field && CLEAR_LABELS.has(normalise(field));
  }))return true;
  const headings=new Set(table.headings.map(normalise));
  return reading.shape.links.length>0 &&
    ["from","source","sourceentity","fromname"].some(h=>headings.has(h)) &&
    ["to","target","targetentity","toname"].some(h=>headings.has(h));
}

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
  // A standalone relationship list supplies its own source-mentioned endpoints,
  // even if there is no separate elements sheet or records table.
  const linksOnly=tables.length>0 && tables.every(t=>plans[t.name]?.include &&
    plans[t.name].use==="records" && (t.matches[0]?.shape.records.length??-1)===0 &&
    (t.matches[0]?.shape.links.length??0)>0);
  const hasRecords=hasExistingRecords || maps.some(m=>m.nodes>0) || linksOnly ||
    tables.some(t=>plans[t.name]?.include&&plans[t.name].use==="records"&&(t.matches[0]?.shape.records.length??0)>0);
  if(!hasRecords)return false;
  return tables.every(t=>{
    const plan=plans[t.name],first=t.matches[0];
    if(!plan?.include || !first || first.missing.length || t.rows===0 ||
      (!first.shape.records.length && !first.shape.links.length) ||
      !recognisableSuggestion(t))return false;
    // Two equally strong recognised interpretations need a person's choice.
    if(first.builtIn && t.matches.slice(1).some(m=>m.builtIn&&m.score===first.score))return false;
    if(t.large&&plan.use!=="fill")return false;
    return true;
  });
}
