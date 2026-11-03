"use client";

import { useAccount } from "../../hooks/useAccount";
import { PolicyLinks } from "./PolicyLinks";

/** Pricing and policy links, only where this Mossline runs accounts. */
export function HostedFooter() {
  const { state } = useAccount();
  if (state.status !== "ready") return null;
  return <footer className="ml-account-foot ml-home-foot">
    <span className="ml-small">{state.user ? <a href="/account">Your account</a> : <a href="/sign-in?next=/account">Sign in</a>}</span>
    <PolicyLinks/>
  </footer>;
}
