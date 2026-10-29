import {mkdir, writeFile} from "node:fs/promises";
import {join} from "node:path";
import nodemailer from "nodemailer";

/**
 * Mossline's emails (sign-in links, invitations) go out over plain SMTP, so
 * any mail provider works. MOSSLINE_TEST_MAIL_DIR writes them to files
 * instead: for automated tests only, never on a deployment people use.
 */
let transport:nodemailer.Transporter|null=null;
export const canSendMail=()=>!!(process.env.MOSSLINE_EMAIL_FROM&&(process.env.MOSSLINE_SMTP_URL||process.env.MOSSLINE_TEST_MAIL_DIR));

async function send(to:string,subject:string,text:string,kind:"sign-in"|"invite",testLine:string){
  const testDir=process.env.MOSSLINE_TEST_MAIL_DIR;
  if(testDir&&!process.env.MOSSLINE_SMTP_URL){
    await mkdir(testDir,{recursive:true});
    const name=to.toLowerCase().replace(/[^a-z0-9@._-]/g,"_")+(kind==="invite"?".invite":"")+".txt";
    await writeFile(join(testDir,name),testLine+"\n");
    return;
  }
  transport??=nodemailer.createTransport(process.env.MOSSLINE_SMTP_URL);
  await transport.sendMail({from:process.env.MOSSLINE_EMAIL_FROM!,to,subject,text});
}

export async function sendSignInLink(to:string,url:string):Promise<void>{
  await send(to,"Sign in to Mossline",[
    "Use this link to sign in to Mossline. It works once and expires in 10 minutes.",
    "",url,"",
    "If you didn't ask to sign in, ignore this email. No account changes without the link."
  ].join("\n"),"sign-in",url);
}

export async function sendInvitation(to:string,from:string,title:string,role:"editor"|"viewer",url:string):Promise<void>{
  await send(to,from+" shared a map with you on Mossline",[
    from+" has invited you to "+(role==="editor"?"view and edit":"view")+" “"+title+"” on Mossline.",
    "",
    "Open it here, signing in with this email address:",url,"",
    "If you weren't expecting this, you can ignore it."
  ].join("\n"),"invite",url);
}

export async function sendOrgInvitation(to:string,from:string,org:string,url:string):Promise<void>{
  await send(to,from+" invited you to "+org+" on Mossline",[
    from+" has invited you to join "+org+" on Mossline, to work on its maps together.",
    "",
    "Sign in with this email address to accept:",url,"",
    "If you weren't expecting this, you can ignore it."
  ].join("\n"),"invite",url);
}
