"use client";

import { useEffect } from "react";

export type BudgetRailContextValue = {
  id: string;
  numero: string;
  title: string;
  client: string;
  status: string;
  margin: string | null;
  total: string | null;
  lineCount: number;
  reviewHref: string;
  editHref: string | null;
};

export function BudgetRailContext({ context }: { context: BudgetRailContextValue | null }) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("orqena:budget-context", { detail: context }));
    return () => {
      window.dispatchEvent(new CustomEvent("orqena:budget-context", { detail: null }));
    };
  }, [context]);

  return null;
}
