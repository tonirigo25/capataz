"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runProactiveEvaluation } from "@/lib/proactive-evaluation";

export async function runProactiveEvaluationAction() {
  const result = await runProactiveEvaluation({ type: "manual", triggeredBy: "control_center" });
  revalidatePath("/recomendaciones/control");
  revalidatePath("/recomendaciones");
  revalidatePath("/alertas");
  revalidatePath("/hoy");
  redirect(`/recomendaciones/control?resultado=${result.locked ? "locked" : result.status}&run=${result.runId ?? ""}`);
}
