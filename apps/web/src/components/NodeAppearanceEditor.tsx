"use client";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { GraphNode, NodeStyleOverride } from "@mossline/graph-core";

type Props={
  node:GraphNode;
  value:NodeStyleOverride;
  onChange:(id:string,value:NodeStyleOverride|undefined)=>void;
};
/** A reusable inspector for presentation choices, never canonical graph edits. */
export function NodeAppearanceEditor({node,value,onChange}:Props){
  const [picture,setPicture]=useState(value.imageUrl??"");
  const [error,setError]=useState("");
  useEffect(()=>{
    setPicture(value.imageUrl??"");
    setError("");
  },[node.id,value.imageUrl]);
  const patch=(update:Partial<NodeStyleOverride>)=>onChange(node.id,{...value,...update});
  function applyPicture(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const url=picture.trim();
    if(url){
      try{
        const address=new URL(url);
        if(address.protocol!=="https:"||url.length>2048)throw Error("invalid");
      }catch{
        setError("Enter a valid HTTPS image URL (up to 2,048 characters).");
        return;
      }
    }
    setError("");
    const next={...value};
    if(url)next.imageUrl=url;
    else delete next.imageUrl;
    onChange(node.id,next);
  }
  return <section className="node-appearance-editor" aria-label={"Appearance of "+node.label}>
    <p className="eyebrow">Author this view</p>
    <h3>How should this appear?</h3>
    <label>Label
      <select value={value.label??"auto"}
        onChange={e=>patch({label:e.target.value as NonNullable<NodeStyleOverride["label"]>})}>
        <option value="auto">Automatic</option>
        <option value="show">Always show</option>
        <option value="hide">Hide on the canvas</option>
      </select>
    </label>
    <label>Size
      <select value={value.size??"normal"}
        onChange={e=>patch({size:e.target.value as NonNullable<NodeStyleOverride["size"]>})}>
        <option value="normal">Standard</option>
        <option value="small">Compact</option>
        <option value="large">Featured</option>
      </select>
    </label>
    <label className="appearance-emphasis">
      <input type="checkbox" checked={!!value.highlight}
        onChange={e=>patch({highlight:e.target.checked})}/>
      Highlight this entity
    </label>
    <form onSubmit={applyPicture} className="appearance-picture-form">
      <label htmlFor="appearance-picture">Picture override (HTTPS URL)
        <input id="appearance-picture" type="url" value={picture}
          onChange={e=>{setPicture(e.target.value);setError("");}}
          maxLength={2048} placeholder="https://example.org/photo.jpg"/>
      </label>
      <button type="submit">Apply picture</button>
      {error&&<p role="alert" className="appearance-error">{error}</p>}
    </form>
    {value.imageUrl&&<p className="appearance-active-image">Custom picture for this view only.</p>}
    <button type="button" className="appearance-reset" onClick={()=>onChange(node.id,undefined)}>
      Restore default appearance
    </button>
    <p className="appearance-explanation">
      Save a perspective to keep these choices. The original record and export stay unchanged.
      Use only pictures you have permission to display.
    </p>
  </section>;
}
