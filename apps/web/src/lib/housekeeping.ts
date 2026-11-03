import {pool} from "./db";
import {canSendMail, sendNotice} from "./auth-mail";
import {handOverEverything} from "./orgs-db";
import {forgetMemberships} from "./shared-maps-db";
import {reportError} from "./report";

/**
 * Keeping the promises in the privacy notice: expired sign-in data goes, and
 * accounts unused for three years are warned and then, 30 days on, deleted.
 * Safe to run as often as you like; it does a bounded amount each time.
 */
export const INACTIVE="3 years", GRACE="30 days";
export async function housekeeping(now=new Date()):Promise<Record<string,number>>{
  const q=(sql:string,args:unknown[]=[])=>pool().query(sql,args);
  const out:Record<string,number>={};
  out.sessions=(await q(`DELETE FROM mossline_sessions WHERE expires_at < now()`)).rowCount??0;
  out.signInLinks=(await q(`DELETE FROM mossline_verifications WHERE expires_at < now()`)).rowCount??0;
  out.emailChanges=(await q(`DELETE FROM mossline_email_changes WHERE expires_at < now()`)).rowCount??0;
  out.signInRequests=(await q(`DELETE FROM mossline_signin_requests WHERE requested_at < now() - interval '1 day'`)).rowCount??0;
  out.rateLimits=(await q(`DELETE FROM mossline_auth_rate_limits WHERE last_request < $1`,[now.getTime()-864e5])).rowCount??0;
  out.paymentEvents=(await q(`DELETE FROM mossline_billing_events WHERE received_at < now() - interval '90 days'`)).rowCount??0;

  // Warn accounts unused for three years. Without email, nobody can be warned, so nobody is deleted.
  out.warned=0;out.deleted=0;
  if(!canSendMail())return out;
  const due=await q(`SELECT id,email FROM mossline_users WHERE inactivity_warned_at IS NULL
    AND coalesce(last_active_at,created_at) < now() - interval '${INACTIVE}' ORDER BY created_at LIMIT 50`);
  for(const u of due.rows as {id:string;email:string}[]){
    try{
      await sendNotice(u.email,"Your Mossline account will be deleted in 30 days",[
        "You haven't signed in to Mossline for three years, so we'll delete your account in 30 days, as our privacy notice says.",
        "Anything you've published or kept in your account goes with it, unless it belongs to an organisation you're in.",
        "To keep it, just sign in before then: "+new URL("/sign-in?next=/account",process.env.MOSSLINE_BASE_URL).toString(),
        "To keep a copy first, sign in and choose Download your data."
      ]);
      await q(`UPDATE mossline_users SET inactivity_warned_at=now() WHERE id=$1`,[u.id]);
      out.warned++;
    }catch(error){reportError("inactivity warning",error);}
  }
  // Delete those warned at least 30 days ago who still haven't signed in.
  const gone=await q(`SELECT id,email FROM mossline_users WHERE inactivity_warned_at < now() - interval '${GRACE}'
    AND coalesce(last_active_at,created_at) < inactivity_warned_at ORDER BY inactivity_warned_at LIMIT 50`);
  for(const u of gone.rows as {id:string;email:string}[]){
    try{
      await handOverEverything(u.id);
      await q(`DELETE FROM mossline_users WHERE id=$1`,[u.id]);
      await forgetMemberships(u.email);
      out.deleted++;
    }catch(error){reportError("inactive account deletion",error);}
  }
  return out;
}
