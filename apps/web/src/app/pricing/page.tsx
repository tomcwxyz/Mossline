import type { Metadata } from "next";
import { PLANS, planPrice } from "../../lib/plans";
import { Pricing } from "../../components/account/Pricing";
export const metadata: Metadata = { title: "Pricing · Mossline" };
export const dynamic = "force-dynamic";
export default function PricingPage() { return <Pricing price={planPrice()} free={PLANS.free.limits} org={PLANS.organisation.limits}/>; }
