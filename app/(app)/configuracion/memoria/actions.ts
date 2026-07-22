"use server";
import { revalidatePath } from "next/cache";
import { requireCompanyContext } from "@/lib/auth/session";
import { archiveMemory, confirmMemory, rejectMemory } from "@/lib/orqena/memory-service";
export async function changeMemory(formData: FormData) { const auth = await requireCompanyContext(); const id = String(formData.get("id") ?? ""); const action = String(formData.get("action") ?? ""); if (!id) return; if (action === "confirm") await confirmMemory(auth.companyId, id, auth.userId); else if (action === "reject") await rejectMemory(auth.companyId, id); else if (action === "archive") await archiveMemory(auth.companyId, id); revalidatePath("/configuracion/memoria"); }
