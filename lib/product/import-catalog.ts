export const IMPORT_KINDS = [
  "CLIENTS",
  "CONTACTS",
  "WORKS",
  "TASKS",
  "FOLLOW_UPS",
  "SUPPLIERS",
  "SUBCONTRACTORS",
  "FINANCIAL_ACCOUNTS",
  "INTERNAL_NOTES",
  "DOCUMENTS",
] as const;

export type ImportKind = (typeof IMPORT_KINDS)[number];

export type ImportField = {
  name: string;
  label: string;
  required?: boolean;
  example: string;
  help: string;
};

export type ImportDefinition = {
  kind: ImportKind;
  slug: string;
  label: string;
  shortLabel: string;
  group: "Relaciones" | "Operaciones" | "Colaboradores" | "Finanzas" | "Conocimiento";
  description: string;
  dependency: string;
  destination: string;
  fields: readonly ImportField[];
  examples: readonly Record<string, string>[];
};

export const IMPORT_CATALOG: Record<ImportKind, ImportDefinition> = {
  CLIENTS: {
    kind: "CLIENTS",
    slug: "clientes",
    label: "Clientes",
    shortLabel: "Clientes",
    group: "Relaciones",
    description: "Datos comerciales, fiscales y de contacto de cada cliente.",
    dependency: "Sin dependencias. Conviene importarlos primero.",
    destination: "/clientes",
    fields: [
      field("nombre", "Nombre", true, "Construcciones Delta", "Nombre visible del cliente."),
      field("nombreComercial", "Nombre comercial", false, "Delta Obras", "Nombre de uso habitual."),
      field("razonSocial", "Razón social", false, "Construcciones Delta SL", "Denominación fiscal."),
      field("nifCif", "NIF/CIF", false, "B12345678", "Referencia recomendada para enlazar otros archivos."),
      field("telefono", "Teléfono", true, "+34910000000", "Teléfono principal."),
      field("email", "Email", false, "administracion@delta.example", "Email principal válido."),
      field("direccion", "Dirección", true, "Calle Mayor 24", "Dirección principal."),
      field("codigoPostal", "Código postal", false, "28013", "Código postal."),
      field("municipio", "Municipio", false, "Madrid", "Municipio."),
      field("provincia", "Provincia", false, "Madrid", "Provincia."),
      field("pais", "País", false, "España", "España si se deja vacío."),
      field("tipo", "Tipo", true, "empresa", "Segmento o tipo interno."),
      field("notas", "Notas", false, "Cliente B2B", "Observación interna sin datos sensibles innecesarios."),
    ],
    examples: [
      row({ nombre: "Construcciones Delta", nombreComercial: "Delta Obras", razonSocial: "Construcciones Delta SL", nifCif: "B12345678", telefono: "+34910000000", email: "administracion@delta.example", direccion: "Calle Mayor 24", codigoPostal: "28013", municipio: "Madrid", provincia: "Madrid", pais: "España", tipo: "empresa", notas: "Cliente B2B" }),
      row({ nombre: "Ana Martín", telefono: "+34600000000", email: "ana.martin@example.invalid", direccion: "Avenida del Mar 8", codigoPostal: "46002", municipio: "Valencia", provincia: "Valencia", pais: "España", tipo: "autonomo" }),
    ],
  },
  CONTACTS: {
    kind: "CONTACTS",
    slug: "contactos",
    label: "Contactos de cliente",
    shortLabel: "Contactos",
    group: "Relaciones",
    description: "Personas de contacto, facturación y obra vinculadas a un cliente.",
    dependency: "Requiere clienteNifCif o clienteNombre ya existente.",
    destination: "/clientes?tab=contactos",
    fields: [
      field("clienteNifCif", "NIF/CIF cliente", false, "B12345678", "Referencia preferente del cliente."),
      field("clienteNombre", "Nombre cliente", false, "Construcciones Delta", "Alternativa si no existe NIF/CIF."),
      field("nombre", "Nombre", true, "Laura Soto", "Nombre del contacto."),
      field("apellidos", "Apellidos", false, "García", "Apellidos."),
      field("cargo", "Cargo", false, "Responsable de compras", "Cargo o función."),
      field("telefono", "Teléfono", false, "+34610000000", "Teléfono directo."),
      field("email", "Email", false, "laura.soto@example", "Email válido."),
      field("principal", "Principal", false, "si", "si/no."),
      field("facturacion", "Facturación", false, "si", "si/no."),
      field("obra", "Contacto de obra", false, "no", "si/no."),
      field("notas", "Notas", false, "Prefiere contacto por email", "Nota operativa."),
    ],
    examples: [row({ clienteNifCif: "B12345678", clienteNombre: "Construcciones Delta", nombre: "Laura", apellidos: "Soto García", cargo: "Responsable de compras", telefono: "+34610000000", email: "laura.soto@example.invalid", principal: "si", facturacion: "si", obra: "no", notas: "Prefiere contacto por email" })],
  },
  WORKS: {
    kind: "WORKS",
    slug: "trabajos",
    label: "Trabajos y obras",
    shortLabel: "Trabajos",
    group: "Operaciones",
    description: "Obras, servicios y proyectos con presupuesto y planificación inicial.",
    dependency: "Requiere un cliente existente. codigo debe ser único por empresa.",
    destination: "/trabajos",
    fields: [
      field("codigo", "Código", true, "OB-2026-001", "Código único de la obra."),
      field("clienteNifCif", "NIF/CIF cliente", false, "B12345678", "Referencia preferente del cliente."),
      field("clienteNombre", "Nombre cliente", false, "Construcciones Delta", "Alternativa al NIF/CIF."),
      field("titulo", "Título", true, "Reforma oficina centro", "Nombre del trabajo."),
      field("direccion", "Dirección", true, "Calle Alcalá 120", "Ubicación del trabajo."),
      field("tipoTrabajo", "Tipo", true, "Reforma integral", "Tipo de trabajo."),
      field("estado", "Estado", false, "planificada", "borrador, planificada, en_curso, pausada, finalizada…"),
      field("prioridad", "Prioridad", false, "media", "baja, media, alta o urgente."),
      field("fechaInicioPrevista", "Inicio previsto", false, "2026-09-01", "Fecha ISO AAAA-MM-DD."),
      field("fechaFinPrevista", "Fin previsto", false, "2026-11-30", "Fecha ISO AAAA-MM-DD."),
      field("presupuestoAprobado", "Presupuesto", true, "48000.00", "Importe sin separador de miles."),
      field("costePrevisto", "Coste previsto", false, "35500.00", "Importe previsto; el margen se calcula."),
      field("responsable", "Responsable", false, "Laura Soto", "Nombre visible del responsable."),
      field("descripcion", "Descripción", false, "Adecuación de oficinas", "Alcance resumido."),
    ],
    examples: [row({ codigo: "OB-2026-001", clienteNifCif: "B12345678", clienteNombre: "Construcciones Delta", titulo: "Reforma oficina centro", direccion: "Calle Alcalá 120", tipoTrabajo: "Reforma integral", estado: "planificada", prioridad: "media", fechaInicioPrevista: "2026-09-01", fechaFinPrevista: "2026-11-30", presupuestoAprobado: "48000.00", costePrevisto: "35500.00", responsable: "Laura Soto", descripcion: "Adecuación de oficinas" })],
  },
  TASKS: {
    kind: "TASKS",
    slug: "tareas",
    label: "Tareas",
    shortLabel: "Tareas",
    group: "Operaciones",
    description: "Tareas operativas con prioridad, fechas y contexto de cliente u obra.",
    dependency: "clienteNifCif y obraCodigo son opcionales, pero deben existir si se informan.",
    destination: "/tareas",
    fields: [
      field("titulo", "Título", true, "Revisar mediciones", "Acción concreta."),
      field("descripcion", "Descripción", false, "Contrastar medición con plano", "Contexto operativo."),
      field("categoria", "Categoría", false, "obra", "Categoría interna."),
      field("prioridad", "Prioridad", false, "high", "low, medium, high o urgent."),
      field("estado", "Estado", false, "planned", "inbox, planned, in_progress, blocked, waiting…"),
      field("clienteNifCif", "NIF/CIF cliente", false, "B12345678", "Cliente relacionado."),
      field("obraCodigo", "Código obra", false, "OB-2026-001", "Trabajo relacionado."),
      field("fechaInicio", "Inicio", false, "2026-09-02T08:00:00+02:00", "Fecha y hora ISO."),
      field("fechaVencimiento", "Vencimiento", false, "2026-09-02T12:00:00+02:00", "Fecha y hora ISO."),
      field("minutosEstimados", "Minutos previstos", false, "90", "Entero positivo."),
      field("requiereConfirmacion", "Confirmación humana", false, "si", "si/no."),
    ],
    examples: [row({ titulo: "Revisar mediciones", descripcion: "Contrastar medición con plano", categoria: "obra", prioridad: "high", estado: "planned", clienteNifCif: "B12345678", obraCodigo: "OB-2026-001", fechaInicio: "2026-09-02T08:00:00+02:00", fechaVencimiento: "2026-09-02T12:00:00+02:00", minutosEstimados: "90", requiereConfirmacion: "si" })],
  },
  FOLLOW_UPS: {
    kind: "FOLLOW_UPS",
    slug: "seguimientos",
    label: "Seguimientos comerciales",
    shortLabel: "Seguimientos",
    group: "Relaciones",
    description: "Próximas acciones comerciales y operativas con fecha y prioridad.",
    dependency: "Las referencias de cliente u obra son opcionales, pero se validan si aparecen.",
    destination: "/seguimientos",
    fields: [
      field("titulo", "Título", true, "Enviar propuesta revisada", "Siguiente acción."),
      field("tipo", "Tipo", false, "comercial", "Tipo de seguimiento."),
      field("estado", "Estado", false, "planned", "planned, due, in_progress, waiting_response…"),
      field("prioridad", "Prioridad", false, "high", "low, medium, high o urgent."),
      field("clienteNifCif", "NIF/CIF cliente", false, "B12345678", "Cliente relacionado."),
      field("clienteNombre", "Nombre cliente", false, "Construcciones Delta", "Alternativa al NIF/CIF."),
      field("obraCodigo", "Código obra", false, "OB-2026-001", "Trabajo relacionado."),
      field("proximaAccion", "Próxima acción", false, "2026-09-03T10:00:00+02:00", "Fecha y hora ISO."),
      field("fechaLimite", "Fecha límite", false, "2026-09-04T18:00:00+02:00", "Fecha y hora ISO."),
      field("resultadoEsperado", "Resultado esperado", false, "Confirmar alcance", "Objetivo verificable."),
    ],
    examples: [row({ titulo: "Enviar propuesta revisada", tipo: "comercial", estado: "planned", prioridad: "high", clienteNifCif: "B12345678", clienteNombre: "Construcciones Delta", obraCodigo: "OB-2026-001", proximaAccion: "2026-09-03T10:00:00+02:00", fechaLimite: "2026-09-04T18:00:00+02:00", resultadoEsperado: "Confirmar alcance" })],
  },
  SUPPLIERS: partnerDefinition("SUPPLIERS", "proveedores", "Proveedores", "Proveedor", "Materiales"),
  SUBCONTRACTORS: partnerDefinition("SUBCONTRACTORS", "subcontratas", "Subcontratas", "Subcontrata", "Instalaciones"),
  FINANCIAL_ACCOUNTS: {
    kind: "FINANCIAL_ACCOUNTS",
    slug: "cuentas-financieras",
    label: "Cuentas financieras",
    shortLabel: "Cuentas",
    group: "Finanzas",
    description: "Cuentas bancarias, caja y otras fuentes para ordenar la tesorería.",
    dependency: "No importa movimientos ni altera saldos de facturas o cobros.",
    destination: "/dinero",
    fields: [
      field("nombre", "Nombre", true, "Cuenta operativa", "Nombre interno."),
      field("tipo", "Tipo", true, "bank", "bank, cash u other."),
      field("moneda", "Moneda", true, "EUR", "Código ISO de tres letras."),
      field("saldoInicial", "Saldo inicial", false, "25000.00", "Importe sin separador de miles."),
      field("saldoMinimo", "Saldo mínimo", false, "5000.00", "Umbral operativo."),
      field("activa", "Activa", false, "si", "si/no."),
    ],
    examples: [row({ nombre: "Cuenta operativa", tipo: "bank", moneda: "EUR", saldoInicial: "25000.00", saldoMinimo: "5000.00", activa: "si" })],
  },
  INTERNAL_NOTES: {
    kind: "INTERNAL_NOTES",
    slug: "notas-internas",
    label: "Notas internas",
    shortLabel: "Notas",
    group: "Conocimiento",
    description: "Notas privadas vinculadas a cliente u obra, nunca visibles para terceros.",
    dependency: "Requiere clienteNifCif, clienteNombre u obraCodigo.",
    destination: "/clientes",
    fields: [
      field("clienteNifCif", "NIF/CIF cliente", false, "B12345678", "Cliente relacionado."),
      field("clienteNombre", "Nombre cliente", false, "Construcciones Delta", "Alternativa al NIF/CIF."),
      field("obraCodigo", "Código obra", false, "OB-2026-001", "Trabajo relacionado."),
      field("contenido", "Contenido", true, "Revisar acceso a obra antes del inicio", "Nota interna. Evita datos sensibles innecesarios."),
    ],
    examples: [row({ clienteNifCif: "B12345678", clienteNombre: "Construcciones Delta", obraCodigo: "OB-2026-001", contenido: "Revisar acceso a obra antes del inicio" })],
  },
  DOCUMENTS: {
    kind: "DOCUMENTS",
    slug: "metadatos-documentos",
    label: "Metadatos de documentos",
    shortLabel: "Documentos",
    group: "Conocimiento",
    description: "Índice documental sin subir archivos: nombre, clasificación, huella y vínculos.",
    dependency: "Los vínculos son opcionales y se validan dentro de la misma empresa.",
    destination: "/documentos",
    fields: [
      field("name", "Nombre", true, "Plano distribución v2.pdf", "Nombre visible."),
      field("category", "Categoría", true, "plano", "presupuesto, factura, contrato, albaran, ticket, fotografia, garantia, certificado, plano, informe u otro."),
      field("classification", "Clasificación", true, "OPERATIONAL", "OPERATIONAL, COMMERCIAL, FINANCIAL o RESTRICTED."),
      field("originalName", "Nombre original", false, "plano-distribucion-v2.pdf", "Nombre de origen."),
      field("mimeType", "MIME", false, "application/pdf", "Tipo MIME."),
      field("sha256", "SHA-256", false, "", "Huella hexadecimal de 64 caracteres."),
      field("clienteNifCif", "NIF/CIF cliente", false, "B12345678", "Cliente relacionado."),
      field("clienteNombre", "Nombre cliente", false, "Construcciones Delta", "Alternativa al NIF/CIF."),
      field("obraCodigo", "Código obra", false, "OB-2026-001", "Trabajo relacionado."),
      field("partnerNifCif", "NIF/CIF colaborador", false, "B87654321", "Proveedor o subcontrata relacionado."),
    ],
    examples: [row({ name: "Plano distribución v2.pdf", category: "plano", classification: "OPERATIONAL", originalName: "plano-distribucion-v2.pdf", mimeType: "application/pdf", clienteNifCif: "B12345678", clienteNombre: "Construcciones Delta", obraCodigo: "OB-2026-001" })],
  },
};

