"use server";

import { executeNextAction } from "@/lib/platform/next-action-boundary";
import { updateAgendaEventStatus as updateAgendaEventStatusUseCase, reprogramAgendaEvent as reprogramAgendaEventUseCase } from "@/lib/application/operations/agenda-use-cases";

export async function updateAgendaEventStatus(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/agenda/actions.ts#updateAgendaEventStatus" }, () => updateAgendaEventStatusUseCase(formData));
}

export async function reprogramAgendaEvent(formData: FormData) {
  return executeNextAction({ operation: "app/(app)/agenda/actions.ts#reprogramAgendaEvent" }, () => reprogramAgendaEventUseCase(formData));
}
