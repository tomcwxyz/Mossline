import type { Metadata } from "next";
import "@fontsource/newsreader/400.css";
import "@fontsource/newsreader/500.css";
import "@fontsource/newsreader/400-italic.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/kalam/400.css";
import "./globals.css";
import "./field-atlas.css";
import { THEME_BOOT } from "../components/atlas/theme";

export const metadata: Metadata = {
  title: "Mossline — a field atlas for connected work",
  description: "Map organisations, projects, funders, people and places, and check the evidence behind every connection.",
  icons: { icon: "/icon.svg" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-GB" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOT }}/></head>
    <body>{children}</body>
  </html>;
}
