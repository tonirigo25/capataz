"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, CreditCard, ShieldCheck } from "lucide-react";
import { registerPayment } from "@/app/(app)/dinero/actions";
import { AccessibleDialog } from "@/components/accessible-dialog";
import { formatCurrency } from "@/lib/format";

export function ConfirmedPaymentForm({
  facturaId,
  numero,
  cliente,
  pendiente,
  total
}: {
  facturaId: string;
  numero: string;
  cliente: string;
  pendiente: number;
  total: number;
}) {
  const [amount, setAmount] = useState(Math.min(200, pendiente).toString());
  const [method, setMethod] = useState("transferencia");
  const [type, setType] = useState("pago_parcial");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const parsedAmount = Number(amount);
  const nextPending = useMemo(() => Math.max(0, pendiente - (Number.isFinite(parsedAmount) ? parsedAmount : 0)), [parsedAmount, pendiente]);
  const nextStatus = nextPending <= 0 ? "pagada" : nextPending < total ? "parcialmente pagada" : "pendiente";

  return (
    <section className="card p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-obra-green/10 text-obra-green">
          <CreditCard size={22} />
        </span>
        <div>
          <h2 className="text-lg font-black text-obra-ink">Registrar cobro</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Primero revisas el importe. Capataz sólo actualiza la factura cuando confirmas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label mb-1 block">Importe</span>
          <input className="field" type="number" step="0.01" min="0.01" max={pendiente} value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <label>
          <span className="label mb-1 block">Método</span>
          <select className="field" value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="transferencia">Transferencia</option>
            <option value="bizum">Bizum</option>
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
          </select>
        </label>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label mb-1 block">Tipo</span>
          <select className="field" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="pago_parcial">Pago parcial</option>
            <option value="senal">Señal</option>
            <option value="pago_final">Pago final</option>
            <option value="regularizacion">Regularización</option>
          </select>
        </label>
        <label>
          <span className="label mb-1 block">Fecha</span>
          <input className="field" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
      </div>
      <div className="mt-3 grid gap-3">
        <label>
          <span className="label mb-1 block">Notas</span>
          <input className="field" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
        <p><strong className="text-obra-ink">Ahora pendiente:</strong> {formatCurrency(pendiente)}</p>
        <p><strong className="text-obra-ink">Tras confirmar:</strong> {formatCurrency(nextPending)} · estado {nextStatus}</p>
      </div>

      <button type="button" className="primary-button mt-4 w-full" onClick={() => setConfirmOpen(true)}>
        <ShieldCheck size={18} />
        Revisar y confirmar pago
      </button>

      <AccessibleDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirmar pago" description={`Vas a registrar ${formatCurrency(parsedAmount || 0)} en ${numero} de ${cliente}.`}>
            <div className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              Pendiente actualizado: {formatCurrency(nextPending)}. Estado resultante: {nextStatus}.
            </div>

            <form action={registerPayment} className="mt-4 grid gap-2">
              <input type="hidden" name="facturaId" value={facturaId} />
              <input type="hidden" name="importe" value={amount} />
              <input type="hidden" name="metodo" value={method} />
              <input type="hidden" name="tipo" value={type} />
              <input type="hidden" name="fecha" value={date} />
              <input type="hidden" name="notas" value={notes} />
              <input type="hidden" name="confirmadoPorUsuario" value="true" />
              <input type="hidden" name="redirectTo" value={`/dinero/${facturaId}`} />
              <button type="submit" className="primary-button w-full">
                <CheckCircle2 size={18} />
                Sí, registrar pago
              </button>
              <button type="button" className="secondary-button w-full" onClick={() => setConfirmOpen(false)}>
                Revisar antes
              </button>
            </form>
      </AccessibleDialog>
    </section>
  );
}
