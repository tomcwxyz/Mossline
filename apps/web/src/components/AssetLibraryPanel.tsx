"use client";

import { useState } from "react";
import { parseAssetLibrary, type LibraryAsset } from "@mossline/graph-core";

type Props={
  assets:LibraryAsset[];
  onAdd:(asset:LibraryAsset)=>boolean;
  onRemove:(id:string)=>void;
};

export function AssetLibraryPanel({assets,onAdd,onRemove}:Props){
  const [name,setName]=useState("");
  const [url,setUrl]=useState("");
  const [creator,setCreator]=useState("");
  const [licence,setLicence]=useState<LibraryAsset["licence"]>("Unknown");
  const [attribution,setAttribution]=useState("");
  const [sourceUrl,setSourceUrl]=useState("");
  const [error,setError]=useState("");
  function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    try {
      if(assets.length>=60)throw Error("This browser already has 60 artwork references.");
      const asset= parseAssetLibrary([{
        id:crypto.randomUUID(),name,url,creator,licence,attribution,
        ...(sourceUrl?{sourceUrl}:{})
      }])[0];
      if(assets.some(x=>x.url===asset.url))
        throw Error("This picture URL is already in your library.");
      if(!onAdd(asset))throw Error("Browser storage is full or unavailable.");
      setName("");setUrl("");setCreator("");setAttribution("");setSourceUrl("");
      setLicence("Unknown");setError("");
    }catch(err){
      setError(err instanceof Error?err.message:"Check the picture details and try again.");
    }
  }
  return <details className="asset-library-panel">
    <summary>Artwork library <span>{assets.length} picture{assets.length===1?"":"s"}</span></summary>
    <p className="help">Save reusable image links with their creator and usage terms.
      This library is browser-local; adding an image does not upload it or grant permission to reuse it.</p>
    <form className="asset-form" onSubmit={submit}>
      <label>Short title
        <input type="text" required maxLength={80} value={name} onChange={e=>setName(e.target.value)}
          placeholder="e.g. Community hall portrait"/>
      </label>
      <label>Image URL (HTTPS)
        <input type="url" required maxLength={2048} value={url} onChange={e=>setUrl(e.target.value)}
          placeholder="https://example.org/hall.jpg"/>
      </label>
      <label>Creator or rights holder
        <input type="text" required maxLength={120} value={creator} onChange={e=>setCreator(e.target.value)}
          placeholder="Photographer or organisation"/>
      </label>
      <label>Licence / permission
        <select value={licence} onChange={e=>setLicence(e.target.value as LibraryAsset["licence"])}>
          <option value="Unknown">Unknown — do not assume permission</option>
          <option value="CC0">CC0</option>
          <option value="CC BY">CC BY</option>
          <option value="CC BY-SA">CC BY-SA</option>
          <option value="Public domain">Public domain</option>
          <option value="Permission granted">Permission granted</option>
          <option value="Other / restricted">Other / restricted</option>
        </select>
      </label>
      <label>Attribution / conditions
        <textarea value={attribution} maxLength={500} rows={2}
          onChange={e=>setAttribution(e.target.value)} placeholder="Credit, licence link, specific use conditions"/>
      </label>
      <label>Original source link (optional, HTTPS)
        <input type="url" value={sourceUrl} maxLength={2048}
          onChange={e=>setSourceUrl(e.target.value)} placeholder="https://example.org/source"/>
      </label>
      {error&&<p role="alert" className="asset-error">{error}</p>}
      <button type="submit" disabled={assets.length>=60}>+ Add image reference</button>
    </form>
    {assets.length>0&&<ul className="asset-library-list">
      {assets.map(asset=><li key={asset.id}>
        <img alt="" src={asset.url} loading="lazy" referrerPolicy="no-referrer"/>
        <div><strong>{asset.name}</strong><span>{asset.creator} · {asset.licence}</span>
          {asset.attribution&&<small>{asset.attribution}</small>}
          {asset.licence==="Unknown"&&<small>Usage permission unverified</small>}
        </div>
        <button type="button" onClick={()=>onRemove(asset.id)}
          aria-label={"Remove "+asset.name+" from artwork library"}>×</button>
      </li>)}
    </ul>}
    <p className="help">Removing a library entry does not change pictures already saved in perspectives.
      Export a perspective bundle to take its image references to another browser.</p>
  </details>;
}
