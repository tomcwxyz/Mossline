"use client";

import { LEGAL_PAGES } from "../../lib/legal";
import { AccountShell } from "./AccountShell";

export function LegalPage({ title, current, html }: { title: string; current: string; html: string }) {
  return <AccountShell title="Policies">
    <div className="ml-legal">
      <nav className="ml-legal-nav" aria-label="Policies">
        <ul>{LEGAL_PAGES.map(p => <li key={p.slug}><a href={"/legal/" + p.slug} aria-current={p.slug === current ? "page" : undefined}>{p.title}</a></li>)}
          <li><a href="/pricing">Pricing</a></li></ul>
      </nav>
      <article className="ml-legal-body">
        <h1>{title}</h1>
        <div dangerouslySetInnerHTML={{ __html: html }}/>
      </article>
    </div>
  </AccountShell>;
}
