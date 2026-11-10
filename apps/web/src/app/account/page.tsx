import type { Metadata } from "next";
import { Account } from "../../components/account/Account";

export const metadata: Metadata = { title: "Your account · Mossy", robots: { index: false } };

export default function AccountPage() { return <Account/>; }
