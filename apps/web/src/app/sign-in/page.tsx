import type { Metadata } from "next";
import { SignIn } from "../../components/account/SignIn";

export const metadata: Metadata = { title: "Sign in · Mossline", robots: { index: false } };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
  return <SignIn next={one(params.next) ?? "/"} error={one(params.error) ?? ""}/>;
}
