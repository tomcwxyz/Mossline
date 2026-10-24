import type { Metadata } from "next";
import "./globals.css";
import "./field-atlas.css";

export const metadata: Metadata = {
  title: "Mossline — Make sense of connected worlds",
  description: "An open-source space for exploring relationships, networks and systems."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-GB"><body>{children}</body></html>;
}
