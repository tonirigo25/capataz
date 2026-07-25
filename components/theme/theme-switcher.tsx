"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { applyThemePreference, themeStorageKey, type ThemePreference } from "@/components/theme/theme-provider";

const options = [
  { id: "light" as const, label: "Claro", Icon: Sun },
  { id: "dark" as const, label: "Oscuro", Icon: Moon },
  { id: "system" as const, label: "Sistema", Icon: Monitor },
];

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    const read = () => setPreference((localStorage.getItem(themeStorageKey) || "system") as ThemePreference);
    read();
    window.addEventListener("orqena-theme-change", read);
    return () => window.removeEventListener("orqena-theme-change", read);
  }, []);

  return (
    <div className="theme-switcher" role="group" aria-label="Tema de color" suppressHydrationWarning>
      {options.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={preference === id ? "is-active" : undefined}
          aria-pressed={preference === id}
          title={compact ? label : undefined}
          onClick={() => {
            applyThemePreference(id);
            setPreference(id);
          }}
        >
          <Icon size={15} aria-hidden="true" />
          <span className={compact ? "sr-only" : undefined}>{label}</span>
        </button>
      ))}
    </div>
  );
}
