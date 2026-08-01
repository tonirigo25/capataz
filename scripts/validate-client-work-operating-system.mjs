import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const client = read("app/(app)/clientes/[id]/page.tsx");
const clientCanonical = read("components/portal/modules-a/client-360-canonical.tsx");
const clientRestricted = read("components/portal/modules-a/client-360-restricted.tsx");
const clientRail = read("components/portal/modules-a/client-360-rail-shell.tsx");
const styles = read("app/globals.css");
const clients = read("app/(app)/clientes/page.tsx");
const clientFilters = read("components/clients/client-filter-bar.tsx");
const clientSplit = read("components/clients/client-split-view.tsx");
const contextDrawer = read("components/context-drawer.tsx");
const work = read("app/(app)/obras/[id]/page.tsx");
const works = read("app/(app)/obras/page.tsx");
const gallery = read("components/work-progress-gallery.tsx");
const dialog = read("components/accessible-dialog.tsx");
const workflow = read("components/entity-workflow-summary.tsx");
const crm = read("lib/client-crm.ts");
const forms = read("app/(app)/gestion/page.tsx");
const chrome = read("components/app-chrome.tsx");
const contextRail = read("components/portal/orqena-context-rail.tsx");
const management = read("lib/application/operations/management-use-cases.ts");
const pwa = read("app/pwa-register.tsx");
const schema = read("prisma/schema.prisma");

const cases = [];
const check = (name, condition) => cases.push([name, Boolean(condition)]);
const ordered = (source, tokens) => {
  const indexes = tokens.map((token) => source.indexOf(token));
  return indexes.every((index) => index >= 0) && indexes.every((index, position) => position === 0 || index > indexes[position - 1]);
};

