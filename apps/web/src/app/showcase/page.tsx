import type {Metadata} from "next";
import {MOSSY_EXAMPLES} from "../../data/mossy-examples";
import {isHostedConfigured} from "../../lib/hosted-auth";
import {featuredShowcase, type ShowcaseItem} from "../../lib/showcase-db";
import {Wordmark} from "../../components/atlas/Wordmark";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Showcase · Mossy",description:"Five fictional worlds to explore, plus maps and stories shared by the Mossy community."};

export default async function ShowcasePage(){
  let items:ShowcaseItem[]=[];
  let unavailable=false;
  if(isHostedConfigured())try{items=await featuredShowcase();}catch{unavailable=true;}
  return <main className="ml-atlas ml-showcase">
    <header className="ml-home-header">
      <a className="ml-account-home" href="/"><Wordmark/></a>
      <nav className="ml-showcase-nav"><a href="/">Your maps</a><a href="/showcase" aria-current="page">Showcase</a></nav>
    </header>
    <div className="ml-showcase-body">
      <section className="ml-showcase-intro">
        <p className="ml-start-eyebrow">Made with Mossy</p>
        <h1>A small window into what data can reveal.</h1>
        <p>Explore five entirely fictional datasets, then see work shared by real people. Every featured community map is submitted deliberately and reviewed before appearing here.</p>
        <a className="ml-solid ml-account-button" href="/">Make something of your own →</a>
      </section>
      <section aria-labelledby="examples-heading">
        <div className="ml-start-examples-head"><div>
          <p className="ml-start-eyebrow">Start somewhere interesting</p>
          <h2 id="examples-heading">Five fictional worlds</h2>
          <p>The figures, names and relationships are invented. Open an example in Mossy, or download its source data and import it yourself.</p>
        </div></div>
        <div className="ml-start-example-grid">
          {MOSSY_EXAMPLES.map(example=><article key={example.id} className={"ml-start-example is-"+example.colour}>
            <p className="ml-start-eyebrow">{example.tag}</p>
            <h3>{example.title}</h3><p>{example.subtitle}</p>
            <strong>{example.focus}</strong>
            <div className="ml-start-example-actions"><a href={"/?example="+example.id}>Open in Mossy →</a>
              <a href={example.url} download={example.id+".json"}>Download data</a></div>
          </article>)}
        </div>
      </section>
      <section className="ml-showcase-community" aria-labelledby="community-heading">
        <p className="ml-start-eyebrow">Made by people</p><h2 id="community-heading">Community showcase</h2>
        <p className="ml-showcase-helper">Published maps are private to their link until their author submits them here and an operator approves them. To share yours, publish a reviewed map in Mossy and select <strong>Submit to Showcase</strong>.</p>
        {unavailable?<p role="status">The community gallery is temporarily unavailable.</p>:
        items.length===0?<p className="ml-showcase-empty">The first community contributions haven't been featured yet. Yours could be one of them.</p>:
        <div className="ml-showcase-community-grid">{items.map(item=><article key={item.slug} className="ml-showcase-item">
          <p className="ml-start-eyebrow">Community contribution</p><h3><a href={"/p/"+item.slug}>{item.title}</a></h3>
          <p>{item.description}</p><small>Shared by {item.credit}</small>
          <a href={"/p/"+item.slug}>Explore this work →</a>
        </article>)}</div>}
      </section>
    </div>
  </main>;
}
