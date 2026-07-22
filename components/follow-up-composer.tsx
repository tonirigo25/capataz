"use client";

import { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, MessageCircle, ShieldCheck, X } from "lucide-react";
import { scheduleBudgetFollowUp } from "@/app/(app)/clientes/actions";
import { DemoLimitButton } from "@/components/demo-limit-button";
import { formatCurrency } from "@/lib/format";

type FollowUpData = {
  clienteId: string;
  clienteNombre: string;
  obraId: string | null;
  presupuestoId: string;
  presupuestoNumero: string;
  presupuestoTitulo: string;
  presupuestoTotal: number;
  initialMessage?: string | null;
};

export function FollowUpComposer({
  data,
  initialDateTime
  , demoLimit
}: {
  data: FollowUpData;
  initialDateTime: string;
  demoLimit?: { currentCount: number; limit: number };
}) {
  const [draftOpen, setDraftOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState(
    data.initialMessage ??
      `Hola ${data.clienteNombre.split(" ")[0]}, te escribo para saber si pudiste revisar el presupuesto ${data.presupuestoNumero} de ${data.presupuestoTitulo}. Si quieres ajustamos fechas o partidas.`
  );
  const [dateTime, setDateTime] = useState(initialDateTime);

  const formattedDate = useMemo(() => new Date(dateTime).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }), [dateTime]);

  return (
    <section className="card p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-obra-yellow/30 text-obra-yellowDark">
          <MessageCircle size={22} />
        </span>
        <div>
          <h2 className="text-lg font-black text-obra-ink">Seguimiento por WhatsApp</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Orqena prepara el mensaje. Revísalo y confirma antes de programarlo.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
        <p><strong className="text-obra-ink">Presupuesto:</strong> {data.presupuestoNumero} · {formatCurrency(data.presupuestoTotal)}</p>
        <p className="mt-1"><strong className="text-obra-ink">Estado:</strong> enviado, pendiente de respuesta</p>
      </div>

      {!draftOpen ? (
        <button type="button" className="primary-button mt-4 w-full" onClick={() => setDraftOpen(true)}>
          <MessageCircle size={18} />
          Preparar seguimiento
        </button>
      ) : (
        <div className="mt-4 grid gap-3">
          <label>
            <span className="label mb-1 block">Mensaje redactado</span>
            <textarea
              className="field min-h-32 py-3 leading-6"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="label mb-1 block">Canal</span>
              <input className="field" value="WhatsApp" readOnly />
            </label>
            <label>
              <span className="label mb-1 block">Fecha y hora</span>
              <input
                className="field"
                type="datetime-local"
                value={dateTime}
                onChange={(event) => setDateTime(event.target.value)}
              />
            </label>
          </div>
          <div className="rounded-lg border border-obra-yellowDark/20 bg-obra-yellow/20 p-3 text-sm leading-6 text-obra-yellowDark">
            Confirmar programa el recordatorio para {formattedDate}. No envía el mensaje fuera de la app.
          </div>
          <DemoLimitButton
            className="primary-button w-full"
            currentCount={demoLimit?.currentCount}
            limit={demoLimit?.limit}
            icon={ShieldCheck}
            onAllowed={() => setConfirmOpen(true)}
          >
            Confirmar y programar
          </DemoLimitButton>
        </div>
      )}

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-obra-ink/50 p-4 sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-card">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-obra-ink">Confirmar seguimiento</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Se guardará como programado para {formattedDate}. WhatsApp real sigue desactivado.
                </p>
              </div>
              <button type="button" className="icon-button shrink-0" aria-label="Cerrar" onClick={() => setConfirmOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{message}</div>

            <form action={scheduleBudgetFollowUp} className="mt-4 grid gap-2">
              <input type="hidden" name="clienteId" value={data.clienteId} />
              <input type="hidden" name="presupuestoId" value={data.presupuestoId} />
              <input type="hidden" name="obraId" value={data.obraId ?? ""} />
              <input type="hidden" name="canal" value="whatsapp" />
              <input type="hidden" name="mensaje" value={message} />
              <input type="hidden" name="fechaProgramada" value={dateTime} />
              <input type="hidden" name="confirmadoPorUsuario" value="true" />
              <button type="submit" className="primary-button w-full">
                <CheckCircle2 size={18} />
                Sí, programarlo
              </button>
              <button type="button" className="secondary-button w-full" onClick={() => setConfirmOpen(false)}>
                Revisar antes
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
