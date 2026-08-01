"use client";

import { useEffect } from "react";

export type MoneyRailContextValue = {
  title: string;
  description: string;
  status: "risk" | "attention" | "stable";
  amountLabel: string;
  amount: string;
  periodLabel: string;
  periodValue: string;
  recommendations: string[];
  detailHref: string;
};

export function MoneyRailContext({
  context,
}: {
  context: MoneyRailContextValue | null;
}) {
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("orqena:money-context", { detail: context }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("orqena:money-context", { detail: null }),
      );
    };
  }, [context]);

  return null;
}
