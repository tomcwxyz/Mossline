import { parseCsv, type ImportFile, type ImportIssue } from "./import";
import { parseGraphDocument, type GraphDocument, type NodeType } from "./schema";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const value = (v: unknown) => v == null ? "" : String(v).trim();
const nodeTypes: NodeType[] = ["organisation","project","funder","person","place","topic","methodology","outcome","other"];
const classify: Record<string,NodeType> = {
  organisation:"organisation",organization:"organisation",charity:"organisation",network:"organisation",
  project:"project",programme:"project",program:"project",initiative:"project",
  funder:"funder",fundingbody:"funder",foundation:"funder",donor:"funder",
  person:"person",contact:"person",people:"person",place:"place",location:"place",
  geography:"place",region:"place",topic:"topic",tocmethodology:"methodology",tocoutput:"outcome"
};
function typeForColumn(name: string): NodeType {
  return classify[norm(name).replace(/name$/,"")] ?? "other";
}
function typeForValue(input: unknown, fallback: NodeType): NodeType {
  return classify[norm(value(input))] ?? fallback;
}
const idFor = (column: string, label: string) => "mapped:" +
  encodeURIComponent(norm(column) + ":" + label.trim().toLowerCase());

export interface DataColumn {
  name: string;
  filled: number;
  distinct: number;
  examples: string[];
}
export type MapMode = "entities" | "relationships";
export interface RelationshipRule {
  fromColumn: string;
  toColumn: string;
  fromType: NodeType;
  toType: NodeType;
  type: string;
}
export interface ColumnMapping {
  mode: MapMode;
  nameColumn: string;
  nodeType: NodeType;
  typeColumn: string;
  regionColumn: string;
  regionTarget: "source" | "target" | "both";
  descriptionColumn: string;
  rules: RelationshipRule[];
}
export interface KumuFieldSuggestion { field: string; role: string; treatment: "mapped" | "review" | "preserved"; }
export type DataDiscovery =
  | { kind:"kumu-configuration"; fileName:string; title:string; attributes:string[]; fieldSuggestions:KumuFieldSuggestion[];
      elementTypes:string[]; connectionTypes:string[]; perspectives:string[];
      embeddedNodes:number; embeddedEdges:number; externalSheets:boolean;
      advice:string[] }
  | { kind:"csv-table"; fileName:string; rowCount:number; columns:DataColumn[];
      mapping:ColumnMapping; advice:string[] }
  | { kind:"unsupported"; fileName:string; reason:string };

function suggestKumuField(field:string):KumuFieldSuggestion {
  const roles:Record<string,[string,KumuFieldSuggestion["treatment"]]>={
    label:["Entity label","mapped"],
    elementtype:["Entity category; uncommon classes stay in custom fields","mapped"],
    connectiontype:["Relationship category","mapped"],
    description:["Entity or relationship description","mapped"],
    region:["Regional grouping","mapped"],
    geographicreach:["Geographical reach: check if multiple values","review"],
    image:["Entity image URL or media reference","review"],
    website:["Entity source/website URL","mapped"],
    tags:["Entity tags","mapped"],
    topics:["Topic tags; also candidates for topic entities","review"],
    public:["Visibility guard; FALSE records must not become public","mapped"],
    mapx:["Visual coordinate from a Kumu-specific view","preserved"],
    mapy:["Visual coordinate from a Kumu-specific view","preserved"],
    geo:["Potential geographical metadata; inspect source values","review"]
  };
  const [role,treatment]=roles[norm(field)]??["Custom attribute retained as source data","preserved"];
  return {field,role,treatment};
}

