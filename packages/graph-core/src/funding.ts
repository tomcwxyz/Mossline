import {parseCsv,type ImportFile,type ImportIssue} from "./import";
import {parseGraphDocument,type GraphDocument,type GraphEdge,type GraphNode} from "./schema";

const normalise=(s:string)=>s.trim().toLowerCase().replace(/[^a-z0-9]/g,"");
const clean=(s:unknown)=>String(s??"").trim();
const canonical=(s:string)=>s.trim().toLocaleLowerCase("en-GB").replace(/\s+/g," ");
const encode=(s:string)=>encodeURIComponent(s);
export type FundingMapping={
  funder:string;recipient:string;grantId:string;funderId:string;recipientId:string;
  title:string;description:string;amount:string;currency:string;date:string;
  programme:string;themes:string;region:string;publicFlag:string;
};
const synonyms:Record<keyof FundingMapping,string[]>={
  funder:["Funding Org:Name","Funder","Funder Name","Funding Organisation","Funding Organization","Donor"],
  recipient:["Recipient Org:Name","Recipient","Recipient Name","Grantee","Fundee","Recipient Organisation","Organisation"],
  grantId:["Identifier","Grant ID","Grant Identifier","Award ID","Grant Reference"],
  funderId:["Funding Org:Identifier","Funder ID","Funder Identifier"],
  recipientId:["Recipient Org:Identifier","Recipient ID","Grantee ID","Recipient Charity Number"],
  title:["Title","Grant Title","Project Title","Purpose"],
  description:["Description","Grant Description","Summary","Project Description"],
  amount:["Amount Awarded","Amount","Award Amount","Grant Amount","Amount (£)"],
  currency:["Currency","Currency Code"],
  date:["Award Date","Date Awarded","Grant Date","Date"],
  programme:["Grant Programme:Title","Programme","Programme Name","Grant Programme"],
  themes:["Themes","Theme","Topic","Topics","Grant Theme","Focus Area","Issue Area"],
  region:["Recipient Region","Recipient Org:Location:Name","Recipient Location","Region","Area"],
  publicFlag:["Public","Visibility","Is Public"]
};
export function suggestFundingMapping(headers:string[]):FundingMapping{
  return Object.fromEntries(Object.entries(synonyms).map(([field,variants])=>[
    field,headers.find(h=>variants.some(alias=>normalise(alias)===normalise(h)))??""
  ])) as FundingMapping;
}
function stableHash(input:string):string{
  let hash=2166136261;
  for(let i=0;i<input.length;i++)hash=Math.imul(hash^input.charCodeAt(i),16777619)>>>0;
  return hash.toString(16).padStart(8,"0");
}
const fundingTag="mosslineFundingGrant";
export type FundingImport={
  graph:GraphDocument|null;issues:ImportIssue[];
  counts:{inputRows:number;importedGrants:number;skipped:number;funders:number;recipients:number};
  mapping:FundingMapping;
};
function parseAmount(value:string):number|null{
  if(!value.trim())return null;
  const stripped=value.trim().replace(/^[£$€]\s*/,"").replace(/,/g,"");
  if(!/^-?\d+(?:\.\d{1,2})?$/.test(stripped))return null;
  const numeric=Number(stripped);
  return Number.isFinite(numeric)&&numeric>=0?numeric:null;
}
function parseThemeList(raw:string):string[]{
  return [...new Set(raw.split(/[;|]/).map(t=>t.trim()).filter(Boolean).slice(0,12))];
}
const hidden=(s:string)=>["false","no","0","private","internal"].includes(s.toLowerCase());
/** Read-only transform. Every award remains a separate entity, even if a funder
 * gave multiple awards to the same recipient; this prevents losing amounts/dates.
 * Deliberately does not interpret grants to identifiable individuals.
 */
