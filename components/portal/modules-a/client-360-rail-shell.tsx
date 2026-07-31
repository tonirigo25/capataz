"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import { ChevronsRight, Sparkles } from "lucide-react";

const STORAGE_KEY = "orqena.client360.rail-collapsed";

export function Client360RailShell({
  children,
}: {
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useLayoutEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      setCollapsed(false);
    }
  }, []);

  const toggle = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // El rail sigue siendo funcional aunque el navegador bloquee storage.
      }
      return next;
    });
  };

  return (
    <aside
      className="client-360-rail-shell min-w-0 self-stretch border-t border-border bg-surface"
      data-client-360-rail
      data-collapsed={collapsed ? "true" : "false"}
      aria-label="Contexto de Orqena IA"
    >
      <button
        type="button"
        onClick={toggle}
        className="flex min-h-16 w-full items-center justify-between gap-3 border-b border-border px-5 font-semibold text-content"
        aria-expanded={!collapsed}
        aria-controls="client-360-ai-context"
      >
        <span className="inline-flex items-center gap-2">
          <Sparkles size={18} className="text-brand-strong" aria-hidden="true" />
          <span className="client-360-rail-shell__label">Orqena IA</span>
        </span>
        <ChevronsRight
          size={18}
          className={`text-content-secondary transition-transform ${collapsed ? "" : "rotate-180"}`}
          aria-hidden="true"
        />
        <span className="sr-only">
          {collapsed ? "Mostrar contexto de Orqena IA" : "Ocultar contexto de Orqena IA"}
        </span>
      </button>
      {collapsed ? null : children}
    </aside>
  );
}
