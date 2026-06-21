"use client";

import { useMemo, useState } from "react";
import { BellPlus, SendHorizonal } from "lucide-react";
import { prepareCollectionReminder } from "@/app/(app)/dinero/actions";
import { ConfirmedPaymentForm } from "@/components/confirmed-payment-form";
import { formatCurrency } from "@/lib/format";

type InvoiceOption = {
  id: string;
  numero: string;
  concepto: string;
  pendiente: number;
  total: number;
  clientName: string;
};

export function PaymentPanel({ invoices }: { invoices: InvoiceOption[] }) {
  const payableInvoices = invoices.filter((invoice) => invoice.pendiente > 0);
  const [selectedId, setSelectedId] = useState(payableInvoices[0]?.id ?? "");
  const selected = useMemo(
    () => payableInvoices.find((invoice) => invoice.id === selectedId) ?? payableInvoices[0],
    [payableInvoices, selectedId]
  );

  if (!selected) {
    return (
      <div className="card p-4 text-sm text-slate-600">
        No hay facturas pendientes para registrar pagos o preparar recordatorios.
      </div>
    );
  }

  return (
    <section className="grid gap-4">
      <div className="grid gap-3">
        <InvoiceSelect invoices={payableInvoices} selectedId={selectedId} setSelectedId={setSelectedId} />
        <ConfirmedPaymentForm
          key={selected.id}
          facturaId={selected.id}
          numero={selected.numero}
          cliente={selected.clientName}
          pendiente={selected.pendiente}
          total={selected.total}
        />
      </div>

      <form action={prepareCollectionReminder} className="card p-4">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-obra-yellow/30 text-obra-yellowDark">
            <BellPlus size={22} />
          </span>
          <div>
            <h2 className="text-lg font-black text-obra-ink">Preparar recordatorio</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Se guarda como pendiente de confirmación. Capataz no lo envía automáticamente.
            </p>
          </div>
        </div>

        <InvoiceSelect invoices={payableInvoices} selectedId={selectedId} setSelectedId={setSelectedId} />
        <input type="hidden" name="facturaId" value={selected.id} />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label>
            <span className="label mb-1 block">Canal</span>
            <select className="field" name="canal" defaultValue="whatsapp">
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="interno">Interno</option>
            </select>
          </label>
          <label>
            <span className="label mb-1 block">Fecha y hora</span>
            <input className="field" name="fechaProgramada" type="datetime-local" />
          </label>
        </div>

        <button type="submit" className="secondary-button mt-4 w-full">
          <SendHorizonal size={18} />
          Preparar, no enviar
        </button>
      </form>
    </section>
  );
}

function InvoiceSelect({
  invoices,
  selectedId,
  setSelectedId
}: {
  invoices: InvoiceOption[];
  selectedId: string;
  setSelectedId: (value: string) => void;
}) {
  const selected = invoices.find((invoice) => invoice.id === selectedId) ?? invoices[0];

  return (
    <label>
      <span className="label mb-1 block">Factura</span>
      <select className="field" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
        {invoices.map((invoice) => (
          <option key={invoice.id} value={invoice.id}>
            {invoice.numero} · {invoice.clientName} · {formatCurrency(invoice.pendiente)} pendiente
          </option>
        ))}
      </select>
      <span className="mt-2 block text-xs font-semibold text-slate-500">
        {selected.concepto} · total {formatCurrency(selected.total)}
      </span>
    </label>
  );
}
