"use client";

import { useEffect } from "react";

export type AlertsRailContextValue = {
  mode?: "alerts" | "notifications";
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
    let active = true;
    const publish = () => {
      if (!active) return;
      window.dispatchEvent(new CustomEvent<AlertsRailContextValue>("orqena:alerts-context", { detail: value }));
    };

    publish();
    const frame = window.requestAnimationFrame(publish);
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      window.dispatchEvent(new CustomEvent<null>("orqena:alerts-context", { detail: null }));
    };
  }, [value]);

  return null;
}
