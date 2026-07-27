"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/format";

type PreviewLine = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

type PreviewSnapshot = {
  lines: PreviewLine[];
  subtotal: number;
};

function readEditorSnapshot(editor: HTMLElement, fallback: PreviewSnapshot) {
  const forms = Array.from(editor.querySelectorAll<HTMLFormElement>("[data-budget-line]"));
  const lines = forms.flatMap((form) => {
    const description = form.querySelector<HTMLInputElement>('[name="descripcion"]')?.value.trim() ?? "";
    const quantity = Number(form.querySelector<HTMLInputElement>('[name="cantidad"]')?.value ?? 0);
    const unit = form.querySelector<HTMLSelectElement>('[name="unidad"]')?.value ?? "ud";
    const unitPrice = Number(form.querySelector<HTMLInputElement>('[name="precioUnitario"]')?.value ?? 0);
    if (!description) return [];
    return [{ description, quantity: Number.isFinite(quantity) ? quantity : 0, unit, unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0 }];
  });
  if (!lines.length) return fallback;
  return {
    lines,
    subtotal: lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0),
  };
}

export function BudgetLivePreview({
  budgetNumber,
  companyName,
  clientName,
  title,
  initialLines,
  initialSubtotal,
  initialTax,
  initialDiscount,
}: {
  budgetNumber: string;
  companyName: string;
  clientName: string;
  title: string;
  initialLines: PreviewLine[];
  initialSubtotal: number;
  initialTax: number;
  initialDiscount: number;
}) {
  const fallbackRef = useRef<PreviewSnapshot>({ lines: initialLines, subtotal: initialSubtotal });
  const fallback = fallbackRef.current;
  const [snapshot, setSnapshot] = useState<PreviewSnapshot>(fallback);

  useEffect(() => {
    const editor = document.getElementById("budget-line-editor");
    if (!editor) return;
    const refresh = (event?: Event) => {
      if (event?.target instanceof Element && !event.target.closest("#budget-line-editor")) return;
      setSnapshot(readEditorSnapshot(editor, fallback));
    };
    refresh();
    document.addEventListener("input", refresh, true);
    document.addEventListener("change", refresh, true);
    return () => {
      document.removeEventListener("input", refresh, true);
      document.removeEventListener("change", refresh, true);
    };
  }, [fallback]);

  const taxRate = initialSubtotal > 0 ? initialTax / initialSubtotal : 0;
  const tax = snapshot.subtotal * taxRate;
  const total = Math.max(0, snapshot.subtotal + tax - initialDiscount);

  return (
    <aside className="budget-live-preview" aria-label="Vista previa viva del presupuesto" data-preview-subtotal={snapshot.subtotal}>
      <div className="budget-live-preview__paper">
        <header className="flex items-start justify-between gap-4 border-b-2 border-content pb-5">
          <div>
            <p className="type-object-title text-content">Orqena</p>
            <p className="type-meta mt-1">{companyName}</p>
          </div>
          <div className="text-right">
            <p className="type-section-title text-content">PRESUPUESTO</p>
            <p className="type-object-title mt-1 text-content">{budgetNumber}</p>
          </div>
        </header>

        <div className="py-5">
          <p className="type-meta">Cliente</p>
          <p className="type-object-title mt-1 text-content">{clientName}</p>
          <p className="type-secondary mt-1">{title}</p>
        </div>

        <div className="divide-y divide-border border-y border-border">
          {snapshot.lines.length ? snapshot.lines.map((line, index) => (
            <div key={`${line.description}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-content">{line.description}</span>
                <span className="type-meta mt-1 block">{line.quantity} {line.unit} × {formatCurrency(line.unitPrice)}</span>
              </span>
              <strong className="tabular text-content">{formatCurrency(line.quantity * line.unitPrice)}</strong>
            </div>
          )) : (
            <p className="type-secondary py-5">Añade una partida para completar la vista previa.</p>
          )}
        </div>

        <dl className="ml-auto mt-5 grid max-w-xs gap-2 text-sm">
          <div className="flex justify-between gap-5"><dt className="text-content-secondary">Base</dt><dd className="tabular font-semibold text-content">{formatCurrency(snapshot.subtotal)}</dd></div>
          <div className="flex justify-between gap-5"><dt className="text-content-secondary">IVA</dt><dd className="tabular font-semibold text-content">{formatCurrency(tax)}</dd></div>
          {initialDiscount > 0 ? <div className="flex justify-between gap-5"><dt className="text-content-secondary">Descuento</dt><dd className="tabular font-semibold text-content">−{formatCurrency(initialDiscount)}</dd></div> : null}
          <div className="flex justify-between gap-5 border-t-2 border-content pt-2 text-lg"><dt className="font-semibold text-content">Total</dt><dd className="tabular font-semibold text-content">{formatCurrency(total)}</dd></div>
        </dl>
      </div>
      <p className="type-meta mt-3">La vista previa refleja los campos visibles. El PDF oficial conserva su generador, numeración y cálculos existentes.</p>
    </aside>
  );
}