export function importFundingCsv(file:ImportFile,mapping?:FundingMapping):FundingImport {
  const issues:ImportIssue[]=[];
  const empty=(inputRows=0,skipped=0,m=suggestFundingMapping([])):FundingImport=>({
    graph:null,issues,mapping:m,
    counts:{inputRows,importedGrants:0,skipped,funders:0,recipients:0}
  });
  let rows:string[][];
  try{rows=parseCsv(file.text);}
  catch(error){issues.push({severity:"error",message:error instanceof Error?error.message:"Invalid CSV"});return empty();}
  const [headers,...records]=rows;
  if(!headers?.length){issues.push({severity:"error",message:"No column headings found"});return empty();}
  const m=mapping??suggestFundingMapping(headers);
  if(!m.funder||!m.recipient||!headers.includes(m.funder)||!headers.includes(m.recipient)){
    issues.push({severity:"error",message:"Identify the funder and recipient organisation columns. This importer does not support grants to individuals."});
    return empty(records.length,0,m);
  }
  for(const [field,column] of Object.entries(m)){
    if(column&&!headers.includes(column)){
      issues.push({severity:"error",message:"Mapped "+field+" column not found: "+column});
      return empty(records.length,0,m);
    }
  }
  const nodes=new Map<string,GraphNode>();
  const edges:GraphEdge[]=[];
  const recipients=new Set<string>(),funders=new Set<string>(),seenGrants=new Set<string>();
  const grantCounts=new Map<string,number>();
  let skipped=0,withheld=0;
  for(const [i,row] of records.entries()){
    if(row.length>headers.length){issues.push({severity:"warning",message:"Row "+(i+2)+" has extra columns and was skipped"});skipped++;continue;}
    const record=Object.fromEntries(headers.map((h,j)=>[h,clean(row[j])]));
    const value=(key:keyof FundingMapping)=>m[key]?record[m[key]]??"":"";
    if(hidden(value("publicFlag"))){withheld++;skipped++;continue;}
    const funder=value("funder"),recipient=value("recipient");
    if(!funder||!recipient){
      skipped++;issues.push({severity:"warning",message:"Row "+(i+2)+" is missing a funder or organisation recipient and was skipped"});continue;
    }
    const funderKey=value("funderId")?"id:"+canonical(value("funderId")):"name:"+canonical(funder);
    const recipientKey=value("recipientId")?"id:"+canonical(value("recipientId")):"name:"+canonical(recipient);
    const funderNodeId="entity:"+encode(funderKey),recipientNodeId="entity:"+encode(recipientKey);
    const date=value("date"),amountRaw=value("amount"),amount=parseAmount(amountRaw);
    if(amountRaw&&amount===null)issues.push({severity:"warning",message:"Row "+(i+2)+" has an invalid amount; it was not included in totals"});
    if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))))
      issues.push({severity:"warning",message:"Row "+(i+2)+" has an unrecognised award date"});
    const currency=value("currency").toUpperCase()||((/^[£]/.test(amountRaw))?"GBP":"");
    const title=value("title")||"Grant to "+recipient;
    const description=value("description");
    const programme=value("programme");
    const themes=parseThemeList(value("themes"));
    const identity=value("grantId")?
      "id:"+value("grantId"):
      "row:"+stableHash(JSON.stringify([funderKey,recipientKey,title,description,
        amountRaw,date,programme,themes]));
    const duplicateIndex=(grantCounts.get(identity)??0)+1;
    grantCounts.set(identity,duplicateIndex);
    const grantId="grant:"+encode(identity)+(duplicateIndex>1?":"+duplicateIndex:"");
    if(seenGrants.has(identity)&&value("grantId")){
      skipped++;issues.push({severity:"warning",message:"Duplicate grant identifier on row "+(i+2)+"; ignored rather than double counting"});continue;
    }
    seenGrants.add(identity);
    funders.add(funderNodeId);recipients.add(recipientNodeId);
    const upsert=(id:string,label:string,role:"funder"|"recipient",identifier:string,region?:string)=>{
      const current=nodes.get(id);
      const roles=new Set<string>([...((current?.properties?.fundingRoles as string[]|undefined)??[]),role]);
      nodes.set(id,{
        id,label:current?.label??label,
        type:roles.has("funder")?"funder":"organisation",
        ...(region||current?.region?{region:current?.region??region}:{}),
        properties:{...(current?.properties??{}),fundingRoles:[...roles],
          ...(identifier?{organisationIdentifier:identifier}:{})}
      });
    };
    upsert(funderNodeId,funder,"funder",value("funderId"));
    upsert(recipientNodeId,recipient,"recipient",value("recipientId"),value("region"));
    nodes.set(grantId,{id:grantId,label:title,type:"project",
      ...(description?{description}:{}),tags:themes,
      properties:{[fundingTag]:true,awardIdentifier:value("grantId")||undefined,
        ...(amount!==null?{amountAwarded:amount}:{}),
        ...(currency?{currency}:{}),
        ...(date?{awardDate:date}:{}),
        ...(programme?{programme}:{}),
        funderId:funderNodeId,recipientId:recipientNodeId,
        sourceFile:file.name,sourceRow:i+2}});
    edges.push({id:"award:"+grantId,source:funderNodeId,target:grantId,
      type:"awarded",direction:"directed",
      origin:{system:"csv",recordId:value("grantId")||identity,fileName:file.name,recordNumber:i+2}});
    edges.push({id:"recipient:"+grantId,source:grantId,target:recipientNodeId,
      type:"awarded to",direction:"directed",
      origin:{system:"csv",recordId:value("grantId")||identity,fileName:file.name,recordNumber:i+2}});
  }
  if(withheld)issues.push({severity:"warning",message:withheld+" records marked non-public were excluded"});
  if(!nodes.size){
    issues.push({severity:"error",message:"No grants with named funders and organisation recipients were found"});
    return empty(records.length,skipped,m);
  }
  const graph=parseGraphDocument({version:1,title:file.name.replace(/\.csv$/i,"")+" — Funding landscape",
    description:"Funding awards recorded in "+file.name+". The graph shows awarded grants, not proof of impact or ongoing relationships.",
    nodes:[...nodes.values()],edges});
  return {graph,issues,mapping:m,
    counts:{inputRows:records.length,importedGrants:edges.length/2,skipped,
      funders:funders.size,recipients:recipients.size}};
}

