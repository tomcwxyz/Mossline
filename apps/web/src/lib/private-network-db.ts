import {neon} from "@neondatabase/serverless";
import type {PrivateUpload} from "./private-network-input";
import {parseGraphDocument} from "@mossline/graph-core";
import type {GraphDocument} from "@mossline/graph-core";

function connection(){
  if(!process.env.MOSSLINE_DATABASE_URL)
    throw Error("Private network database not configured.");
  return neon(process.env.MOSSLINE_DATABASE_URL);
}
export type PrivateNetworkSummary={
  id:string;title:string;createdAt:string;updatedAt:string;
  nodeCount:number;edgeCount:number;versionId:string;
};
type DbSummary={
  id:string;title:string;created_at:string;updated_at:string;
  nodes_count:number;edges_count:number;version_id:string;
};
const summary=(row:DbSummary):PrivateNetworkSummary=>({
  id:row.id,title:row.title,createdAt:String(row.created_at),
  updatedAt:String(row.updated_at),nodeCount:Number(row.nodes_count),
  edgeCount:Number(row.edges_count),versionId:row.version_id
});
export async function listPrivateNetworks(owner:string):Promise<PrivateNetworkSummary[]>{
  const sql=connection();
  const rows=await sql`SELECT n.id,n.title,n.created_at,n.updated_at,
    v.nodes_count,v.edges_count,v.id AS version_id
    FROM mossline_private_networks n
    JOIN mossline_private_network_versions v ON v.id=n.current_version_id
    WHERE n.owner_user_id=${owner}
    ORDER BY n.updated_at DESC LIMIT 50`;
  return rows.map(row=>summary(row as DbSummary));
}
export async function createPrivateNetwork(owner:string,data:PrivateUpload):
  Promise<PrivateNetworkSummary>{
  const sql=connection();
  // One statement: either all three writes succeed or no private dataset exists.
  const rows=await sql`
    WITH inserted_network AS (
      INSERT INTO mossline_private_networks(owner_user_id,title)
      VALUES (${owner},${data.title}) RETURNING id,owner_user_id
    ), inserted_version AS (
      INSERT INTO mossline_private_network_versions
        (network_id,owner_user_id,content_sha256,graph,nodes_count,edges_count)
      SELECT n.id,n.owner_user_id,${data.digest},
        ${JSON.stringify(data.graph)}::jsonb,${data.nodeCount},${data.edgeCount}
      FROM inserted_network n RETURNING id,network_id
    )
    UPDATE mossline_private_networks n SET
      current_version_id=v.id,updated_at=now()
    FROM inserted_version v
    WHERE n.id=v.network_id AND n.owner_user_id=${owner}
    RETURNING n.id,n.title,n.created_at,n.updated_at,
      ${data.nodeCount}::integer AS nodes_count,
      ${data.edgeCount}::integer AS edges_count,
      v.id AS version_id`;
  if(rows.length!==1)throw Error("Could not save private network.");
  return summary(rows[0] as DbSummary);
}
export async function getPrivateNetwork(owner:string,id:string):
  Promise<{summary:PrivateNetworkSummary;graph:GraphDocument}|null>{
  const sql=connection();
  const rows=await sql`SELECT n.id,n.title,n.created_at,n.updated_at,
    v.nodes_count,v.edges_count,v.id AS version_id,v.graph
    FROM mossline_private_networks n
    JOIN mossline_private_network_versions v ON v.id=n.current_version_id
    AND v.owner_user_id=n.owner_user_id
    WHERE n.id=${id}::uuid AND n.owner_user_id=${owner} LIMIT 1`;
  if(!rows.length)return null;
  const row=rows[0] as unknown as DbSummary&{graph:unknown};
  return {summary:summary(row),graph:parseGraphDocument(row.graph)};
}
export async function deletePrivateNetwork(owner:string,id:string):Promise<boolean>{
  const sql=connection();
  const rows=await sql`DELETE FROM mossline_private_networks
    WHERE id=${id}::uuid AND owner_user_id=${owner} RETURNING id`;
  return rows.length===1;
}
