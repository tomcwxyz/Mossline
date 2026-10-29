import {NextResponse} from "next/server";
import {isHostedConfigured} from "../../../../../lib/hosted-auth";
import {confirmEmailChange} from "../../../../../lib/account-db";
import {reportError} from "../../../../../lib/report";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** The link from the new address. Whoever opens it proves they read that inbox. */
export async function GET(request:Request){
  const base=process.env.MOSSLINE_BASE_URL??new URL(request.url).origin;
  const back=(state:string)=>NextResponse.redirect(new URL("/account?email="+state,base));
  if(!isHostedConfigured())return back("off");
  const token=new URL(request.url).searchParams.get("token")??"";
  if(!/^[A-Za-z0-9_-]{30,100}$/.test(token))return back("invalid");
  try{
    const result=await confirmEmailChange(token);
    if(result===null)return back("invalid");
    if(typeof result==="string")return back(result);
    return back("changed");
  }catch(error){reportError("email change confirm",error);return back("failed");}
}
