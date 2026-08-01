import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const client = read("app/(app)/clientes/[id]/page.tsx");
const clientCanonical = read("components/portal/modules-a/client-360-canonical.tsx");
const internalBreadcrumbs = read("components/internal-breadcrumbs.tsx");
const internalBreadcrumbStyles = read("components/internal-breadcrumbs.module.css");
const clientRestricted = read("components/portal/modules-a/client-360-restricted.tsx");
const clientRail = read("components/portal/modules-a/client-360-rail-shell.tsx");
const styles = read("app/globals.css");
const clients = read("app/(app)/clientes/page.tsx");
const clientFilters = read("components/clients/client-filter-bar.tsx");
const clientPortfolio = read("components/portal/modules-a/client-portfolio.tsx");
const clientWorkspaces = read("components/portal/modules-a/client-360-real-workspaces.tsx");
const clientWorksOverview = read("components/portal/modules-a/client-360-works-overview.tsx");
const clientOpportunitiesOverview = read("components/portal/modules-a/client-360-opportunities-overview.tsx");
const contextDrawer = read("components/context-drawer.tsx");
const work = read("app/(app)/obras/[id]/page.tsx");
const works = read("app/(app)/obras/page.tsx");
const workPortfolio = read("components/portal/modules-a/work-portfolio.tsx");
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
  "cliente expone los nueve submenús 360 canónicos exactos",
  (client.match(/^  \{ id: "(resumen|obras|oportunidades|actividad|presupuestos|facturas|conversaciones|documentos|archivos)"/gm) ?? []).length === 9 &&
    (clientCanonical.match(/^  "(resumen|obras|oportunidades|actividad|presupuestos|facturas|conversaciones|documentos|archivos)",/gm) ?? []).length === 9,
);
check("cliente abre Resumen por defecto", client.includes(': "resumen");') && client.includes('requestedView'));
check(
  "cliente conserva cabecera y navegación canónicas en acceso completo o restringido",
  client.includes("<Client360Canonical") &&
    client.includes("<Client360Restricted") &&
    clientCanonical.includes("Cliente 360") &&
    clientCanonical.includes("<InternalBreadcrumbs") &&
    clientRestricted.includes("Cliente 360") &&
    clientRestricted.includes('href="/clientes"'),
);
check(
  "Cliente 360 usa migas internas semánticas con identidad autorizada y destino estable",
  clientCanonical.includes("<InternalBreadcrumbs") &&
    clientCanonical.includes('{ label: "Clientes", href: hrefs.back }') &&
    clientCanonical.includes("{ label: displayName }") &&
    internalBreadcrumbs.includes('aria-label={label}') &&
    internalBreadcrumbs.includes('aria-current={current ? "page" : undefined}') &&
    internalBreadcrumbStyles.includes("min-height: 28px;") &&
    internalBreadcrumbStyles.includes("min-height: 44px;") &&
    internalBreadcrumbStyles.includes("text-overflow: ellipsis;"),
);
check("cliente conserva acciones contextuales reales", clientCanonical.includes("profileEditHref") && clientCanonical.includes("hrefs.newOpportunity") && client.includes("<ClientActions"));
check("insights de cliente quedan aislados por cliente u obra autorizada", client.includes("const scopedSignals") && client.includes("signal.entity.clientId === client.id") && client.includes("clientWorkIds.has(signal.entity.workId)"));
check("rail de Cliente 360 se oculta, expande y persiste sin scroll propio", clientRail.includes("localStorage.setItem") && clientRail.includes('data-collapsed={collapsed ? "true" : "false"}') && styles.includes('.client-360-canonical:has(> [data-client-360-rail][data-collapsed="true"])'));
check("rail de Cliente 360 cambia con la vista sin reutilizar señales no relacionadas", client.includes("signalMatchesClientView") && client.includes("const activeSignal") && clientCanonical.includes("recommendationMatchesView") && clientCanonical.includes("railEmptyCopy[activeView]"));
check("Cliente 360 elimina la columna global vacía desde tablet horizontal", styles.includes('@media (min-width: 900px)') && styles.includes('.field-os-workspace[data-embedded-context="client"]'));
check("cliente conecta workspaces canónicos sin mezclar pantallas", ordered(client, ["<ClientWorksWorkspace", "<ClientOpportunitiesWorkspace", "<ClientActivityWorkspace", "<ClientBudgetsWorkspace", "<ClientInvoicesWorkspace", "<ClientConversationsWorkspace", "<ClientDocumentsWorkspace", "<ClientFilesWorkspace"]));
check(
  "obras de Cliente 360 enlaza tarjetas, lista y portfolio sin inventar datos",
  client.includes('query.modo === "tarjetas" || query.modo === "portfolio"') &&
    client.includes("worksMode={worksMode}") &&
    ['"tarjetas"', '"lista"', '"portfolio"'].every((mode) => clientWorksOverview.includes(mode)) &&
    clientWorksOverview.includes("WorksReferenceCards") &&
    clientWorksOverview.includes("WorksOperationalList") &&
    clientWorksOverview.includes("WorksDesktopTable") &&
    clientWorkspaces.includes("progressPercent: null") &&
    clientWorkspaces.includes("estimatedMarginPercent: null"),
);
check(
  "oportunidades enlaza lista y tablero usando estados reales de presupuesto",
  client.includes('query.modo === "tablero"') &&
    client.includes("opportunityMode={opportunityMode}") &&
    clientWorkspaces.includes("opportunityStageByBudgetStatus") &&
    ["borrador", "pendiente_revision", "enviado", "visto", "pendiente_respuesta", "aceptado", "rechazado", "caducado"].every((status) => clientWorkspaces.includes(`${status}:`)) &&
    clientWorkspaces.includes('active: opportunityMode === "tablero" ? "board" : "list"') &&
    clientOpportunitiesOverview.includes("<OpportunityList") &&
    clientOpportunitiesOverview.includes("<OpportunityColumn") &&
    clientWorkspaces.includes("probabilityPercent: null"),
);
check("cliente agrega actividad, notas, fotos y archivos de obras", client.includes("<ActivityTab") && client.includes("<NotesTab") && crm.includes("work.photos") && crm.includes("work.repositoryDocuments"));
check("cliente limita resumen ejecutivo", client.includes("xl:grid-cols-4") && !client.includes("xl:grid-cols-6"));
check(
  "Resumen de Cliente 360 no añade los bloques fiscales pendientes ajenos a la referencia",
  !client.includes('activeTab === "resumen" ? (\n          <DataTab'),
);
check(
  "Insights clave contiene texto largo sin desbordar su tarjeta",
  clientCanonical.includes("client-360-ref__rail-suggestions") &&
    clientCanonical.includes("insights.slice(0, 3)") &&
    styles.includes(".client-360-ref__rail-suggestions li p") &&
    styles.includes("-webkit-line-clamp: 2;"),
);
check("cliente conserva mapa heredado explícito", ["obras", "archivos", "dinero", "presupuestos", "facturas", "pagos", "finanzas", "visitas", "notas"].every((tab) => crm.length > 0 && client.includes(`${tab}:`)));
check("listado de clientes prioriza próxima acción", clients.includes("toWorkspaceItem") && clients.includes("nextAction") && clients.includes("activeWorksCount") && clients.includes("pendingTotal"));
check("listado ofrece seis vistas inteligentes, búsqueda y filtros en sheet", ["Todos", "Seguimiento", "Presupuesto abierto", "Trabajo activo", "Cobro pendiente", "En riesgo"].every((label) => clientFilters.includes(label)) && clientFilters.includes("<FilterSheet") && clientFilters.includes('type="search"'));
check("rail de vista de cliente nace bajo la barra superior y ocupa la altura útil", styles.includes(".clients-page-content,") && styles.includes(".clients-workspace {\n    display: contents;") && styles.includes("min-height: calc(100dvh - var(--fos-layout-topbar));") && styles.includes("grid-row: 1 / span 2;") && styles.includes("align-self: stretch;"));
check("acciones de cliente escapan del recorte y mantienen acceso por teclado", clientPortfolio.includes("createPortal") && clientPortfolio.includes('aria-haspopup="menu"') && clientPortfolio.includes('event.key === "Escape"') && clientPortfolio.includes("resolveClientMenuPosition") && styles.includes(".clients-row-actions__menu") && styles.includes("z-index: 90"));
check("acciones de cliente tienen objetivo táctil mínimo de 44px", styles.includes(".clients-row-actions__trigger") && styles.includes("width: 44px;") && styles.includes("height: 44px;"));
check("listado activo no preselecciona el primer cliente", clientPortfolio.includes("useState<string | null>(null)") && clientPortfolio.includes("setSelectedId(null)") && !clientPortfolio.includes("items[0]?.id") && !clientPortfolio.includes("?? items[0]"));
check("preview activo nace neutral y cambia solo por selección explícita", clientPortfolio.includes("<ClientPreviewEmpty />") && clientPortfolio.includes("Selecciona un cliente") && clientPortfolio.includes("onClick={onSelect}") && clientPortfolio.includes('type="radio"') && clientPortfolio.includes('name="client-preview"'));
check("móvil no privilegia el primer cliente", !clientPortfolio.includes("primary={index === 0}") && !clientPortfolio.includes("primary: boolean") && clientPortfolio.includes('className="secondary-button">Abrir Cliente 360'));
check("clientes ofrece importación segura solo mediante autorización resuelta en servidor", clients.includes('auth.role === "OWNER" || auth.role === "ADMIN"') && clients.includes("canImport={canImportClient}") && clientFilters.includes("canImport: boolean") && clientFilters.includes('href="/configuracion/importar"'));
check("context drawer conserva Escape, cierre y foco", contextDrawer.includes('event.key === "Escape"') && contextDrawer.includes("opener.current?.focus()") && contextDrawer.includes('aria-modal="true"'));