export const IMPORT_GROUPS = ["Relaciones", "Operaciones", "Colaboradores", "Finanzas", "Conocimiento"] as const;

export const PROTECTED_IMPORT_AREAS = [
  { label: "Presupuestos y facturas emitidas", reason: "Conservan numeración, impuestos, importes y estados mediante su flujo nativo.", href: "/presupuestos" },
  { label: "Cobros, pagos y gastos", reason: "Afectan saldos y conciliación; no se crean desde un CSV genérico.", href: "/dinero" },
  { label: "Facturas de proveedor y subcontrata", reason: "Requieren validación documental, fiscal y confirmación humana.", href: "/facturas-proveedor" },
  { label: "Equipo, roles y permisos", reason: "Las altas se realizan mediante invitación segura y nunca por importación masiva.", href: "/equipo" },
  { label: "Configuración fiscal, billing e IA", reason: "Son controles protegidos; no se exportan ni sobrescriben con plantillas.", href: "/configuracion" },
] as const;

export function isImportKind(value: string): value is ImportKind {
  return (IMPORT_KINDS as readonly string[]).includes(value);
}

export function getImportDefinition(kind: string) {
  return isImportKind(kind) ? IMPORT_CATALOG[kind] : null;
}

export function buildImportTemplate(kind: ImportKind) {
  const definition = IMPORT_CATALOG[kind];
  const headers = definition.fields.map((item) => item.name);
  const rows = definition.examples.map((example) => headers.map((header) => example[header] ?? ""));
  return [headers, ...rows].map((values) => values.map(csvCell).join(",")).join("\r\n");
}

