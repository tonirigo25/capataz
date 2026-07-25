import { sectorProfiles } from "@/lib/business-profile/sectors";

export type MarketingModule = {
  slug: string;
  name: string;
  eyebrow: string;
  problem: string;
  result: string;
  profiles: string[];
  scene: string;
  features: string[];
  relations: string[];
  cta: string;
  metadata: { title: string; description: string };
  visualTone: "brand" | "blue" | "sand";
  family: "relationship" | "operation" | "control";
  workflow: string[];
  faq: [string, string][];
};

export const marketingProductCatalog: MarketingModule[] = [
  module("clientes", "Clientes", "Relaciones", "La historia de un cliente suele quedar repartida.", "Contacto, actividad, oportunidades y próximos pasos comparten una vista 360.", ["Dirección", "Comercial", "Responsable"], "Client360Demo", ["Resumen ejecutivo", "Rail de relación", "Timeline y documentos"], ["Trabajo", "Presupuestos", "Agenda"], "Explorar Cliente 360", "brand"),
  module("trabajo", "Trabajo", "Operación", "El avance real se pierde entre tareas y mensajes.", "Cada servicio, proyecto u orden muestra hitos, equipo y siguiente paso.", ["Dirección", "Responsable", "Empleado"], "Work360Demo", ["Planificación por hitos", "Avance y evidencias", "Equipo y agenda"], ["Clientes", "Documentos", "Tareas"], "Explorar Trabajo 360", "sand"),
  module("ventas", "Ventas", "Oportunidades", "Una propuesta sin contexto genera revisiones innecesarias.", "Oportunidad, partidas, aprobación y actividad avanzan en un solo flujo.", ["Comercial", "Dirección", "Propietario"], "SalesQuoteStudioDemo", ["Precio de venta", "Aprobación visible", "Versiones y actividad"], ["Clientes", "Trabajo", "Facturas"], "Ver el estudio de propuestas", "blue"),
  module("compras", "Compras", "Suministro", "Solicitudes, pedidos y recepciones se desconectan con facilidad.", "Cada compra conserva el recorrido desde la necesidad hasta el pago.", ["Compras", "Dirección", "Finanzas"], "TreasuryFlowDemo", ["Comparativas", "Pedidos y recepción", "Factura recibida"], ["Proveedores", "Trabajo", "Tesorería"], "Conocer el flujo de compras", "sand"),
  module("finanzas", "Finanzas", "Control", "Una cifra aislada no explica qué hay que decidir.", "Facturas, cobros, pagos y previsión mantienen su origen documental.", ["Finanzas", "Dirección", "Propietario"], "TreasuryFlowDemo", ["Vencimientos", "Trazabilidad", "Previsión explicada"], ["Ventas", "Compras", "Tesorería"], "Explorar control financiero", "blue"),
  module("agenda", "Agenda", "Contexto diario", "Una cita sin relación obliga a reconstruir el contexto.", "Cliente, trabajo, contacto y responsable se seleccionan de forma coherente.", ["Comercial", "Responsable", "Empleado"], "ContextualAgendaDemo", ["Día, semana y lista", "Creación contextual", "Filtros persistentes"], ["Clientes", "Trabajo", "Equipo"], "Ver Agenda contextual", "brand"),
  module("documentos", "Documentos", "Trazabilidad", "Una carpeta no explica por qué existe un archivo.", "Cada documento aparece junto a la relación y actividad que lo justifican.", ["Todos los portales"], "Client360Demo", ["Clasificación", "Relaciones", "Acciones por permiso"], ["Clientes", "Trabajo", "Facturas"], "Conocer Documentos", "sand"),
  module("equipo", "Equipo", "Responsabilidad", "Una misma pantalla para todos oculta prioridades y confunde accesos.", "Cada persona recibe navegación, métricas y acciones según su portal.", ["Propietario", "Dirección", "Responsables"], "RolePortalStudio", ["Portal preview", "Invitaciones", "Aprobaciones"], ["Hoy", "Seguridad", "Configuración"], "Explorar portales", "blue"),
  module("orqena", "Orqena", "Decisión asistida", "Buscar contexto y preparar el siguiente paso consume tiempo.", "Orqena explica fuentes, propone y espera confirmación antes de actuar.", ["Perfiles con acceso habilitado"], "OrqenaActionDemo", ["Fuentes visibles", "Edición", "Confirmar o cancelar"], ["Página activa", "Permisos", "Memoria"], "Ver Orqena en acción", "brand"),
  module("movil", "Móvil", "Continuidad", "El trabajo pierde ritmo cuando solo funciona en escritorio.", "Tareas, agenda, avance y evidencias se diseñan para la mano.", ["Responsable", "Empleado", "Comercial"], "MobileWorkDemo", ["Dock por perfil", "Safe areas", "Sincronización"], ["Hoy", "Tareas", "Agenda"], "Explorar la experiencia móvil", "sand"),
];

