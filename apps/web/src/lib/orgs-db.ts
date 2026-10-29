import {randomUUID} from "node:crypto";
import {pool} from "./db";
import {activePlan, canUseAsJoinDomain, domainOf, limitsFor, type Limits, type PlanId} from "./plans";

export type OrgRole="admin"|"member";
export type Org={id:string;name:string;role:OrgRole;plan:PlanId;planUntil:string|null;planSource:string|null;
  joinDomain:string|null;billing:boolean};
export type OrgMember={userId:string;name:string;email:string;role:OrgRole;joined:string};
export type OrgInvite={email:string;role:OrgRole};
export type Usage={plan:PlanId;limits:Limits;publications:number;savedMaps:number;org:{id:string;name:string}|null};

type OrgRow={id:string;name:string;role:OrgRole;plan:"free"|"organisation";plan_until:Date|null;plan_source:string|null;
  join_domain:string|null;stripe_customer_id:string|null};
const toOrg=(r:OrgRow):Org=>({id:r.id,name:r.name,role:r.role,plan:activePlan({plan:r.plan,planUntil:r.plan_until}),
  planUntil:r.plan_until?new Date(r.plan_until).toISOString():null,planSource:r.plan_source,joinDomain:r.join_domain,
  billing:!!r.stripe_customer_id});

export async function orgOf(userId:string):Promise<Org|null>{
  const {rows}=await pool().query<OrgRow>(`SELECT o.id,o.name,m.role,o.plan,o.plan_until,o.plan_source,o.join_domain,o.stripe_customer_id
    FROM mossline_org_members m JOIN mossline_orgs o ON o.id=m.org_id WHERE m.user_id=$1`,[userId]);
  return rows[0]?toOrg(rows[0]):null;
}

/** What an account's plan allows and how much it has used: its organisation's, or its own free allowance. */
export async function usageFor(userId:string):Promise<Usage>{
  const org=await orgOf(userId);
  const [pubs,maps]=await Promise.all([
    pool().query<{n:string}>(org?`SELECT count(*) AS n FROM mossline_publications WHERE org_id=$1 AND is_published`
      :`SELECT count(*) AS n FROM mossline_publications WHERE owner_id=$1 AND org_id IS NULL AND is_published`,[org?org.id:userId]),
    pool().query<{n:string}>(org?`SELECT count(*) AS n FROM mossline_maps WHERE org_id=$1`
      :`SELECT count(*) AS n FROM mossline_maps WHERE owner_id=$1 AND org_id IS NULL`,[org?org.id:userId])
  ]);
  const plan=org?.plan??"free";
  return {plan,limits:limitsFor(plan),publications:Number(pubs.rows[0].n),savedMaps:Number(maps.rows[0].n),
    org:org?{id:org.id,name:org.name}:null};
}

