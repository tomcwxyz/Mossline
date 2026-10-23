import type {GraphDocument} from "./schema";
import type {NetworkSemanticDocument} from "./network-semantic";
import {cosineSimilarity} from "./semantic-discovery";

/** Read-only discovery prompts. IDs always refer to original source entities. */
export type NetworkInsight={
 id:string;
 kind:"recorded"|"theme"|"geography"|"coverage"|"similarity";
 title:string;
 summary:string;
 count:number;
 sourceIds:string[];
 edgeIds:string[];
 similarity?:number;
};

/** Deterministic, local signals require no model access or remote data transfer. */
export function sourceNetworkInsights(graph:GraphDocument,
  eligibleIds?:ReadonlySet<string>):NetworkInsight[]{
 const nodes=eligibleIds?graph.nodes.filter(n=>eligibleIds.has(n.id)):graph.nodes;
 const lookup=new Map(nodes.map(n=>[n.id,n]));
 const degree=new Map(nodes.map(n=>[n.id,0]));
 const incident=new Map<string,string[]>();
 const regions=new Map<string,{label:string;ids:string[]}>();
 const themes=new Map<string,{label:string;ids:string[]}>();
 const cross:{edgeId:string;source:string;target:string}[]=[];
 for(const node of nodes){
   if(node.region?.trim()){
     const label=node.region.trim(),key=label.toLocaleLowerCase("en-GB");
     const bucket=regions.get(key)??{label,ids:[]};
     bucket.ids.push(node.id);regions.set(key,bucket);
   }
   for(const tag of new Set(node.tags.map(x=>x.trim()).filter(Boolean))){
     const key=tag.toLocaleLowerCase("en-GB");
     const bucket=themes.get(key)??{label:tag,ids:[]};
     bucket.ids.push(node.id);themes.set(key,bucket);
   }
 }
 for(const edge of graph.edges){
   if(edge.inferred||!lookup.has(edge.source)||!lookup.has(edge.target))continue;
   degree.set(edge.source,(degree.get(edge.source)??0)+1);
   degree.set(edge.target,(degree.get(edge.target)??0)+1);
   for(const id of [edge.source,edge.target]){
     const list=incident.get(id)??[];list.push(edge.id);incident.set(id,list);
   }
   const a=lookup.get(edge.source)!,b=lookup.get(edge.target)!;
   if(a.region?.trim()&&b.region?.trim()&&
     a.region.trim().toLocaleLowerCase("en-GB")!==b.region.trim().toLocaleLowerCase("en-GB"))
     cross.push({edgeId:edge.id,source:a.id,target:b.id});
 }
 const insights:NetworkInsight[]=[];
 const ranked=[...degree].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 const hub=ranked[0];
 if(hub&&hub[1]>=2){
   const name=lookup.get(hub[0])!.label;
   insights.push({id:"source-hub",kind:"recorded",
     title:"A well-connected part of this network",
     summary:name+" has "+hub[1]+" recorded links in this dataset. Explore what those connections actually represent.",
     count:hub[1],sourceIds:[hub[0]],edgeIds:(incident.get(hub[0])??[]).slice(0,8)});
 }
 const topTheme=[...themes.values()].sort((a,b)=>b.ids.length-a.ids.length||
   a.label.localeCompare(b.label))[0];
 if(topTheme&&topTheme.ids.length>=3)
   insights.push({id:"source-theme",kind:"theme",
     title:"A recurring source theme: "+topTheme.label,
     summary:topTheme.ids.length+" entities share this recorded tag. A shared tag is not a recorded relationship.",
     count:topTheme.ids.length,sourceIds:topTheme.ids.slice(0,8),edgeIds:[]});
 if(cross.length)
   insights.push({id:"source-cross-region",kind:"recorded",
     title:"Connections crossing recorded regions",
     summary:cross.length+" original links join entities with different source region labels. Check the records before drawing geographical conclusions.",
     count:cross.length,sourceIds:[...new Set(cross.flatMap(x=>[x.source,x.target]))].slice(0,8),
     edgeIds:cross.slice(0,8).map(x=>x.edgeId)});
 const topRegion=[...regions.values()].sort((a,b)=>b.ids.length-a.ids.length||
   a.label.localeCompare(b.label))[0];
 if(topRegion&&topRegion.ids.length>=3)
   insights.push({id:"source-region",kind:"geography",
     title:"Geographic concentration: "+topRegion.label,
     summary:topRegion.ids.length+" entities use this recorded region label. This does not establish exact locations.",
     count:topRegion.ids.length,sourceIds:topRegion.ids.slice(0,8),edgeIds:[]});
 const unlinked=ranked.filter(([,count])=>count===0).map(([id])=>id);
 if(unlinked.length>=2)
   insights.push({id:"source-unlinked",kind:"coverage",
     title:"Entities without recorded connections",
     summary:unlinked.length+" entities have no original relationship edges in this import. That may reflect source coverage, not real-world isolation.",
     count:unlinked.length,sourceIds:unlinked.slice(0,8),edgeIds:[]});
 return insights.slice(0,5);
}

