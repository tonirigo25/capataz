"use client";

import { useState } from "react";
import { Ban, CalendarClock, CheckCircle2, X } from "lucide-react";
import { reprogramAgendaEvent, updateAgendaEventStatus } from "@/app/(app)/agenda/actions";

type Mode = "realizado" | "cancelado" | "reprogramado";

export function AgendaEventControls({
  id,
  title,
  currentDateTime
}: {
  id: string;
  title: string;
  currentDateTime: string;
}) {
  const [mode, setMode] = useState<Mode | null>(null);

  return (
    <>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button type="button" className="secondary-button w-full" onClick={() => setMode("reprogramado")}>
          <CalendarClock size={18} />
          Reprogramar
        </button>
        <button type="button" className="secondary-button w-full" onClick={() => setMode("realizado")}>
          <CheckCircle2 size={18} />
          Realizado
        </button>
        <button type="button" className="secondary-button w-full" onClick={() => setMode("cancelado")}>
          <Ban size={18} />
          Cancelar
        </button>
      </div>

      {mode ? (
        <div className="fixed inset-0 z-50 flex items-end bg-obra-ink/50 p-4 sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-card">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-obra-ink">{modalTitle(mode)}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Esta acción sólo cambia la agenda interna. No se envía WhatsApp, email ni aviso externo.
                </p>
              </div>
              <button type="button" className="icon-button shrink-0" aria-label="Cerrar" onClick={() => setMode(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-sm font-semibold leading-6 text-obra-ink">{title}</div>

            {mode === "reprogramado" ? (
              <form action={reprogramAgendaEvent} className="mt-4 grid gap-3">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="confirmadoPorUsuario" value="true" />
                <label>
                  <span className="label mb-1 block">Nueva fecha/hora</span>
                  <input className="field" name="fechaInicio" type="datetime-local" defaultValue={currentDateTime} required />
                </label>
                <label>
                  <span className="label mb-1 block">Fin opcional</span>
                  <input className="field" name="fechaFin" type="datetime-local" />
                </label>
                <button type="submit" className="primary-button w-full">
                  <CalendarClock size={18} />
                  Confirmar reprogramación
                </button>
                <button type="button" className="secondary-button w-full" onClick={() => setMode(null)}>
                  Revisar antes
                </button>
              </form>
            ) : (
              <form action={updateAgendaEventStatus} className="mt-4 grid gap-2">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="estado" value={mode} />
                <input type="hidden" name="confirmadoPorUsuario" value="true" />
                <button type="submit" className={mode === "cancelado" ? "secondary-button w-full" : "primary-button w-full"}>
                  {mode === "cancelado" ? <Ban size={18} /> : <CheckCircle2 size={18} />}
                  {mode === "cancelado" ? "Sí, cancelarlo" : "Sí, marcar realizado"}
                </button>
                <button type="button" className="secondary-button w-full" onClick={() => setMode(null)}>
                  Revisar antes
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function modalTitle(mode: Mode) {
  if (mode === "realizado") return "Confirmar realizado";
  if (mode === "cancelado") return "Confirmar cancelación";
  return "Confirmar reprogramación";
}
