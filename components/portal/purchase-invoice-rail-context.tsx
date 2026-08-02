"use client";

import { useEffect } from "react";

export type PurchaseInvoiceRailContextValue = {
  visibleCount: number;
  overdueCount: number;
  overdueAmount: number;
  pendingAmount: number;
  unassignedCount: number;
  attention: Array<{ id: string; title: string; detail: string; href: string }>;
};

export function PurchaseInvoiceRailContext({ value }: { value: PurchaseInvoiceRailContextValue }) {
  useEffect(() => {
    const publish = () => window.dispatchEvent(new CustomEvent("orqena:purchase-invoice-context", { detail: value }));
    publish();
    const frame = requestAnimationFrame(publish);
    const timer = window.setTimeout(publish, 120);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.dispatchEvent(new CustomEvent("orqena:purchase-invoice-context", { detail: null }));
    };
  }, [value]);
  return null;
}
