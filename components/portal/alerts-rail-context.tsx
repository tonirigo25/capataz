"use client";

import { useEffect } from "react";

export type AlertsRailContextValue = {
  activeCritical: number;
  activeTotal: number;
  topTitle: string | null;
  topDescription: string | null;
  topAmount: number | null;
  topHref: string | null;
  actions: Array<{ id: string; title: string; href: string }>;
};

export function AlertsRailContext({ value }: { value: AlertsRailContextValue }) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent<AlertsRailContextValue>("orqena:alerts-context", { detail: value }));
    return () => {
      window.dispatchEvent(new CustomEvent<null>("orqena:alerts-context", { detail: null }));
    };
  }, [value]);

  return null;
}
