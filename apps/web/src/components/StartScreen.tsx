"use client";

import type {ReactNode} from "react";
import {MOSSY_EXAMPLES, type MossyExampleId} from "../data/mossy-examples";

export type StartMap={id:string;title:string;nodes:number;edges:number;updatedAt:number;funding:boolean;summary?:string;
  /** e.g. "Shared" for a map kept in an account. */
  badge?:string};

/** A small drawn atlas: wash, ink, pencil and the four record shapes, as the
 *  lenses draw them. Decorative; the real atlas is one click away. */
function AtlasSketch(){
  const wash=[[118,104,74,56],[262,92,64,50],[196,214,82,52]];
  const marks:[string,number,number][]=[["c",96,92],["s",128,118],["c",150,84],["s",88,128],["d",120,98],
    ["c",250,78],["s",282,104],["t",240,108],["s",266,64],["c",180,206],["s",214,226],["c",204,194],
    ["d",188,222],["s",162,230],["t",226,204]];
  const ink=[[120,98,96,92],[120,98,128,118],[120,98,150,84],[120,98,88,128],[150,84,250,78],[250,78,282,104],
    [250,78,266,64],[250,78,240,108],[188,222,180,206],[188,222,214,226],[188,222,162,230],[188,222,204,194],[128,118,188,222]];
  const shape=(k:string,x:number,y:number,i:number)=>k==="c"?<circle key={i} cx={x} cy={y} r="5.2" className="ml-sk-org"/>
    :k==="s"?<rect key={i} x={x-4.6} y={y-4.6} width="9.2" height="9.2" rx="1.6" className="ml-sk-project"/>
    :k==="d"?<path key={i} d={`M${x} ${y-8}L${x+8} ${y}L${x} ${y+8}L${x-8} ${y}Z`} className="ml-sk-funder"/>
    :<path key={i} d={`M${x} ${y-6}L${x+6} ${y+5}L${x-6} ${y+5}Z`} className="ml-sk-place"/>;
  return <svg viewBox="0 0 360 290" aria-hidden="true">
    {wash.map(([cx,cy,rx,ry],i)=><g key={i} className="ml-sk-wash">
      {[1,.78,.56,.34].map(k=><ellipse key={k} cx={cx} cy={cy} rx={rx*k} ry={ry*k}/>)}</g>)}
    {ink.map(([x1,y1,x2,y2],i)=><path key={i} d={`M${x1} ${y1}Q${(x1+x2)/2+(y2-y1)*.12} ${(y1+y2)/2-(x2-x1)*.12} ${x2} ${y2}`} className="ml-sk-ink"/>)}
    <path d="M96 92Q170 150 204 194" className="ml-sk-pencil"/>
    {marks.map(([k,x,y],i)=>shape(k,x,y,i))}
    <text x="118" y="38" className="ml-sk-area">LOCAL SUPPLY CHAINS</text>
    <text x="262" y="34" className="ml-sk-area">LAND ACCESS</text>
    <text x="196" y="282" className="ml-sk-area">FOOD JUSTICE</text>
    <g className="ml-sk-receipt" transform="translate(214 142)"><rect width="136" height="22" rx="5"/>
      <text x="68" y="15">grants-2023.csv · #30</text></g>
  </svg>;
}

