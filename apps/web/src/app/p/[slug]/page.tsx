import {notFound} from "next/navigation";
import {PublishedAtlas} from "../../../components/PublishedAtlas";
import {getPublished} from "../../../lib/hosted-db";
import {isHostedConfigured,validPublicationId} from "../../../lib/hosted-auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
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
