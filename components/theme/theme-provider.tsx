"use client";

import { useEffect } from "react";

export const themeStorageKey = "orqena-theme";
export type ThemePreference = "light" | "dark" | "system";

export const themeBootScript = `(function(){try{var k="${themeStorageKey}",p=localStorage.getItem(k)||"system",m=window.matchMedia("(prefers-color-scheme: dark)"),t=p==="system"?(m.matches?"dark":"light"):p,d=document.documentElement;d.dataset.theme=t;d.dataset.themePreference=p;d.style.colorScheme=t;document.cookie="orqena_theme="+p+"; Path=/; Max-Age=31536000; SameSite=Lax"}catch(e){}})();`;

export function applyThemePreference(preference: ThemePreference) {
  const resolved = preference === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : preference;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
  root.style.colorScheme = resolved;
  localStorage.setItem(themeStorageKey, preference);
  document.cookie = `orqena_theme=${preference}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent("orqena-theme-change", { detail: preference }));
}

export function ThemeProvider() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => {
      const preference = (localStorage.getItem(themeStorageKey) || "system") as ThemePreference;
      if (preference === "system") applyThemePreference("system");
    };
    const syncStorage = (event: StorageEvent) => {
      if (event.key === themeStorageKey) applyThemePreference((event.newValue || "system") as ThemePreference);
    };
    media.addEventListener("change", syncSystem);
    window.addEventListener("storage", syncStorage);
    return () => {
      media.removeEventListener("change", syncSystem);
      window.removeEventListener("storage", syncStorage);
    };
  }, []);
  return null;
}
