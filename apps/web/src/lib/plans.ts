/**
 * What each plan allows. Limits only apply where a deployment turns plans on
 * (MOSSLINE_PLANS_ENABLED=true, as on the hosted Mossline). A Mossline run
 * by anyone else has no limits and no payments.
 */
type Env=Record<string,string|undefined>;
export type PlanId="free"|"organisation";
export type Limits={publications:number;savedMaps:number;peoplePerMap:number;uploadBytes:number};

export const PLANS:Record<PlanId,{name:string;limits:Limits}>={
  free:{name:"Free",limits:{publications:3,savedMaps:1,peoplePerMap:3,uploadBytes:1_000_000}},
  organisation:{name:"Organisation",limits:{publications:100,savedMaps:50,peoplePerMap:50,uploadBytes:4_000_000}}
};
const UNLIMITED:Limits={publications:Infinity,savedMaps:Infinity,peoplePerMap:Infinity,uploadBytes:4_000_000};

export const plansEnabled=(env:Env=process.env)=>env.MOSSLINE_PLANS_ENABLED==="true";
/** Anyone may create an account, instead of only the addresses on MOSSLINE_PUBLISHERS. */
export const openSignUp=(env:Env=process.env)=>env.MOSSLINE_OPEN_SIGNUP==="true";
/** The price people see. Payment itself is set by the Stripe price. */
export const planPrice=(env:Env=process.env)=>env.MOSSLINE_PLAN_PRICE||"£49 a year";

export type OrgPlan={plan:PlanId;planUntil:Date|string|null};
/** An organisation's paid plan counts until its end date; with no end date it runs until changed. */
export function activePlan(org:OrgPlan|null|undefined,now=new Date()):PlanId{
  if(!org||org.plan!=="organisation")return "free";
  if(org.planUntil===null)return "organisation";
  return new Date(org.planUntil).getTime()>now.getTime()?"organisation":"free";
}
export function limitsFor(plan:PlanId,env:Env=process.env):Limits{
  return plansEnabled(env)?PLANS[plan].limits:UNLIMITED;
}

/** Shared mail services: their domains can't be used to let "everyone at" join an organisation. */
const PUBLIC_MAIL=new Set(["gmail.com","googlemail.com","outlook.com","hotmail.com","hotmail.co.uk","live.com","live.co.uk",
  "msn.com","yahoo.com","yahoo.co.uk","icloud.com","me.com","mac.com","aol.com","proton.me","protonmail.com","pm.me",
  "gmx.com","gmx.co.uk","mail.com","zoho.com","yandex.com","btinternet.com","sky.com","virginmedia.com","talktalk.net","fastmail.com","hey.com"]);
export const domainOf=(email:string)=>email.trim().toLowerCase().split("@")[1]??"";
export const canUseAsJoinDomain=(email:string)=>{const d=domainOf(email);return !!d&&d.includes(".")&&!PUBLIC_MAIL.has(d);};

/** What to tell someone at a limit: what the limit is, and what lifts it. */
export function limitMessage(what:"publications"|"savedMaps"|"peoplePerMap"|"uploadBytes",plan:PlanId,limit:number,env:Env=process.env):string{
  const thing={publications:"published maps",savedMaps:"maps saved to the account",peoplePerMap:"people on one map",
    uploadBytes:"MB per map"}[what];
  const n=what==="uploadBytes"?Math.round(limit/1e6):limit;
  return plan==="free"
    ? `The free plan allows ${n} ${thing}. An organisation plan (${planPrice(env)}) allows more: see Your account.`
    : `This organisation's plan allows ${n} ${thing}. Remove some, or contact us if you need more.`;
}
