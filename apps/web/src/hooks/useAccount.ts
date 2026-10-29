"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Who is signed in, if anyone, and how this deployment lets people sign in.
 * Talks to Mossline's own endpoints with plain fetch; nothing is kept in
 * browser storage beyond the session cookie.
 */
export type SignInMethods = { microsoft: boolean; google: boolean; email: boolean };
export type AccountUser = { name: string; email: string; canPublish: boolean; operator?: boolean };
export type AccountState =
  | { status: "loading" }
  | { status: "off" }
  | { status: "ready"; signIn: SignInMethods; user: AccountUser | null; sharedMaps: boolean; plans: boolean; openSignUp: boolean; price: string };

export type OwnedPublication = { slug: string; title: string; nodes: number; edges: number; revision: number; createdAt: string; updatedAt: string };

export function useAccount(enabled = true) {
  const [state, setState] = useState<AccountState>({ status: "loading" });
  const refresh = useCallback(async () => {
    if (!enabled) { setState({ status: "off" }); return; }
    try {
      const r = await fetch("/api/publications/status", { cache: "no-store", credentials: "same-origin" });
      const data = await r.json() as { enabled?: boolean; signIn?: SignInMethods; user?: AccountUser | null; sharedMaps?: boolean;
        plans?: boolean; openSignUp?: boolean; price?: string };
      setState(data.enabled && data.signIn ? { status: "ready", signIn: data.signIn, user: data.user ?? null, sharedMaps: !!data.sharedMaps,
        plans: !!data.plans, openSignUp: !!data.openSignUp, price: data.price ?? "" } : { status: "off" });
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
  setName: (name: string) => call<unknown>("/api/auth/update-user", { method: "POST", body: JSON.stringify({ name }) }),
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

// ---- Organisations and plans ------------------------------------------------------
export type Limits = { publications: number | null; savedMaps: number | null; peoplePerMap: number | null; uploadBytes: number | null };
export type Usage = { plan: "free" | "organisation"; limits: Limits; publications: number; savedMaps: number; org: { id: string; name: string } | null };
export type Org = { id: string; name: string; role: "admin" | "member"; plan: "free" | "organisation"; planUntil: string | null;
  planSource: string | null; joinDomain: string | null; billing: boolean };
export type OrgMember = { userId: string; name: string; email: string; role: "admin" | "member"; joined: string };
export type OrgState = { org: Org | null; members: OrgMember[]; invites: { email: string; role: "admin" | "member" }[];
  joinable: { id: string; name: string; how: "invited" | "domain"; role: "admin" | "member" }[]; usage: Usage; canCreate: boolean;
  plans: boolean; billing: boolean; price: string; domain: string | null };
const send = (method: string, body?: unknown) => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });
export const orgs = {
  get: () => call<OrgState>("/api/org"),
  create: (name: string) => call<{ org: Org }>("/api/org", send("POST", { name })),
  update: (changes: { name?: string; openToDomain?: boolean }) => call<{ org: Org }>("/api/org", send("PATCH", changes)),
  join: (orgId: string) => call<{ org: Org }>("/api/org/join", send("POST", { orgId })),
  leave: () => call<{ result: string }>("/api/org/leave", send("POST", {})),
  invite: (email: string, role: "admin" | "member") => call<{ emailed: boolean }>("/api/org/invites", send("POST", { email, role })),
  cancelInvite: (email: string) => call<unknown>("/api/org/invites?email=" + encodeURIComponent(email), send("DELETE")),
  setRole: (userId: string, role: "admin" | "member") => call<unknown>("/api/org/members", send("PATCH", { userId, role })),
  remove: (userId: string) => call<unknown>("/api/org/members?userId=" + encodeURIComponent(userId), send("DELETE")),
  checkout: () => call<{ url: string }>("/api/billing/checkout", send("POST", {})),
  portal: () => call<{ url: string }>("/api/billing/portal", send("POST", {}))
};
/** "2 of 3", or just "2" when there's no limit. */
export const ofLimit = (used: number, limit: number | null) => limit === null ? used.toLocaleString("en-GB") : used.toLocaleString("en-GB") + " of " + limit.toLocaleString("en-GB");