check(
  "cliente expone los ocho submenús 360 canónicos exactos",
  (client.match(/^  \{ id: "(resumen|obras|oportunidades|actividad|presupuestos|facturas|conversaciones|documentos)"/gm) ?? []).length === 8 &&
    (clientCanonical.match(/^  "(resumen|obras|oportunidades|actividad|presupuestos|facturas|conversaciones|documentos)",/gm) ?? []).length === 8,
);
check("cliente abre Resumen por defecto", client.includes(': "resumen");') && client.includes('requestedView'));
check(
  "cliente conserva cabecera y navegación canónicas en acceso completo o restringido",
  client.includes("<Client360Canonical") &&
    client.includes("<Client360Restricted") &&
    clientCanonical.includes("Cliente 360") &&
    clientCanonical.includes("href={hrefs.back}") &&
    clientRestricted.includes("Cliente 360") &&
    clientRestricted.includes('href="/clientes"'),
);
check("cliente conserva acciones contextuales reales", clientCanonical.includes("nextAction.actionLabel") && clientCanonical.includes("hrefs.newOpportunity") && client.includes("<ClientActions"));
check("insights de cliente quedan aislados por cliente u obra autorizada", client.includes("const scopedSignals") && client.includes("signal.entity.clientId === client.id") && client.includes("clientWorkIds.has(signal.entity.workId)"));
check("rail de Cliente 360 se oculta, expande y persiste sin scroll propio", clientRail.includes("localStorage.setItem") && clientRail.includes('data-collapsed={collapsed ? "true" : "false"}') && styles.includes('.client-360-canonical:has(> [data-client-360-rail][data-collapsed="true"])'));
check("rail de Cliente 360 cambia con la vista sin reutilizar señales no relacionadas", client.includes("signalMatchesClientView") && client.includes("const activeSignal") && clientCanonical.includes("recommendationMatchesView") && clientCanonical.includes("railEmptyCopy[activeView]"));
check("Cliente 360 elimina la columna global vacía desde tablet horizontal", styles.includes('@media (min-width: 900px)') && styles.includes('.field-os-workspace[data-embedded-context="client"]'));
check("cliente consolida obras y dinero", client.includes('<WorksTab') && ordered(client, ["<BudgetsTab", "<InvoicesTab", "<PaymentsTab", "<ClientFinanceTab"]));
check("cliente agrega actividad, notas, fotos y archivos de obras", client.includes("<ActivityTab") && client.includes("<NotesTab") && crm.includes("work.photos") && crm.includes("work.repositoryDocuments"));
check("cliente limita resumen ejecutivo", client.includes("xl:grid-cols-4") && !client.includes("xl:grid-cols-6"));
check("cliente conserva mapa heredado explícito", ["obras", "archivos", "dinero", "presupuestos", "facturas", "pagos", "finanzas", "visitas", "notas"].every((tab) => crm.length > 0 && client.includes(`${tab}:`)));
check("listado de clientes prioriza próxima acción", clients.includes("toWorkspaceItem") && clients.includes("nextAction") && clients.includes("activeWorksCount") && clients.includes("pendingTotal"));
check("listado ofrece seis vistas inteligentes, búsqueda y filtros en sheet", ["Todos", "Seguimiento", "Presupuesto abierto", "Trabajo activo", "Cobro pendiente", "En riesgo"].every((label) => clientFilters.includes(label)) && clientFilters.includes("<FilterSheet") && clientFilters.includes('type="search"'));
check("desktop usa split 420-480 y móvil evita tabla", clientSplit.includes("data-client-list-split") && clientSplit.includes("data-client-mobile-cards") && !clientSplit.includes("<table"));
check("preview cambia por click y foco sin perder deep link", clientSplit.includes("onClick={onSelect}") && clientSplit.includes("onFocusCapture={onSelect}") && clientSplit.includes("Abrir ficha completa"));
check("context drawer conserva Escape, cierre y foco", contextDrawer.includes('event.key === "Escape"') && contextDrawer.includes("opener.current?.focus()") && contextDrawer.includes('aria-modal="true"'));

check("obra expone siete áreas 360 exactas", (work.match(/^  \["(resumen|progreso|planificacion|equipo|documentos|datos|economia)"/gm) ?? []).length === 7);
check("obra abre Resumen por defecto", work.includes(': "resumen");') && work.includes("requestedView"));
check("obra usa ParentNavigation y EntityHeader", work.includes("<EntityHeader") && work.includes('<ParentNavigation href="/obras"'));
check("obra ofrece Registrar avance como acción principal", work.includes("Registrar avance") && work.includes("menu={<WorkActions"));
check("Progreso conserva modo en URL", work.includes("modo=cronologia") && work.includes("modo=galeria") && work.includes('query.modo === "galeria"'));
check("Progreso integra cronología, galería y notas", work.includes("TimelineList") && work.includes("WorkProgressGallery") && work.includes("<NotesTab"));
check("galería usa miniaturas reales y carga diferida", gallery.includes("<Image") && gallery.includes("aspect-[4/3]") && !gallery.includes('priority'));
check("visor permite anterior, siguiente y teclado", gallery.includes("ArrowLeft") && gallery.includes("ArrowRight") && gallery.includes("Anterior") && gallery.includes("Siguiente"));
check("visor cierra, restaura foco y atrapa Tab", dialog.includes('event.key === "Escape"') && dialog.includes("previousFocus.current?.focus()") && dialog.includes('event.key !== "Tab"'));
check("visor bloquea scroll y respeta safe area", dialog.includes('document.body.style.overflow = "hidden"') && dialog.includes("safe-area-inset-bottom"));
check("fotografías filtran URLs seguras", work.includes('photo.url.startsWith("/")') && work.includes('photo.url.startsWith("https://")'));
check("incidencias reutilizan categoría existente", crm.includes('photo.categoria === "incidencia"') && schema.includes("model WorkPhoto"));
check("Dinero conserva cálculos existentes", work.includes("calculateWorkFinancials(work)") && work.includes("WorkTreasuryTab") && work.includes("SubcontractTab"));
check("Planificación integra agenda y recordatorios", work.includes('activeTab === "planificacion"') && work.includes("work.agendaEvents") && work.includes("work.reminders"));
check("Documentos y Equipo permanecen accesibles", work.includes('activeTab === "documentos"') && work.includes('activeTab === "equipo"'));
check("Capataz es contextual y no pestaña", work.includes("<AiTab") && !work.match(/^  \["ia"/m));
check("obra conserva mapa heredado explícito", ["fotografias", "cronologia", "tesoreria", "materiales", "subcontratas", "configuracion"].every((tab) => work.includes(`${tab}:`)));
check("no se inventa porcentaje físico", !work.includes("porcentajeAvance") && !work.includes("progresoFisico"));
check("listado de obras prioriza filas y riesgo real", works.includes(': "tabla"') && works.includes("Última actualización") && works.includes("item.hasRisk") && works.includes("item.nextAction.label"));

check("consultas de entidad derivan companyId de sesión", client.includes("requireCapability") && work.includes("requireCapability") && workflow.includes("requireCompanyContext"));
check("tareas y seguimientos están aislados por companyId", workflow.includes("where: { companyId, ...entityWhere"));
check("cliente y obra por ID están company-scoped", crm.includes("where: { id, companyId }") && work.includes("where: { id, companyId: auth.companyId }"));
check("formularios mantienen orden semántico y targets", forms.includes("Identidad del cliente") && forms.includes("Contacto operativo") && forms.includes("Fiscal y condiciones comerciales") && forms.includes("StickyFormActions"));
check("Editar cliente usa identidad, métricas y formulario responsive canónico", forms.includes("client-edit-reference__identity") && forms.includes("client-edit-reference__field-grid--three") && styles.includes(".client-edit-reference__identity") && styles.includes("@media (max-width: 767px)"));
check(
  "Editar cliente expone los ocho submenús canónicos con destinos reales",
  (forms.match(/^  \["(resumen|obras|oportunidades|actividad|presupuestos|facturas|conversaciones|documentos)"/gm) ?? []).length === 8 &&
    forms.includes('href={`/clientes/${clientId}?vista=${view}`}'),
);
check("Editar cliente no inventa campos comerciales o RGPD sin persistencia", !forms.includes('name="sector"') && !forms.includes('name="sitioWeb"') && !forms.includes('name="condicionesPago"') && !forms.includes('name="consentimientoComercial"'));
check("métricas de Editar cliente usan scopes propios y excluyen borradores", forms.includes('resolveScopedEntityIds(auth, "work.view", "Work")') && forms.includes('resolveScopedEntityIds(auth, "sales.invoices.view", "Client")') && forms.includes("relationAllowedForClient(") && forms.includes("invoiceAccess.scope") && forms.includes('invoice.estado !== "borrador"'));
check("Editar cliente normaliza retorno y rechaza IDs inexistentes", forms.includes("normalizeLoginReturnPath") && forms.includes("if (query.id && !record) notFound()") && management.includes("normalizeLoginReturnPath") && management.includes("result.count !== 1"));
check("rail global reconoce Editar cliente sin duplicar contexto", chrome.includes("railPathname") && chrome.includes("editedClientId") && contextRail.includes("Completar ficha del cliente") && contextRail.includes('pathname.endsWith("/editar")'));
check("navegación secundaria usa URL, aria-current y targets", clientCanonical.includes("?vista=${view}") && work.includes("?vista=${id}") && clientCanonical.includes("aria-current") && work.includes("aria-current"));
check("composición responsive cubre móvil, tablet y escritorio", gallery.includes("grid-cols-2") && gallery.includes("sm:grid-cols-3") && gallery.includes("xl:grid-cols-4") && work.includes("xl:grid-cols"));
check("avisos PWA respetan la navegación y las acciones móviles", pwa.includes("pwa-status-stack") && styles.includes("body:has(.field-os-bottom-nav):has(.sticky-form-actions, .client-edit-reference__actions)") && styles.includes("min-height: 44px"));

let failed = 0;
for (const [name, ok] of cases) {
  if (ok) console.log("[client-work-operating-system] OK", name);
  else { failed += 1; console.error("[client-work-operating-system] FAIL", name); }
}
console.log(`[client-work-operating-system] ${cases.length - failed}/${cases.length}`);
if (failed) process.exit(1);
