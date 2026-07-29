"use client";

import { useActionState } from "react";
import { processOutbox } from "@/app/(app)/equipo/actions";

export function LocalOutboxProcessor({ outboxId, label = "Procesar de forma local" }: { outboxId: string; label?: string }) {
  const [state, action, pending] = useActionState(processOutbox, { previewHtml: null });
  return <div><form action={action}><input type="hidden" name="outboxId" value={outboxId}/><button className="secondary-button" disabled={pending}>{pending ? "Procesando…" : label}</button></form>{state.previewHtml ? <div className="prose mt-3 rounded-lg border border-border bg-subtle p-3 text-sm"><p className="font-semibold">Vista transitoria: el token no se almacena.</p><div dangerouslySetInnerHTML={{ __html: state.previewHtml }}/></div> : null}</div>;
}
