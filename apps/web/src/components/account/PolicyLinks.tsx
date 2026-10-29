import { LEGAL_PAGES } from "../../lib/legal";

/** The policies and pricing, in a quiet line at the foot of account pages. */
export function PolicyLinks() {
  return <nav className="ml-policy-links" aria-label="Policies">
    <a href="/pricing">Pricing</a>
    {LEGAL_PAGES.filter(p => ["terms", "privacy", "acceptable-use", "cookies"].includes(p.slug)).map(p =>
      <a key={p.slug} href={"/legal/" + p.slug}>{p.title}</a>)}
  </nav>;
}