function partnerDefinition(kind: "SUPPLIERS" | "SUBCONTRACTORS", slug: string, label: string, singular: string, specialty: string): ImportDefinition {
  return {
    kind,
    slug,
    label,
    shortLabel: label,
    group: "Colaboradores",
    description: `${singular} con datos fiscales, contacto, especialidad y condiciones de pago.`,
    dependency: "Sin dependencias. El NIF/CIF evita duplicados dentro de la empresa.",
    destination: kind === "SUPPLIERS" ? "/proveedores" : "/subcontratas",
    fields: [
      field("nombreComercial", "Nombre comercial", true, `${singular} Norte`, "Nombre visible."),
      field("razonSocial", "Razón social", true, `${singular} Norte SL`, "Denominación legal."),
      field("nifCif", "NIF/CIF", true, "B87654321", "Identificador fiscal único por tipo."),
      field("email", "Email", false, "administracion@example.invalid", "Email principal."),
      field("telefono", "Teléfono", false, "+34920000000", "Teléfono principal."),
      field("direccion", "Dirección", false, "Polígono Norte 3", "Dirección."),
      field("municipio", "Municipio", false, "Madrid", "Municipio."),
      field("provincia", "Provincia", false, "Madrid", "Provincia."),
      field("codigoPostal", "Código postal", false, "28031", "Código postal."),
      field("pais", "País", false, "España", "España si se deja vacío."),
      field("personaContacto", "Persona de contacto", false, "Carlos Martín", "Contacto principal."),
      field("condicionesPago", "Condiciones de pago", false, "Transferencia 30 días", "Condiciones acordadas."),
      field("diasVencimiento", "Días vencimiento", false, "30", "Entero entre 0 y 365."),
      field("especialidad", "Especialidad", false, specialty, "Categoría profesional."),
      field("notas", "Notas", false, "Documentación revisada", "Nota interna."),
    ],
    examples: [row({ nombreComercial: `${singular} Norte`, razonSocial: `${singular} Norte SL`, nifCif: "B87654321", email: "administracion@example.invalid", telefono: "+34920000000", direccion: "Polígono Norte 3", municipio: "Madrid", provincia: "Madrid", codigoPostal: "28031", pais: "España", personaContacto: "Carlos Martín", condicionesPago: "Transferencia 30 días", diasVencimiento: "30", especialidad: specialty, notas: "Documentación revisada" })],
  };
}

function field(name: string, label: string, required: boolean, example: string, help: string): ImportField {
  return { name, label, required, example, help };
}

function row(values: Record<string, string>) {
  return values;
}

function csvCell(value: string) {
  let safe = value;
  if (/^[\t\r\n]/.test(safe) || /^[=+\-@]/.test(safe.trimStart())) safe = `'${safe}`;
  return `"${safe.replaceAll('"', '""')}"`;
}