export type FundingAward={grantId:string;funderId:string;recipientId:string;
  amount:number|null;currency:string;themes:string[];
  description:string;programme:string;title:string;date:string};
export function fundingAwards(graph:GraphDocument):FundingAward[]{
  const ids=new Set(graph.nodes.map(n=>n.id));
  return graph.nodes.flatMap(node=>{
    if(node.properties?.[fundingTag]!==true)return [];
    const funderId=clean(node.properties.funderId),recipientId=clean(node.properties.recipientId);
    const source=graph.edges.some(e=>!e.inferred&&e.source===funderId&&e.target===node.id&&e.type==="awarded");
    const target=graph.edges.some(e=>!e.inferred&&e.source===node.id&&e.target===recipientId&&e.type==="awarded to");
    if(!ids.has(funderId)||!ids.has(recipientId)||!source||!target)return [];
    const amount=node.properties.amountAwarded;
    return [{grantId:node.id,funderId,recipientId,amount:typeof amount==="number"?amount:null,
      currency:clean(node.properties.currency),themes:node.tags,
      description:node.description??"",programme:clean(node.properties.programme),
      title:node.label,date:clean(node.properties.awardDate)}];
  });
}

export type FundingInsight={recipientA:string;recipientB:string;
  kind:"recorded-themes"|"word-overlap";common:string[];
  evidenceA:string;evidenceB:string;differentFunders:boolean;score:number};
/** Small, transparent lexical baseline; NOT an LLM or semantic embedding.
 * Candidate similarity never becomes a canonical graph edge.
 */
