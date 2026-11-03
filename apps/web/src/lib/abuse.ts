import {createHash} from "node:crypto";
import {pool} from "./db";
export {isDisposable} from "./disposable";


/** Sign-in links one address can ask for in an hour, whoever asks. */
export const LINKS_PER_HOUR=5;
const hash=(email:string)=>createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
/** Records a request for a sign-in link, and says whether this address has had too many lately. */
export async function tooManyLinks(email:string):Promise<boolean>{
  const h=hash(email);
  const {rows}=await pool().query<{n:string}>(`SELECT count(*) AS n FROM mossline_signin_requests
    WHERE email_hash=$1 AND requested_at > now() - interval '1 hour'`,[h]);
  if(Number(rows[0].n)>=LINKS_PER_HOUR)return true;
  await pool().query(`INSERT INTO mossline_signin_requests (email_hash) VALUES ($1)`,[h]);
  return false;
}
