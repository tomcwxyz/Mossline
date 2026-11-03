import {notFound} from "next/navigation";
import {PublishedAtlas} from "../../../../components/PublishedAtlas";
import {getPublished} from "../../../../lib/hosted-db";
import {isHostedConfigured,validPublicationId} from "../../../../lib/hosted-auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
/** A published map or story, made to sit inside another site (see next.config.ts for the framing rule). */
export default async function EmbeddedPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  if(!validPublicationId(slug)||!isHostedConfigured())notFound();
  let publication;
  try{publication=await getPublished(slug);}
  catch{ return <main className="shell published-wait" role="alert"><h1>Map temporarily unavailable</h1></main>; }
  if(!publication)notFound();
  return <PublishedAtlas snapshot={publication.snapshot} slug={slug} embedded/>;
}
