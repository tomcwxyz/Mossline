import {betterAuth} from "better-auth";
import {APIError, createAuthMiddleware} from "better-auth/api";
import {magicLink} from "better-auth/plugins/magic-link";
import {pool} from "./db";
import {sendSignInLink} from "./auth-mail";
import {isHostedConfigured, mayPublish, signInMethods} from "./hosted-auth";
import {forgetMemberships, isInvited} from "./shared-maps-db";

/**
 * Publishers, plus anyone invited to a shared map, may have an account. Someone
 * who already has one can always sign in, if only to delete it.
 */
async function mayHaveAccount(email:string):Promise<boolean>{
  if(mayPublish(email))return true;
  try{
    if(await isInvited(email))return true;
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
      // Say the same thing whoever asks, so the form can't be used to find out who has an account.
      sendMagicLink:async({email,url})=>{ if(await mayHaveAccount(email))await sendSignInLink(email,url); }
    })]:[],
    user:{
      modelName:"mossline_users",
      fields:snake({name:"name",email:"email",emailVerified:"email_verified",image:"image",createdAt:"created_at",updatedAt:"updated_at"}),
      // Owned maps and publications go with the account (database cascade); invitations to others' maps are dropped.
      deleteUser:{enabled:true,afterDelete:async user=>{ await forgetMemberships(user.email); }}
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
          return {data:{...user,image:null}};
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
  return {id,name,email,canPublish:mayPublish(email)};
}