export async function createOrg(userId:string,name:string):Promise<Org>{
  const client=await pool().connect();
  try{
    await client.query("BEGIN");
    const id=randomUUID();
    await client.query(`INSERT INTO mossline_orgs (id,name,created_by) VALUES ($1,$2,$3)`,[id,name,userId]);
    await client.query(`INSERT INTO mossline_org_members (org_id,user_id,role) VALUES ($1,$2,'admin')`,[id,userId]);
    // What this person already made comes with them.
    await client.query(`UPDATE mossline_publications SET org_id=$1 WHERE owner_id=$2 AND org_id IS NULL`,[id,userId]);
    await client.query(`UPDATE mossline_maps SET org_id=$1 WHERE owner_id=$2 AND org_id IS NULL`,[id,userId]);
    await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK");throw error;}
  finally{client.release();}
  return (await orgOf(userId))!;
}

export async function updateOrg(orgId:string,changes:{name?:string;joinDomain?:string|null}):Promise<void>{
  if(changes.name!==undefined)await pool().query(`UPDATE mossline_orgs SET name=$1, updated_at=now() WHERE id=$2`,[changes.name,orgId]);
  if(changes.joinDomain!==undefined)await pool().query(`UPDATE mossline_orgs SET join_domain=$1, updated_at=now() WHERE id=$2`,[changes.joinDomain,orgId]);
}

export async function members(orgId:string):Promise<{members:OrgMember[];invites:OrgInvite[]}>{
  const [m,i]=await Promise.all([
    pool().query<{user_id:string;name:string;email:string;role:OrgRole;created_at:Date}>(`SELECT m.user_id,u.name,u.email,m.role,m.created_at
      FROM mossline_org_members m JOIN mossline_users u ON u.id=m.user_id WHERE m.org_id=$1 ORDER BY m.created_at`,[orgId]),
    pool().query<{email:string;role:OrgRole}>(`SELECT email,role FROM mossline_org_invites WHERE org_id=$1 ORDER BY created_at`,[orgId])
  ]);
  return {members:m.rows.map(r=>({userId:r.user_id,name:r.name,email:r.email,role:r.role,joined:new Date(r.created_at).toISOString()})),
    invites:i.rows};
}

export async function invite(orgId:string,email:string,role:OrgRole,by:string):Promise<void>{
  await pool().query(`INSERT INTO mossline_org_invites (org_id,email,role,invited_by) VALUES ($1,$2,$3,$4)
    ON CONFLICT (org_id,email) DO UPDATE SET role=EXCLUDED.role`,[orgId,email.toLowerCase(),role,by]);
}
export async function cancelInvite(orgId:string,email:string):Promise<void>{
  await pool().query(`DELETE FROM mossline_org_invites WHERE org_id=$1 AND email=$2`,[orgId,email.toLowerCase()]);
}
export async function isInvitedToOrg(email:string):Promise<boolean>{
  const {rows}=await pool().query(`SELECT 1 FROM mossline_org_invites WHERE email=$1 LIMIT 1`,[email.toLowerCase()]);
  return rows.length>0;
}

/** Organisations this person could join: invitations to their address, and ones open to their email domain. */
export async function joinable(email:string):Promise<{id:string;name:string;how:"invited"|"domain";role:OrgRole}[]>{
  const address=email.toLowerCase();
  const {rows}=await pool().query<{id:string;name:string;how:"invited"|"domain";role:OrgRole}>(`
    SELECT o.id,o.name,'invited' AS how,i.role FROM mossline_org_invites i JOIN mossline_orgs o ON o.id=i.org_id WHERE i.email=$1
    UNION
    SELECT o.id,o.name,'domain' AS how,'member' AS role FROM mossline_orgs o WHERE o.join_domain=$2
      AND NOT EXISTS (SELECT 1 FROM mossline_org_invites i WHERE i.org_id=o.id AND i.email=$1)`,[address,domainOf(address)]);
  return rows;
}

/** Joins an organisation this person was invited to, or that's open to their verified address's domain. */
export async function join(userId:string,email:string,orgId:string):Promise<boolean>{
  const option=(await joinable(email)).find(o=>o.id===orgId);
  if(!option)return false;
  const client=await pool().connect();
  try{
    await client.query("BEGIN");
    const {rowCount}=await client.query(`INSERT INTO mossline_org_members (org_id,user_id,role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [orgId,userId,option.role]);
    if(rowCount!==1){await client.query("ROLLBACK");return false;}
    await client.query(`DELETE FROM mossline_org_invites WHERE org_id=$1 AND email=$2`,[orgId,email.toLowerCase()]);
    await client.query(`UPDATE mossline_publications SET org_id=$1 WHERE owner_id=$2 AND org_id IS NULL`,[orgId,userId]);
    await client.query(`UPDATE mossline_maps SET org_id=$1 WHERE owner_id=$2 AND org_id IS NULL`,[orgId,userId]);
    await client.query("COMMIT");
    return true;
  }catch(error){await client.query("ROLLBACK");throw error;}
  finally{client.release();}
}

export async function setRole(orgId:string,userId:string,role:OrgRole):Promise<boolean>{
  if(role==="member"&&await adminCount(orgId,userId)===0)return false;
  const {rowCount}=await pool().query(`UPDATE mossline_org_members SET role=$1 WHERE org_id=$2 AND user_id=$3`,[role,orgId,userId]);
  return rowCount===1;
}
async function adminCount(orgId:string,except:string):Promise<number>{
  const {rows}=await pool().query<{n:string}>(`SELECT count(*) AS n FROM mossline_org_members WHERE org_id=$1 AND role='admin' AND user_id<>$2`,[orgId,except]);
  return Number(rows[0].n);
}
async function memberCount(orgId:string):Promise<number>{
  const {rows}=await pool().query<{n:string}>(`SELECT count(*) AS n FROM mossline_org_members WHERE org_id=$1`,[orgId]);
  return Number(rows[0].n);
}

/**
 * Someone leaves (or is removed). What they made stays with the organisation:
 * ownership passes to an admin who's staying. The last admin can't leave
 * while others remain; the last person leaving closes the organisation.
 */
export async function leave(orgId:string,userId:string):Promise<"left"|"last-admin"|"closed"|"not-member">{
  const role=(await pool().query<{role:OrgRole}>(`SELECT role FROM mossline_org_members WHERE org_id=$1 AND user_id=$2`,[orgId,userId])).rows[0]?.role;
  if(!role)return "not-member";
  const others=await memberCount(orgId)-1;
  if(others===0){
    await pool().query(`UPDATE mossline_publications SET org_id=NULL WHERE org_id=$1`,[orgId]);
    await pool().query(`UPDATE mossline_maps SET org_id=NULL WHERE org_id=$1`,[orgId]);
    await pool().query(`DELETE FROM mossline_orgs WHERE id=$1`,[orgId]);
    return "closed";
  }
  if(role==="admin"&&await adminCount(orgId,userId)===0)return "last-admin";
  await handOver(orgId,userId);
  await pool().query(`DELETE FROM mossline_org_members WHERE org_id=$1 AND user_id=$2`,[orgId,userId]);
  return "left";
}
/** Passes what someone owns in an organisation to one of its other admins. */
export async function handOver(orgId:string,userId:string):Promise<void>{
  const to=(await pool().query<{user_id:string}>(`SELECT user_id FROM mossline_org_members WHERE org_id=$1 AND role='admin' AND user_id<>$2
    ORDER BY created_at LIMIT 1`,[orgId,userId])).rows[0]?.user_id;
  if(!to)return;
  await pool().query(`UPDATE mossline_publications SET owner_id=$1 WHERE org_id=$2 AND owner_id=$3`,[to,orgId,userId]);
  await pool().query(`UPDATE mossline_maps SET owner_id=$1 WHERE org_id=$2 AND owner_id=$3`,[to,orgId,userId]);
}
/** Before an account is deleted: keep its organisation's maps by handing them over. */
export async function handOverEverything(userId:string):Promise<void>{
  const org=await orgOf(userId);
  if(!org)return;
  if(await memberCount(org.id)===1){await leave(org.id,userId);return;}
  // The last admin leaving: the longest-standing member takes over, so the organisation keeps its maps.
  if(await adminCount(org.id,userId)===0)
    await pool().query(`UPDATE mossline_org_members SET role='admin' WHERE org_id=$1 AND user_id=(SELECT user_id FROM mossline_org_members
      WHERE org_id=$1 AND user_id<>$2 ORDER BY created_at LIMIT 1)`,[org.id,userId]);
  await handOver(org.id,userId);
}

export const validJoinDomain=(adminEmail:string,domain:string)=>canUseAsJoinDomain(adminEmail)&&domainOf(adminEmail)===domain;

// ---- Plans and billing ---------------------------------------------------------
export async function setPlan(orgId:string,plan:PlanId,until:Date|null,source:"stripe"|"invoice"|"operator"):Promise<void>{
  await pool().query(`UPDATE mossline_orgs SET plan=$1, plan_until=$2, plan_source=$3, updated_at=now() WHERE id=$4`,
    [plan,until,source,orgId]);
}
export async function setStripe(orgId:string,customer:string|null,subscription:string|null):Promise<void>{
  await pool().query(`UPDATE mossline_orgs SET stripe_customer_id=coalesce($1,stripe_customer_id),
    stripe_subscription_id=coalesce($2,stripe_subscription_id), updated_at=now() WHERE id=$3`,[customer,subscription,orgId]);
}
export async function stripeCustomerOf(orgId:string):Promise<string|null>{
  const {rows}=await pool().query<{c:string|null}>(`SELECT stripe_customer_id AS c FROM mossline_orgs WHERE id=$1`,[orgId]);
  return rows[0]?.c??null;
}
export async function orgForStripe(customer:string|null,subscription:string|null):Promise<string|null>{
  const {rows}=await pool().query<{id:string}>(`SELECT id FROM mossline_orgs WHERE stripe_customer_id=$1 OR stripe_subscription_id=$2 LIMIT 1`,
    [customer,subscription]);
  return rows[0]?.id??null;
}
/** Records a payment event once; false if it was already handled. */
export async function firstTime(eventId:string,type:string):Promise<boolean>{
  const {rowCount}=await pool().query(`INSERT INTO mossline_billing_events (id,type) VALUES ($1,$2) ON CONFLICT DO NOTHING`,[eventId,type]);
  return rowCount===1;
}

/** A payment event that failed part-way is forgotten, so Stripe's retry is handled. */
export async function forgetEvent(eventId:string):Promise<void>{
  await pool().query(`DELETE FROM mossline_billing_events WHERE id=$1`,[eventId]);
}

// ---- Operator views --------------------------------------------------------------
export async function allOrgs(){
  const {rows}=await pool().query<{id:string;name:string;plan:"free"|"organisation";plan_until:Date|null;plan_source:string|null;
    members:string;maps:string;publications:string;created_at:Date}>(`
    SELECT o.id,o.name,o.plan,o.plan_until,o.plan_source,o.created_at,
      (SELECT count(*) FROM mossline_org_members m WHERE m.org_id=o.id) AS members,
      (SELECT count(*) FROM mossline_maps x WHERE x.org_id=o.id) AS maps,
      (SELECT count(*) FROM mossline_publications p WHERE p.org_id=o.id AND p.is_published) AS publications
    FROM mossline_orgs o ORDER BY o.created_at DESC LIMIT 500`);
  return rows.map(r=>({id:r.id,name:r.name,plan:activePlan({plan:r.plan,planUntil:r.plan_until}),storedPlan:r.plan,
    planUntil:r.plan_until?new Date(r.plan_until).toISOString():null,planSource:r.plan_source,members:Number(r.members),
    maps:Number(r.maps),publications:Number(r.publications),created:new Date(r.created_at).toISOString()}));
}
export async function recentPublications(){
  const {rows}=await pool().query<{slug:string;snapshot:{title?:string};email:string|null;updated_at:Date}>(`
    SELECT p.slug,p.snapshot,u.email,p.updated_at FROM mossline_publications p LEFT JOIN mossline_users u ON u.id=p.owner_id
    WHERE p.is_published ORDER BY p.updated_at DESC LIMIT 200`);
  return rows.map(r=>({slug:r.slug,title:typeof r.snapshot?.title==="string"?r.snapshot.title:"Untitled",owner:r.email??"",
    updatedAt:new Date(r.updated_at).toISOString()}));
}
export async function takeDown(slug:string):Promise<boolean>{
  const {rowCount}=await pool().query(`DELETE FROM mossline_publications WHERE slug=$1`,[slug]);
  return rowCount===1;
}
export async function counts(){
  const {rows}=await pool().query<{users:string;orgs:string;paid:string;maps:string;publications:string}>(`SELECT
    (SELECT count(*) FROM mossline_users) AS users, (SELECT count(*) FROM mossline_orgs) AS orgs,
    (SELECT count(*) FROM mossline_orgs WHERE plan='organisation' AND (plan_until IS NULL OR plan_until>now())) AS paid,
    (SELECT count(*) FROM mossline_maps) AS maps, (SELECT count(*) FROM mossline_publications WHERE is_published) AS publications`);
  const r=rows[0];
  return {users:Number(r.users),orgs:Number(r.orgs),paid:Number(r.paid),maps:Number(r.maps),publications:Number(r.publications)};
}