function module(
  slug: string,
  name: string,
  eyebrow: string,
  problem: string,
  result: string,
  profiles: string[],
  scene: string,
  features: string[],
  relations: string[],
  cta: string,
  visualTone: MarketingModule["visualTone"],
): MarketingModule {
  const family: MarketingModule["family"] =
    ["clientes", "ventas", "agenda", "equipo"].includes(slug)
      ? "relationship"
      : ["trabajo", "movil", "orqena"].includes(slug)
        ? "operation"
        : "control";
  return {
    slug,
    name,
    eyebrow,
    problem,
    result,
    profiles,
    scene,
    features,
    relations,
    cta,
    metadata: { title: `${name} conectado`, description: result },
    visualTone,
    family,
    workflow: moduleWorkflow(slug),
    faq: [
      [`¿Cómo se relaciona ${name} con el resto?`, `La actividad conserva vínculos con ${relations.slice(0, 2).join(" y ").toLocaleLowerCase("es-ES")}.`],
      ["¿La demostración usa información real?", "No. La escena pública usa datos sintéticos y no ejecuta acciones empresariales."],
    ],
  };
}

function moduleWorkflow(slug: string) {
  const workflows: Record<string, string[]> = {
    clientes: ["Contacto", "Oportunidad", "Propuesta", "Trabajo", "Continuidad"],
    trabajo: ["Planificar", "Preparar", "Ejecutar", "Revisar", "Entregar"],
    ventas: ["Relacionar", "Definir", "Valorar", "Aprobar", "Enviar"],
    compras: ["Solicitar", "Comparar", "Pedir", "Recibir", "Conciliar"],
    finanzas: ["Registrar", "Vencer", "Cobrar o pagar", "Conciliar", "Prever"],
    agenda: ["Elegir relación", "Fijar contexto", "Programar", "Realizar", "Continuar"],
    documentos: ["Incorporar", "Clasificar", "Relacionar", "Autorizar", "Consultar"],
    equipo: ["Invitar", "Aprobar", "Asignar portal", "Limitar alcance", "Trabajar"],
    orqena: ["Pedir", "Analizar", "Revisar fuentes", "Editar", "Confirmar"],
    movil: ["Abrir", "Consultar", "Avanzar", "Aportar evidencia", "Sincronizar"],
  };
  return workflows[slug] ?? ["Empezar", "Relacionar", "Revisar", "Decidir", "Continuar"];
}

