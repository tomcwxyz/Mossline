import {apiResult} from "../../../../lib/hosted-response";
import {readJsonBody} from "../../../../lib/hosted-auth";
import {requireSignedIn} from "../../../../lib/hosted-guard";
import {canSendMail,sendEmailChange,sendNotice} from "../../../../lib/auth-mail";
import {emailInUse,startEmailChange} from "../../../../lib/account-db";
import {tooManyLinks} from "../../../../lib/abuse";
import {isDisposable} from "../../../../lib/disposable";
import {reportError} from "../../../../lib/report";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const EMAIL=/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

/** Sends a link to the new address; the change happens only when it's opened. The old address is told. */
export async function POST(request:Request){
  const user=await requireSignedIn(request,{write:true});
  if(user instanceof Response)return user;
  if(!canSendMail())return apiResult({error:"This Mossline can't send email, so addresses can't be changed here. Contact us instead."},404);
  let email="";
  try{const body=await readJsonBody(request,1_000) as {email?:unknown};email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";}catch{/* below */}
  if(!EMAIL.test(email)||isDisposable(email))return apiResult({error:"Give an email address you'll keep"},400);
  if(email===user.email.toLowerCase())return apiResult({error:"That's already your address"},400);
  try{
    if(await emailInUse(email))return apiResult({error:"Another account already uses that address"},409);
    if(await tooManyLinks(email))return apiResult({error:"Too many tries for that address. Try again in an hour."},429);
    const token=await startEmailChange(user.id,email);
    const url=new URL("/api/account/email/confirm?token="+token,process.env.MOSSLINE_BASE_URL).toString();
    await sendEmailChange(email,url);
    await sendNotice(user.email,"Your Mossline email address is being changed",[
      "Someone signed in to your Mossline account asked to change its email address to "+email+".",
      "It changes only once that address confirms. If this wasn't you, sign in and sign out everywhere, or reply to us."
    ]).catch(error=>reportError("email change notice",error));
    return apiResult({sent:true});
  }catch(error){reportError("email change",error);return apiResult({error:"Couldn't start the change. Try again shortly."},503);}
}
