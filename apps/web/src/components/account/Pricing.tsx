"use client";

import type { Limits } from "../../lib/plans";
import { AccountShell } from "./AccountShell";

const mb = (n: number) => Math.round(n / 1e6) + " MB";

/** Two plans. Everything in the browser stays free, with or without an account. */
export function Pricing({ price, free, org }: { price: string; free: Limits; org: Limits }) {
  return <AccountShell title="Pricing">
    <section className="ml-account-card ml-account-card--wide ml-pricing" aria-labelledby="pricing-title">
      <p className="ml-start-eyebrow">Pricing</p>
      <h1 id="pricing-title">Free to use. Pay to work together at scale.</h1>
      <p className="ml-add-lede">Mapping, exploring and editing in your browser is free, with no account. Mossline is open source:
        you can also run it yourself. Accounts add publishing, keeping maps online and working on them with others.</p>
      <div className="ml-pricing-plans">
        <article className="ml-pricing-plan" aria-labelledby="plan-free">
          <h2 id="plan-free">Free</h2>
          <p className="ml-pricing-price">£0</p>
          <ul>
            <li>Everything in the browser, unlimited</li>
            <li>{free.publications} published maps</li>
            <li>{free.savedMaps} map kept in your account</li>
            <li>Share it with up to {free.peoplePerMap} people</li>
            <li>Maps up to {mb(free.uploadBytes)} compressed</li>
          </ul>
          <a className="ml-quiet ml-account-button" href="/sign-in?next=/account">Create a free account</a>
        </article>
        <article className="ml-pricing-plan is-featured" aria-labelledby="plan-org">
          <h2 id="plan-org">Organisation</h2>
          <p className="ml-pricing-price">{price}</p>
          <p className="ml-small">One price for the whole organisation, however many people are in it.</p>
          <ul>
            <li>Everyone in the organisation can open and edit its maps</li>
            <li>{org.publications} published maps</li>
            <li>{org.savedMaps} maps kept in the organisation</li>
            <li>Share each with up to {org.peoplePerMap} people outside it</li>
            <li>Maps up to {mb(org.uploadBytes)} compressed</li>
            <li>Let anyone with your email domain join</li>
            <li>Pay by card, or by invoice on request</li>
          </ul>
          <a className="ml-solid ml-account-button" href="/organisation">Start an organisation</a>
        </article>
      </div>
      <div className="ml-pricing-notes">
        <h2>Good to know</h2>
        <ul>
          <li>Cancel any time. Your plan runs to the end of the year you&apos;ve paid for.</li>
          <li>Nothing is deleted when a plan ends or a limit is reached. You just can&apos;t add more past the free limits.</li>
          <li>Your maps are yours. Export them at any time.</li>
          <li>No adverts, no tracking, and no selling data. See the <a href="/legal/privacy">privacy notice</a>.</li>
        </ul>
      </div>
    </section>
  </AccountShell>;
}
