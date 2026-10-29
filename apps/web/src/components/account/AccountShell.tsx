"use client";

import type { ReactNode } from "react";
import { useAtlasTheme } from "../atlas/theme";
import { ThemeButton, Wordmark } from "../atlas/Wordmark";

/** The plain page frame for signing in and account settings. */
export function AccountShell({ title, children }: { title: string; children: ReactNode }) {
  const [theme, setTheme] = useAtlasTheme();
  return <main className="ml-atlas ml-account" data-theme={theme}>
    <header className="ml-home-header">
      <a href="/" className="ml-account-home" aria-label="Mossline — all maps"><Wordmark/></a>
      <span className="ml-add-title">{title}</span>
      <div className="ml-home-header-actions"><ThemeButton theme={theme} onChange={setTheme}/></div>
    </header>
    <div className="ml-account-body">{children}</div>
  </main>;
}
