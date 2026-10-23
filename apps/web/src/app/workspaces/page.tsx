import Link from "next/link";
import {privateWorkspacesEnabled} from "../../lib/private-workspace-auth";
import {PrivateWorkspaceDashboard} from "../../components/PrivateWorkspaceDashboard";
export const dynamic="force-dynamic";
export default function WorkspacesPage(){
 return <main className="workspace-main">
   <header><p className="eyebrow">Mossline · private workspaces</p>
    <h1>My networks</h1><p>Private source networks and reviewed insights are separate
      from anything you choose to publish publicly.</p></header>
   {!privateWorkspacesEnabled()?<section>
     <h2>Private workspaces are not enabled yet</h2>
     <p>The public and browser-local network tools remain available.
       An administrator must enable Neon Auth and apply the private storage migration
       before private saving can be used.</p>
   </section>:<PrivateWorkspaceDashboard/>}
   <p><Link href="/">← Back to local network exploration</Link></p>
 </main>;
}