export function StartScreen({maps,onOpen,onImport,onFunding,onTheList,onExample,onCommunity,onSampleSheet,
  onPft,onRecovery,onOpenExample,accountMaps}:{
  maps:StartMap[];onOpen:(id:string)=>void;onImport:()=>void;
  onFunding:()=>void;onTheList:()=>void;onExample:()=>void;onCommunity:()=>void;onSampleSheet:()=>void;
  onPft:()=>void;onRecovery:()=>void;onOpenExample:(id:MossyExampleId)=>void;
  /** Maps in the signed-in account that aren't in this browser yet. */
  accountMaps?:ReactNode;
}){
  return <div className="ml-start">
    <section className="ml-start-hero">
      <div className="ml-start-intro">
        <p className="ml-start-eyebrow">A field atlas for connected work</p>
        <h1>See the relationships, not just the parts.</h1>
        <p className="ml-start-lede">Bring your organisations, projects, places and people into one atlas.
          Follow what your records say, see where the money goes, and check the evidence behind every line.</p>
        <p className="ml-start-choose">Start with what you have</p>
        <div className="ml-start-routes ml-start-routes--simple" role="group" aria-label="Start exploring">
          <button type="button" onClick={onImport}>
            <svg className="ml-start-icon" viewBox="0 0 28 28" aria-hidden="true"><circle cx="8" cy="9" r="4" className="ml-sk-org"/>
              <rect x="16" y="15" width="8" height="8" rx="1.5" className="ml-sk-project"/><path d="M8 9L20 19" className="ml-sk-ink"/></svg>
            <span><strong>Add your data</strong>
              <small>Spreadsheets, records or existing maps. Mossy will help make sense of them.</small></span>
            <span aria-hidden="true" className="ml-start-arrow">→</span>
          </button>
        </div>
        <button type="button" className="ml-start-try" onClick={onExample}>Or try an example network →</button>
        <p className="ml-start-privacy">No account needed to begin · Files are read in your browser</p>
      </div>
      <figure className="ml-start-art">
        <AtlasSketch/>
        <figcaption>
          <span><i className="ml-key-ink"/>Ink · recorded</span>
          <span><i className="ml-key-pencil"/>Pencil · suggested</span>
          <span><i className="ml-key-wash"/>Wash · to navigate</span>
        </figcaption>
      </figure>
    </section>

    <section className="ml-start-examples" aria-labelledby="start-examples">
      <div className="ml-start-examples-head">
        <div><p className="ml-start-eyebrow">Five invented worlds</p>
          <h2 id="start-examples">See what Mossy can uncover</h2>
          <p>Explore a complete fictional dataset, then download it and try importing it yourself. Every person, place, figure and connection is invented.</p></div>
        <a className="ml-quiet" href="/showcase">Visit Showcase →</a>
      </div>
      <div className="ml-start-example-grid">
        {MOSSY_EXAMPLES.map(example=><article key={example.id} className={"ml-start-example is-"+example.colour}>
          <p className="ml-start-eyebrow">{example.tag}</p>
          <img className="ml-start-example-preview" src={"/examples/"+example.id+".svg"} width="480" height="210" alt="" loading="lazy"/>
          <h3>{example.title}</h3><p>{example.subtitle}</p>
          <strong>{example.focus}</strong>
          <div className="ml-start-example-actions">
            <button type="button" onClick={()=>onOpenExample(example.id)}>Explore example →</button>
            <a href={example.url} download={example.id+".json"}>Get the data</a>
          </div>
        </article>)}
      </div>
    </section>

    <section className="ml-start-maps" aria-labelledby="start-maps">
      <div className="ml-start-maps-head">
        <div><p className="ml-start-eyebrow">Pick up where you left off</p>
          <h2 id="start-maps">Your maps</h2></div>
        <span className="ml-start-count">{maps.length}</span>
      </div>
      {maps.length?<>
        <div className="ml-start-maplist studio-start-maplist">
          {maps.map(m=><button key={m.id} type="button" onClick={()=>onOpen(m.id)}>
            <svg viewBox="0 0 26 26" aria-hidden="true" className="ml-start-map-mark"><path d="M3 19C8 19 9 8 14 8S20 15 23 6" className="ml-mark-line"/>
              <circle cx="3.5" cy="19" r="2.6" className="ml-mark-a"/><circle cx="14" cy="8" r="2.6" className="ml-mark-b"/>
              <circle cx="22.6" cy="6.4" r="2.6" className="ml-mark-c"/></svg>
            <span className="ml-start-map-name"><strong>{m.title}{m.badge&&<em className="ml-start-badge">{m.badge}</em>}</strong>
              <small>{m.summary??(m.nodes.toLocaleString("en-GB")+(m.nodes===1?" record · ":" records · ")+
                m.edges.toLocaleString("en-GB")+(m.edges===1?" link":" links"))}</small></span>
            <span aria-hidden="true" className="ml-start-arrow">→</span>
          </button>)}
        </div>
        <button type="button" className="ml-link-button" onClick={onRecovery}>
          Manage, back up or restore saved maps ↗</button>
      </>:<><p className="ml-start-empty">Nothing saved here yet. Start with your own data or try a fictional network.</p>
        <button type="button" className="ml-link-button" onClick={onExample}>
          Open an example →</button></>}
    </section>

    {accountMaps}

    <details className="studio-start-more ml-start-more">
      <summary>More ways to get started</summary>
      <div className="ml-start-more-actions">
        <button type="button" onClick={onFunding}>Bring in grants data</button>
        <button type="button" onClick={onTheList}>Shifting Ground · The List</button>
        <button type="button" onClick={onCommunity}>Try the small community example</button>
        <button type="button" onClick={onSampleSheet}>Try a fictional spreadsheet</button>
        <button type="button" onClick={onPft}>Explore the illustration showcase</button>
        <button type="button" onClick={onRecovery}>Recover browser data</button>
      </div>
    </details>
    <footer className="ml-start-footer"><span>Mossy is an open-source technical alpha.</span>
      <span>Maps are saved locally · Keep backups of important work</span></footer>
  </div>;
}
