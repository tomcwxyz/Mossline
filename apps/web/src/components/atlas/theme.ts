"use client";

import { useEffect, useState } from "react";
import type { AtlasTheme } from "./palette";

/** One Night/Day choice for the whole app, remembered on this device. It is
 *  set on <html data-theme> so every page, including the legacy tools, reads
 *  the same tokens; layout.tsx applies it before first paint. */
export const THEME_KEY = "mossline:atlas-theme";
const EVENT = "mossline:theme";

export function readTheme(): AtlasTheme {
  try { return window.localStorage.getItem(THEME_KEY) === "night" ? "night" : "day"; } catch { return "day"; }
}
export function writeTheme(theme: AtlasTheme) {
  try { window.localStorage.setItem(THEME_KEY, theme); } catch { /* storage blocked */ }
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: theme }));
}
export function useAtlasTheme(): [AtlasTheme, (theme: AtlasTheme) => void] {
  const [theme, setTheme] = useState<AtlasTheme>("day");
  useEffect(() => {
    setTheme(readTheme());
    const onChange = (event: Event) => setTheme((event as CustomEvent<AtlasTheme>).detail);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_KEY) return;
      const next = readTheme(); document.documentElement.dataset.theme = next; setTheme(next);
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onStorage); };
  }, []);
  return [theme, writeTheme];
}
/** Runs before React, so a night choice never flashes day colours. */
export const THEME_BOOT = `try{if(localStorage.getItem("${THEME_KEY}")==="night")document.documentElement.dataset.theme="night"}catch(e){}`;