function readTable(file: ImportFile): {headers:string[];rows:Record<string,string>[]} {
  const lines = parseCsv(file.text);
  const [raw,...records]=lines;
  if(!raw?.length) throw Error("No header row found");
  const headers=raw.map(s=>s.trim());
  if(headers.some(h=>!h)) throw Error("Every column needs a non-empty heading");
  if(new Set(headers.map(norm)).size!==headers.length) throw Error("Column headings must be distinct");
  const rows=records.map((record,index)=>{
    if(record.length>headers.length) throw Error("Record "+(index+2)+" has more values than headings");
    return Object.fromEntries(headers.map((h,j)=>[h,record[j]??""]));
  });
  return {headers,rows};
}
const pick=(names:string[],variants:string[]):string => names.find(s=>variants.includes(norm(s))) ?? "";
export function discoverData(file: ImportFile): DataDiscovery {
  try {
    if(file.name.toLowerCase().endsWith(".json")) {
      const obj: unknown=JSON.parse(file.text);
      if(!obj || typeof obj!=="object" || Array.isArray(obj))
        return {kind:"unsupported",fileName:file.name,reason:"Expected a JSON object"};
      const data=obj as Record<string,unknown>;
      if(!Array.isArray(data.elements) || !Array.isArray(data.connections))
        return {kind:"unsupported",fileName:file.name,reason:"Not a Kumu project export with elements/connections arrays"};
      const attributes=(Array.isArray(data.attributes)?data.attributes:[])
        .filter((a):a is Record<string,unknown>=>!!a && typeof a==="object" && !Array.isArray(a));
      const names=attributes.map(a=>value(a.name)).filter(Boolean);
      const values=(name:string):string[]=>{
        const a=attributes.find(a=>norm(value(a.name))===norm(name));
        return (Array.isArray(a?.values)?a.values:[]).map(value).filter(Boolean);
      };
      const views=(Array.isArray(data.perspectives)?data.perspectives:[])
        .map(p=>p&&typeof p==="object"&&!Array.isArray(p)?value((p as Record<string,unknown>).name):"").filter(Boolean);
      const maps=(Array.isArray(data.maps)?data.maps:[]).filter(m=>m&&typeof m==="object");
      const externalSheets=maps.some(m=>
        typeof (m as Record<string,unknown>).src==="string" &&
        (m as Record<string,string>).src.toLowerCase().startsWith("auth:googlesheets:"));
      const embeddedNodes=data.elements.length,embeddedEdges=data.connections.length;
      const advice=[
        "The project configuration can suggest fields and perspectives, but cannot recreate records that are absent.",
        ...(externalSheets?["This project refers to Google Sheets data. Export the source sheet tabs as CSV and upload them to map the actual rows."]:[]),
        ...(embeddedNodes===0&&embeddedEdges===0?["No embedded entities or connections were found. This file must not replace your current map."]:[])
      ];
      return {
        kind:"kumu-configuration",fileName:file.name,title:value(data.name)||file.name,
        attributes:names,fieldSuggestions:names.map(suggestKumuField),
        elementTypes:values("Element Type"),connectionTypes:values("Connection Type"),
        perspectives:views,embeddedNodes,embeddedEdges,externalSheets,advice
      };
    }
    if(!file.name.toLowerCase().endsWith(".csv"))
      return {kind:"unsupported",fileName:file.name,reason:"Choose a CSV table or Kumu JSON export"};
    const {headers,rows}=readTable(file);
    const columns=headers.map(name=>{
      const used=rows.map(r=>value(r[name])).filter(Boolean);
      return {name,filled:used.length,distinct:new Set(used).size,examples:[...new Set(used)].slice(0,3)};
    });
    const organisations=pick(headers,["organisation","organization","organisationname","organizationname","organisation name","charity","network"]);
    const project=pick(headers,["project","projectname","programme","program","initiative"]);
    const funder=pick(headers,["funder","fundername","foundation","fundingbody","donor"]);
    const from=pick(headers,["from","source","sourceorganisation","sourceentity"])||organisations||project;
    const to=pick(headers,["to","target","targetorganisation","targetentity"])||project||funder;
    const candidate=from&&to&&from!==to;
    const nameColumn=pick(headers,["label","name","organisation","organization","project","title","entity"])||headers[0];
    const relationFrom = from || headers[0];
    const relationTo = to && to!==relationFrom ? to : headers.find(h=>h!==relationFrom) || "";
    const relationType=organisations&&project&&relationFrom===organisations&&relationTo===project ?
      "participates in" : project&&funder&&relationFrom===project&&relationTo===funder ?
      "funded by" : "related to";
    const mapping:ColumnMapping={
      mode:candidate?"relationships":"entities",
      nameColumn,nodeType:typeForColumn(nameColumn),
      typeColumn:pick(headers,["elementtype","entitytype","category","type"]),
      regionColumn:pick(headers,["region","geographicreach","geography"]),
      regionTarget:"source",
      descriptionColumn:pick(headers,["description","summary","about"]),
      rules:relationTo ? [
        {fromColumn:relationFrom,toColumn:relationTo,
          fromType:typeForColumn(relationFrom),toType:typeForColumn(relationTo),type:relationType},
        ...(organisations && project && funder && relationFrom===organisations && relationTo===project ?
          [{fromColumn:project,toColumn:funder,
            fromType:"project" as NodeType,toType:"funder" as NodeType,type:"funded by"}] : [])
      ]:[]
    };
    const advice=[
      "Column suggestions come from headings and sample values, not independently verified facts.",
      "Check the entity columns and relationship meaning before generating a map.",
      ...(columns.length<2?["Only one column was found. This can still become a list of entities."]:[]),
      ...(rows.length===0?["This table contains no data rows."]:[])
    ];
    return {kind:"csv-table",fileName:file.name,rowCount:rows.length,columns,mapping,advice};
  } catch(error) {
    return {kind:"unsupported",fileName:file.name,reason:error instanceof Error?error.message:"Could not read input"};
  }
}

export interface MappedPreview {
  graph: GraphDocument | null;
  issues: ImportIssue[];
  counts: { inputRows:number;nodes:number;edges:number;skipped:number };
}
/**
 * Explicit, reviewed column-to-graph mapping. Relationship meaning is supplied
 * by the user. No semantic inference can silently create network claims.
 */
