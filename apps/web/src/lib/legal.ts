/**
 * The policies people agree to. Change TERMS_VERSION when the terms or the
 * privacy notice change in a way people should be told about; accounts
 * record the version they agreed to.
 */
export const TERMS_VERSION="2026-10-29";
export const LEGAL_PAGES=[
  {slug:"terms",title:"Terms of service"},
  {slug:"privacy",title:"Privacy notice"},
  {slug:"data-processing",title:"Data processing agreement"},
  {slug:"acceptable-use",title:"Acceptable use and takedown"},
  {slug:"cookies",title:"Cookies and browser storage"},
  {slug:"subprocessors",title:"Who else handles data"}
] as const;
export type LegalSlug=typeof LEGAL_PAGES[number]["slug"];

/** Who runs this Mossline, filled into the policies. Unset values show as visible blanks, never invented. */
export function operator(env:Record<string,string|undefined>=process.env){
  const blank=(what:string)=>"[" + what + " not set]";
  return {
    name:env.MOSSLINE_OPERATOR_NAME||blank("operator name"),
    legal:env.MOSSLINE_OPERATOR_LEGAL_NAME||env.MOSSLINE_OPERATOR_NAME||blank("legal name"),
    address:env.MOSSLINE_OPERATOR_ADDRESS||blank("postal address"),
    email:env.MOSSLINE_OPERATOR_EMAIL||blank("contact email"),
    company:env.MOSSLINE_OPERATOR_COMPANY_NUMBER||"",
    ico:env.MOSSLINE_OPERATOR_ICO_NUMBER||"",
    site:env.MOSSLINE_BASE_URL||blank("site address"),
    price:env.MOSSLINE_PLAN_PRICE||"£49 a year",
    vat:env.MOSSLINE_OPERATOR_VAT_NUMBER||"",
    hosting:env.MOSSLINE_HOSTING_PROVIDER||blank("hosting provider"),
    database:env.MOSSLINE_DATABASE_PROVIDER||blank("database provider"),
    region:env.MOSSLINE_DATA_REGION||blank("data location"),
    emailProvider:env.MOSSLINE_EMAIL_PROVIDER||blank("email provider")
  };
}

/** Fills a policy's {{placeholders}} from the operator's settings. Values are escaped; blanks stay visible. */
export function fillPolicy(text:string,env:Record<string,string|undefined>=process.env):string{
  const o=operator(env);
  const esc=(v:string)=>v.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]!));
  const updated=new Date(TERMS_VERSION+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
  const values:Record<string,string>={
    name:o.name,legal:o.legal,address:o.address,email:o.email,site:o.site,price:o.price,
    hosting:o.hosting,database:o.database,region:o.region,email_provider:o.emailProvider,updated,
    company_line:o.company?"Registered company number "+o.company+".":"",
    ico_line:o.ico?"We are registered with the Information Commissioner's Office, registration number "+o.ico+".":"",
    vat_statement:o.vat?"Prices exclude VAT, which we add where it applies (VAT number "+o.vat+").":"We aren't registered for VAT, so no VAT is charged."
  };
  return text.replace(/\{\{(\w+)\}\}/g,(m,k:string)=>k in values?esc(values[k]):m);
}
