"use client";

export type StartMap={id:string;title:string;nodes:number;edges:number;updatedAt:number;funding:boolean;summary?:string};

export function StartScreen({maps,onOpen,onImport,onFunding,onExample,onCommunity,onSampleSheet,
  onPft,onRecovery}:{
  maps:StartMap[];onOpen:(id:string)=>void;onImport:()=>void;
  onFunding:()=>void;onExample:()=>void;onCommunity:()=>void;onSampleSheet:()=>void;
  onPft:()=>void;onRecovery:()=>void;
}){
  return <div className="studio-start">
    <section className="studio-start-hero">
      <div className="studio-start-intro">
        <p className="eyebrow">mossline · make sense of connected worlds</p>
        <h1>See the relationships, not just the parts<span className="heading-period">.</span></h1>
        <p>Bring your organisations, projects, places and people into a living network.
          Start with what you have, then discover the connections worth exploring.</p>
        <p className="studio-start-choose">How would you like to start?</p>
        <div className="studio-start-route-choices" role="group" aria-label="Choose a data import route">
          <button type="button" onClick={onImport}>
            <span className="studio-start-route-icon" aria-hidden="true">▦</span>
            <span className="studio-start-route-description">
              <strong>Map your own data</strong>
              <small>Organisations, people, projects or places · CSV, Kumu and JSON</small>
            </span>
            <span aria-hidden="true">→</span>
          </button>
          <button type="button" onClick={onFunding}>
            <span className="studio-start-route-icon" aria-hidden="true">◎</span>
            <span className="studio-start-route-description">
              <strong>Explore funding data</strong>
              <small>Grant awards, funders and recipients · complete source network</small>
            </span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
        <button type="button" className="studio-start-try" onClick={onExample}>
          Or try an example network →
        </button>
        <p className="studio-start-privacy">No account needed · Your working data stays in this browser</p>
      </div>
      <div className="studio-start-art" aria-hidden="true">
        <svg viewBox="0 0 390 300" fill="none">
          <path d="M80 89L172 51L252 96L326 48M80 89L111 201L218 238L252 96M111 201L42 248M172 51L218 238M252 96L330 207L218 238M326 48L330 207" stroke="#87a88b" strokeOpacity=".57" strokeWidth="2"/>
          {[[80,89,13],[172,51,22],[252,96,31],[326,48,12],[111,201,20],[218,238,22],[330,207,14],[42,248,11]].map(([cx,cy,r],i)=>
            <circle key={i} cx={cx} cy={cy} r={r} fill={i%3===0?"#b9c998":i%3===1?"#d7bb83":"#7ba6ac"} stroke="#1b4433" strokeWidth="4"/>)}
          <circle cx="252" cy="96" r="49" stroke="#d7bb83" strokeOpacity=".38" strokeWidth="2" strokeDasharray="4 8"/>
        </svg>
      </div>
    </section>
    <div className="studio-start-grid studio-start-single">
      <section className="studio-start-card" aria-labelledby="start-maps">
        <div className="studio-start-card-head">
          <div><p className="eyebrow">Pick up where you left off</p>
            <h2 id="start-maps">Your maps</h2></div>
          <span className="studio-start-count">{maps.length}</span>
        </div>
        {maps.length?<>
          <div className="studio-start-maplist">
            {maps.map(m=><button key={m.id} type="button" onClick={()=>onOpen(m.id)}>
              <span className="studio-start-map-symbol" aria-hidden="true">✳</span>
              <span className="studio-start-map-name"><strong>{m.title}</strong>
                <small>{m.summary??(m.nodes.toLocaleString("en-GB")+" entities · "+
                  m.edges.toLocaleString("en-GB")+" connections")}</small></span>
              <span aria-hidden="true">→</span>
            </button>)}
          </div>
          <button type="button" className="studio-start-quiet" onClick={onRecovery}>
            Manage, back up or restore saved maps ↗</button>
        </>:<><p>Nothing saved here yet. Start with your own data or try a fictional network.</p>
          <button type="button" className="studio-start-quiet" onClick={onExample}>
            Open an example →</button></>}
      </section>

    </div>
    <details className="studio-start-more">
      <summary>More ways to get started</summary>
      <div className="studio-start-more-actions">
        <button type="button" onClick={onCommunity}>Try the small community example</button>
        <button type="button" onClick={onSampleSheet}>Try a fictional spreadsheet</button>
        <button type="button" onClick={onPft}>Explore the illustration showcase</button>
        <button type="button" onClick={onRecovery}>Recover browser data</button>
      </div>
    </details>
    <footer className="footer"><span>Mossline is an open-source technical alpha.</span>
      <span>Maps are saved locally · Keep backups of important work</span></footer>
  </div>;
}
