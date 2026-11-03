import type { Metadata } from "next";
import { Admin } from "../../components/account/Admin";
export const metadata: Metadata = { title: "Running Mossline", robots: { index: false } };
export default function AdminPage() { return <Admin/>; }
