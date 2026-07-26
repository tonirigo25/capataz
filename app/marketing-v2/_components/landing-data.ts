export type EntryId = "audio" | "ticket" | "obra" | "documento";

export type EntryFlow = {
  id: EntryId;
  eyebrow: string;
  title: string;
  input: string;
  interpretation: string;
  proposal: string;
};

export const entryFlows: readonly EntryFlow[] = [
  {
    id: "audio",
    eyebrow: "Audio de un cliente",
    title: "Una conversación se convierte en trabajo revisable.",
    input: "Petición hablada, medidas y condiciones.",
    interpretation: "Capataz separa alcance, partidas y dudas.",
    proposal: "Borrador de presupuesto con partidas, cantidades y dudas señaladas.",
  },
  {
    id: "ticket",
    eyebrow: "Foto de un ticket",
    title: "El papel deja de quedarse fuera de la obra.",
    input: "Ticket ficticio con proveedor, fecha e importe.",
    interpretation: "Identifica el gasto y propone su categoría.",
    proposal: "Gasto clasificado y relacionado con la obra correspondiente.",
  },
  {
    id: "obra",
    eyebrow: "Foto o mensaje desde la obra",
    title: "Lo que ocurre en campo llega con contexto.",
    input: "Avance, incidencia, material o cambio comunicado.",
    interpretation: "Distingue el hecho, la obra y lo que falta confirmar.",
    proposal: "Parte, incidencia, evidencia o cambio de alcance preparado.",
  },
  {
    id: "documento",
    eyebrow: "Factura o documento",
    title: "Cada documento encuentra su siguiente paso.",
    input: "Documento de ejemplo recibido en la empresa.",
    interpretation: "Extrae datos y señala relaciones o dudas.",
    proposal: "Datos extraídos, vencimiento y relación con proveedor y obra.",
  },
] as const;

export type JourneyId =
  | "consulta"
  | "presupuesto"
  | "aprobacion"
  | "obra"
  | "gastos"
  | "factura"
  | "cobro";

export type JourneyStage = {
  id: JourneyId;
  label: string;
  received: string;
  record: string;
  owner: string;
  status: string;
  action: string;
  next: string;
};

export const journeyStages: readonly JourneyStage[] = [
  {
    id: "consulta",
    label: "Consulta",
    received: "Audio del cliente con reforma, medidas y necesidades.",
    record: "Cliente y oportunidad de trabajo.",
    owner: "Propietario",
    status: "Alcance por aclarar",
    action: "Revisar lo entendido y completar las dudas.",
    next: "Preparar el presupuesto.",
  },
  {
    id: "presupuesto",
    label: "Presupuesto",
    received: "Alcance confirmado, partidas y condiciones.",
    record: "Presupuesto PR-0048.",
    owner: "Propietario o administración",
    status: "Borrador revisable",
    action: "Comprobar cantidades, margen y condiciones.",
    next: "Compartir solo después de confirmar.",
  },
  {
    id: "aprobacion",
    label: "Aprobación",
    received: "Respuesta del cliente y cambios aceptados.",
    record: "Presupuesto y cliente relacionados.",
    owner: "Propietario",
    status: "Decisión pendiente",
    action: "Registrar la aceptación y el alcance final.",
    next: "Abrir la obra y su planificación.",
  },
  {
    id: "obra",
    label: "Obra",
    received: "Partes, fotos ficticias, tareas e incidencias.",
    record: "Reforma baño · Calle Luna 18.",
    owner: "Responsable de obra",
    status: "En ejecución",
    action: "Revisar avance, cambios y próximos trabajos.",
    next: "Relacionar compras, horas y cambios.",
  },
  {
    id: "gastos",
    label: "Gastos",
    received: "Tickets, facturas, materiales y partes.",
    record: "Gastos vinculados a la obra.",
    owner: "Administración",
    status: "Datos por validar",
    action: "Confirmar categoría, proveedor y obra.",
    next: "Actualizar la lectura económica.",
  },
  {
    id: "factura",
    label: "Factura",
    received: "Trabajo aprobado, anticipos y conceptos facturables.",
    record: "Factura en preparación.",
    owner: "Administración",
    status: "Borrador no enviado",
    action: "Revisar conceptos, vencimiento y destinatario.",
    next: "Confirmar antes de emitir o compartir.",
  },
  {
    id: "cobro",
    label: "Cobro",
    received: "Factura, vencimiento y movimientos registrados.",
    record: "Seguimiento de cobro.",
    owner: "Propietario y administración",
    status: "Atención pendiente",
    action: "Comprobar el estado y decidir el seguimiento.",
    next: "Cerrar el recorrido con trazabilidad.",
  },
] as const;

