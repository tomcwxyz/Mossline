"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  buildMappedGraph, checkRecipeColumns, makeMappingRecipe,
  parseMappingRecipe, parseMappingRecipes,
  type ColumnMapping, type DataDiscovery, type ImportFile, type MappingRecipe,
  type MappedPreview, type NodeType, type RelationshipRule
} from "@mossline/graph-core";

type CsvDiscovery = Extract<DataDiscovery, {kind:"csv-table"}>;
const types:NodeType[]=["organisation","project","funder","person","place","topic","methodology","outcome","other"];
const labelType=(value:NodeType)=>value.charAt(0).toUpperCase()+value.slice(1);
const RECIPES_KEY="mossline-mapping-recipes-v1";
function exportRecipe(recipe:MappingRecipe) {
  const blob=new Blob([JSON.stringify(recipe,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download="mossline-recipe-"+recipe.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,40)+
    "-rev"+recipe.revision+".json";
  a.click();
  URL.revokeObjectURL(url);
}

export function DataMappingWorkbench({file,discovery,onPreview,onChange}:{
  file:ImportFile;
  discovery:CsvDiscovery;
  onPreview:(preview:MappedPreview)=>void;
  onChange:()=>void;
}) {
  const [mapping,setMapping]=useState<ColumnMapping>(discovery.mapping);
  const [lastPreview,setLastPreview]=useState<MappedPreview|null>(null);
  const [recipes,setRecipes]=useState<MappingRecipe[]>([]);
  const [recipeName,setRecipeName]=useState("");
  const [selectedRecipeId,setSelectedRecipeId]=useState("");
  const [recipeNote,setRecipeNote]=useState("");
  const recipeFile=useRef<HTMLInputElement>(null);
  const columns=discovery.columns.map(c=>c.name);
  useEffect(()=>{
    try {
      const stored=window.localStorage.getItem(RECIPES_KEY);
      if(stored) setRecipes(parseMappingRecipes(JSON.parse(stored)));
    } catch {
      setRecipeNote("Saved recipes could not be read. The browser data was left unchanged.");
    }
  },[]);
  const selectedRecipe=recipes.find(r=>r.id===selectedRecipeId);
  const compatibility=selectedRecipe?checkRecipeColumns(selectedRecipe,columns):null;
  function storeRecipes(next:MappingRecipe[]) {
    try {
      const valid=parseMappingRecipes(next);
      window.localStorage.setItem(RECIPES_KEY,JSON.stringify(valid));
      setRecipes(valid);
      return true;
    } catch {
      setRecipeNote("Could not save recipes. Check browser storage or the 40-recipe limit.");
      return false;
    }
  }
  function saveRecipe(){
    try {
      const name=recipeName.trim();
      const previous=selectedRecipe?.name===name?selectedRecipe:undefined;
      const recipe=makeMappingRecipe(name,columns,mapping,previous);
      if(recipes.length>=40){setRecipeNote("40 local recipe revisions is the current limit.");return;}
      if(storeRecipes([...recipes,recipe])) {
        setSelectedRecipeId(recipe.id);
        setRecipeName(recipe.name);
        setRecipeNote("Saved recipe revision "+recipe.revision+" locally. No source rows are included.");
      }
    } catch {setRecipeNote("Recipe could not be saved. Check the name and mapping rules.");}
  }
  function loadRecipe(){
    if(!selectedRecipe || !compatibility?.usable) return;
    setMapping(selectedRecipe.mapping);
    setRecipeName(selectedRecipe.name);
    setLastPreview(null);
    onChange();
    setRecipeNote("Loaded revision "+selectedRecipe.revision+
      ". Review the suggested relationships, then preview against the current file.");
  }
  function deleteRecipe(){
    if(!selectedRecipe) return;
    if(storeRecipes(recipes.filter(r=>r.id!==selectedRecipe.id))){
      setSelectedRecipeId("");
      setRecipeNote("Deleted this local recipe revision. Other revisions remain available.");
    }
  }
  async function importRecipe(event:ChangeEvent<HTMLInputElement>){
    const input=event.target.files?.[0];
    event.target.value="";
    if(!input)return;
    if(input.size>65536){setRecipeNote("Recipe JSON must be under 64 KB.");return;}
    try {
      const parsed=parseMappingRecipe(JSON.parse(await input.text()));
      if(recipes.find(r=>r.id===parsed.id)){
        setRecipeNote("This exact recipe revision is already saved here.");return;
      }
      if(recipes.length>=40){setRecipeNote("40 local recipe revisions is the current limit.");return;}
      if(storeRecipes([...recipes,parsed])) {
        setSelectedRecipeId(parsed.id);
        setRecipeNote("Recipe imported. Check column compatibility before using it.");
      }
    } catch {
      setRecipeNote("Invalid or unsupported recipe JSON. The saved recipes were not changed.");
    }
  }
  const update=(next:ColumnMapping)=>{
    setMapping(next);
    setLastPreview(null);
    onChange();
  };
  const editRule=(index:number,patch:Partial<RelationshipRule>)=>{
    update({...mapping,rules:mapping.rules.map((r,i)=>i===index?{...r,...patch}:r)});
  };
  const columnOptions=(allowEmpty=false)=><>
    {allowEmpty&&<option value="">Not mapped</option>}
    {columns.map(col=><option value={col} key={col}>{col}</option>)}
  </>;
  const typeOptions=types.map(type=><option value={type} key={type}>{labelType(type)}</option>);
  const apply=()=>{
    const result=buildMappedGraph(file,mapping);
    setLastPreview(result);
    onPreview(result);
  };
  return <section className="mapping-workbench" aria-label="Map your spreadsheet into a network">
    <div className="mapping-intro">
      <p className="eyebrow">Discover → Map → Preview → Confirm</p>
      <h3>Teach Mossline what your data means</h3>
      <p>These are suggestions based on your column names, not decisions made for you.
        Choose which values should become entities, and which pairs genuinely describe relationships.</p>
    </div>
    <section className="mapping-recipe-panel" aria-label="Reusable mapping recipes">
      <div className="mapping-recipe-intro">
        <h4>Save the mapping, not the spreadsheet</h4>
        <p>Reuse your decisions on a newer CSV export. Each revision stays in this browser unless you export its JSON file.</p>
      </div>
      <div className="mapping-field-grid">
        <label htmlFor="recipe-name">Recipe name
          <input id="recipe-name" value={recipeName} maxLength={65}
            onChange={e=>setRecipeName(e.target.value)} placeholder="e.g. PFT funding relationships"/>
        </label>
        <label htmlFor="recipe-versions">Saved recipes · {recipes.length}
          <select id="recipe-versions" value={selectedRecipeId} onChange={e=>{
            const next=recipes.find(r=>r.id===e.target.value);
            setSelectedRecipeId(e.target.value);
            if(next)setRecipeName(next.name);
            setRecipeNote("");
          }}>
            <option value="">Choose a saved recipe</option>
            {recipes.slice().sort((a,b)=>b.createdAt-a.createdAt).map(recipe=>
              <option key={recipe.id} value={recipe.id}>{recipe.name} · r{recipe.revision}</option>)}
          </select>
        </label>
      </div>
      {compatibility && <div className={"recipe-compatibility "+(compatibility.usable?"compatible":"incompatible")}>
        {compatibility.usable ? "Compatible with required columns." :
          "Cannot apply: missing "+compatibility.missing.join(", ")}
        {compatibility.added.length>0 && <small>New columns: {compatibility.added.join(", ")}</small>}
        <small>{compatibility.note}</small>
      </div>}
      <div className="mapping-recipe-actions">
        <button type="button" onClick={saveRecipe} disabled={!recipeName.trim()}>
          {selectedRecipe?.name===recipeName.trim() ? "Save new revision" : "Save recipe"}
        </button>
        <button type="button" onClick={loadRecipe} disabled={!compatibility?.usable}>Use selected</button>
        <button type="button" onClick={()=>selectedRecipe&&exportRecipe(selectedRecipe)}
          disabled={!selectedRecipe}>Export JSON</button>
        <button type="button" onClick={()=>recipeFile.current?.click()}>Import recipe JSON</button>
        <button type="button" onClick={deleteRecipe} disabled={!selectedRecipe}>Delete revision</button>
      </div>
      <input ref={recipeFile} type="file" accept=".json,application/json" hidden
        aria-label="Import a mapping recipe JSON file" onChange={importRecipe}/>
      {recipeNote && <p className="mapping-recipe-feedback" role="status">{recipeNote}</p>}
      <p className="mapping-recipe-caveat">Recipes contain selected column names, entity types and relationship rules,
        not row values. Column matches don't prove the data's meaning is unchanged. Review each import before applying it.</p>
    </section>
    <details className="mapping-columns" open>
      <summary>{discovery.rowCount} rows · {columns.length} columns found</summary>
      <div className="mapping-column-list">
        {discovery.columns.map(col=><div key={col.name}>
          <strong>{col.name}</strong>
          <span>{col.filled}/{discovery.rowCount} filled · {col.distinct} distinct</span>
          <small>{col.examples.length?col.examples.join(" · "):"No populated examples"}</small>
        </div>)}
      </div>
    </details>
    <div className="mapping-controls">
      <label>What kind of table is this?
        <select value={mapping.mode} onChange={e=>update({...mapping,mode:e.target.value as ColumnMapping["mode"]})}>
          <option value="relationships">Rows describe relationships between things</option>
          <option value="entities">Rows describe individual entities</option>
        </select>
      </label>
      {mapping.mode==="entities" ? <div className="mapping-field-grid">
        <label>Entity name column
          <select value={mapping.nameColumn} onChange={e=>update({...mapping,nameColumn:e.target.value})}>{columnOptions()}</select>
        </label>
        <label>Default entity type
          <select value={mapping.nodeType} onChange={e=>update({...mapping,nodeType:e.target.value as NodeType})}>{typeOptions}</select>
        </label>
        <label>Type/category column (optional)
          <select value={mapping.typeColumn} onChange={e=>update({...mapping,typeColumn:e.target.value})}>{columnOptions(true)}</select>
        </label>
      </div> : <div className="mapping-rules">
        <p className="mapping-explainer">Each rule reads two columns on the same row. Add separate rules if a table has organisations, projects and funders.</p>
        {mapping.rules.map((rule,i)=><div className="mapping-rule" key={i}>
          <div className="mapping-rule-heading">
            <strong>Relationship {i+1}</strong>
            <button type="button" onClick={()=>update({...mapping,rules:mapping.rules.filter((_,j)=>i!==j)})}
              aria-label={"Remove relationship rule "+(i+1)}>Remove</button>
          </div>
          <div className="mapping-field-grid">
            <label>From column
              <select value={rule.fromColumn} onChange={e=>editRule(i,{fromColumn:e.target.value})}>{columnOptions()}</select>
            </label>
            <label>From entity type
              <select value={rule.fromType} onChange={e=>editRule(i,{fromType:e.target.value as NodeType})}>{typeOptions}</select>
            </label>
            <label>To column
              <select value={rule.toColumn} onChange={e=>editRule(i,{toColumn:e.target.value})}>{columnOptions()}</select>
            </label>
            <label>To entity type
              <select value={rule.toType} onChange={e=>editRule(i,{toType:e.target.value as NodeType})}>{typeOptions}</select>
            </label>
            <label className="mapping-wide">What does this relationship actually mean?
              <input value={rule.type} maxLength={100} onChange={e=>editRule(i,{type:e.target.value})}
                placeholder="e.g. delivers, participates in, funded by" required />
            </label>
          </div>
        </div>)}
        <button type="button" className="mapping-add" onClick={()=>{
          const from=columns[0]??"",to=columns.find(c=>c!==from)??"";
          update({...mapping,rules:[...mapping.rules,{
            fromColumn:from,toColumn:to,fromType:"organisation",toType:"project",type:"related to"
          }]});
        }}>+ Add another relationship</button>
      </div>}
      <div className="mapping-field-grid">
        <label>Region column (optional)
          <select value={mapping.regionColumn} onChange={e=>update({...mapping,regionColumn:e.target.value})}>{columnOptions(true)}</select>
        </label>
        <label>Description column (optional)
          <select value={mapping.descriptionColumn} onChange={e=>update({...mapping,descriptionColumn:e.target.value})}>{columnOptions(true)}</select>
        </label>
        {mapping.mode==="relationships" && mapping.regionColumn && <label className="mapping-wide">
          Which kind of entity does that region describe?
          <select value={mapping.regionTarget}
            onChange={e=>update({...mapping,regionTarget:e.target.value as ColumnMapping["regionTarget"]})}>
            <option value="source">From-column entities</option>
            <option value="target">To-column entities</option>
            <option value="both">Both (only if truly applicable)</option>
          </select>
        </label>}
      </div>
    </div>
    <p className="mapping-caution">A shared row is not necessarily proof of collaboration, funding or causation.
      Check the labels and source data before confirming. This work is performed locally in your browser.</p>
    <button className="button-primary" type="button" onClick={apply}>Preview proposed graph →</button>
    {lastPreview&&<p role="status" className="mapping-last">Proposal: {lastPreview.counts.nodes} entities,
      {lastPreview.counts.edges} relationships, {lastPreview.counts.skipped} skipped rows.
      {lastPreview.issues.some(i=>i.severity==="error")?" Correct the mapping and try again.":" Review the result below before confirming."}
    </p>}
  </section>;
}
