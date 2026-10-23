"use client";
import {useEffect,useState,type FormEvent} from "react";
import {createAuthClient} from "@neondatabase/auth/next";
const authClient=createAuthClient();
type Row={id:string;title:string;createdAt:string;updatedAt:string;
 nodeCount:number;edgeCount:number;versionId:string};
export function PrivateWorkspaceDashboard(){
 const {data:session,isPending}=authClient.useSession();
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [name,setName]=useState("");
 const [signUp,setSignUp]=useState(false);
 const [busy,setBusy]=useState(false);
 const [networks,setNetworks]=useState<Row[]>([]);
 const [error,setError]=useState("");
 useEffect(()=>{
  if(!session?.user){setNetworks([]);return;}
  let alive=true;
  void fetch("/api/private-networks",{cache:"no-store",credentials:"same-origin"})
   .then(async res=>{
    const body=await res.json();
    if(!res.ok)throw Error(body.error??"Could not list networks");
    return body as {networks:Row[]};
   }).then(body=>{if(alive)setNetworks(body.networks);})
   .catch(err=>{if(alive)setError(err instanceof Error?err.message:"Could not load networks");});
  return ()=>{alive=false;};
 },[session?.user?.id]);
 async function submit(event:FormEvent){
  event.preventDefault();setError("");setBusy(true);
  try{
    const response=signUp?
      await authClient.signUp.email({email,password,name:name.trim()||email}):
      await authClient.signIn.email({email,password});
    if(response.error)throw Error(response.error.message||"Sign-in failed");
    setPassword("");
    window.location.reload();
  }catch(err){setError(err instanceof Error?err.message:"Authentication failed");}
  finally{setBusy(false);}
 }
 async function remove(id:string){
  if(!window.confirm("Delete this private network and its stored versions? This cannot be undone."))return;
  setBusy(true);setError("");
  try{
   const res=await fetch("/api/private-networks/"+id,{
    method:"DELETE",credentials:"same-origin",cache:"no-store"});
   if(!res.ok)throw Error("Could not delete this network.");
   setNetworks(rows=>rows.filter(row=>row.id!==id));
  }catch(err){setError(err instanceof Error?err.message:"Deletion failed");}
  finally{setBusy(false);}
 }
 if(isPending)return <p role="status">Checking your private workspace session…</p>;
 if(!session?.user)return <section className="private-workspace-login">
  <h2>{signUp?"Create an account":"Sign in"}</h2>
  <p>Private networks are visible only after sign-in.
    Importing and exploring locally never requires an account.</p>
  <form onSubmit={submit}>
   {signUp&&<label>Display name<input required value={name} autoComplete="name"
     onChange={e=>setName(e.target.value)} maxLength={100}/></label>}
   <label>Email<input type="email" required value={email} autoComplete="email"
     onChange={e=>setEmail(e.target.value)}/></label>
   <label>Password<input type="password" required minLength={8} value={password}
     autoComplete={signUp?"new-password":"current-password"}
     onChange={e=>setPassword(e.target.value)}/></label>
   <button type="submit" disabled={busy}>{busy?"Working…":signUp?"Create account":"Sign in"}</button>
  </form>
  <button type="button" onClick={()=>{setSignUp(v=>!v);setError("");}}>
   {signUp?"I already have an account":"Create an account"}
  </button>
  {error&&<p role="alert">{error}</p>}
 </section>;
 return <section>
  <div className="workspace-account">
   <p>Signed in as {session.user.email}</p>
   <button type="button" onClick={()=>void authClient.signOut().then(()=>window.location.reload())}>Sign out</button>
  </div>
  <h2>Saved private networks</h2>
  <p>Uploaded source records are not public, and saving them does not
    initiate AI analysis. Open your local network and select
    <strong> Save privately for deeper analysis</strong> to store a copy.</p>
  {!networks.length&&<p>No networks saved to this workspace yet.</p>}
  <div className="workspace-networks">
   {networks.map(row=><article key={row.id}>
    <h3>{row.title}</h3>
    <p>{row.nodeCount.toLocaleString("en-GB")} entities · {row.edgeCount.toLocaleString("en-GB")} relationships</p>
    <small>Saved {new Date(row.updatedAt).toLocaleDateString("en-GB")}</small>
    <button type="button" disabled={busy} onClick={()=>void remove(row.id)}>Delete private copy</button>
   </article>)}
  </div>
  {error&&<p role="alert">{error}</p>}
 </section>;
}
