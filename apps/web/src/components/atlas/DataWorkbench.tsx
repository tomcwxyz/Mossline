"use client";

import {useMemo,useRef,useState,type KeyboardEvent} from "react";
import {
  edgeValues,isRecorded,makeEdit,nodeValues,type Edit,type GraphDocument,type GraphEdge,
  type GraphNode,type NodeFields,type EdgeFields,type NodeType
} from "@mossline/graph-core";
import {TYPE_LABEL} from "./palette";

/**
 * The table and the picture are two editors of ONE graph. Every committed cell
 * creates a normal, sourced, undoable Mossy edit; no parallel table state.
 * An original CSV or imported map stays untouched.
 */
export type DataTab="records"|"connections";
type Props={
  graph:GraphDocument;
  tab:DataTab;
  onTab:(tab:DataTab)=>void;
  selectedId:string|null;
  onPick:(id:string)=>void;
  onClose:()=>void;
  onConnect:()=>void;
  editable:boolean;
  editor:string;
  onEdit:(edit:Edit)=>void;
  lastEdit?:Edit;
  onUndo:(id:string)=>void;
};

const pageSize=80;
const TYPES:NodeType[]=["organisation","project","funder","person","place","topic","outcome","methodology","other"];

function Cell({value,label,editable,onCommit,maxLength=200}:{
  value:string;label:string;editable:boolean;onCommit:(v:string)=>void;maxLength?:number;
}){
  const [open,setOpen]=useState(false);
  const [draft,setDraft]=useState(value);
  const cancelled=useRef(false);
  function finish(){
    if(cancelled.current){cancelled.current=false;return;}
    setOpen(false);
    const clean=draft.trim();
    if(clean!==value && clean.length<=maxLength)onCommit(clean);
  }
  function keys(event:KeyboardEvent<HTMLInputElement>){
    if(event.key==="Enter"){event.preventDefault();event.currentTarget.blur();}
    if(event.key==="Escape"){event.preventDefault();cancelled.current=true;setOpen(false);}
  }
  if(!editable)return <span className="ml-data-cell-text">{value||"—"}</span>;
  if(open)return <input className="ml-data-cell-input" autoFocus aria-label={label} maxLength={maxLength}
    value={draft} onChange={e=>setDraft(e.target.value)} onBlur={finish} onKeyDown={keys}/>;
  return <button type="button" className="ml-data-cell-edit" aria-label={"Edit "+label}
    title={"Edit "+label} onClick={()=>{cancelled.current=false;setDraft(value);setOpen(true);}}>
    {value||<span className="ml-data-empty">Add…</span>}<span className="ml-data-pencil" aria-hidden="true">✎</span>
  </button>;
}
function SelectCell<T extends string>({value,label,choices,editable,onCommit}:{
  value:T;label:string;choices:readonly {value:T;label:string}[];editable:boolean;onCommit:(value:T)=>void;
}){
  const found=choices.find(x=>x.value===value);
  if(!editable)return <span>{found?.label??value}</span>;
  return <select className="ml-data-cell-select" aria-label={label} value={value}
    onChange={e=>onCommit(e.target.value as T)}>
    {choices.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
  </select>;
}
const typeOptions=TYPES.map(type=>({value:type,label:TYPE_LABEL[type]}));
const directionOptions=[
  {value:"directed",label:"→ one way"},{value:"mutual",label:"↔ both ways"},
  {value:"undirected",label:"— no direction"}
] as const;

export function DataWorkbench({graph,tab,onTab,selectedId,onPick,onClose,onConnect,
  editable,editor,onEdit,lastEdit,onUndo}:Props){
  const [search,setSearch]=useState("");
  const [limit,setLimit]=useState(pageSize);
  const [removed,setRemoved]=useState<string|null>(null);
  const known=useMemo(()=>new Map(graph.nodes.map(n=>[n.id,n])),[graph.nodes]);
  const counts=useMemo(()=>{
    const degree=new Map(graph.nodes.map(n=>[n.id,0]));
    for(const e of graph.edges)if(isRecorded(e)){
      degree.set(e.source,(degree.get(e.source)??0)+1);
      degree.set(e.target,(degree.get(e.target)??0)+1);
    }
    return degree;
  },[graph]);
  const connections=useMemo(()=>graph.edges.filter(isRecorded),[graph.edges]);
  const query=search.toLocaleLowerCase("en-GB").trim();
  const records=useMemo(()=>{
    const matched=graph.nodes.filter(n=>!query||[n.label,n.type,n.region??"",...n.tags]
      .some(v=>v.toLocaleLowerCase("en-GB").includes(query)));
    // New records should be visible immediately, not hidden on page 9.
    return [...matched.filter(n=>n.origin?.system==="edit").reverse(),
      ...matched.filter(n=>n.origin?.system!=="edit")];
  },[graph.nodes,query]);
  const links=useMemo(()=>{
    const matched=connections.filter(e=>!query||[
      known.get(e.source)?.label??"",known.get(e.target)?.label??"",e.type
    ].some(v=>v.toLocaleLowerCase("en-GB").includes(query)));
    // Draw a link, see the new row at the top of the Connections table.
    return [...matched.filter(e=>e.origin?.system==="edit").reverse(),
      ...matched.filter(e=>e.origin?.system!=="edit")];
  },[connections,known,query]);
  const pinned=tab==="records"&&selectedId&&!records.slice(0,limit).some(n=>n.id===selectedId)
    ? records.find(n=>n.id===selectedId):undefined;
  const shownRecords=pinned?[pinned,...records.slice(0,limit)]:records.slice(0,limit);
  const lastNodeId=lastEdit?.op.kind==="update-node"?lastEdit.op.id:
    lastEdit?.op.kind==="add-node"?lastEdit.op.node.id:null;
  const lastEdgeId=lastEdit?.op.kind==="update-edge"?lastEdit.op.id:
    lastEdit?.op.kind==="add-edge"?lastEdit.op.edge.id:null;
  const shown=tab==="records"?records:links;
  function nodeEdit(node:GraphNode,key:keyof NodeFields,next:string|NodeType|string[]){
    const old=nodeValues(node,[key]);
    const current=old[key];
    if(JSON.stringify(current)===JSON.stringify(next))return;
    if(key==="label" && !String(next).trim())return;
    onEdit(makeEdit({kind:"update-node",id:node.id,set:{[key]:next} as NodeFields,was:old},editor));
  }
  function edgeEdit(edge:GraphEdge,key:keyof EdgeFields,next:string){
    const old=edgeValues(edge,[key]);
    if(old[key]===next || (key==="type"&&!next.trim()))return;
    onEdit(makeEdit({kind:"update-edge",id:edge.id,set:{[key]:next} as EdgeFields,was:old},editor));
  }
  const changeTab=(next:DataTab)=>{onTab(next);setSearch("");setLimit(pageSize);setRemoved(null);};
  return <section className="ml-data-workbench" aria-label="Live data table">
    <header className="ml-data-head">
      <div className="ml-data-head-title">
        <strong>Data</strong><span>{graph.nodes.length.toLocaleString("en-GB")} records · {connections.length.toLocaleString("en-GB")} connections</span>
      </div>
      <div className="ml-data-tabs" role="group" aria-label="Data tables">
        <button type="button" aria-pressed={tab==="records"} onClick={()=>changeTab("records")}>Records</button>
        <button type="button" aria-pressed={tab==="connections"} onClick={()=>changeTab("connections")}>Connections</button>
      </div>
      <label className="ml-data-search"><span className="ml-visually-hidden">Find in data</span>
        <input type="search" value={search} onChange={e=>{setSearch(e.target.value);setLimit(pageSize);}}
          placeholder={tab==="records"?"Find a record…":"Find a connection…"} aria-label="Find in data"/></label>
      {editable&&<button type="button" className="ml-quiet ml-data-connect" onClick={onConnect}>Connect two records</button>}
      <button type="button" className="ml-data-close" onClick={onClose} aria-label="Close data table">×</button>
    </header>
    <div className="ml-data-scroll" role="region" aria-label={tab==="records"?"Records table":"Connections table"} tabIndex={0}>
      {tab==="records"?<table className="ml-data-table"><thead><tr>
        <th scope="col">Record</th><th scope="col">Type</th><th scope="col">Region</th>
        <th scope="col">Themes</th><th scope="col">Links</th><th scope="col">Source</th>
      </tr></thead><tbody>{shownRecords.map(n=><tr key={n.id} className={[selectedId===n.id?"is-selected":"",lastNodeId===n.id?"is-updated":""].filter(Boolean).join(" ")}>
        <td className="ml-data-name"><div className="ml-data-named">
          <button type="button" className="ml-data-locate" aria-label={"Show "+n.label+" in the graph"}
            onClick={()=>onPick(n.id)} title="Find in the graph">◎</button>
          <Cell value={n.label} label={"name of "+n.label} editable={editable} maxLength={200}
            onCommit={text=>nodeEdit(n,"label",text)}/></div></td>
        <td><SelectCell value={n.type} label={"Type of "+n.label} choices={typeOptions}
          editable={editable} onCommit={type=>nodeEdit(n,"type",type)}/></td>
        <td><Cell value={n.region??""} label={"region of "+n.label} editable={editable}
          onCommit={text=>nodeEdit(n,"region",text)}/></td>
        <td><Cell value={n.tags.join(", ")} label={"themes of "+n.label} editable={editable}
          onCommit={text=>nodeEdit(n,"tags",[...new Set(text.split(/[,;|]/).map(t=>t.trim()).filter(Boolean))].slice(0,40))}/></td>
        <td className="ml-data-number">{counts.get(n.id)??0}</td>
        <td className="ml-data-source" title={n.origin?.fileName??n.origin?.system??"Not recorded"}>
          {n.origin?.system==="edit"?"Added here":n.origin?.fileName??n.origin?.system??"—"}</td>
      </tr>)}</tbody></table>:
      <table className="ml-data-table"><thead><tr>
        <th scope="col">From</th><th scope="col">To</th><th scope="col">Relationship</th>
        <th scope="col">Direction</th><th scope="col">Source</th>{editable&&<th scope="col">Change</th>}
      </tr></thead><tbody>{links.slice(0,limit).map(e=><tr key={e.id} className={lastEdgeId===e.id?"is-updated":undefined}>
        <td><button type="button" className="ml-data-record-link" onClick={()=>onPick(e.source)}>
          {known.get(e.source)?.label??e.source}</button></td>
        <td><button type="button" className="ml-data-record-link" onClick={()=>onPick(e.target)}>
          {known.get(e.target)?.label??e.target}</button></td>
        <td><Cell value={e.type} label={"relationship from "+(known.get(e.source)?.label??"record")+" to "+
          (known.get(e.target)?.label??"record")} editable={editable} maxLength={120}
          onCommit={value=>edgeEdit(e,"type",value)}/></td>
        <td><SelectCell value={e.direction??"directed"} label={"Direction of "+e.type}
          editable={editable} choices={directionOptions} onCommit={value=>edgeEdit(e,"direction",value)}/></td>
        <td className="ml-data-source">{e.origin?.system==="edit"?"Added here":e.origin?.fileName??e.origin?.system??"—"}</td>
        {editable&&<td>{removed===e.id?<span className="ml-data-confirm">
          <button type="button" onClick={()=>{onEdit(makeEdit({kind:"remove-edge",id:e.id,
            label:(known.get(e.source)?.label??"record")+" — "+(known.get(e.target)?.label??"record")},editor));setRemoved(null);}}>
            Remove</button>
          <button type="button" onClick={()=>setRemoved(null)}>Cancel</button>
        </span>:<button type="button" className="ml-data-remove" onClick={()=>setRemoved(e.id)}
          aria-label={"Remove connection "+e.type}>×</button>}</td>}
      </tr>)}</tbody></table>}
      {!shown.length&&<p className="ml-data-none">No matching {tab==="records"?"records":"connections"}. Clear the search or change the filters above.</p>}
    </div>
    <footer className="ml-data-foot">
      <span>Showing {Math.min(shown.length,limit).toLocaleString("en-GB")} of {shown.length.toLocaleString("en-GB")}{pinned?" · plus the selected record":""} · {editable?
        "Click a cell to change it; Enter or click away to apply.":"Read-only source-backed data."}</span>
      {shown.length>limit&&<button type="button" className="ml-link-button" onClick={()=>setLimit(n=>n+pageSize)}>Show more</button>}
      {editable&&lastEdit&&!lastEdit.undone&&<button type="button" className="ml-link-button ml-data-undo"
        onClick={()=>onUndo(lastEdit.id)}>Undo last change</button>}
      <span>Original imported files are kept. Changes appear here and in the visualisation.</span>
    </footer>
  </section>;
}
