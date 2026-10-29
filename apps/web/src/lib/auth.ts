import {betterAuth} from "better-auth";
import {APIError, createAuthMiddleware} from "better-auth/api";
import {magicLink} from "better-auth/plugins/magic-link";
import {pool} from "./db";
import {sendSignInLink} from "./auth-mail";
import {isHostedConfigured, mayCreate, signInMethods} from "./hosted-auth";
import {forgetMemberships, isInvited} from "./shared-maps-db";
import {handOverEverything, isInvitedToOrg} from "./orgs-db";
import {TERMS_VERSION} from "./legal";

/**
 * Who may have an account: anyone with open sign-up, otherwise the publishers
 * list; plus anyone invited to a shared map or an organisation. Someone who
 * already has one can always sign in, if only to delete it.
 */
async function mayHaveAccount(email:string):Promise<boolean>{
  if(mayCreate(email))return true;
  try{
    if(await isInvited(email))return true;
    if(await isInvitedToOrg(email))return true;
    const {rows}=await pool().query("SELECT 1 FROM mossline_users WHERE email=$1",[email.trim().toLowerCase()]);
    return rows.length>0;
  }catch{return false;}
}

/**
 * Accounts exist so a published map belongs to someone. Mossline keeps the
 * least it can: a name and an email address. Providers only confirm who you
 * are; their access tokens, profile photos, IP addresses and browser details
 * are not stored.
 */
