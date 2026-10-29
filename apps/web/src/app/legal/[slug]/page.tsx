import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { LEGAL_PAGES, fillPolicy, type LegalSlug } from "../../../lib/legal";
import { LegalPage } from "../../../components/account/LegalPage";
import terms from "../../../content/legal/terms";
import privacy from "../../../content/legal/privacy";
import dataProcessing from "../../../content/legal/data-processing";
import acceptableUse from "../../../content/legal/acceptable-use";
import cookies from "../../../content/legal/cookies";
import subprocessors from "../../../content/legal/subprocessors";

const TEXT: Record<LegalSlug, string> = { terms, privacy, "data-processing": dataProcessing, "acceptable-use": acceptableUse, cookies, subprocessors };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = LEGAL_PAGES.find(p => p.slug === slug);
  return { title: (page?.title ?? "Policies") + " · Mossline" };
}

/** The policies, filled in with who runs this Mossline. */
export default async function Legal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = LEGAL_PAGES.find(p => p.slug === slug);
  if (!page) notFound();
  const html = await marked.parse(fillPolicy(TEXT[page.slug]), { gfm: true });
  return <LegalPage title={page.title} current={page.slug} html={html}/>;
}
