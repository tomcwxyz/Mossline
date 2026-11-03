"use client";

import { useState, type FormEvent } from "react";
import { account, safeReturnPath, useAccount } from "../../hooks/useAccount";
import { AccountShell } from "./AccountShell";

const ERRORS: Record<string, string> = {
  expired_token: "That sign-in link has expired or been used. Ask for a new one.",
  invalid_token: "That sign-in link has expired or been used. Ask for a new one.",
  access_denied: "Sign-in was cancelled."
};

export function SignIn({ next, error }: { next: string; error: string }) {
  const { state } = useAccount();
  const back = safeReturnPath(next);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [busy, setBusy] = useState<"" | "email" | "microsoft" | "google">("");
  const [problem, setProblem] = useState(error ? ERRORS[error.toLowerCase()] ??
    "We couldn't sign you in. If your address isn't set up to publish here, ask whoever runs this Mossline to add it." : "");

  async function sendLink(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || busy) return;
    setBusy("email"); setProblem("");
    try { await account.emailLink(email.trim(), back); setSent(email.trim()); }
    catch (e) { setProblem(e instanceof Error ? e.message : "Couldn't send the link. Try again."); }
    finally { setBusy(""); }
  }
  async function withProvider(provider: "microsoft" | "google") {
    setBusy(provider); setProblem("");
    try { await account.provider(provider, back); }
    catch (e) { setProblem(e instanceof Error ? e.message : "Couldn't reach the sign-in service."); setBusy(""); }
  }

  return <AccountShell title="Sign in">
    <section className="ml-account-card" aria-labelledby="sign-in-title">
      <p className="ml-start-eyebrow">Your account</p>
      <h1 id="sign-in-title">Sign in to Mossline</h1>
      <p className="ml-add-lede">You only need an account to publish maps or work on them with other people. Everything else in Mossline works
        without one, and your maps stay in this browser unless you choose to save one to your account.</p>

      {problem && <p className="ml-add-error" role="alert">{problem}</p>}

      {state.status === "loading" && <p className="ml-small" role="status">Checking…</p>}
      {state.status === "off" && <p className="ml-account-note">Accounts aren&apos;t switched on for this Mossline.
        Everything else works without one.</p>}
      {state.status === "ready" && state.user && <div className="ml-account-note" role="status">
        <p>You&apos;re signed in as <strong>{state.user.name || state.user.email}</strong>.</p>
        <div className="ml-edit-actions"><a className="ml-solid ml-account-button" href={back}>Carry on</a>
          <a className="ml-quiet ml-account-button" href="/account">Your account</a></div>
      </div>}
      {state.status === "ready" && !state.user && (sent ? <div className="ml-account-note" role="status">
        <p><strong>Check your email.</strong> If {sent} can publish here, a sign-in link is on its way.
          It works once and lasts 10 minutes.</p>
        <button type="button" className="ml-link-button" onClick={() => setSent("")}>Use a different address</button>
      </div> : <div className="ml-account-methods">
        {state.signIn.microsoft && <button type="button" className="ml-quiet ml-account-provider" disabled={!!busy}
          onClick={() => void withProvider("microsoft")}>{busy === "microsoft" ? "Opening Microsoft…" : "Continue with Microsoft"}</button>}
        {state.signIn.google && <button type="button" className="ml-quiet ml-account-provider" disabled={!!busy}
          onClick={() => void withProvider("google")}>{busy === "google" ? "Opening Google…" : "Continue with Google"}</button>}
        {state.signIn.email && (state.signIn.microsoft || state.signIn.google) && <p className="ml-account-or"><span>or</span></p>}
        {state.signIn.email && <form className="ml-edit-form" onSubmit={sendLink}>
          <label className="ml-edit-field"><span>Email address</span>
            <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}/></label>
          <button type="submit" className="ml-solid" disabled={!!busy}>{busy === "email" ? "Sending…" : "Email me a sign-in link"}</button>
        </form>}
      </div>)}

      {state.status === "ready" && !state.user && !sent && <p className="ml-small">By continuing, you agree to the{" "}
        <a href="/legal/terms">terms of service</a> and <a href="/legal/privacy">privacy notice</a>.</p>}
      <p className="ml-small ml-account-privacy">Mossline keeps your name, your email address, and the maps you publish or save to your account.
        Nothing else is kept with your account, and there's no password. Delete your account at any time and those maps go with it.</p>
      <a className="ml-small" href={back}>← Back to Mossline</a>
    </section>
  </AccountShell>;
}