const STOP=new Set(["entity","category","description","source","topics","organisation",
 "organization","organisations","organizations","project","projects","charitable",
 "charity","charities","region","community","communities","the","their","which",
 "about","with","from","support","supports","providing","services","through",
 "across","local","between","other","including"]);
function tokens(text:string):string[]{
 return [...new Set((text.toLocaleLowerCase("en-GB").match(/[a-z]{5,}/g)??[])
   .filter(word=>!STOP.has(word)))].slice(0,80);
}

/** Shortlist by source-language overlap; only then score embeddings.
 * Bounded in a worker, avoiding a quadratic comparison of entire big graphs.
 * No relationship edge is created or asserted. Not exhaustive nearest-neighbour search.
 */
export function semanticNetworkInsights(graph:GraphDocument,
 docs:NetworkSemanticDocument[],vectors:number[][],max=5):NetworkInsight[]{
 if(docs.length!==vectors.length||vectors.some(v=>!v?.length||v.length!==vectors[0]?.length))
   throw Error("Semantic signals require a complete, consistent index.");
 const postings=new Map<string,number[]>();
 const wordSets=docs.map(d=>tokens(d.text));
 for(let i=0;i<wordSets.length;i++)for(const word of wordSets[i]){
   const values=postings.get(word)??[];values.push(i);postings.set(word,values);
 }
 const connected=new Set(graph.edges.map(e=>
   [e.source,e.target].sort().join("\u0000")));
 const candidates:{a:number;b:number;score:number}[]=[];
 for(let i=0;i<docs.length;i++){
   const possible=new Map<number,number>();
   for(const word of wordSets[i]){
     const indices=postings.get(word)??[];
     if(indices.length<2||indices.length>45)continue;
     for(const j of indices){
       if(j<=i)continue;
       possible.set(j,(possible.get(j)??0)+1);
     }
   }
   const nearby=[...possible].filter(([,shared])=>shared>=2)
     .sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,18);
   for(const [j] of nearby){
     if(connected.has([docs[i].id,docs[j].id].sort().join("\u0000")))continue;
     const score=cosineSimilarity(vectors[i],vectors[j]);
     if(score>=0.83)candidates.push({a:i,b:j,score});
   }
 }
 candidates.sort((a,b)=>b.score-a.score||docs[a.a].id.localeCompare(docs[b.a].id));
 const seen=new Set<string>(),results:NetworkInsight[]=[];
 for(const item of candidates){
   const a=docs[item.a],b=docs[item.b];
   if(seen.has(a.id)||seen.has(b.id))continue;
   seen.add(a.id);seen.add(b.id);
   const score=Number(item.score.toFixed(3));
   results.push({id:"semantic-"+a.id+"-"+b.id,kind:"similarity",
     title:"Possibly related descriptions",
     summary:a.label+" and "+b.label+" use similar language in their source descriptions (similarity "+score+
       "). No recorded link between them was found; this is a lead to investigate, not evidence of collaboration.",
     sourceIds:[a.id,b.id],edgeIds:[],count:2,similarity:score});
   if(results.length>=Math.max(1,Math.min(10,max)))break;
 }
 return results;
}
