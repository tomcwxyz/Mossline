import {mkdir, writeFile} from "node:fs/promises";
import {join} from "node:path";
import nodemailer from "nodemailer";

/**
 * Sign-in links go out over plain SMTP, so any mail provider works.
 * MOSSLINE_TEST_MAIL_DIR writes them to files instead: for automated tests
 * only, never on a deployment people use.
 */
let transport:nodemailer.Transporter|null=null;
export async function sendSignInLink(to:string,url:string):Promise<void>{
  const from=process.env.MOSSLINE_EMAIL_FROM!;
  const subject="Sign in to Mossline";
  const text=[
    "Use this link to sign in to Mossline. It works once and expires in 10 minutes.",
    "",url,"",
    "If you didn't ask to sign in, ignore this email. No account changes without the link."
  ].join("\n");
  const testDir=process.env.MOSSLINE_TEST_MAIL_DIR;
  if(testDir&&!process.env.MOSSLINE_SMTP_URL){
    await mkdir(testDir,{recursive:true});
    await writeFile(join(testDir,to.toLowerCase().replace(/[^a-z0-9@._-]/g,"_")+".txt"),url+"\n");
    return;
  }
  transport??=nodemailer.createTransport(process.env.MOSSLINE_SMTP_URL);
  await transport.sendMail({from,to,subject,text});
}
