import type {Metadata} from "next";
import {MOSSY_EXAMPLES} from "../../data/mossy-examples";
import {isHostedConfigured} from "../../lib/hosted-auth";
import {featuredShowcase, type ShowcaseItem} from "../../lib/showcase-db";
import {Wordmark} from "../../components/atlas/Wordmark";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Showcase · Mossy",description:"Five ways to explore to explore, plus maps and stories shared by the Mossy community."};

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
          <p>Five distinct views — Geography, Network, Themes, Funding and Timeline. Explore an example or download both CSVs and let Mossy work it out. All organisations, activities and relationships are invented; the geography example uses real UK city locations.</p>
        </div></div>
        <div className="ml-start-example-grid">
          {MOSSY_EXAMPLES.map((example,index)=><article key={example.id} className={"ml-start-example is-"+example.colour+(index===0?" is-featured":"")}>
            <img className="ml-start-example-preview" src={"/examples/"+example.id+".svg"} width="960" height="540"
              alt={example.lensLabel+" chart preview of the fictional "+example.title+" dataset"} loading={index===0?"eager":"lazy"}/>
            <div className="ml-start-example-copy">
              <p className="ml-start-eyebrow">{String(index+1).padStart(2,"0")} / {example.lensLabel}</p>
              <h3>{example.title}</h3>
              <p>{example.subtitle}</p>
              <strong>{example.focus}</strong>
              <p className="ml-example-facts">{example.facts}</p>
              <div className="ml-start-example-actions">
                <a className="ml-example-open" href={"/?example="+example.id}>Explore this {example.lensLabel.toLowerCase()} view →</a>
                <details className="ml-example-download"><summary>Try the source files</summary>
                  <a href={"/examples/"+example.id+"-records.csv"} download>Records CSV</a>
                  <a href={"/examples/"+example.id+"-relationships.csv"} download>Relationships CSV</a>
                  <a href={example.url} download={example.id+".json"}>Complete map JSON</a>
                  <small>Import both CSV files together.</small>
                </details>
              </div>
            </div>
          </article>)}
        </div>
      </section>
      <section className="ml-showcase-community" aria-labelledby="community-heading">
        <p className="ml-start-eyebrow">Made by people</p><h2 id="community-heading">Community showcase</h2>
        <p className="ml-showcase-helper">Published maps are private to their link until their author submits them here and an operator approves them. To share yours, publish a reviewed map in Mossy and select <strong>Submit to Showcase</strong>.</p>
        {unavailable?<p role="status">The community gallery is temporarily unavailable.</p>:
        items.length===0?<p className="ml-showcase-empty">The first community contributions haven't been featured yet. Yours could be one of them.</p>:
        <div className="ml-showcase-community-grid">{items.map(item=><article key={item.slug} className="ml-showcase-item">
          <a href={"/p/"+item.slug} className="ml-showcase-cover" aria-label={"Explore "+item.title}>
            <img src={"/p/"+item.slug+"/opengraph-image"} width="1200" height="630" loading="lazy" alt=""/>
          </a>
          <p className="ml-start-eyebrow">Community contribution</p><h3><a href={"/p/"+item.slug}>{item.title}</a></h3>
          <p>{item.description}</p><small>Shared by {item.credit}</small>
          <a href={"/p/"+item.slug}>Explore this work →</a>
        </article>)}</div>}
      </section>
    </div>
  </main>;
}