export function buildMappedGraph(file:ImportFile,mapping:ColumnMapping):MappedPreview {
  const issues:ImportIssue[]=[];
  const result=(graph:GraphDocument|null,inputRows:number,skipped=0):MappedPreview=>
    ({graph,issues,counts:{inputRows,nodes:graph?.nodes.length??0,edges:graph?.edges.length??0,skipped}});
  try {
    if(!file.name.toLowerCase().endsWith(".csv")) throw Error("Mapped import requires a CSV file");
    const {headers,rows}=readTable(file),columns=new Set(headers);
    const required=mapping.mode==="entities" ? [mapping.nameColumn] :
      mapping.rules.flatMap(r=>[r.fromColumn,r.toColumn]);
    if(mapping.mode==="relationships" && !mapping.rules.length)
      throw Error("Add at least one relationship rule");
    for(const column of required) if(!column || !columns.has(column))
      throw Error("Mapped column not present in source: "+(column||"(unselected)"));
    for(const rule of mapping.rules) {
      if(rule.fromColumn===rule.toColumn) throw Error("Select different source and target columns");
      if(!rule.type.trim()) throw Error("Give every relationship rule a meaningful description");
      if(!nodeTypes.includes(rule.fromType)||!nodeTypes.includes(rule.toType))
        throw Error("Choose supported entity types");
    }
    const nodes=new Map<string,GraphDocument["nodes"][number]>();
    const edges:GraphDocument["edges"]=[];
    let skipped=0,privateRows=0;
    const publicColumn = headers.find(h=>norm(h)==="public");
    const position=(i:number)=>({system:"csv" as const,fileName:file.name,recordNumber:i+2});
    function addNode(label:string,column:string,nodeType:NodeType,row:Record<string,string>,index:number,
      includeRegion:boolean) {
      const id=idFor(column,label);
      const existing=nodes.get(id);
      if(existing) {
        if(existing.type!==nodeType) issues.push({severity:"warning",
          message:"Conflicting suggested types for '"+label+"'; first mapping is retained."});
        return id;
      }
      const region=includeRegion && mapping.regionColumn ? value(row[mapping.regionColumn]):"";
      const description=mapping.descriptionColumn ? value(row[mapping.descriptionColumn]):"";
      nodes.set(id,{
        id,label,type:nodeType,description:description||undefined,region:region||undefined,tags:[],
        origin:{...position(index),recordId:column+":"+label},properties:{...row}
      });
      return id;
    }
    for(const [i,row] of rows.entries()){
      if(publicColumn && ["false","no","0","private"].includes(value(row[publicColumn]).toLowerCase())) {
        privateRows++; skipped++; continue;
      }
      if(mapping.mode==="entities"){
        const label=value(row[mapping.nameColumn]);
        if(!label){skipped++;continue;}
        const nodeType=mapping.typeColumn&&columns.has(mapping.typeColumn)?
          typeForValue(row[mapping.typeColumn],mapping.nodeType):mapping.nodeType;
        addNode(label,mapping.nameColumn,nodeType,row,i,true);
      }else{
        let created=false;
        for(const [ruleIndex,rule] of mapping.rules.entries()) {
          const from=value(row[rule.fromColumn]),to=value(row[rule.toColumn]);
          if(!from || !to) continue;
          const source=addNode(from,rule.fromColumn,rule.fromType,row,i,
            mapping.regionTarget==="source" || mapping.regionTarget==="both");
          const target=addNode(to,rule.toColumn,rule.toType,row,i,
            mapping.regionTarget==="target" || mapping.regionTarget==="both");
          edges.push({
            id:"mapped:edge:"+i+":"+ruleIndex,source,target,type:rule.type.trim(),
            origin:{...position(i),recordId:"row:"+String(i+2)+":rule:"+String(ruleIndex+1)},
            properties:{...row}
          });
          created=true;
        }
        if(!created)skipped++;
      }
    }
    if(privateRows)issues.push({severity:"warning",
      message:privateRows+" rows marked non-public were excluded before generating any nodes or relationships."});
    if(skipped-privateRows>0)issues.push({severity:"warning",
      message:(skipped-privateRows)+" rows contained no values for the selected mapping and were skipped."});
    if(nodes.size===0)throw Error("No nodes could be built using the chosen columns");
    if(mapping.mode==="relationships" && !edges.length)
      throw Error("No complete relationship pairs matched the selected columns");
    if(mapping.mode==="relationships" && mapping.rules.some(r=>r.type==="related to"))
      issues.push({severity:"warning",message:"‘related to’ is a placeholder: confirm what the source rows actually assert."});
    const graph=parseGraphDocument({
      version:1,title:file.name.replace(/\.csv$/i,""),
      description:"Review-generated from CSV columns; relationship labels require source validation.",
      nodes:[...nodes.values()],edges
    });
    return result(graph,rows.length,skipped);
  } catch(error) {
    issues.push({severity:"error",message:error instanceof Error?error.message:"Could not build graph"});
    return result(null,0);
  }
}
