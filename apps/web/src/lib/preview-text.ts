import type {HostedSnapshot} from "@mossline/graph-core";

/** What a shared link says about a published map or story: plain text, short enough for a preview card. */
export function previewText(snapshot:HostedSnapshot){
  const story=snapshot.story;
  const n=(count:number,one:string,many:string)=>count.toLocaleString("en-GB")+" "+(count===1?one:many);
  const counts=n(snapshot.nodes.length,"record","records")+" · "+n(snapshot.edges.filter(e=>!e.inferred).length,"recorded link","recorded links");
  const strip=(s:string)=>s.replace(/\*\*|\*|\[([^\]]*)\]\([^)]*\)/g,"$1").replace(/\s+/g," ").trim();
  const clip=(s:string,n:number)=>s.length<=n?s:s.slice(0,n-1).replace(/\s+\S*$/,"")+"…";
  const title=story?.title||snapshot.title;
  const about=strip(story?.intro||snapshot.introduction||"");
  return {
    kind:story?"A story about a map":"A map",
    title:clip(title,120),
    description:clip(about||(story?n(story.steps.length,"step","steps")+", told over a map of "+counts+".":counts+"."),200),
    counts,
    // Only an uploaded cover goes into the card: a linked one would mean fetching another site's picture.
    cover:story?.cover&&story.cover.src.startsWith("data:image/")?story.cover:null
  };
}