export type ResponsibilityId = "propietario" | "administracion" | "obra" | "tecnico";

export type ResponsibilityView = {
  id: ResponsibilityId;
  label: string;
  areas: readonly string[];
  primaryAction: string;
  pending: readonly string[];
  access: string;
};

export const responsibilityViews: readonly ResponsibilityView[] = [
  {
    id: "propietario",
    label: "Propietario",
    areas: ["Resumen", "Margen", "Cobros", "Riesgos"],
    primaryAction: "Revisar decisiones pendientes",
    pending: [
      "Confirmar el margen del presupuesto PR-0048.",
      "Revisar un cobro que necesita atención.",
      "Resolver un cambio de alcance antes de continuar.",
    ],
    access: "Acceso a indicadores económicos, riesgos y decisiones de la empresa.",
  },
  {
    id: "administracion",
    label: "Administración",
    areas: ["Documentos", "Facturas", "Pagos", "Vencimientos"],
    primaryAction: "Ordenar documentos pendientes",
    pending: [
      "Relacionar una factura con proveedor y obra.",
      "Confirmar el vencimiento de un documento.",
      "Revisar un pago antes de registrarlo.",
    ],
    access: "Acceso operativo a documentación, facturación, pagos y vencimientos.",
  },
  {
    id: "obra",
    label: "Responsable de obra",
    areas: ["Planificación", "Cambios", "Compras", "Incidencias"],
    primaryAction: "Actualizar el trabajo de hoy",
    pending: [
      "Validar el avance comunicado por el equipo.",
      "Revisar una compra propuesta para la obra.",
      "Resolver una incidencia antes del siguiente hito.",
    ],
    access: "Acceso al contexto operativo de las obras bajo su responsabilidad.",
  },
  {
    id: "tecnico",
    label: "Técnico o colaborador",
    areas: ["Tareas", "Partes", "Instrucciones", "Documentos"],
    primaryAction: "Completar el parte asignado",
    pending: [
      "Completar una tarea con su evidencia.",
      "Leer la instrucción del siguiente trabajo.",
      "Adjuntar localmente la referencia solicitada.",
    ],
    access: "Acceso limitado a su trabajo asignado. La información económica sensible no aparece.",
  },
] as const;

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export const faqItems: readonly FaqItem[] = [
  {
    id: "forma-trabajar",
    question: "¿Tengo que cambiar mi forma de trabajar?",
    answer:
      "La propuesta es empezar con lo que ya utilizas —audios, fotos, mensajes y documentos— y ordenar el siguiente paso contigo. Durante la beta, la incorporación se revisa de forma acompañada.",
  },
  {
    id: "presupuesto-audio",
    question: "¿Puede preparar un presupuesto desde un audio?",
    answer:
      "La demostración muestra cómo un audio puede convertirse en un borrador con partidas y dudas. El resultado siempre necesita revisión humana antes de guardarse o compartirse.",
  },
  {
    id: "interpretacion-incorrecta",
    question: "¿Qué ocurre si interpreta algo mal?",
    answer:
      "Capataz debe señalar lo claro y lo dudoso para que puedas editar, cancelar o confirmar. La demostración no realiza cambios reales y sirve para evaluar ese recorrido de revisión.",
  },
  {
    id: "permiso",
    question: "¿Guarda o envía información sin permiso?",
    answer:
      "En esta portada no se guarda ni se envía ningún dato. El principio mostrado es que las acciones importantes requieren ver qué ocurrirá y una confirmación explícita.",
  },
  {
    id: "partidas-precios",
    question: "¿Puedo utilizar mis propias partidas y precios?",
    answer:
      "La adaptación de partidas y precios debe comprobarse durante la incorporación. Esta demostración usa datos ficticios y no promete una configuración concreta para cada empresa.",
  },
  {
    id: "autonomos",
    question: "¿Sirve para autónomos?",
    answer:
      "La beta está orientada a autónomos y pequeños equipos de construcción y reformas, siempre que el recorrido propuesto encaje con su forma de presupuestar, ejecutar y cobrar.",
  },
  {
    id: "movil",
    question: "¿Funciona desde el móvil?",
    answer:
      "La experiencia está diseñada para consultarse y utilizarse en pantallas móviles. Las acciones de cámara y micrófono que aparecen aquí son representaciones y no solicitan permisos.",
  },
  {
    id: "tiempo-empezar",
    question: "¿Cuánto tiempo necesito para empezar?",
    answer:
      "No publicamos un plazo fijo. Antes de activar nada, se revisan las necesidades, el equipo y la información disponible para acordar una incorporación realista.",
  },
] as const;
