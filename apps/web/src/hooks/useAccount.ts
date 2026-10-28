"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Who is signed in, if anyone, and how this deployment lets people sign in.
 * Talks to Mossline's own endpoints with plain fetch; nothing is kept in
 * browser storage beyond the session cookie.
 */
export type SignInMethods = { microsoft: boolean; google: boolean; email: boolean };
export type AccountUser = { name: string; email: string; canPublish: boolean };
export type AccountState =
  | { status: "loading" }
  | { status: "off" }
  | { status: "ready"; signIn: SignInMethods; user: AccountUser | null };

export type OwnedPublication = { slug: string; title: string; nodes: number; edges: number; revision: number; createdAt: string; updatedAt: string };

export function useAccount(enabled = true) {
  const [state, setState] = useState<AccountState>({ status: "loading" });
  const refresh = useCallback(async () => {
    if (!enabled) { setState({ status: "off" }); return; }
    try {
      const r = await fetch("/api/publications/status", { cache: "no-store", credentials: "same-origin" });
      const data = await r.json() as { enabled?: boolean; signIn?: SignInMethods; user?: AccountUser | null };
      setState(data.enabled && data.signIn ? { status: "ready", signIn: data.signIn, user: data.user ?? null } : { status: "off" });
    } catch { setState({ status: "off" }); }
  }, [enabled]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { state, refresh };
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(path, { cache: "no-store", credentials: "same-origin", ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const data = await r.json().catch(() => ({})) as T & { error?: string; message?: string };
  if (r.status === 429 && !data.error) throw Error("Too many tries from here. Wait a minute, then try again.");
  if (!r.ok) throw Error(data.error ?? data.message ?? "Something went wrong. Try again.");
  return data;
}

/** Only paths on this site, so a sign-in link can't send someone elsewhere. */
export function safeReturnPath(value: string | null | undefined): string {
  return value && /^\/(?!\/)[A-Za-z0-9/_?=&.%+~,-]*$/.test(value) ? value : "/";
}

export const account = {
  emailLink: (email: string, next: string) => call<{ status: boolean }>("/api/auth/sign-in/magic-link",
    { method: "POST", body: JSON.stringify({ email, callbackURL: safeReturnPath(next), errorCallbackURL: "/sign-in" }) }),
  provider: async (provider: "microsoft" | "google", next: string) => {
    const data = await call<{ url?: string }>("/api/auth/sign-in/social",
      { method: "POST", body: JSON.stringify({ provider, callbackURL: safeReturnPath(next), errorCallbackURL: "/sign-in" }) });
    if (data.url) window.location.assign(data.url);
  },
  signOut: () => call<unknown>("/api/auth/sign-out", { method: "POST", body: "{}" }),
  deleteAccount: () => call<unknown>("/api/auth/delete-user", { method: "POST", body: "{}" }),
  publications: () => call<{ publications: OwnedPublication[] }>("/api/publications").then(d => d.publications),
  publish: (snapshot: unknown) => call<{ slug: string; revision: number }>("/api/publications",
    { method: "POST", body: JSON.stringify({ snapshot }) }),
  update: (slug: string, revision: number, snapshot: unknown) => call<{ slug: string; revision: number }>("/api/publications/" + slug,
    { method: "PATCH", body: JSON.stringify({ revision, snapshot }) }),
  unpublish: (slug: string) => call<unknown>("/api/publications/" + slug, { method: "DELETE" }),
  claim: (slug: string, managementKey: string) => call<{ slug: string }>("/api/publications/claim",
    { method: "POST", body: JSON.stringify({ slug, managementKey }) })
};
