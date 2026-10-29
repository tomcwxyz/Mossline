import type { Metadata } from "next";
import { Organisation } from "../../components/account/Organisation";
export const metadata: Metadata = { title: "Your organisation · Mossline", robots: { index: false } };
export default function OrganisationPage() { return <Organisation/>; }
