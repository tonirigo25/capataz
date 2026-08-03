"use client";

import { useEffect } from "react";

export type TeamRailContextValue = {
  activeCount: number;
  totalCount: number;
  selected: {
    name: string;
    email: string;
    role: string;
    area: string;
    access: string;
    status: string;
    lastAccess: string;
    workload: string;
    canEdit: boolean;
    editHref: string | null;
    portalHref: string | null;
  } | null;
};

export function TeamRailContext({ context }: { context: TeamRailContextValue }) {
  useEffect(() => {
    let active = true;
    const publish = () => {
      if (!active) return;
      window.dispatchEvent(new CustomEvent("orqena:team-context", { detail: context }));
    };

    publish();
    const frame = window.requestAnimationFrame(publish);
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      window.dispatchEvent(new CustomEvent("orqena:team-context", { detail: null }));
    };
  }, [context]);

  return null;
}