const stop=new Set("the and for with from into through this that their our your more less a an in on of to by across at all using project programme support grants funding grant help work working people communities community local improve provide service services new".split(" "));
function terms(text:string):Set<string>{
  return new Set((text.toLocaleLowerCase("en-GB").match(/[\p{L}]{4,}/gu)??[])
    .map(s=>s.replace(/(ies|ing|ed|s)$/u,(ending)=>ending==="ies"?"y":""))
    .filter(s=>!stop.has(s)&&s.length>=4));
}
export function analyseFundingLandscape(graph:GraphDocument){
  const awards=fundingAwards(graph),nodeNames=new Map(graph.nodes.map(n=>[n.id,n.label]));
  const funderIds=new Set(awards.map(a=>a.funderId)),recipientIds=new Set(awards.map(a=>a.recipientId));
  const fundedBy=new Map<string,Set<string>>();
  const awardedTo=new Map<string,Set<string>>();
  for(const award of awards){
    fundedBy.set(award.recipientId,new Set([...(fundedBy.get(award.recipientId)??[]),award.funderId]));
    awardedTo.set(award.funderId,new Set([...(awardedTo.get(award.funderId)??[]),award.recipientId]));
  }
  const currencies=new Map<string,{total:number;count:number}>();
  for(const a of awards)if(a.amount!==null&&a.currency){
    const current=currencies.get(a.currency)??{total:0,count:0};
    currencies.set(a.currency,{total:current.total+a.amount,count:current.count+1});
  }
  const byRecipient=new Map<string,FundingAward[]>();
  for(const a of awards)byRecipient.set(a.recipientId,[...(byRecipient.get(a.recipientId)??[]),a]);
  const recipients=[...byRecipient.entries()].map(([id,list])=>{
    const tags=new Set(list.flatMap(a=>a.themes.map(canonical)));
    const documents=list.map(a=>a.title+" "+a.description+" "+a.programme);
    return {id,list,tags,words:terms(documents.join(" ")),
      sample:list.map(a=>[a.title,a.description].filter(Boolean).join(": ")).find(Boolean)??"",
      funders:fundedBy.get(id)??new Set<string>()};
  });
  const insights:FundingInsight[]=[];
  for(let i=0;i<recipients.length;i++)for(let j=i+1;j<recipients.length;j++){
    const a=recipients[i],b=recipients[j];
    const shared=[...a.tags].filter(t=>b.tags.has(t));
    const commonWords=[...a.words].filter(t=>b.words.has(t)).slice(0,8);
    // Exclude only lexical similarities caused by a single common term.
    if(!shared.length&&commonWords.length<2)continue;
    const differentFunders=[...a.funders].every(id=>!b.funders.has(id));
    insights.push({recipientA:a.id,recipientB:b.id,
      kind:shared.length?"recorded-themes":"word-overlap",
      common:shared.length?shared:commonWords,
      evidenceA:a.sample.slice(0,220),evidenceB:b.sample.slice(0,220),
      differentFunders,score:shared.length*4+commonWords.length+(differentFunders?1:0)});
  }
  insights.sort((a,b)=>b.score-a.score||nodeNames.get(a.recipientA)!.localeCompare(nodeNames.get(b.recipientA)!));
  return {
    awardCount:awards.length,funderCount:funderIds.size,recipientCount:recipientIds.size,
    amounts:[...currencies.entries()].map(([currency,v])=>({currency,...v})),
    multiFunded:[...fundedBy.entries()].filter(([,v])=>v.size>1)
      .map(([id,funders])=>({id,name:nodeNames.get(id)??id,
        funders:[...funders].map(f=>nodeNames.get(f)??f)})).sort((a,b)=>b.funders.length-a.funders.length),
    themes:[...new Set(awards.flatMap(a=>a.themes.map(canonical)))].sort(),
    insights:insights.slice(0,16),
    awards,
    getName:(id:string)=>nodeNames.get(id)??id
  };
}
