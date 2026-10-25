import type { ReactNode } from "react";

/** The Mossline mark and name, as used in every header. */
export function Wordmark({ children }: { children?: ReactNode }) {
  return <span className="ml-wordmark">
    <svg viewBox="0 0 26 26" aria-hidden="true"><path d="M3 19C8 19 9 8 14 8S20 15 23 6" className="ml-mark-line"/>
      <circle cx="3.5" cy="19" r="2.6" className="ml-mark-a"/><circle cx="14" cy="8" r="2.6" className="ml-mark-b"/>
      <circle cx="22.6" cy="6.4" r="2.6" className="ml-mark-c"/></svg>
    <span>Mossline</span>{children}
  </span>;
}
/** A Night/Day switch that follows and sets the app-wide choice. */
export function ThemeButton({ theme, onChange }: { theme: "day" | "night"; onChange: (theme: "day" | "night") => void }) {
  return <button type="button" className="ml-quiet ml-theme-button" onClick={() => onChange(theme === "night" ? "day" : "night")}
    aria-label={theme === "night" ? "Use day colours" : "Use night colours"}>{theme === "night" ? "Day" : "Night"}</button>;
}
