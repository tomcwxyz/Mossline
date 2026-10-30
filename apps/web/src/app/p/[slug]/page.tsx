import {notFound} from "next/navigation";
import {PublishedAtlas} from "../../../components/PublishedAtlas";
import {getPublished} from "../../../lib/hosted-db";
import {isHostedConfigured,validPublicationId} from "../../../lib/hosted-auth";
import {previewText} from "../../../lib/preview-text";
import type {Metadata} from "next";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
/** What a shared link shows: the title and a line about it. The picture is opengraph-image.tsx. */
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;
  if(!validPublicationId(slug)||!isHostedConfigured())return {};
  try{
    const p=await getPublished(slug);
    if(!p)return {};
    const t=previewText(p.snapshot);
    const base=process.env.MOSSLINE_BASE_URL;
    return {title:t.title+" — Mossline",description:t.description,
      ...(base?{metadataBase:new URL(base)}:{}),
      openGraph:{title:t.title,description:t.description,type:"article",siteName:"Mossline"},
      twitter:{card:"summary_large_image",title:t.title,description:t.description}};
  }catch{return {};}
}
/** Dynamic lookup on EVERY request: never serve an unpublished snapshot from a static build. */
export default async function HostedPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  if(!validPublicationId(slug)||!isHostedConfigured())notFound();
  let publication;
  try{publication=await getPublished(slug);}
  catch{ return <main className="shell published-wait" role="alert">
    <h1>Map temporarily unavailable</h1><p>We could not load this publication.</p>
  </main>;}
  if(!publication)notFound();
  return <PublishedAtlas snapshot={publication.snapshot} slug={slug}/>;
}
