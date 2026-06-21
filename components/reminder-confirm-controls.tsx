"use client";

import { useState } from "react";
import { Ban, CheckCircle2, ShieldCheck, X } from "lucide-react";
import { cancelReminder, confirmReminder, markReminderDone } from "@/app/(app)/recordatorios/actions";

export function ReminderConfirmControls({
  id,
  title,
  message,
  scheduledLabel
}: {
  id: string;
  title: string;
  message: string;
  scheduledLabel: string;
}) {
  const [mode, setMode] = useState<"confirm" | "cancel" | "done" | null>(null);

  return (
    <>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button type="button" className="primary-button w-full" onClick={() => setMode("confirm")}>
          <ShieldCheck size={18} />
          Programar
        </button>
        <button type="button" className="secondary-button w-full" onClick={() => setMode("cancel")}>
          <Ban size={18} />
          Cancelar
        </button>
        <button type="button" className="secondary-button w-full" onClick={() => setMode("done")}>
          <CheckCircle2 size={18} />
          Realizado
        </button>
      </div>

      {mode ? (
        <div className="fixed inset-0 z-50 flex items-end bg-obra-ink/50 p-4 sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-card">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-obra-ink">
                  {mode === "confirm" ? "Confirmar programación" : mode === "cancel" ? "Confirmar cancelación" : "Confirmar realizado"}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {mode === "confirm"
                    ? `Se dejará programado para ${scheduledLabel}. No se envía ningún mensaje real.`
                    : mode === "cancel"
                      ? `Se cancelará este recordatorio de ${title}.`
                      : `Se marcará este recordatorio de ${title} como realizado.`}
                </p>
              </div>
              <button type="button" className="icon-button shrink-0" aria-label="Cerrar" onClick={() => setMode(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{message}</div>

            <form action={mode === "confirm" ? confirmReminder : mode === "cancel" ? cancelReminder : markReminderDone} className="mt-4 grid gap-2">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="confirmadoPorUsuario" value="true" />
              <button type="submit" className={mode === "confirm" || mode === "done" ? "primary-button w-full" : "secondary-button w-full"}>
                {mode === "cancel" ? <Ban size={18} /> : <CheckCircle2 size={18} />}
                {mode === "confirm" ? "Sí, programarlo" : mode === "cancel" ? "Sí, cancelarlo" : "Sí, marcar realizado"}
              </button>
              <button type="button" className="secondary-button w-full" onClick={() => setMode(null)}>
                Revisar antes
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