check("obra expone ocho áreas 360 exactas", (work.match(/^  \["(resumen|planificacion|partes|costes|documentos|equipo|facturacion|incidencias)"/gm) ?? []).length === 8);
check("obra abre Resumen por defecto", work.includes("const activeTab") && work.includes(': "resumen"'));
check("obra usa ParentNavigation y EntityHeader", work.includes("<EntityHeader") && work.includes("<ParentNavigation href={returnTo}"));
check("obra conserva Registrar avance como acción contextual real", work.includes('"Registrar avance", Camera') && work.includes("<WorkActions"));
check("Partes conserva modo en URL", work.includes("vista=partes&subvista=diarios&modo=cronologia") && work.includes("vista=partes&subvista=diarios&modo=galeria") && work.includes('query.modo === "galeria"'));
check("Partes integra cronología, galería y notas", work.includes("TimelineList") && work.includes("WorkProgressGallery") && work.includes("<NotesTab"));
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
check("listado de obras prioriza filas y riesgo real", works.includes(': "tabla"') && workPortfolio.includes("Última actualización") && works.includes("item.hasRisk") && works.includes("item.nextAction.label") && ["Obra", "Estado", "Avance", "Equipo", "Próxima visita", "Incidencias", "Presupuesto vs Real"].every((label) => workPortfolio.includes(label)));

check("consultas de entidad derivan companyId de sesión", client.includes("requireCapability") && work.includes("requireCapability") && workflow.includes("requireCompanyContext"));
check("tareas y seguimientos están aislados por companyId", workflow.includes("where: { companyId, ...entityWhere"));
check("cliente y obra por ID están company-scoped", crm.includes("where: { id, companyId }") && work.includes("where: { id, companyId: auth.companyId }"));
check("formularios mantienen orden semántico y targets", forms.includes("Identidad del cliente") && forms.includes("Contacto operativo") && forms.includes("Fiscal y condiciones comerciales") && forms.includes("StickyFormActions"));
check("Editar cliente usa identidad, métricas y formulario responsive canónico", forms.includes("client-edit-reference__identity") && forms.includes("client-edit-reference__field-grid--three") && styles.includes(".client-edit-reference__identity") && styles.includes("@media (max-width: 767px)"));
check(
  "Editar cliente expone los nueve submenús canónicos con destinos reales",
  (forms.match(/^  \["(resumen|obras|oportunidades|actividad|presupuestos|facturas|conversaciones|documentos|archivos)"/gm) ?? []).length === 9 &&
    forms.includes('href={`/clientes/${clientId}?vista=${view}`}'),
);
check("Editar cliente no inventa campos comerciales o RGPD sin persistencia", !forms.includes('name="sector"') && !forms.includes('name="sitioWeb"') && !forms.includes('name="condicionesPago"') && !forms.includes('name="consentimientoComercial"'));
check("métricas de Editar cliente usan scopes propios y excluyen borradores", forms.includes('resolveScopedEntityIds(auth, "work.view", "Work")') && forms.includes('resolveScopedEntityIds(auth, "sales.invoices.view", "Client")') && forms.includes("relationAllowedForClient(") && forms.includes("invoiceAccess.scope") && forms.includes('invoice.estado !== "borrador"'));
check("Editar cliente normaliza retorno y rechaza IDs inexistentes", forms.includes("normalizeLoginReturnPath") && forms.includes("if (query.id && !record) notFound()") && management.includes("normalizeLoginReturnPath") && management.includes("result.count !== 1"));
check("rail global reconoce Editar cliente sin duplicar contexto", chrome.includes("railPathname") && chrome.includes("editedClientId") && contextRail.includes("Completar ficha del cliente") && contextRail.includes('pathname.endsWith("/editar")'));
check("navegación secundaria usa URL canónica, aria-current y targets", clientCanonical.includes("?vista=${view}") && work.includes("workViewHref(workId, activeTab, id, returnTo)") && clientCanonical.includes("aria-current") && work.includes("aria-current"));
check("composición responsive cubre móvil, tablet y escritorio", gallery.includes("grid-cols-2") && gallery.includes("sm:grid-cols-3") && gallery.includes("xl:grid-cols-4") && work.includes("xl:grid-cols"));
check("avisos PWA respetan la navegación y las acciones móviles", pwa.includes("pwa-status-stack") && styles.includes("body:has(.field-os-bottom-nav):has(.sticky-form-actions, .client-edit-reference__actions)") && styles.includes("min-height: 44px"));
check("navegación y paginación móvil conservan objetivos táctiles completos", chrome.includes("grid-cols-5") && styles.includes("min-h-16 w-full min-w-0") && styles.includes(".clients-pagination--mobile nav a,") && styles.includes("width: 44px;") && styles.includes("height: 44px;"));

let failed = 0;
for (const [name, ok] of cases) {
  if (ok) console.log("[client-work-operating-system] OK", name);
  else { failed += 1; console.error("[client-work-operating-system] FAIL", name); }
}
console.log(`[client-work-operating-system] ${cases.length - failed}/${cases.length}`);
if (failed) process.exit(1);
