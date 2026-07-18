import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const client = read("app/(app)/clientes/[id]/page.tsx");
const clients = read("app/(app)/clientes/page.tsx");
const work = read("app/(app)/obras/[id]/page.tsx");
const works = read("app/(app)/obras/page.tsx");
const gallery = read("components/work-progress-gallery.tsx");
const dialog = read("components/accessible-dialog.tsx");
const workflow = read("components/entity-workflow-summary.tsx");
const crm = read("lib/client-crm.ts");
const forms = read("app/(app)/gestion/page.tsx");
const schema = read("prisma/schema.prisma");

const cases = [];
const check = (name, condition) => cases.push([name, Boolean(condition)]);
const ordered = (source, tokens) => {
  const indexes = tokens.map((token) => source.indexOf(token));
  return indexes.every((index) => index >= 0) && indexes.every((index, position) => position === 0 || index > indexes[position - 1]);
};

check("cliente expone cinco áreas exactas", (client.match(/^  \["(resumen|obras|dinero|actividad|archivos)"/gm) ?? []).length === 5);
check("cliente abre Resumen por defecto", client.includes(': "resumen");') && client.includes('requestedView'));
check("cliente usa ParentNavigation y EntityHeader", client.includes("<EntityHeader") && client.includes('<ParentNavigation href="/clientes"'));
check("cliente conserva una sola acción primaria", client.includes("> Crear obra</Link>") && client.includes("menu={<ClientActions"));
check("cliente consolida obras y dinero", client.includes('<WorksTab') && ordered(client, ["<BudgetsTab", "<InvoicesTab", "<PaymentsTab", "<ClientFinanceTab"]));
check("cliente agrega actividad, notas, fotos y archivos de obras", client.includes("<ActivityTab") && client.includes("<NotesTab") && crm.includes("work.photos") && crm.includes("work.repositoryDocuments"));
check("cliente limita resumen ejecutivo", client.includes("xl:grid-cols-4") && !client.includes("xl:grid-cols-6"));
check("cliente conserva mapa heredado explícito", ["contactos", "presupuestos", "facturas", "pagos", "finanzas", "visitas", "documentos", "notas", "datos"].every((tab) => crm.length > 0 && client.includes(`${tab}:`)));
check("listado de clientes prioriza próxima acción", clients.includes("Próxima acción") && clients.includes("client.nextAction") && clients.includes("client.activeWorksCount") && clients.includes("client.pendingTotal"));

check("obra expone seis áreas exactas", (work.match(/^  \["(resumen|progreso|dinero|planificacion|archivos|equipo)"/gm) ?? []).length === 6);
check("obra abre Resumen por defecto", work.includes(': "resumen");') && work.includes("requestedView"));
check("obra usa ParentNavigation y EntityHeader", work.includes("<EntityHeader") && work.includes('<ParentNavigation href="/obras"'));
check("obra ofrece Registrar avance como acción principal", work.includes("Registrar avance") && work.includes("menu={<WorkActions"));
check("Progreso conserva modo en URL", work.includes("modo=cronologia") && work.includes("modo=galeria") && work.includes('query.modo === "galeria"'));
check("Progreso integra cronología, galería y notas", work.includes("TimelineList") && work.includes("WorkProgressGallery") && work.includes("<NotesTab"));
check("galería usa miniaturas reales y carga diferida", gallery.includes("<img") && gallery.includes('loading="lazy"') && gallery.includes("aspect-[4/3]"));
check("visor permite anterior, siguiente y teclado", gallery.includes("ArrowLeft") && gallery.includes("ArrowRight") && gallery.includes("Anterior") && gallery.includes("Siguiente"));
check("visor cierra, restaura foco y atrapa Tab", dialog.includes('event.key === "Escape"') && dialog.includes("previousFocus.current?.focus()") && dialog.includes('event.key !== "Tab"'));
check("visor bloquea scroll y respeta safe area", dialog.includes('document.body.style.overflow = "hidden"') && dialog.includes("safe-area-inset-bottom"));
check("fotografías filtran URLs seguras", work.includes('photo.url.startsWith("/")') && work.includes('photo.url.startsWith("https://")'));
check("incidencias reutilizan categoría existente", crm.includes('photo.categoria === "incidencia"') && schema.includes("model WorkPhoto"));
check("Dinero conserva cálculos existentes", work.includes("calculateWorkFinancials(work)") && work.includes("WorkTreasuryTab") && work.includes("SubcontractTab"));
check("Planificación integra agenda y recordatorios", work.includes('activeTab === "planificacion"') && work.includes("work.agendaEvents") && work.includes("work.reminders"));
check("Archivos y Equipo permanecen accesibles", work.includes('activeTab === "archivos"') && work.includes('activeTab === "equipo"'));
check("Capataz es contextual y no pestaña", work.includes("<AiTab") && !work.match(/^  \["ia"/m));
check("obra conserva mapa heredado explícito", ["fotografias", "cronologia", "tesoreria", "materiales", "subcontratas", "configuracion"].every((tab) => work.includes(`${tab}:`)));
check("no se inventa porcentaje físico", !work.includes("porcentajeAvance") && !work.includes("progresoFisico"));
check("listado de obras prioriza filas y riesgo real", works.includes(': "tabla"') && works.includes("Última actualización") && works.includes("item.hasRisk") && works.includes("item.nextAction.label"));

check("consultas de entidad derivan companyId de sesión", client.includes("requireCompanyContext") && work.includes("requireCompanyContext") && workflow.includes("requireCompanyContext"));
check("tareas y seguimientos están aislados por companyId", workflow.includes("where: { companyId, ...entityWhere"));
check("cliente y obra por ID están company-scoped", crm.includes("where: { id, companyId }") && work.includes("where: { id, companyId }"));
check("formularios mantienen orden semántico y targets", forms.includes("Identidad del cliente") && forms.includes("Contacto operativo") && forms.includes("Fiscal y condiciones comerciales") && forms.includes("StickyFormActions"));
check("navegación secundaria usa URL, aria-current y targets", client.includes("?vista=${tab}") && work.includes("?vista=${id}") && client.includes("aria-current") && work.includes("aria-current"));
check("composición responsive cubre móvil, tablet y escritorio", gallery.includes("grid-cols-2") && gallery.includes("sm:grid-cols-3") && gallery.includes("xl:grid-cols-4") && work.includes("xl:grid-cols"));

let failed = 0;
for (const [name, ok] of cases) {
  if (ok) console.log("[client-work-operating-system] OK", name);
  else { failed += 1; console.error("[client-work-operating-system] FAIL", name); }
}
console.log(`[client-work-operating-system] ${cases.length - failed}/${cases.length}`);
if (failed) process.exit(1);
