import { invalidateActionPath as revalidatePath, navigateAction as redirect } from "@/lib/application/action-effects";
import { runProactiveEvaluation } from "@/lib/proactive-evaluation";
import { requireCapability } from "@/lib/commercial/authorization";

export async function runProactiveEvaluationAction() {
  const auth = await requireCapability("orqena.execute");
  const result = await runProactiveEvaluation({ type: "manual", triggeredBy: "control_center", scope: { companyId: auth.companyId } });
  revalidatePath("/recomendaciones/control");
  revalidatePath("/recomendaciones");
  revalidatePath("/alertas");
  revalidatePath("/hoy");
  redirect(`/recomendaciones/control?resultado=${result.locked ? "locked" : result.status}&run=${result.runId ?? ""}`);
}
