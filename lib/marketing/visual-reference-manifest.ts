export type VisualReference = {
  id: string;
  name: string;
  suppliedAsset: string | null;
  publicPages: string[];
  authenticatedPages: string[];
  components: string[];
  dynamicBehavior: string[];
  staticFallback: string;
  restrictions: string[];
};

const sharedRestrictions = [
  "La referencia es un blueprint de composición, no un bitmap publicable.",
  "Los textos permanecen como HTML accesible.",
  "Los datos de demostración se identifican como sintéticos.",
  "No se reutilizan logotipos, empresas, testimonios ni cifras de la referencia.",
];

export const visualReferenceManifest: VisualReference[] = [
  {
    id: "01",
    name: "Hero Product Orchestra",
    suppliedAsset: "references/01-hero-product-system.png",
    publicPages: ["/", "/producto", "/demo"],
    authenticatedPages: ["/hoy"],
    components: ["HeroProductOrchestra", "ProductScene", "SceneProgress"],
    dynamicBehavior: ["Cliente → Presupuesto → Trabajo → Factura → Cobro", "Escritorio y móvil sincronizados", "Pausa y control manual"],
    staticFallback: "Cliente visible como estado inicial; Cobro como estado estable con movimiento reducido.",
    restrictions: [...sharedRestrictions, "El hero es neutral: no usa obra ni construcción como lenguaje global."],
  },
  {
    id: "02",
    name: "Role Portal Studio",
    suppliedAsset: "references/02-role-portals.png",
    publicPages: ["/", "/producto/equipo", "/demo"],
    authenticatedPages: ["/hoy", "/equipo", "/equipo/[membershipId]/portal"],
    components: ["RolePortalStudio", "PortalPreview"],
    dynamicBehavior: ["Siete perfiles", "Navegación, métricas y acciones específicas", "Acceso visible explicado"],
    staticFallback: "Portal Propietario con navegación y prioridad principal.",
    restrictions: [...sharedRestrictions, "Los perfiles describen capacidades; no reabren el modelo de autorización."],
  },
  {
    id: "03",
    name: "Client Workflow Evolution",
    suppliedAsset: "references/03-client-workflow-evolution.png",
    publicPages: ["/", "/producto/clientes", "/producto/trabajo"],
    authenticatedPages: ["/clientes/[id]", "/obras/[id]"],
    components: ["Client360Demo", "Work360Demo", "RecordWorkspace"],
    dynamicBehavior: ["Lifecycle comercial y operativo", "Timeline contextual", "Evolución por hitos"],
    staticFallback: "Resumen, rail y próxima acción visibles sin JavaScript.",
    restrictions: [...sharedRestrictions, "No se publican fotografías ni nombres de terceros presentes en la referencia."],
  },
  {
    id: "04",
    name: "Client 360",
    suppliedAsset: null,
    publicPages: ["/", "/producto/clientes"],
    authenticatedPages: ["/clientes/[id]"],
    components: ["Client360Demo", "RecordWorkspace", "RecordPeek"],
    dynamicBehavior: ["Seis estados de relación", "Próxima acción", "Timeline y documentos"],
    staticFallback: "Resumen de relación con pestañas semánticas.",
    restrictions: [...sharedRestrictions, "La economía solo se presenta a perfiles autorizados."],
  },
  {
    id: "05",
    name: "Work 360",
    suppliedAsset: null,
    publicPages: ["/", "/producto/trabajo"],
    authenticatedPages: ["/obras/[id]"],
    components: ["Work360Demo", "RecordWorkspace", "RecordPeek"],
    dynamicBehavior: ["Planificación → Cierre", "Hitos y tareas", "Evolución visual"],
    staticFallback: "Estado, responsable y próximo hito visibles.",
    restrictions: [...sharedRestrictions, "El término Trabajo cambia mediante el perfil sectorial."],
  },
  {
    id: "06",
    name: "Sales Quote Studio",
    suppliedAsset: null,
    publicPages: ["/producto/ventas", "/demo"],
    authenticatedPages: ["/presupuestos", "/presupuestos/[id]"],
    components: ["SalesQuoteStudioDemo", "ListWorkspace"],
    dynamicBehavior: ["Cliente → Partidas → Precio → Aprobación → Envío", "Edición controlada"],
    staticFallback: "Propuesta legible con estado de aprobación.",
    restrictions: [...sharedRestrictions, "No se muestra margen a perfiles sin autorización."],
  },
  {
    id: "07",
    name: "Finance & Treasury Control",
    suppliedAsset: null,
    publicPages: ["/producto/finanzas", "/demo"],
    authenticatedPages: ["/dinero", "/tesoreria"],
    components: ["TreasuryFlowDemo", "ListWorkspace"],
    dynamicBehavior: ["Documento → Vencimiento → Movimiento → Previsión", "Origen documental visible"],
    staticFallback: "Posición explicada por entradas y salidas.",
    restrictions: [...sharedRestrictions, "No se inventan saldos ni previsiones."],
  },
  {
    id: "08",
    name: "Contextual Agenda",
    suppliedAsset: null,
    publicPages: ["/producto/agenda", "/demo"],
    authenticatedPages: ["/agenda"],
    components: ["ContextualAgendaDemo", "AgendaContextSelector"],
    dynamicBehavior: ["Cliente limita trabajos", "Trabajo fija cliente", "Relaciones coherentes"],
    staticFallback: "Selector contextual con cliente como primer paso.",
    restrictions: [...sharedRestrictions, "Nunca se ofrecen relaciones de otra empresa."],
  },
  {
    id: "09",
    name: "Mobile Work Portal",
    suppliedAsset: null,
    publicPages: ["/", "/producto/movil", "/demo"],
    authenticatedPages: ["/hoy", "/tareas/[id]"],
    components: ["MobileWorkDemo", "MobileBottomNavigation"],
    dynamicBehavior: ["Tarea → Instrucciones → Avance → Evidencia → Cierre", "Sincronización con escritorio"],
    staticFallback: "Tarea prioritaria y acción principal visibles.",
    restrictions: [...sharedRestrictions, "La imagen usada por la demo es sintética."],
  },
];

export function getVisualReference(id: string) {
  return visualReferenceManifest.find((reference) => reference.id === id);
}
