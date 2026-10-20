"use client";

import { useState } from "react";
import { PFT_VISUAL_PACK } from "../data/pft-visual-pack";
import { visualAssetUrl } from "@mossline/graph-core";

const selection=[
  "org-meadow-commons","org-fieldroots","org-soillink","org-northern-soils",
  "org-agroforestry-exchange","org-scottish-field-lab","proj-006","proj-010",
  "fund-green-horizon","fund-northern-landscapes","topic-soil","geo-wales"
];
function labelFor(id:string) {
  return id.replace(/^(org|proj|fund|topic|geo)-/,"").replace(/-/g," ").replace(/\b\w/g,ch=>ch.toUpperCase());
}
export function PftVisualShowcase({onOpenSample}:{
  onOpenSample:()=>void;
}) {
  const [gallery,setGallery]=useState(false);
  const hero=PFT_VISUAL_PACK.frontPage?.hero;
  return <section className="visual-showcase" aria-label="Preview original PFT illustrations">
    {hero&&<img className="visual-showcase-hero" alt="Illustrated countryside from the owner's PFT art pack"
      src={visualAssetUrl(PFT_VISUAL_PACK,hero)} loading="eager"/>}
    <div className="visual-showcase-intro">
      <p className="eyebrow">New in alpha 1.3 · PFT artwork preview</p>
      <h2>Explore the original farming illustrations</h2>
      <p>82 source-ID-matched illustrations, the front-page artwork and UK map are ready.
        See the art now — you don't need to upload a spreadsheet to check that the images work.</p>
      <div className="visual-showcase-actions">
        <button className="button-primary" type="button" onClick={onOpenSample}>
          Open illustrated example map →
        </button>
        <button className="button-outline" type="button"
          onClick={()=>setGallery(value=>!value)} aria-expanded={gallery}>
          {gallery?"Hide artwork gallery":"Browse the artwork"}
        </button>
      </div>
      <p className="visual-showcase-warning">The example map uses synthetic relationships strictly for
        demonstrating the visual style. It is not the real PFT network. Your saved maps are kept.</p>
    </div>
    {gallery&&<div className="visual-showcase-gallery" aria-label="Examples of PFT entity pictures">
      {selection.map(id=>{
        const file=PFT_VISUAL_PACK.images[id];
        const url=file?visualAssetUrl(PFT_VISUAL_PACK,file):undefined;
        return <figure key={id}>
          {url&&<img src={url} loading="lazy" alt={"Original PFT illustration for "+labelFor(id)} />}
          <figcaption>{labelFor(id)}</figcaption>
        </figure>;
      })}
      <p>These are samples from the 82 illustrations.
        <a href={PFT_VISUAL_PACK.source} target="_blank" rel="noreferrer"> See the artwork repository ↗</a>
      </p>
    </div>}
  </section>;
}