const sectorCopy: Record<string, { slug: string; lead: string; story: string; faq: string[] }> = {
  general_services: { slug: "servicios-generales", lead: "Clientes, servicios y equipo en una operación flexible.", story: "Desde la solicitud hasta la entrega, cada persona conserva el mismo contexto.", faq: ["¿Puedo adaptar los nombres?", "Sí, la terminología parte del perfil sectorial."] },
  construction: { slug: "construccion", lead: "Obras, responsables y avances con trazabilidad.", story: "Planificación, ejecución y entrega se expresan con vocabulario propio del sector.", faq: ["¿Orqena es solo para construcción?", "No. Construcción es uno de los perfiles disponibles."] },
  installations: { slug: "instalaciones-mantenimiento", lead: "Avisos, instalaciones y mantenimiento técnico coordinados.", story: "La agenda y el trabajo conectan oficina, responsable y técnico.", faq: ["¿Sirve para mantenimiento recurrente?", "El perfil admite servicios e intervenciones; el alcance concreto se revisa en la demo."] },
  professional_services: { slug: "servicios-profesionales", lead: "Clientes, proyectos y entregables en una relación continua.", story: "El proyecto mantiene actividad, agenda y documentos cerca de la decisión.", faq: ["¿Puedo trabajar por proyecto?", "Sí, el vocabulario visible usa proyectos y responsables."] },
  consulting: { slug: "consultoria", lead: "Diagnósticos, planes de acción y seguimiento compartido.", story: "Cada recomendación conserva sus fuentes, responsables y próximos pasos.", faq: ["¿Orqena sustituye el criterio profesional?", "No. Ayuda a preparar contexto y propuestas bajo revisión humana."] },
  agency: { slug: "agencia", lead: "Cuentas, campañas y entregables conectados.", story: "Comercial, producción y cliente comparten un hilo sin mezclar responsabilidades.", faq: ["¿Puedo organizar campañas?", "El perfil adapta los trabajos a proyectos y campañas."] },
  repair_workshop: { slug: "taller-reparacion", lead: "Diagnóstico, orden de trabajo y entrega con continuidad.", story: "Recepción, técnico y cliente ven el estado que les corresponde.", faq: ["¿Incluye órdenes de trabajo?", "Sí, es la terminología principal de este perfil."] },
  healthcare: { slug: "salud-bienestar", lead: "Servicios administrativos coordinados con especial cuidado del acceso.", story: "Agenda, equipo y documentación empresarial se organizan sin presentarse como historia clínica.", faq: ["¿Gestiona historia clínica?", "No. La propuesta se limita a gestión administrativa de servicios."] },
  education: { slug: "educacion-formacion", lead: "Programas, tutorías y equipo formativo conectados.", story: "Agenda, documentos y seguimiento se articulan alrededor del programa.", faq: ["¿Puedo organizar cursos?", "Sí, el perfil usa programas, cursos y tutorías como ejemplos."] },
  retail: { slug: "comercio", lead: "Pedidos, campañas y operación comercial en contexto.", story: "Cliente, pedido y actividad comparten próximos pasos.", faq: ["¿Sustituye un punto de venta?", "No se afirma esa capacidad; Orqena organiza la operación empresarial descrita."] },
  hospitality: { slug: "hosteleria", lead: "Servicios, eventos y equipo con una visión común del día.", story: "Responsables y empleados reciben un portal centrado en sus acciones.", faq: ["¿Puedo organizar eventos?", "Sí, aparecen como tipo de servicio dentro del perfil."] },
  real_estate: { slug: "inmobiliaria", lead: "Captaciones, operaciones y responsables en una relación trazable.", story: "Cada operación conserva cliente, agenda, documentos y actividad.", faq: ["¿Incluye un portal inmobiliario?", "El alcance actual organiza operaciones internas; no se inventan integraciones externas."] },
  other: { slug: "otros", lead: "Una base neutral para actividades con un flujo propio.", story: "La configuración flexible conserva clientes, trabajos, agenda y documentos.", faq: ["¿Y si mi sector no aparece?", "El perfil Otros mantiene lenguaje neutral y puede revisarse en una demo."] },
};

export const marketingSectorCatalog = Object.entries(sectorProfiles).map(([key, profile]) => ({
  ...profile,
  ...sectorCopy[key],
  key,
}));

export function getMarketingModule(slug: string) {
  return marketingProductCatalog.find((item) => item.slug === slug);
}

export function getMarketingSector(slug: string) {
  return marketingSectorCatalog.find((item) => item.slug === slug);
}
