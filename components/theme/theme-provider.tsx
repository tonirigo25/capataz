"use client";

import { useEffect } from "react";

export const themeStorageKey = "orqena-theme";
export type ThemePreference = "light" | "dark" | "system";

export const themeBootScript = `(function(){try{var k="${themeStorageKey}",v=localStorage.getItem(k),p=v==="light"||v==="dark"||v==="system"?v:"light",m=window.matchMedia("(prefers-color-scheme: dark)"),t=p==="system"?(m.matches?"dark":"light"):p,d=document.documentElement,c=document.querySelector('meta[name="theme-color"]');d.dataset.theme=t;d.dataset.themePreference=p;d.style.colorScheme=t;if(c)c.setAttribute("content",t==="dark"?"#0d1718":"#f8f5ed");if(v!==p)localStorage.setItem(k,p);document.cookie="orqena_theme="+p+"; Path=/; Max-Age=31536000; SameSite=Lax"}catch(e){}})();`;

export function normalizeThemePreference(value: string | null | undefined): ThemePreference {
  return value === "light" || value === "dark" || value === "system" ? value : "light";
}

function renderThemePreference(preference: ThemePreference) {
  const resolved = preference === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : preference;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
  root.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#0d1718" : "#f8f5ed");
}

export function applyThemePreference(preference: ThemePreference) {
  const normalized = normalizeThemePreference(preference);
  renderThemePreference(normalized);
  if (localStorage.getItem(themeStorageKey) !== normalized) localStorage.setItem(themeStorageKey, normalized);
  document.cookie = `orqena_theme=${normalized}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent("orqena-theme-change", { detail: normalized }));
}

export function ThemeProvider() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => {
      const preference = normalizeThemePreference(localStorage.getItem(themeStorageKey));
      if (preference === "system") renderThemePreference("system");
    };
    const syncStorage = (event: StorageEvent) => {
      if (event.key !== themeStorageKey) return;
      const preference = normalizeThemePreference(event.newValue);
      renderThemePreference(preference);
      window.dispatchEvent(new CustomEvent("orqena-theme-change", { detail: preference }));
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
