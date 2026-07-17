"use client";

import { useState } from "react";
import { Ban, CalendarClock, CheckCircle2 } from "lucide-react";
import { reprogramAgendaEvent, updateAgendaEventStatus } from "@/app/(app)/agenda/actions";
import { AccessibleDialog } from "@/components/accessible-dialog";

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

      <AccessibleDialog open={Boolean(mode)} onClose={() => setMode(null)} title={mode ? modalTitle(mode) : "Actualizar evento"} description="Esta acción sólo cambia la agenda interna. No se envía WhatsApp, email ni aviso externo.">
          {mode ? <>
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
          </> : null}
      </AccessibleDialog>
    </>
  );
}

function modalTitle(mode: Mode) {
  if (mode === "realizado") return "Confirmar realizado";
  if (mode === "cancelado") return "Confirmar cancelación";
  return "Confirmar reprogramación";
}
