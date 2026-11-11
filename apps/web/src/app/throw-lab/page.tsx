import type {Metadata} from "next";
import catalogueData from "../../../../../data/throw-lab/catalogue.json";
import {Wordmark} from "../../components/atlas/Wordmark";
import {RICH_LAB_EXAMPLES} from "../../lib/throw-lab-examples";

export const metadata:Metadata={
  title:"Throw Lab · Mossy",
  description:"Explore rich fictional source datasets in Mossy, from connected communities and food routes to grants, cultural geography and wildlife."
};

type Case={
  id:string;title:string;family:string;format:string;idealFirstView:string;
  edit:string;mustNot:string;actualStatus:string;
  files?:{name:string;content:string}[];
};
const cases:Case[]=catalogueData.cases;
const runnable=cases.filter(item=>item.actualStatus==="engine-regression-added");
const gaps=cases.filter(item=>item.actualStatus!=="engine-regression-added");
const familyName=(value:string)=>({
  "lists-and-tables":"Lists and rich tables",
  "relationships-and-structures":"Relationships and structures",
  "events-measures-flows":"Events, measurements and flows",
  "geography-and-time":"Geography and time",
  "documents-and-text":"Documents and text",
  "mixed-and-messy":"Mixed and messy files"
}[value]??value);

export default function ThrowLabPage(){
  return <main className="ml-atlas ml-showcase">
    <header className="ml-home-header">
      <a className="ml-account-home" href="/"><Wordmark/></a>
      <nav className="ml-showcase-nav">
        <a href="/">Your maps</a><a href="/showcase">Showcase</a>
        <a href="/throw-lab" aria-current="page">Throw Lab</a>
      </nav>
    </header>
    <div className="ml-showcase-body">
      <section className="ml-showcase-intro">
        <p className="ml-start-eyebrow">Try something unexpected</p>
        <h1>What can you throw at Mossy?</h1>
        <p>A workbench of entirely fictional datasets. Start with the larger worlds below: each has enough records, relationships and variation to find something interesting. Explore the actual files in Mossy, then change how they're read.</p>
        <p><strong>{RICH_LAB_EXAMPLES.length} substantial datasets</strong>, {runnable.length} small engine-tested input cases and {gaps.length} tracked gaps. This is a transparent alpha: being able to read a source doesn't mean every ideal visualisation is ready yet.</p>
        <a className="ml-solid ml-account-button" href="/">Open Mossy to add a file →</a>
      </section>
      <section aria-labelledby="lab-rich">
        <div className="ml-start-examples-head">
          <div>
            <p className="ml-start-eyebrow">Start exploring</p>
            <h2 id="lab-rich">Eight richer worlds to investigate</h2>
            <p>Hundreds of source records per example, now spread deliberately across the UK, the United States and multiple countries and continents. Some form recorded networks; others belong on maps or have no links at all. Every example uses the same import journey as your own files.</p>
          </div>
        </div>
        <div className="ml-start-example-grid ml-throw-rich-grid">
          {RICH_LAB_EXAMPLES.map((item,index)=><article key={item.id} className="ml-start-example ml-throw-rich-card">
            <div className="ml-start-example-copy">
              <p className="ml-start-eyebrow">{String(index+1).padStart(2,"0")} / {item.group} · {item.geography.label}</p>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <p className="ml-example-facts">{item.stats}</p>
              <p className="ml-small"><strong>Geography:</strong> {item.geography.cities} city anchors · {item.geography.countries.length} {item.geography.countries.length===1?"country":"countries"}. Locations are fictional and placed near real city centres.</p>
              <div className="ml-throw-patterns">
                <strong>Things worth looking for</strong>
                <ul>{item.observations.map(pattern=><li key={pattern}>{pattern}</li>)}</ul>
              </div>
              <p><strong>Try:</strong> {item.whatToTry}</p>
              <p className="ml-small"><strong>Remember:</strong> {item.caveat}</p>
              <div className="ml-start-example-actions">
                <a href={"/?throw="+encodeURIComponent(item.id)} className="ml-example-open">Explore in Mossy →</a>
                <details className="ml-example-download">
                  <summary>Download source files</summary>
                  {item.files.map(file=><a href={file.path} download={file.name} key={file.path}>
                    {file.name} · {file.rows.toLocaleString("en-GB")} rows</a>)}
                  <small>Open the files together to preserve relationships across sources.</small>
                </details>
              </div>
            </div>
          </article>)}
        </div>
      </section>
      <section aria-labelledby="lab-ready">
        <div className="ml-start-examples-head">
          <div>
            <p className="ml-start-eyebrow">For checking the details</p>
            <h2 id="lab-ready">Small parser tests</h2>
            <p>These intentionally small fixtures catch particular import mistakes. They aren't intended to be an impressive map or network; use the larger examples above for that.</p>
          </div>
        </div>
        <details className="ml-throw-small">
          <summary>Show all {runnable.length} small source fixtures</summary>
          <div className="ml-start-example-grid">
          {runnable.map(item=><article key={item.id} className="ml-start-example">
            <div className="ml-start-example-copy">
              <p className="ml-start-eyebrow">{familyName(item.family)} · {item.format}</p>
              <h3>{item.title}</h3>
              <p><strong>Should reveal:</strong> {item.idealFirstView}</p>
              <p><strong>What to change:</strong> {item.edit}</p>
              <p className="ml-example-facts"><strong>Must not:</strong> {item.mustNot}</p>
              <details className="ml-example-download">
                <summary>Download the fictional source{item.files?.length===1?"":" files"}</summary>
                {item.files?.map(file=><a key={file.name} download={file.name}
                  href={"data:text/plain;charset=utf-8,"+encodeURIComponent(file.content)}>{file.name}</a>)}
              </details>
            </div>
          </article>)}
          </div>
        </details>
      </section>
      <section className="ml-showcase-community" aria-labelledby="lab-gaps">
        <p className="ml-start-eyebrow">The honest backlog</p>
        <h2 id="lab-gaps">What Mossy can't do properly yet</h2>
        <p className="ml-showcase-helper">These {gaps.length} cases are part of the product contract, but do not have a passing import regression or verified first view. They are not marked as supported.</p>
        {Array.from(new Set(gaps.map(item=>item.family))).map(family=><details key={family} className="ml-example-download">
          <summary>{familyName(family)} · {gaps.filter(item=>item.family===family).length} cases</summary>
          <ul>{gaps.filter(item=>item.family===family).map(item=><li key={item.id}>
            <strong>{item.title}</strong> ({item.format}) — intended view: {item.idealFirstView}. {item.mustNot}.
          </li>)}</ul>
        </details>)}
      </section>
      <p className="ml-start-privacy">These examples are fictional. Ordinary local file imports stay on your device. Publishing a result is a separate choice.</p>
    </div>
  </main>;
}