const snake=<T extends string>(fields:Record<T,string>)=>fields;
function makeAuth(){
  const methods=signInMethods();
  const env=process.env;
  return betterAuth({
    appName:"Mossline",
    baseURL:env.MOSSLINE_BASE_URL,
    secret:env.MOSSLINE_AUTH_SECRET,
    database:pool(),
    telemetry:{enabled:false},
    socialProviders:{
      ...(methods.microsoft?{microsoft:{
        clientId:env.MOSSLINE_MICROSOFT_CLIENT_ID!,
        clientSecret:env.MOSSLINE_MICROSOFT_CLIENT_SECRET!,
        // "organizations" admits work and school accounts; "common" adds personal ones.
        tenantId:env.MOSSLINE_MICROSOFT_TENANT||"common",
        disableProfilePhoto:true,
        prompt:"select_account" as const
      }}:{}),
      ...(methods.google?{google:{
        clientId:env.MOSSLINE_GOOGLE_CLIENT_ID!,
        clientSecret:env.MOSSLINE_GOOGLE_CLIENT_SECRET!,
        prompt:"select_account" as const
      }}:{})
    },
    plugins:methods.email?[magicLink({
      expiresIn:10*60,
      storeToken:"hashed",
      // Automated tests sign in many people from one address in a few minutes; people never do.
      ...(process.env.MOSSLINE_TEST_MAIL_DIR&&!process.env.MOSSLINE_SMTP_URL?{rateLimit:{window:60,max:100}}:{}),
      // Say the same thing whoever asks, so the form can't be used to find out who has an account.
      sendMagicLink:async({email,url})=>{ if(await mayHaveAccount(email))await sendSignInLink(email,url); }
    })]:[],
    user:{
      modelName:"mossline_users",
      fields:snake({name:"name",email:"email",emailVerified:"email_verified",image:"image",createdAt:"created_at",updatedAt:"updated_at"}),
      // Which terms someone agreed to by creating the account, and when.
      additionalFields:{
        termsVersion:{type:"string",required:false,input:false,fieldName:"terms_version"},
        termsAcceptedAt:{type:"date",required:false,input:false,fieldName:"terms_accepted_at"}
      },
      // An organisation's maps pass to another of its admins; the rest of what the account owns goes with it
      // (database cascade), and its invitations to others' maps are dropped.
      deleteUser:{enabled:true,
        beforeDelete:async user=>{ await handOverEverything(user.id); },
        afterDelete:async user=>{ await forgetMemberships(user.email); }}
    },
    session:{
      modelName:"mossline_sessions",
      fields:snake({expiresAt:"expires_at",token:"token",createdAt:"created_at",updatedAt:"updated_at",
        ipAddress:"ip_address",userAgent:"user_agent",userId:"user_id"}),
      expiresIn:60*60*24*30,
      updateAge:60*60*24
    },
    account:{
      modelName:"mossline_accounts",
      fields:snake({accountId:"account_id",providerId:"provider_id",userId:"user_id",accessToken:"access_token",
        refreshToken:"refresh_token",idToken:"id_token",accessTokenExpiresAt:"access_token_expires_at",
        refreshTokenExpiresAt:"refresh_token_expires_at",scope:"scope",password:"password",
        createdAt:"created_at",updatedAt:"updated_at"}),
      // A provider sign-in joins an existing account only when the provider vouches for the address.
      accountLinking:{enabled:true}
    },
    verification:{
      modelName:"mossline_verifications",
      fields:snake({identifier:"identifier",value:"value",expiresAt:"expires_at",createdAt:"created_at",updatedAt:"updated_at"})
    },
    rateLimit:{
      enabled:true,
      storage:"database",
      modelName:"mossline_auth_rate_limits",
      fields:snake({key:"key",count:"count",lastRequest:"last_request"})
    },
    advanced:{cookiePrefix:"mossline"},
    hooks:{
      // An address that can't publish gets the same reply as one that can, and nothing is stored for it.
      before:createAuthMiddleware(async ctx=>{
        if(ctx.path==="/sign-in/magic-link"&&!await mayHaveAccount(typeof ctx.body?.email==="string"?ctx.body.email:""))
          return ctx.json({status:true});
      })
    },
    onAPIError:{errorURL:"/sign-in"},
    databaseHooks:{
      user:{
        create:{before:async user=>{
          // The publishers list is only as good as the address, so it must be one the provider has verified
          // (Microsoft: add the verified_primary_email optional claim; see docs/HOSTED_PUBLISHING.md).
          if(!user.emailVerified||!await mayHaveAccount(user.email))
            throw new APIError("FORBIDDEN",{message:"This address can't publish from Mossline."});
          // Signing in for the first time, after being shown the terms and privacy notice, creates the account.
          return {data:{...user,image:null,termsVersion:TERMS_VERSION,termsAcceptedAt:new Date()}};
        }},
        update:{before:async data=>({data:"image" in data?{...data,image:null}:data})}
      },
      session:{create:{before:async session=>({data:{...session,ipAddress:null,userAgent:null}})}},
      account:{
        create:{before:async account=>({data:{...account,accessToken:null,refreshToken:null,idToken:null,
          accessTokenExpiresAt:null,refreshTokenExpiresAt:null}})},
        update:{before:async account=>({data:{...account,accessToken:null,refreshToken:null,idToken:null,
          accessTokenExpiresAt:null,refreshTokenExpiresAt:null}})}
      }
    }
  });
}

type Auth=ReturnType<typeof makeAuth>;
const cached=globalThis as unknown as {__mosslineAuth?:Auth};
/** The configured auth instance, or null when hosted publishing is off. */
export function getAuth():Auth|null{
  if(!isHostedConfigured())return null;
  cached.__mosslineAuth??=makeAuth();
  return cached.__mosslineAuth;
}

export type SignedIn={id:string;name:string;email:string;canPublish:boolean};
export async function currentUser(request:Request):Promise<SignedIn|null>{
  const auth=getAuth();
  if(!auth)return null;
  const session=await auth.api.getSession({headers:request.headers});
  if(!session)return null;
  const {id,name,email}=session.user;
  // Members of an organisation publish and keep maps under it, whoever let them in.
  let inOrg=false;
  if(!mayCreate(email)){
    try{inOrg=(await pool().query("SELECT 1 FROM mossline_org_members WHERE user_id=$1",[id])).rows.length>0;}catch{/* treated as not */}
  }
  return {id,name,email,canPublish:mayCreate(email)||inOrg};
}
