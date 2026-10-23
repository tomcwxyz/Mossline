"use client";
import {useEffect,useState} from "react";
import type {GraphDocument} from "@mossline/graph-core";
import {loadGeneralGraph} from "../lib/general-map-store";
import {loadFundingDataset} from "../lib/funding-dataset-store";

export function PrivateNetworkSave({graph,generalDatasetId,fundingDatasetId}:{
 graph:GraphDocument;generalDatasetId?:string;fundingDatasetId?:string
}){
 const [available,setAvailable]=useState(false);
 const [signedIn,setSignedIn]=useState(false);
 const [approved,setApproved]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 useEffect(()=>{
  let alive=true;
  void fetch("/api/private-networks/status",{cache:"no-store"}).then(r=>r.json())
    .then(data=>{if(alive){setAvailable(data.enabled===true);
      setSignedIn(data.authenticated===true);}}).catch(()=>{});
  return ()=>{alive=false;};
 },[]);
 async function save(){
  if(!approved||!signedIn||busy)return;
  setBusy(true);setMessage("");
  try{
   const full=generalDatasetId?await loadGeneralGraph(generalDatasetId):
     fundingDatasetId?(await loadFundingDataset(fundingDatasetId)).graph:graph;
   if(!full.nodes.length)throw Error("The complete network isn't available in this browser.");
   const res=await fetch("/api/private-networks",{
     method:"POST",credentials:"same-origin",cache:"no-store",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({graph:full,confirmedPrivateStorage:true})
   });
   const data=await res.json() as {network?:{title:string};error?:string};
   if(!res.ok||!data.network)throw Error(data.error??"Could not save the network");
   setApproved(false);
   setMessage("Saved privately. Open My networks to manage your copy.");
  }catch(error){setMessage(error instanceof Error?error.message:"Private save failed.");}
  finally{setBusy(false);}
 }
 if(!available)return null;
 return <details className="private-network-save">
  <summary>Save privately for deeper analysis</summary>
  <p>The current network stays on this device until you deliberately save it.
    Your private copy is not published or sent to any AI provider.
    Background analysis will be a separate, optional step.</p>
  {!signedIn?<p><a href="/workspaces">Sign in to your private workspace →</a></p>:<>
   <label><input type="checkbox" checked={approved}
     onChange={e=>setApproved(e.target.checked)}/>
     I have permission to store these source records privately on Mossline's server.
     I understand descriptions and imported properties will be stored in the private dataset.</label>
   <div className="network-ai-index-actions">
    <button type="button" disabled={!approved||busy} onClick={save}>
     {busy?"Saving private network…":"Save this network privately"}
    </button>
    <a href="/workspaces">My saved networks →</a>
   </div>
  </>}
  {message&&<p role="status">{message}</p>}
 </details>;
}
