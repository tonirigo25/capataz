"use client";

import { useEffect } from "react";

export type SupplierRailContextValue = {
  kind?: "supplier" | "subcontractor";
  supplierCount: number;
  highRiskCount: number;
  overdueExposure: number;
  overdueInvoices: number;
  qualityAverage: number | null;
  expiringDocuments?: number;
  pendingEvaluations?: number;
  pendingAmount?: number;
  affectedWorks?: number;
  attention: Array<{
    id: string;
    name: string;
    detail: string;
    href: string;
  }>;
};

export function SupplierRailContext({ value }: { value: SupplierRailContextValue }) {
  useEffect(() => {
    const publish = () => window.dispatchEvent(new CustomEvent("orqena:supplier-context", { detail: value }));
    publish();
    const frame = requestAnimationFrame(publish);
    const timer = window.setTimeout(publish, 120);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.dispatchEvent(new CustomEvent("orqena:supplier-context", { detail: null }));
    };
  }, [value]);
  return null;
}
