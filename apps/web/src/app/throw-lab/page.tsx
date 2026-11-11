import type {Metadata} from "next";
import catalogueData from "../../../../../data/throw-lab/catalogue.json";
import {Wordmark} from "../../components/atlas/Wordmark";

export const metadata:Metadata={
  title:"Throw Lab · Mossy",
  description:"Real fictional files to test how Mossy reads lists, relationships, measurements, places and mixed data. See what already works and what's next."
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
        <p>A workbench of entirely fictional datasets. Each one has an intended result and a specific mistake Mossy must avoid. Download the actual source, add it in Mossy, and see whether it makes sense.</p>
        <p><strong>{runnable.length} engine-tested input cases</strong> and {gaps.length} tracked gaps. Being able to import a file does not yet guarantee the ideal chart or interpretation works. This is a transparent alpha, not a compatibility claim.</p>
        <a className="ml-solid ml-account-button" href="/">Open Mossy to add a file →</a>
      </section>
      <section aria-labelledby="lab-ready">
        <div className="ml-start-examples-head">
          <div>
            <p className="ml-start-eyebrow">Actual raw inputs</p>
            <h2 id="lab-ready">Try the files</h2>
            <p>Use the download links, then drop the file or files into <strong>Add your data</strong>. Some examples intentionally need better charting or interpretation; that is part of what we are testing.</p>
          </div>
        </div>
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
