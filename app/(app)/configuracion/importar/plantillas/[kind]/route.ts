import { publicRequestContext } from "@/lib/platform/request-boundary";
import { requireCompanyRole } from "@/lib/auth/session";
import { buildImportTemplate, getImportDefinition } from "@/lib/product/import-catalog";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ kind: string }> }) {
  return publicRequestContext("GET /configuracion/importar/plantillas/[kind]", request, async () => {
    await requireCompanyRole(["OWNER", "ADMIN"]);
    const { kind } = await context.params;
    const definition = getImportDefinition(kind.toUpperCase());
    if (!definition) return new Response("Plantilla no disponible", { status: 404, headers: privateHeaders() });

    return new Response(`\uFEFF${buildImportTemplate(definition.kind)}`, {
      headers: {
        ...privateHeaders(),
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orqena-plantilla-${definition.slug}.csv"`,
      },
    });
  });
}

function privateHeaders() {
  return {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
}
