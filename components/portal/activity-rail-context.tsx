"use client";

import { useEffect } from "react";

export type ActivityRailContextValue = {
  lastUpdated: string | null;
  totalVisible: number;
  incidentCount: number;
  topSignal: { title: string; summary: string | null; href: string } | null;
  activeWorks: Array<{ id: string; title: string; count: number; href: string }>;
  recommendations: Array<{ id: string; title: string; href: string }>;
};

export function ActivityRailContext({ value }: { value: ActivityRailContextValue }) {
  useEffect(() => {
    let active = true;
    const publish = () => {
      if (!active) return;
      window.dispatchEvent(new CustomEvent<ActivityRailContextValue>("orqena:activity-context", { detail: value }));
    };
    publish();
    const frame = window.requestAnimationFrame(publish);
    const quick = window.setTimeout(publish, 250);
    const settled = window.setTimeout(publish, 1000);
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(quick);
      window.clearTimeout(settled);
      window.dispatchEvent(new CustomEvent<null>("orqena:activity-context", { detail: null }));
    };
  }, [value]);

  return null;
}
