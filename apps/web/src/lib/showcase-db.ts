import {pool} from "./db";
import {isHostedConfigured} from "./hosted-auth";

export type ShowcaseItem = {slug:string;title:string;description:string;credit:string;updatedAt:string};
export type ReviewItem = ShowcaseItem & {status:string;submittedAt:string};
const db=()=>{if(!isHostedConfigured())throw Error("Hosted publishing unavailable");return pool();};

/** Publication status is checked every time, so withdrawn maps vanish immediately. */
export async function featuredShowcase():Promise<ShowcaseItem[]>{
  const {rows}=await db().query<{slug:string;title:string;description:string;credit:string;updated_at:Date}>(
    `SELECT s.slug,p.snapshot->>'title' AS title,s.description,s.credit,p.updated_at
     FROM mossline_showcase s JOIN mossline_publications p ON p.slug=s.slug
     WHERE s.status='approved' AND p.is_published=true
     ORDER BY s.reviewed_at DESC,s.submitted_at DESC LIMIT 60`);
  return rows.map(r=>({slug:r.slug,title:r.title,description:r.description,credit:r.credit,updatedAt:new Date(r.updated_at).toISOString()}));
}

/** Only an existing publisher can offer their own published snapshot for review. */
export async function submitShowcase(ownerId:string,slug:string,description:string,credit:string):Promise<boolean>{
  const {rows}=await db().query<{slug:string}>(`
     INSERT INTO mossline_showcase(slug,submitted_by,description,credit,status,reviewed_by,reviewed_at)
     SELECT p.slug,$1,$3,$4,'pending',NULL,NULL FROM mossline_publications p
     WHERE p.slug=$2 AND p.is_published=true AND p.owner_id=$1
     ON CONFLICT(slug) DO UPDATE SET
       description=excluded.description,credit=excluded.credit,status='pending',
       submitted_at=now(),reviewed_at=NULL,reviewed_by=NULL
     WHERE mossline_showcase.submitted_by=excluded.submitted_by
     RETURNING slug`,[ownerId,slug,description,credit]);
  return rows.length>0;
}
export async function reviewQueue():Promise<ReviewItem[]>{
  const {rows}=await db().query<{slug:string;title:string;description:string;credit:string;status:string;submitted_at:Date;updated_at:Date}>(`
    SELECT s.slug,p.snapshot->>'title' AS title,s.description,s.credit,s.status,s.submitted_at,p.updated_at
    FROM mossline_showcase s JOIN mossline_publications p ON p.slug=s.slug
    WHERE p.is_published=true ORDER BY (s.status='pending') DESC,s.submitted_at DESC LIMIT 200`);
  return rows.map(r=>({slug:r.slug,title:r.title,description:r.description,credit:r.credit,status:r.status,
    submittedAt:new Date(r.submitted_at).toISOString(),updatedAt:new Date(r.updated_at).toISOString()}));
}
export async function decideShowcase(slug:string,status:'approved'|'rejected',reviewerId:string):Promise<boolean>{
  const {rowCount}=await db().query(`
    UPDATE mossline_showcase s SET status=$2,reviewed_by=$3,reviewed_at=now()
    FROM mossline_publications p WHERE p.slug=s.slug AND s.slug=$1 AND p.is_published=true`,[slug,status,reviewerId]);
  return rowCount===1;
}
