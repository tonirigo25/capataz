import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Minus, Plus, Save, X } from "lucide-react";
import { saveManualRecord } from "@/app/(app)/gestion/actions";
import {
  Notice,
  PageHeader,
  StickyFormActions,
} from "@/components/ui-primitives";
import { prisma } from "@/lib/prisma";
import { statusLabel } from "@/lib/status";
import {
  assertScopedEntityAccess,
  requireCapability,
  resolveAuthorization,
  resolveScopedEntityIds,
} from "@/lib/commercial/authorization";
import { managementCapability } from "@/lib/commercial/management-capabilities";
import { companySettingsView } from "@/lib/tenant/company-settings";
import { AgendaContextSelector } from "@/components/agenda-context-selector";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { normalizeLoginReturnPath } from "@/lib/auth/return-path";
import { formatCurrency, formatDate } from "@/lib/format";
import { isActiveWorkStatus } from "@/lib/works";

export const dynamic = "force-dynamic";

type EntityType =
  | "cliente"
  | "obra"
  | "presupuesto"
  | "factura"
  | "pago"
  | "gasto"
  | "material"
  | "recordatorio"
  | "eventoAgenda"
  | "contacto"
  | "notaInterna"
  | "documento"
  | "foto";
// `fetchRecord` returns one of several Prisma models selected by `tipo`.
// The renderer narrows that model with the same discriminant; `never` keeps
// the shared dynamic property access assignable without weakening it to `any`.
type ManualRecord = Record<string, never>;

const entityLabels: Record<EntityType, string> = {
  cliente: "cliente",
  obra: "obra",
  presupuesto: "presupuesto",
  factura: "factura",
  pago: "pago",
  gasto: "gasto",
  material: "material",
  recordatorio: "recordatorio",
  eventoAgenda: "evento de agenda",
  contacto: "contacto",
  notaInterna: "nota interna",
  documento: "documento",
  foto: "fotografía",
};

const statusOptions = {
  cliente: [
    "nuevo",
    "pendiente_datos",
    "visita_pendiente",
    "presupuesto_pendiente",
    "presupuesto_enviado",
    "seguimiento_pendiente",
    "aceptado",
    "rechazado",
    "obra_activa",
    "finalizado",
    "pendiente_cobro",
  ],
  obra: [
    "borrador",
    "pendiente_aprobacion",
    "planificada",
    "preparacion",
    "pendiente_inicio",
    "en_curso",
    "pausada",
    "parada",
    "pendiente_material",
    "pendiente_cliente",
    "pendiente_remates",
    "parcialmente_terminada",
    "finalizada",
    "facturada_parcialmente",
    "facturada",
    "pendiente_cobro",
    "cobrada",
    "cerrada",
    "archivada",
  ],
  obraPrioridad: ["baja", "media", "alta", "urgente"],
  presupuesto: [
    "borrador",
    "pendiente_revision",
    "enviado",
    "visto",
    "pendiente_respuesta",
    "aceptado",
    "rechazado",
    "caducado",
  ],
  factura: [
    "borrador",
    "enviada",
    "pendiente",
    "parcialmente_pagada",
    "pagada",
    "vencida",
    "pendiente_emitir",
    "emitida",
    "pendiente_pago",
    "reclamada",
  ],
  pago: ["senal", "pago_parcial", "pago_final", "regularizacion"],
  gasto: [
    "material",
    "mano_obra",
    "transporte",
    "herramienta",
    "gasolina",
    "subcontrata",
    "otros",
  ],
  gastoPago: ["unknown", "pending", "paid", "cancelled"],
  costBehavior: ["unknown", "fixed", "variable"],
  material: ["pendiente", "comprado", "entregado", "falta", "devuelto"],
  recordatorioTipo: [
    "seguimiento_presupuesto",
    "recordatorio_factura",
    "factura_vencida",
    "pedir_fotos",
    "pedir_medidas",
    "confirmar_visita",
    "material_pendiente",
    "recordatorio_interno",
  ],
  recordatorioCanal: ["interno", "whatsapp", "email"],
  recordatorioEstado: [
    "borrador",
    "pendiente_confirmacion",
    "programado",
    "enviado",
    "cancelado",
    "fallido",
    "realizado",
  ],
  eventoTipo: [
    "visita",
    "llamada",
    "seguimiento_presupuesto",
    "seguimiento_cobro",
    "inicio_obra",
    "fin_previsto_obra",
    "compra_material",
    "recordatorio_interno",
    "vencimiento_factura",
    "presupuesto_pendiente",
    "tarea_obra",
  ],
  eventoEstado: [
    "pendiente",
    "confirmado",
    "realizado",
    "reprogramado",
    "cancelado",
  ],
  documentoCategoria: [
    "presupuesto",
    "factura",
    "contrato",
    "albaran",
    "ticket",
    "fotografia",
    "garantia",
    "certificado",
    "plano",
    "informe",
    "otro",
  ],
  fotoCategoria: [
    "antes",
    "durante",
    "despues",
    "incidencia",
    "material",
    "acabado",
    "otro",
  ],
  mimeType: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain",
  ],
};

const clientEditTabs = [
  ["resumen", "Resumen"],
  ["obras", "Obras"],
  ["oportunidades", "Oportunidades"],
  ["actividad", "Actividad"],
  ["presupuestos", "Presupuestos"],
  ["facturas", "Facturas"],
  ["conversaciones", "Conversaciones"],
  ["documentos", "Documentos"],
] as const;

export default async function ManualManagementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const tipo = query.tipo as EntityType | undefined;
  if (!tipo || !(tipo in entityLabels)) notFound();
  const auth = await requireCapability(
    managementCapability(tipo, Boolean(query.id)),
  );
  const [invoiceAccess, budgetAccess] = await Promise.all([
    resolveAuthorization(auth, "sales.invoices.view"),
    resolveAuthorization(auth, "sales.budgets.view"),
  ]);
  const invoiceAllowed = invoiceAccess.allowed;
  const budgetAllowed = budgetAccess.allowed;
  const economicAllowed = invoiceAllowed || budgetAllowed;
  const fieldAccess = {
    sales: (await resolveAuthorization(auth, "sales.pricing.view")).allowed,
    purchaseCost: (await resolveAuthorization(auth, "purchase_cost.view"))
      .allowed,
    internalCost: (await resolveAuthorization(auth, "internal_cost.view"))
      .allowed,
    margin:
      (await resolveAuthorization(auth, "margin_amount.view")).allowed ||
      (await resolveAuthorization(auth, "margin_percent.view")).allowed,
  };
  const [clientWorkAccess, clientDocumentAccess] =
    tipo === "cliente"
      ? await Promise.all([
          resolveAuthorization(auth, "work.view"),
          resolveAuthorization(auth, "documents.view"),
        ])
      : [
          { allowed: false, scope: "COMPANY" },
          { allowed: false, scope: "COMPANY" },
        ];
  const [scopedWorkIds, scopedClientIds] = await Promise.all([
    resolveScopedEntityIds(auth, auth.capability, "Work"),
    resolveScopedEntityIds(auth, auth.capability, "Client"),
  ]);
  const [
    visibleWorkIds,
    visibleWorkClientIds,
    visibleInvoiceWorkIds,
    visibleInvoiceClientIds,
    visibleBudgetWorkIds,
    visibleBudgetClientIds,
    visibleDocumentIds,
    visibleDocumentClientIds,
  ] =
    tipo === "cliente"
      ? await Promise.all([
          clientWorkAccess.allowed
            ? resolveScopedEntityIds(auth, "work.view", "Work")
            : Promise.resolve([]),
          clientWorkAccess.allowed
            ? resolveScopedEntityIds(auth, "work.view", "Client")
            : Promise.resolve([]),
          invoiceAllowed
            ? resolveScopedEntityIds(auth, "sales.invoices.view", "Work")
            : Promise.resolve([]),
          invoiceAllowed
            ? resolveScopedEntityIds(auth, "sales.invoices.view", "Client")
            : Promise.resolve([]),
          budgetAllowed
            ? resolveScopedEntityIds(auth, "sales.budgets.view", "Work")
            : Promise.resolve([]),
          budgetAllowed
            ? resolveScopedEntityIds(auth, "sales.budgets.view", "Client")
            : Promise.resolve([]),
          clientDocumentAccess.allowed
            ? resolveScopedEntityIds(auth, "documents.view", "Document")
            : Promise.resolve([]),
          clientDocumentAccess.allowed
            ? resolveScopedEntityIds(auth, "documents.view", "Client")
            : Promise.resolve([]),
        ])
      : [[], [], [], [], [], [], [], []];
  const workWhere = scopedWorkIds === null ? {} : { id: { in: scopedWorkIds } };
  const clientWhere =
    scopedClientIds === null ? {} : { id: { in: scopedClientIds } };
  const relatedClientWhere =
    scopedClientIds === null ? {} : { clientId: { in: scopedClientIds } };
  const relatedEntityWhere =
    auth.scope === "COMPANY"
      ? {}
      : auth.scope === "SELECTED_WORKS"
        ? { obraId: { in: scopedWorkIds ?? [] } }
        : auth.scope === "SELECTED_CLIENTS"
          ? { clienteId: { in: scopedClientIds ?? [] } }
          : {
              OR: [
                { obraId: { in: scopedWorkIds ?? [] } },
                { clienteId: { in: scopedClientIds ?? [] } },
              ],
            };

  const [
    clients,
    works,
    budgets,
    invoices,
    reminders,
    contacts,
    documents,
    companyRecord,
  ] = await Promise.all([
    prisma.client.findMany({
      where: { companyId: auth.companyId, ...clientWhere },
      orderBy: { nombre: "asc" },
    }),
    prisma.work.findMany({
      where: { companyId: auth.companyId, ...workWhere },
      orderBy: { titulo: "asc" },
      include: { client: true },
    }),
    budgetAllowed
      ? prisma.budget.findMany({
          where: { companyId: auth.companyId, ...relatedEntityWhere },
          orderBy: { numero: "asc" },
          include: { client: true },
        })
      : Promise.resolve([]),
    invoiceAllowed
      ? prisma.invoice.findMany({
          where: { companyId: auth.companyId, ...relatedEntityWhere },
          orderBy: { numero: "asc" },
          include: { client: true },
        })
      : Promise.resolve([]),
    prisma.reminder.findMany({
      where: { companyId: auth.companyId, ...relatedEntityWhere },
      orderBy: { fechaProgramada: "asc" },
      include: { client: true },
    }),
    prisma.contact.findMany({
      where: {
        companyId: auth.companyId,
        ...relatedClientWhere,
        archivedAt: null,
      },
      orderBy: [{ nombre: "asc" }],
      include: { client: true },
    }),
    prisma.document.findMany({
      where: {
        companyId: auth.companyId,
        ...(auth.scope === "COMPANY"
          ? {}
          : {
              OR: [
                { workId: { in: scopedWorkIds ?? [] } },
                { clientId: { in: scopedClientIds ?? [] } },
              ],
            }),
        archivedAt: null,
        ...(economicAllowed ? {} : { budgetId: null, invoiceId: null }),
      },
      orderBy: { createdAt: "desc" },
      include: { client: true, work: true },
    }),
    economicAllowed && ["presupuesto", "factura"].includes(tipo)
      ? prisma.company.findUniqueOrThrow({ where: { id: auth.companyId } })
      : Promise.resolve(null),
  ]);
  const company = companyRecord ? companySettingsView(companyRecord) : null;
  // Number reservation happens only inside the create transaction in gestion/actions.ts.
  const suggestedBudgetNumber = "";
  const suggestedInvoiceNumber = "";
  const suggestedWorkNumber = "";
  if (query.id) await ensureScopedRecord(tipo, query.id, auth);
  const record = query.id
    ? await fetchRecord(tipo, query.id, auth.companyId)
    : null;
  if (query.id && !record) notFound();
  const clientMetrics =
    tipo === "cliente" && query.id
      ? {
          activeWorks: clientWorkAccess.allowed
            ? works.filter(
                (work) =>
                  work.clienteId === query.id &&
                  relationAllowedForClient(
                    clientWorkAccess.scope,
                    visibleWorkIds,
                    visibleWorkClientIds,
                    work.id,
                    work.clienteId,
                  ) &&
                  isActiveWorkStatus(work.estado),
              ).length
            : null,
          totalWorks: clientWorkAccess.allowed
            ? works.filter(
                (work) =>
                  work.clienteId === query.id &&
                  relationAllowedForClient(
                    clientWorkAccess.scope,
                    visibleWorkIds,
                    visibleWorkClientIds,
                    work.id,
                    work.clienteId,
                  ),
              ).length
            : null,
          billedTotal: invoiceAllowed
            ? invoices
                .filter(
                  (invoice) =>
                    invoice.clienteId === query.id &&
                    relationAllowedForClient(
                      invoiceAccess.scope,
                      visibleInvoiceWorkIds,
                      visibleInvoiceClientIds,
                      invoice.obraId,
                      invoice.clienteId,
                    ) &&
                    invoice.estado !== "borrador",
                )
                .reduce((total, invoice) => total + invoice.total, 0)
            : null,
        }
      : null;
  const clientAreaAccess =
    tipo === "cliente" && query.id
      ? {
          commercial:
            budgetAllowed &&
            (visibleBudgetWorkIds === null ||
              visibleBudgetClientIds === null ||
              visibleBudgetClientIds.includes(query.id) ||
              budgets.some(
                (budget) =>
                  budget.clienteId === query.id &&
                  Boolean(
                    budget.obraId && visibleBudgetWorkIds.includes(budget.obraId),
                  ),
              )),
          invoicing:
            invoiceAllowed &&
            (visibleInvoiceWorkIds === null ||
              visibleInvoiceClientIds === null ||
              visibleInvoiceClientIds.includes(query.id) ||
              invoices.some(
                (invoice) =>
                  invoice.clienteId === query.id &&
                  Boolean(
                    invoice.obraId &&
                      visibleInvoiceWorkIds.includes(invoice.obraId),
                  ),
              )),
          documents:
            clientDocumentAccess.allowed &&
            (visibleDocumentIds === null ||
              visibleDocumentClientIds === null ||
              visibleDocumentClientIds.includes(query.id) ||
              documents.some(
                (document) =>
                  document.clientId === query.id &&
                  visibleDocumentIds.includes(document.id),
              )),
          works:
            clientWorkAccess.allowed &&
            (visibleWorkIds === null ||
              visibleWorkClientIds === null ||
              visibleWorkClientIds.includes(query.id) ||
              works.some(
                (work) =>
                  work.clienteId === query.id && visibleWorkIds.includes(work.id),
              )),
        }
      : {
          commercial: false,
          invoicing: false,
          documents: false,
          works: false,
        };
  const duplicateClient =
    tipo === "cliente" && query.duplicateOf
      ? await prisma.client.findFirst({
          where: { id: query.duplicateOf, companyId: auth.companyId },
          select: {
            id: true,
            nombre: true,
            telefono: true,
            email: true,
            nifCif: true,
          },
        })
      : null;
  const title = `${record ? "Editar" : "Añadir"} ${entityLabels[tipo]}`;
  const returnTo = normalizeLoginReturnPath(
    query.returnTo ?? defaultReturnTo(tipo),
  );
  const isClientEdit = tipo === "cliente" && Boolean(query.id && record);
  const manualRecord = record as ManualRecord | null;
  const clientName = valueFor(manualRecord, query, "nombre", "Cliente");

  return (
    <main className={`screen${isClientEdit ? " client-edit-reference" : ""}`}>
      {isClientEdit ? (
        <header className="client-edit-reference__header">
          <h1>Editar cliente</h1>
          <p>
            {clientName} · {statusLabel(valueFor(manualRecord, query, "estado", "nuevo"))}
          </p>
        </header>
      ) : (
        <>
          <Link
            href={returnTo}
            className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-obra-ink"
          >
            <ArrowLeft size={18} />
            Cancelar
          </Link>

          <PageHeader
            eyebrow="Edición manual"
            title={title}
            description="Completa los campos por bloques. Nada se guarda hasta que confirmes la acción final."
          />
        </>
      )}

      <form
        action={saveManualRecord}
        className={
          isClientEdit
            ? "client-edit-reference__form"
            : "surface mx-auto grid max-w-4xl gap-5 p-4 sm:p-6"
        }
      >
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="id" value={query.id ?? ""} />
        <input type="hidden" name="returnTo" value={returnTo} />
        {duplicateClient ? (
          <input type="hidden" name="confirmDuplicate" value="true" />
        ) : null}

        {duplicateClient ? (
          <Notice
            tone={query.duplicateStrength === "weak" ? "warning" : "danger"}
            title="Puede que este cliente ya exista"
            description={`${query.duplicateReason ?? "Coincidencia detectada"} con ${duplicateClient.nombre}. Revisa la ficha existente o continúa sólo si quieres crear otro registro.`}
            action={
              <Link
                href={`/clientes/${duplicateClient.id}`}
                className="secondary-button"
              >
                Ver existente
              </Link>
            }
          />
        ) : null}

        {isClientEdit ? (
          <ClientEditReferenceFields
            clientId={query.id ?? ""}
            record={manualRecord}
            defaults={query}
            metrics={clientMetrics}
            contacts={contacts.filter(
              (contact) => contact.clientId === query.id,
            )}
            access={clientAreaAccess}
          />
        ) : (
          renderFields({
            tipo,
            record: manualRecord,
            defaults: query,
            clients,
            works,
            budgets,
            invoices,
            reminders,
            contacts,
            documents,
            company,
            suggestedBudgetNumber,
            suggestedInvoiceNumber,
            suggestedWorkNumber,
            fieldAccess,
          })
        )}

        {isClientEdit ? (
          <div className="client-edit-reference__actions">
            <Link href={returnTo} className="secondary-button">
              Cancelar
            </Link>
            <ConfirmSubmitButton
              className="primary-button"
              message="¿Guardar los cambios revisados en este cliente?"
            >
              <Save size={17} />
              Guardar cambios
            </ConfirmSubmitButton>
          </div>
        ) : (
          <StickyFormActions>
            <Link href={returnTo} className="secondary-button w-full">
              <X size={18} />
              Cancelar
            </Link>
            <button type="submit" className="primary-button w-full">
              <Save size={18} />
              {duplicateClient ? "Continuar creando" : "Guardar"}
            </button>
          </StickyFormActions>
        )}
      </form>
    </main>
  );
}

function ClientEditReferenceFields({
  clientId,
  record,
  defaults,
  metrics,
  contacts,
  access,
}: {
  clientId: string;
  record: ManualRecord | null;
  defaults: Record<string, string | undefined>;
  metrics: {
    activeWorks: number | null;
    totalWorks: number | null;
    billedTotal: number | null;
  } | null;
  contacts: Array<{
    id: string;
    nombre: string;
    apellidos: string | null;
    cargo: string | null;
    telefono: string | null;
    email: string | null;
    isPrimary: boolean;
  }>;
  access: {
    commercial: boolean;
    invoicing: boolean;
    documents: boolean;
    works: boolean;
  };
}) {
  const permissionRows = [
    ["Comercial", access.commercial],
    ["Facturación", access.invoicing],
    ["Documentos", access.documents],
    ["Obras", access.works],
  ] as const;
  const status = statusLabel(valueFor(record, defaults, "estado", "nuevo"));
  const tags = [
    status,
    valueFor(record, defaults, "tipo", "Cliente"),
    valueFor(record, defaults, "origen", "Manual"),
  ].filter(Boolean);
  const displayName =
    valueFor(record, defaults, "nombreComercial") ||
    valueFor(record, defaults, "razonSocial") ||
    valueFor(record, defaults, "nombre", "Cliente");
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("es-ES"))
    .join("");
  const lastActivity = record?.ultimaInteraccion as
    | Date
    | string
    | null
    | undefined;
  const visibleContacts = contacts;

  return (
    <>
      <section className="client-edit-reference__identity">
        <div className="client-edit-reference__avatar" aria-hidden="true">
          {initials || "CL"}
        </div>
        <div className="client-edit-reference__identity-name">
          <h2>{displayName}</h2>
          <span>{status}</span>
        </div>
        <dl>
          <div>
            <dt>Estado del cliente</dt>
            <dd>{status}</dd>
            <small>Estado guardado en la ficha</small>
          </div>
          {access.invoicing ? (
            <div>
              <dt>Total facturado</dt>
              <dd>{metrics?.billedTotal != null ? formatCurrency(metrics.billedTotal) : "Sin dato"}</dd>
              <small>Facturas emitidas autorizadas</small>
            </div>
          ) : null}
          {access.works ? (
            <div>
              <dt>Obras activas</dt>
              <dd>{metrics?.activeWorks ?? "—"}</dd>
              <small>{metrics?.totalWorks != null ? `${metrics.totalWorks} obras vinculadas` : "Sin dato"}</small>
            </div>
          ) : null}
          <div>
            <dt>Última actividad</dt>
            <dd>{lastActivity ? formatDate(new Date(lastActivity)) : "Sin actividad"}</dd>
            <small>Registro real del cliente</small>
          </div>
        </dl>
      </section>

      <nav className="client-edit-reference__tabs" aria-label="Áreas del cliente">
        {clientEditTabs.map(([view, label], index) => (
          <Link
            key={`${view}-${label}`}
            href={`/clientes/${clientId}?vista=${view}`}
            aria-current={index === 0 ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>

      <section className="client-edit-reference__general">
        <h2>Información general</h2>
        <div className="client-edit-reference__field-grid client-edit-reference__field-grid--three">
          <div className="client-edit-reference__field-column">
            <Field
              name="nombreComercial"
              label="Nombre comercial"
              value={valueFor(record, defaults, "nombreComercial")}
            />
            <Field
              name="razonSocial"
              label="Razón social"
              value={valueFor(record, defaults, "razonSocial")}
            />
            <Field
              name="nombre"
              label="Nombre visible"
              required
              value={valueFor(record, defaults, "nombre")}
            />
            <Field
              name="nifCif"
              label="CIF / NIF"
              value={valueFor(record, defaults, "nifCif")}
            />
            <ClientTypeSelect value={record?.tipo ?? defaults.tipoCliente} />
            <Field
              name="email"
              label="Email"
              type="email"
              value={valueFor(record, defaults, "email")}
            />
          </div>

          <div className="client-edit-reference__field-column">
            <Textarea
              name="direccionFiscal"
              label="Dirección fiscal"
              value={record?.direccionFiscal ?? defaults.direccionFiscal}
            />
            <Field
              name="direccion"
              label="Dirección principal o postal"
              value={valueFor(record, defaults, "direccion")}
            />
            <Field
              name="pais"
              label="País"
              value={valueFor(record, defaults, "pais", "España")}
            />
            <div className="client-edit-reference__field-pair">
              <Field
                name="codigoPostal"
                label="Código postal"
                value={valueFor(record, defaults, "codigoPostal")}
              />
              <Field
                name="municipio"
                label="Ciudad"
                value={valueFor(record, defaults, "municipio")}
              />
            </div>
            <Field
              name="provincia"
              label="Provincia"
              value={valueFor(record, defaults, "provincia")}
            />
          </div>

          <div className="client-edit-reference__field-column">
            <Field
              name="contactoPrincipalNombre"
              label="Contacto principal"
              value={valueFor(record, defaults, "contactoPrincipalNombre")}
            />
            <Field
              name="telefono"
              label="Teléfono general"
              value={valueFor(record, defaults, "telefono")}
            />
            <Field
              name="contactoPrincipalCargo"
              label="Cargo o relación"
              value={valueFor(record, defaults, "contactoPrincipalCargo")}
            />
            <Select
              name="estado"
              label="Estado"
              options={statusOptions.cliente}
              value={record?.estado ?? defaults.estado ?? "pendiente_datos"}
            />
            <Field
              name="emailFacturacion"
              label="Email de facturación"
              type="email"
              value={valueFor(record, defaults, "emailFacturacion")}
            />
            <Field
              name="telefonoFacturacion"
              label="Teléfono de facturación"
              value={valueFor(record, defaults, "telefonoFacturacion")}
            />
            <Field
              name="origen"
              label="Origen"
              value={valueFor(record, defaults, "origen", "Manual")}
            />
          </div>
        </div>
        <section className="client-edit-reference__contacts">
          <header>
            <h2>Personas de contacto</h2>
            <Link
              href={`/gestion?tipo=contacto&clientId=${clientId}&returnTo=${encodeURIComponent(`/gestion?tipo=cliente&id=${clientId}&returnTo=/clientes/${clientId}`)}`}
              className="secondary-button"
            >
              <Plus size={15} aria-hidden="true" /> Añadir contacto
            </Link>
          </header>
          {visibleContacts.length ? (
            <div>
              {visibleContacts.map((contact) => (
                <Link
                  key={contact.id}
                  href={`/gestion?tipo=contacto&id=${contact.id}&clientId=${clientId}&returnTo=${encodeURIComponent(`/gestion?tipo=cliente&id=${clientId}&returnTo=/clientes/${clientId}`)}`}
                >
                  <span aria-hidden="true">
                    {contact.nombre.slice(0, 1).toLocaleUpperCase("es-ES")}
                  </span>
                  <strong>
                    {contact.nombre}
                    {contact.apellidos ? ` ${contact.apellidos}` : ""}
                    {contact.isPrimary ? <small>Principal</small> : null}
                  </strong>
                  <em>{contact.cargo ?? "Sin cargo registrado"}</em>
                  <i>{contact.email ?? "Sin email"}</i>
                  <b>{contact.telefono ?? "Sin teléfono"}</b>
                </Link>
              ))}
            </div>
          ) : (
            <p>No hay personas de contacto registradas.</p>
          )}
        </section>

        <div className="client-edit-reference__lower-grid">
          <div>
            <Textarea
              name="notas"
              label="Notas"
              value={record?.notas ?? defaults.notas}
            />
            <Field
              name="ultimaInteraccion"
              label="Última interacción"
              type="datetime-local"
              value={dateTimeValue(record?.ultimaInteraccion ?? defaults.ultimaInteraccion)}
            />
          </div>
          <section className="client-edit-reference__access" aria-label="Acceso funcional">
            <h2>Acceso funcional</h2>
            <p>Se muestra según el perfil, el alcance y la suscripción vigentes.</p>
            <ul>
              {permissionRows.map(([label, allowed]) => (
                <li key={label} data-allowed={allowed ? "true" : "false"}>
                  {allowed ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Minus size={14} aria-hidden="true" />
                  )}
                  {label}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="client-edit-reference__tags" aria-label="Etiquetas actuales">
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>

        <details className="client-edit-reference__advanced">
          <summary>Datos de contacto y facturación ampliados</summary>
          <div>
            <Field
              name="contactoPrincipalTelefono"
              label="Teléfono del contacto principal"
              value={valueFor(record, defaults, "contactoPrincipalTelefono")}
            />
            <Field
              name="contactoPrincipalEmail"
              label="Email del contacto principal"
              type="email"
              value={valueFor(record, defaults, "contactoPrincipalEmail")}
            />
            <Field
              name="contactoFacturacionNombre"
              label="Persona de facturación"
              value={valueFor(record, defaults, "contactoFacturacionNombre")}
            />
          </div>
        </details>
      </section>
    </>
  );
}

function relationAllowedForClient(
  scope: string,
  workIds: string[] | null,
  clientIds: string[] | null,
  workId: string | null,
  clientId: string,
) {
  if (scope === "COMPANY") return true;
  if (scope === "SELECTED_WORKS") {
    return Boolean(workId && workIds?.includes(workId));
  }
  if (scope === "SELECTED_CLIENTS") {
    return Boolean(clientIds?.includes(clientId));
  }
  return workId
    ? Boolean(workIds?.includes(workId))
    : Boolean(clientIds?.includes(clientId));
}

async function ensureScopedRecord(
  tipo: EntityType,
  id: string,
  auth: Awaited<ReturnType<typeof requireCapability>>,
) {
  const related = async (workId?: string | null, clientId?: string | null) => {
    if (workId)
      return assertScopedEntityAccess(auth, auth.capability, "Work", workId);
    if (clientId)
      return assertScopedEntityAccess(
        auth,
        auth.capability,
        "Client",
        clientId,
      );
    if (auth.scope !== "COMPANY") notFound();
  };
  if (tipo === "obra")
    return assertScopedEntityAccess(auth, auth.capability, "Work", id);
  if (tipo === "documento")
    return assertScopedEntityAccess(auth, auth.capability, "Document", id);
  if (tipo === "foto") {
    const row = await prisma.workPhoto.findFirst({
      where: { id, work: { companyId: auth.companyId } },
      select: { obraId: true },
    });
    if (!row) notFound();
    return related(row.obraId);
  }
  if (tipo === "presupuesto") {
    const row = await prisma.budget.findFirst({
      where: { id, companyId: auth.companyId },
      select: { obraId: true, clienteId: true },
    });
    if (!row) notFound();
    return related(row.obraId, row.clienteId);
  }
  if (tipo === "factura") {
    const row = await prisma.invoice.findFirst({
      where: { id, companyId: auth.companyId },
      select: { obraId: true, clienteId: true },
    });
    if (!row) notFound();
    return related(row.obraId, row.clienteId);
  }
  if (tipo === "pago") {
    const row = await prisma.payment.findFirst({
      where: { id, companyId: auth.companyId },
      select: { obraId: true, clienteId: true },
    });
    if (!row) notFound();
    return related(row.obraId, row.clienteId);
  }
  if (tipo === "gasto") {
    const row = await prisma.expense.findFirst({
      where: { id, companyId: auth.companyId },
      select: { obraId: true, clienteId: true },
    });
    if (!row) notFound();
    return related(row.obraId, row.clienteId);
  }
  if (tipo === "material") {
    const row = await prisma.material.findFirst({
      where: { id, companyId: auth.companyId },
      select: { obraId: true },
    });
    if (!row) notFound();
    return related(row.obraId);
  }
  if (tipo === "recordatorio") {
    const row = await prisma.reminder.findFirst({
      where: { id, companyId: auth.companyId },
      select: { obraId: true, clienteId: true },
    });
    if (!row) notFound();
    return related(row.obraId, row.clienteId);
  }
  if (tipo === "eventoAgenda") {
    const row = await prisma.eventoAgenda.findFirst({
      where: { id, companyId: auth.companyId },
      select: { obraId: true, clienteId: true },
    });
    if (!row) notFound();
    return related(row.obraId, row.clienteId);
  }
  if (tipo === "contacto") {
    const row = await prisma.contact.findFirst({
      where: { id, companyId: auth.companyId },
      select: { clientId: true },
    });
    if (!row) notFound();
    return related(null, row.clientId);
  }
  if (tipo === "notaInterna") {
    const row = await prisma.internalNote.findFirst({
      where: { id, companyId: auth.companyId },
      select: { workId: true, clientId: true },
    });
    if (!row) notFound();
    return related(row.workId, row.clientId);
  }
  if (tipo === "cliente")
    return assertScopedEntityAccess(auth, auth.capability, "Client", id);
}

async function fetchRecord(tipo: EntityType, id: string, companyId: string) {
  switch (tipo) {
    case "cliente":
      return prisma.client.findFirst({ where: { id, companyId } });
    case "obra":
      return prisma.work.findFirst({ where: { id, companyId } });
    case "presupuesto":
      return prisma.budget.findFirst({ where: { id, companyId } });
    case "factura":
      return prisma.invoice.findFirst({ where: { id, companyId } });
    case "pago":
      return prisma.payment.findFirst({ where: { id, companyId } });
    case "gasto":
      return prisma.expense.findFirst({ where: { id, companyId } });
    case "material":
      return prisma.material.findFirst({ where: { id, companyId } });
    case "recordatorio":
      return prisma.reminder.findFirst({ where: { id, companyId } });
    case "eventoAgenda":
      return prisma.eventoAgenda.findFirst({ where: { id, companyId } });
    case "contacto":
      return prisma.contact.findFirst({ where: { id, companyId } });
    case "notaInterna":
      return prisma.internalNote.findFirst({ where: { id, companyId } });
    case "documento":
      return prisma.document.findFirst({ where: { id, companyId } });
    case "foto":
      return prisma.workPhoto.findFirst({ where: { id, work: { companyId } } });
  }
}

function renderFields({
  tipo,
  record,
  defaults,
  clients,
  works,
  budgets,
  invoices,
  reminders,
  contacts,
  documents,
  company,
  suggestedBudgetNumber,
  suggestedInvoiceNumber,
  suggestedWorkNumber,
  fieldAccess,
}: {
  tipo: EntityType;
  record: ManualRecord | null;
  defaults: Record<string, string | undefined>;
  clients: Array<{ id: string; nombre: string }>;
  works: Array<{
    id: string;
    titulo: string;
    clienteId: string;
    client: { nombre: string };
  }>;
  budgets: Array<{
    id: string;
    numero: string;
    titulo: string;
    clienteId: string;
    obraId: string | null;
    client: { nombre: string };
  }>;
  invoices: Array<{
    id: string;
    numero: string;
    concepto: string;
    clienteId: string;
    obraId: string | null;
    client: { nombre: string };
  }>;
  reminders: Array<{
    id: string;
    tipo: string;
    mensaje: string;
    client: { nombre: string } | null;
  }>;
  contacts: Array<{
    id: string;
    nombre: string;
    apellidos: string | null;
    clientId: string;
    client: { nombre: string };
  }>;
  documents: Array<{
    id: string;
    name: string;
    clientId: string | null;
    workId: string | null;
    client: { nombre: string } | null;
    work: { titulo: string } | null;
  }>;
  company: {
    ivaDefecto: number;
    condicionesPorDefecto: string | null;
    iban: string | null;
  } | null;
  suggestedBudgetNumber: string;
  suggestedInvoiceNumber: string;
  suggestedWorkNumber: string;
  fieldAccess: {
    sales: boolean;
    purchaseCost: boolean;
    internalCost: boolean;
    margin: boolean;
  };
}) {
  switch (tipo) {
    case "cliente":
      return (
        <>
          <div className="order-1 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-black text-obra-ink">
              Identidad del cliente
            </p>
            <Field
              name="nombre"
              label="Nombre visible"
              value={valueFor(record, defaults, "nombre")}
            />
            <Field
              name="nombreComercial"
              label="Nombre comercial"
              value={valueFor(record, defaults, "nombreComercial")}
            />
            <Field
              name="razonSocial"
              label="Razón social"
              value={valueFor(record, defaults, "razonSocial")}
            />
            <Field
              name="nifCif"
              label="NIF/CIF"
              value={valueFor(record, defaults, "nifCif")}
            />
            <ClientTypeSelect
              value={record?.tipo ?? defaults.tipoCliente ?? "Particular"}
            />
            <Select
              name="estado"
              label="Estado"
              options={statusOptions.cliente}
              value={record?.estado ?? defaults.estado ?? "pendiente_datos"}
            />
            <Field
              name="origen"
              label="Origen"
              value={valueFor(record, defaults, "origen", "Manual")}
            />
          </div>

          <div className="order-2 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-black text-obra-ink">
              Contacto operativo
            </p>
            <Field
              name="telefono"
              label="Teléfono del cliente"
              value={valueFor(record, defaults, "telefono")}
            />
            <Field
              name="email"
              label="Email del cliente"
              type="email"
              value={valueFor(record, defaults, "email")}
            />
            <Field
              name="contactoPrincipalNombre"
              label="Contacto principal"
              value={valueFor(record, defaults, "contactoPrincipalNombre")}
            />
            <Field
              name="contactoPrincipalCargo"
              label="Cargo o relación"
              value={valueFor(record, defaults, "contactoPrincipalCargo")}
            />
            <Field
              name="contactoPrincipalTelefono"
              label="Teléfono contacto principal"
              value={valueFor(record, defaults, "contactoPrincipalTelefono")}
            />
            <Field
              name="contactoPrincipalEmail"
              label="Email contacto principal"
              type="email"
              value={valueFor(record, defaults, "contactoPrincipalEmail")}
            />
          </div>

          <div className="order-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-black text-obra-ink">
              Fiscal y condiciones comerciales
            </p>
            <Field
              name="direccionFiscal"
              label="Dirección fiscal"
              value={valueFor(record, defaults, "direccionFiscal")}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                name="codigoPostal"
                label="Código postal"
                value={valueFor(record, defaults, "codigoPostal")}
              />
              <Field
                name="municipio"
                label="Municipio"
                value={valueFor(record, defaults, "municipio")}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                name="provincia"
                label="Provincia"
                value={valueFor(record, defaults, "provincia")}
              />
              <Field
                name="pais"
                label="País"
                value={valueFor(record, defaults, "pais", "España")}
              />
            </div>
            <Field
              name="emailFacturacion"
              label="Email de facturación"
              type="email"
              value={valueFor(record, defaults, "emailFacturacion")}
            />
            <Field
              name="telefonoFacturacion"
              label="Teléfono de facturación"
              value={valueFor(record, defaults, "telefonoFacturacion")}
            />
            <Field
              name="contactoFacturacionNombre"
              label="Persona de facturación"
              value={valueFor(record, defaults, "contactoFacturacionNombre")}
            />
          </div>

          <div className="order-3 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-black text-obra-ink">Dirección</p>
            <Field
              name="direccion"
              label="Dirección principal o postal"
              value={valueFor(record, defaults, "direccion")}
            />
            <Field
              name="ultimaInteraccion"
              label="Última interacción"
              type="datetime-local"
              value={dateTimeValue(
                record?.ultimaInteraccion ?? defaults.ultimaInteraccion,
              )}
            />
            <Textarea
              name="notas"
              label="Notas internas"
              value={record?.notas ?? defaults.notas}
            />
          </div>
        </>
      );
    case "obra":
      return (
        <>
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-black text-obra-ink">Identificación</p>
            <RelationSelect
              name="clienteId"
              label="Cliente"
              options={clients.map((client) => [client.id, client.nombre])}
              value={record?.clienteId ?? defaults.clienteId}
            />
            <RelationSelect
              name="contactoId"
              label="Contacto de obra"
              optional
              options={contacts.map((contact) => [
                contact.id,
                `${contact.nombre}${contact.apellidos ? ` ${contact.apellidos}` : ""} · ${contact.client.nombre}`,
              ])}
              value={record?.contactoId ?? defaults.contactoId}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                name="numeroInterno"
                label="Número interno"
                value={record?.numeroInterno ?? defaults.numeroInterno}
              />
              <Field
                name="codigo"
                label="Código"
                value={record?.codigo ?? defaults.codigo ?? suggestedWorkNumber}
              />
            </div>
            <Field
              name="titulo"
              label="Nombre de obra"
              required
              value={record?.titulo ?? defaults.titulo}
            />
            <Field
              name="tipoTrabajo"
              label="Tipo de trabajo"
              required
              value={record?.tipoTrabajo ?? defaults.tipoTrabajo}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                name="estado"
                label="Estado"
                options={statusOptions.obra}
                value={record?.estado ?? defaults.estado ?? "pendiente_inicio"}
              />
              <Select
                name="prioridad"
                label="Prioridad"
                options={statusOptions.obraPrioridad}
                value={record?.prioridad ?? defaults.prioridad ?? "media"}
              />
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-black text-obra-ink">Cliente y equipo</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                name="contactoPrincipal"
                label="Contacto principal"
                value={record?.contactoPrincipal ?? defaults.contactoPrincipal}
              />
              <Field
                name="contactoTelefono"
                label="Teléfono contacto"
                value={record?.contactoTelefono ?? defaults.contactoTelefono}
              />
              <Field
                name="contactoEmail"
                label="Email contacto"
                type="email"
                value={record?.contactoEmail ?? defaults.contactoEmail}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                name="responsable"
                label="Responsable"
                value={record?.responsable ?? defaults.responsable}
              />
              <Field
                name="comercial"
                label="Comercial"
                value={record?.comercial ?? defaults.comercial}
              />
              <Field
                name="jefeObra"
                label="Jefe de obra"
                value={record?.jefeObra ?? defaults.jefeObra}
              />
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-black text-obra-ink">
              Ubicación y planificación
            </p>
            <Field
              name="direccion"
              label="Dirección exacta"
              required
              value={record?.direccion ?? defaults.direccion}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                name="latitud"
                label="Latitud GPS"
                type="number"
                value={record?.latitud ?? defaults.latitud}
              />
              <Field
                name="longitud"
                label="Longitud GPS"
                type="number"
                value={record?.longitud ?? defaults.longitud}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                name="fechaInicioPrevista"
                label="Inicio previsto"
                type="datetime-local"
                value={dateTimeValue(
                  record?.fechaInicioPrevista ?? defaults.fechaInicioPrevista,
                )}
              />
              <Field
                name="fechaInicio"
                label="Fecha inicio legacy"
                type="datetime-local"
                value={dateTimeValue(
                  record?.fechaInicio ?? defaults.fechaInicio,
                )}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                name="fechaInicioReal"
                label="Inicio real"
                type="datetime-local"
                value={dateTimeValue(
                  record?.fechaInicioReal ?? defaults.fechaInicioReal,
                )}
              />
              <Field
                name="fechaFinPrevista"
                label="Fin previsto"
                type="datetime-local"
                value={dateTimeValue(
                  record?.fechaFinPrevista ?? defaults.fechaFinPrevista,
                )}
              />
            </div>
            <Field
              name="fechaFinReal"
              label="Fin real"
              type="datetime-local"
              value={dateTimeValue(
                record?.fechaFinReal ?? defaults.fechaFinReal,
              )}
            />
          </div>

          {fieldAccess.sales ||
          fieldAccess.purchaseCost ||
          fieldAccess.internalCost ||
          fieldAccess.margin ? (
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-black text-obra-ink">
                Economía y recursos
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {fieldAccess.sales ? (
                  <Field
                    name="presupuestoAprobado"
                    label="Presupuesto aprobado"
                    type="number"
                    value={
                      record?.presupuestoAprobado ??
                      defaults.presupuestoAprobado ??
                      0
                    }
                  />
                ) : null}
                {fieldAccess.internalCost ? (
                  <Field
                    name="costePrevisto"
                    label="Coste previsto"
                    type="number"
                    value={record?.costePrevisto ?? defaults.costePrevisto ?? 0}
                  />
                ) : null}
                {fieldAccess.purchaseCost ? (
                  <Field
                    name="gastoReal"
                    label="Gasto real manual"
                    type="number"
                    value={record?.gastoReal ?? defaults.gastoReal ?? 0}
                  />
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {fieldAccess.margin ? (
                  <Field
                    name="margenEstimado"
                    label="Margen estimado"
                    type="number"
                    value={
                      record?.margenEstimado ?? defaults.margenEstimado ?? 0
                    }
                  />
                ) : null}
                <Field
                  name="horasEstimadas"
                  label="Horas estimadas"
                  type="number"
                  value={record?.horasEstimadas ?? defaults.horasEstimadas ?? 0}
                />
                <Field
                  name="horasReales"
                  label="Horas reales"
                  type="number"
                  value={record?.horasReales ?? defaults.horasReales ?? 0}
                />
              </div>
              {fieldAccess.purchaseCost ? (
                <Field
                  name="subcontratasCoste"
                  label="Coste subcontratas no imputado"
                  type="number"
                  value={
                    record?.subcontratasCoste ?? defaults.subcontratasCoste ?? 0
                  }
                />
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-black text-obra-ink">
              Descripción y notas
            </p>
            <Textarea
              name="descripcion"
              label="Descripción de la obra"
              value={record?.descripcion ?? defaults.descripcion}
            />
            <Textarea
              name="notas"
              label="Notas legacy visibles"
              value={record?.notas ?? defaults.notas}
            />
            <Textarea
              name="observacionesInternas"
              label="Observaciones internas"
              value={
                record?.observacionesInternas ?? defaults.observacionesInternas
              }
            />
            <Textarea
              name="notasPrivadas"
              label="Notas privadas"
              value={record?.notasPrivadas ?? defaults.notasPrivadas}
            />
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input
                name="archivada"
                type="checkbox"
                defaultChecked={
                  record?.archivada ?? defaults.archivada === "true"
                }
              />
              Obra archivada
            </label>
            <Field
              name="archivadaAt"
              label="Fecha archivo"
              type="datetime-local"
              value={dateTimeValue(record?.archivadaAt ?? defaults.archivadaAt)}
            />
          </div>
        </>
      );
    case "presupuesto":
      return (
        <>
          <RelationSelect
            name="clienteId"
            label="Cliente"
            options={clients.map((client) => [client.id, client.nombre])}
            value={record?.clienteId ?? defaults.clienteId}
          />
          <RelationSelect
            name="obraId"
            label="Obra"
            optional
            options={works.map((work) => [
              work.id,
              `${work.titulo} · ${work.client.nombre}`,
            ])}
            value={record?.obraId ?? defaults.obraId}
          />
          <Field
            name="numero"
            label="Número"
            value={record?.numero ?? suggestedBudgetNumber}
          />
          <Field name="titulo" label="Título" required value={record?.titulo} />
          <Select
            name="estado"
            label="Estado"
            options={statusOptions.presupuesto}
            value={record?.estado ?? "borrador"}
          />
          <input
            type="hidden"
            name="ivaPercent"
            value={company?.ivaDefecto ?? 21}
          />
          <Textarea
            name="partidas"
            label="Partidas editables (JSON o texto)"
            value={record?.partidas ?? defaultBudgetLines()}
          />
          <Field
            name="subtotal"
            label="Subtotal"
            type="number"
            value={record?.subtotal ?? 0}
          />
          <Field
            name="iva"
            label="IVA"
            type="number"
            value={record?.iva ?? 0}
          />
          <Field
            name="descuento"
            label="Descuento"
            type="number"
            value={record?.descuento ?? 0}
          />
          <Field
            name="total"
            label="Total"
            type="number"
            value={record?.total ?? 0}
          />
          {fieldAccess.margin ? (
            <Field
              name="margenEstimado"
              label="Margen estimado"
              type="number"
              value={record?.margenEstimado ?? 0}
            />
          ) : null}
          <Field
            name="fechaValidez"
            label="Fecha validez"
            type="datetime-local"
            value={
              dateTimeValue(record?.fechaValidez) ||
              dateTimeValue(addDays(new Date(), 15))
            }
          />
          <Field
            name="fechaEnvio"
            label="Fecha envío"
            type="datetime-local"
            value={dateTimeValue(record?.fechaEnvio)}
          />
          <Field
            name="fechaSeguimiento"
            label="Fecha seguimiento"
            type="datetime-local"
            value={dateTimeValue(record?.fechaSeguimiento)}
          />
          <Textarea
            name="condiciones"
            label="Condiciones"
            value={record?.condiciones ?? company?.condicionesPorDefecto}
          />
          <Textarea
            name="observaciones"
            label="Observaciones"
            value={record?.observaciones}
          />
          <Field
            name="formaPago"
            label="Forma de pago"
            value={record?.formaPago ?? "Transferencia / según acuerdo"}
          />
        </>
      );
    case "factura":
      return (
        <>
          <RelationSelect
            name="clienteId"
            label="Cliente"
            options={clients.map((client) => [client.id, client.nombre])}
            value={record?.clienteId ?? defaults.clienteId}
          />
          <RelationSelect
            name="obraId"
            label="Obra"
            optional
            options={works.map((work) => [
              work.id,
              `${work.titulo} · ${work.client.nombre}`,
            ])}
            value={record?.obraId ?? defaults.obraId}
          />
          <Field
            name="numero"
            label="Número"
            value={record?.numero ?? suggestedInvoiceNumber}
          />
          <Field
            name="concepto"
            label="Concepto"
            required
            value={record?.concepto}
          />
          <Select
            name="estado"
            label="Estado"
            options={statusOptions.factura}
            value={record?.estado ?? "borrador"}
          />
          <input
            type="hidden"
            name="ivaPercent"
            value={company?.ivaDefecto ?? 21}
          />
          <Textarea
            name="partidas"
            label="Partidas editables (JSON o texto)"
            value={record?.partidas ?? defaultInvoiceLines()}
          />
          <Field
            name="importeBase"
            label="Base imponible"
            type="number"
            value={record?.importeBase ?? 0}
          />
          <Field
            name="iva"
            label="IVA"
            type="number"
            value={record?.iva ?? 0}
          />
          <Field
            name="total"
            label="Total"
            type="number"
            value={record?.total ?? 0}
          />
          <Field
            name="pagado"
            label="Pagado"
            type="number"
            value={record?.pagado ?? 0}
          />
          <Field
            name="pendiente"
            label="Pendiente"
            type="number"
            value={record?.pendiente ?? 0}
          />
          <Field
            name="fechaEmision"
            label="Fecha emisión"
            type="datetime-local"
            value={
              dateTimeValue(record?.fechaEmision) ?? dateTimeValue(new Date())
            }
          />
          <Field
            name="fechaVencimiento"
            label="Fecha vencimiento"
            type="datetime-local"
            value={
              dateTimeValue(record?.fechaVencimiento) ??
              dateTimeValue(new Date())
            }
          />
          <Textarea
            name="observaciones"
            label="Observaciones"
            value={record?.observaciones}
          />
          <Field
            name="metodoPago"
            label="Método de pago"
            value={record?.metodoPago ?? "transferencia"}
          />
          <Textarea
            name="datosBancarios"
            label="Datos bancarios"
            value={record?.datosBancarios ?? company?.iban}
          />
        </>
      );
    case "pago":
      return (
        <>
          <RelationSelect
            name="facturaId"
            label="Factura"
            options={invoices.map((invoice) => [
              invoice.id,
              `${invoice.numero} · ${invoice.client.nombre} · ${invoice.concepto}`,
            ])}
            value={record?.facturaId ?? defaults.facturaId}
          />
          <Field
            name="importe"
            label="Importe"
            type="number"
            required
            value={record?.importe ?? 0}
          />
          <Field
            name="metodo"
            label="Método"
            required
            value={record?.metodo ?? "transferencia"}
          />
          <Select
            name="tipoPago"
            label="Tipo"
            options={statusOptions.pago}
            value={record?.tipo ?? "pago_parcial"}
          />
          <Field
            name="fecha"
            label="Fecha"
            type="datetime-local"
            value={dateTimeValue(record?.fecha) ?? dateTimeValue(new Date())}
          />
          <Textarea name="notas" label="Notas" value={record?.notas} />
        </>
      );
    case "gasto":
      return (
        <>
          <RelationSelect
            name="obraId"
            label="Obra"
            options={works.map((work) => [
              work.id,
              `${work.titulo} · ${work.client.nombre}`,
            ])}
            value={record?.obraId ?? defaults.obraId}
          />
          <Field
            name="proveedor"
            label="Proveedor"
            required
            value={record?.proveedor}
          />
          <Field
            name="concepto"
            label="Concepto"
            required
            value={record?.concepto}
          />
          <Select
            name="categoria"
            label="Categoría"
            options={statusOptions.gasto}
            value={record?.categoria ?? "material"}
          />
          <Field
            name="importe"
            label="Importe"
            type="number"
            required
            value={record?.importe ?? 0}
          />
          <Field
            name="fecha"
            label="Fecha"
            type="datetime-local"
            value={dateTimeValue(record?.fecha) ?? dateTimeValue(new Date())}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              name="paymentStatus"
              label="Estado de pago"
              options={statusOptions.gastoPago}
              value={record?.paymentStatus ?? "unknown"}
            />
            <Select
              name="costBehavior"
              label="Tipo de coste"
              options={statusOptions.costBehavior}
              value={record?.costBehavior ?? "unknown"}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              name="paymentDueDate"
              label="Fecha prevista de pago"
              type="datetime-local"
              value={dateTimeValue(record?.paymentDueDate)}
            />
            <Field
              name="paidAt"
              label="Fecha pagado"
              type="datetime-local"
              value={dateTimeValue(record?.paidAt)}
            />
          </div>
          <Field
            name="fotoTicketUrl"
            label="Foto ticket URL"
            value={record?.fotoTicketUrl}
          />
          <Textarea name="notas" label="Notas" value={record?.notas} />
        </>
      );
    case "material":
      return (
        <>
          <RelationSelect
            name="obraId"
            label="Obra"
            options={works.map((work) => [
              work.id,
              `${work.titulo} · ${work.client.nombre}`,
            ])}
            value={record?.obraId ?? defaults.obraId}
          />
          <Field name="nombre" label="Nombre" required value={record?.nombre} />
          <Field
            name="cantidad"
            label="Cantidad"
            required
            value={record?.cantidad}
          />
          <Select
            name="estado"
            label="Estado"
            options={statusOptions.material}
            value={record?.estado ?? "pendiente"}
          />
          <Textarea name="notas" label="Notas" value={record?.notas} />
        </>
      );
    case "recordatorio":
      return (
        <>
          <RelationSelect
            name="clienteId"
            label="Cliente"
            optional
            options={clients.map((client) => [client.id, client.nombre])}
            value={record?.clienteId ?? defaults.clienteId}
          />
          <RelationSelect
            name="contactId"
            label="Contacto"
            optional
            options={contacts.map((contact) => [
              contact.id,
              `${contact.nombre}${contact.apellidos ? ` ${contact.apellidos}` : ""} · ${contact.client.nombre}`,
            ])}
            value={record?.contactId ?? defaults.contactId}
          />
          <RelationSelect
            name="obraId"
            label="Obra"
            optional
            options={works.map((work) => [
              work.id,
              `${work.titulo} · ${work.client.nombre}`,
            ])}
            value={record?.obraId ?? defaults.obraId}
          />
          <RelationSelect
            name="facturaId"
            label="Factura"
            optional
            options={invoices.map((invoice) => [
              invoice.id,
              `${invoice.numero} · ${invoice.client.nombre}`,
            ])}
            value={record?.facturaId ?? defaults.facturaId}
          />
          <RelationSelect
            name="presupuestoId"
            label="Presupuesto"
            optional
            options={budgets.map((budget) => [
              budget.id,
              `${budget.numero} · ${budget.client.nombre}`,
            ])}
            value={record?.presupuestoId ?? defaults.presupuestoId}
          />
          <Select
            name="tipoRecordatorio"
            label="Tipo"
            options={statusOptions.recordatorioTipo}
            value={
              record?.tipo ??
              defaults.tipoRecordatorio ??
              "recordatorio_interno"
            }
          />
          <Select
            name="canal"
            label="Canal"
            options={statusOptions.recordatorioCanal}
            value={record?.canal ?? "interno"}
          />
          <Select
            name="estado"
            label="Estado"
            options={statusOptions.recordatorioEstado}
            value={record?.estado ?? "borrador"}
          />
          <Field
            name="fechaProgramada"
            label="Fecha programada"
            type="datetime-local"
            value={
              dateTimeValue(record?.fechaProgramada) ??
              dateTimeValue(tomorrowAtTen())
            }
          />
          <Textarea
            name="mensaje"
            label="Mensaje"
            required
            value={record?.mensaje}
          />
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input
              name="requiereConfirmacion"
              type="checkbox"
              defaultChecked={record?.requiereConfirmacion ?? true}
            />
            Requiere confirmación
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input
              name="confirmadoPorUsuario"
              type="checkbox"
              defaultChecked={record?.confirmadoPorUsuario ?? false}
            />
            Confirmado por usuario
          </label>
        </>
      );
    case "eventoAgenda":
      return (
        <>
          <Field
            name="titulo"
            label="Título"
            required
            value={record?.titulo ?? defaults.titulo}
          />
          <Textarea
            name="descripcion"
            label="Descripción"
            value={record?.descripcion ?? defaults.descripcion}
          />
          <Select
            name="tipoEvento"
            label="Tipo"
            options={statusOptions.eventoTipo}
            value={
              record?.tipo ?? defaults.tipoEvento ?? "recordatorio_interno"
            }
          />
          <Select
            name="estado"
            label="Estado"
            options={statusOptions.eventoEstado}
            value={record?.estado ?? defaults.estado ?? "pendiente"}
          />
          <Field
            name="fechaInicio"
            label="Fecha inicio"
            type="datetime-local"
            required
            value={
              record?.fechaInicio
                ? dateTimeValue(record.fechaInicio)
                : defaults.fechaInicio
            }
          />
          <Field
            name="fechaFin"
            label="Fecha fin"
            type="datetime-local"
            value={
              record?.fechaFin
                ? dateTimeValue(record.fechaFin)
                : defaults.fechaFin
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              name="horaInicio"
              label="Hora inicio"
              type="time"
              value={record?.horaInicio ?? defaults.horaInicio}
            />
            <Field
              name="horaFin"
              label="Hora fin"
              type="time"
              value={record?.horaFin ?? defaults.horaFin}
            />
          </div>
          <AgendaContextSelector
            clients={clients.map((item) => ({
              id: item.id,
              label: item.nombre,
            }))}
            works={works.map((item) => ({
              id: item.id,
              label: `${item.titulo} · ${item.client.nombre}`,
              clientId: item.clienteId,
            }))}
            contacts={contacts.map((item) => ({
              id: item.id,
              label: `${item.nombre}${item.apellidos ? ` ${item.apellidos}` : ""}`,
              clientId: item.clientId,
            }))}
            budgets={budgets.map((item) => ({
              id: item.id,
              label: `${item.numero} · ${item.client.nombre}`,
              clientId: item.clienteId,
              workId: item.obraId,
            }))}
            invoices={invoices.map((item) => ({
              id: item.id,
              label: `${item.numero} · ${item.client.nombre}`,
              clientId: item.clienteId,
              workId: item.obraId,
            }))}
            documents={documents.map((item) => ({
              id: item.id,
              label: item.name,
              clientId: item.clientId,
              workId: item.workId,
            }))}
            initial={{
              clientId: record?.clienteId ?? defaults.clienteId,
              workId: record?.obraId ?? defaults.obraId,
              contactId: record?.contactId ?? defaults.contactId,
              budgetId: record?.presupuestoId ?? defaults.presupuestoId,
              invoiceId: record?.facturaId ?? defaults.facturaId,
            }}
          />
          <RelationSelect
            name="recordatorioId"
            label="Recordatorio"
            optional
            options={reminders.map((reminder) => [
              reminder.id,
              `${statusLabel(reminder.tipo)} · ${reminder.client?.nombre ?? "Interno"}`,
            ])}
            value={record?.recordatorioId ?? defaults.recordatorioId}
          />
          <Field
            name="direccion"
            label="Dirección"
            value={record?.direccion ?? defaults.direccion}
          />
          <Textarea
            name="notas"
            label="Notas"
            value={record?.notas ?? defaults.notas}
          />
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input
              name="requiereConfirmacion"
              type="checkbox"
              defaultChecked={
                record?.requiereConfirmacion ??
                defaults.requiereConfirmacion === "true"
              }
            />
            Requiere confirmación antes de notificar o modificar algo sensible
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input
              name="confirmadoPorUsuario"
              type="checkbox"
              defaultChecked={
                record?.confirmadoPorUsuario ??
                defaults.confirmadoPorUsuario === "true"
              }
            />
            Confirmado por usuario
          </label>
        </>
      );
    case "contacto":
      return (
        <>
          <RelationSelect
            name="clientId"
            label="Cliente"
            options={clients.map((client) => [client.id, client.nombre])}
            value={record?.clientId ?? defaults.clientId}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              name="nombre"
              label="Nombre"
              required
              value={record?.nombre ?? defaults.nombre}
            />
            <Field
              name="apellidos"
              label="Apellidos"
              value={record?.apellidos ?? defaults.apellidos}
            />
          </div>
          <Field
            name="cargo"
            label="Cargo o relación"
            value={record?.cargo ?? defaults.cargo}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              name="telefono"
              label="Teléfono"
              value={record?.telefono ?? defaults.telefono}
            />
            <Field
              name="email"
              label="Email"
              type="email"
              value={record?.email ?? defaults.email}
            />
          </div>
          <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <Checkbox
              name="isPrimary"
              label="Contacto principal"
              checked={record?.isPrimary ?? defaults.isPrimary === "true"}
            />
            <Checkbox
              name="isBillingContact"
              label="Contacto de facturación"
              checked={
                record?.isBillingContact ?? defaults.isBillingContact === "true"
              }
            />
            <Checkbox
              name="isSiteContact"
              label="Contacto de obra"
              checked={
                record?.isSiteContact ?? defaults.isSiteContact === "true"
              }
            />
          </div>
          <Textarea
            name="notes"
            label="Notas internas del contacto"
            value={record?.notes ?? defaults.notes}
          />
          <Checkbox
            name="archived"
            label="Archivar contacto"
            checked={
              Boolean(record?.archivedAt) || defaults.archived === "true"
            }
          />
          <Field
            name="archivedAt"
            label="Fecha archivo"
            type="datetime-local"
            value={dateTimeValue(record?.archivedAt ?? defaults.archivedAt)}
          />
        </>
      );
    case "notaInterna":
      return (
        <>
          <Notice
            tone="info"
            description="Las notas internas no se incluyen en PDFs ni mensajes externos."
          />
          <RelationSelect
            name="clientId"
            label="Cliente"
            optional
            options={clients.map((client) => [client.id, client.nombre])}
            value={record?.clientId ?? defaults.clientId}
          />
          <RelationSelect
            name="workId"
            label="Obra"
            optional
            options={works.map((work) => [
              work.id,
              `${work.titulo} · ${work.client.nombre}`,
            ])}
            value={record?.workId ?? defaults.workId}
          />
          <RelationSelect
            name="budgetId"
            label="Presupuesto"
            optional
            options={budgets.map((budget) => [
              budget.id,
              `${budget.numero} · ${budget.client.nombre}`,
            ])}
            value={record?.budgetId ?? defaults.budgetId}
          />
          <RelationSelect
            name="invoiceId"
            label="Factura"
            optional
            options={invoices.map((invoice) => [
              invoice.id,
              `${invoice.numero} · ${invoice.client.nombre}`,
            ])}
            value={record?.invoiceId ?? defaults.invoiceId}
          />
          <Textarea
            name="content"
            label="Contenido"
            required
            value={record?.content ?? defaults.content}
          />
          <Checkbox
            name="archived"
            label="Archivar nota"
            checked={
              Boolean(record?.archivedAt) || defaults.archived === "true"
            }
          />
          <Field
            name="archivedAt"
            label="Fecha archivo"
            type="datetime-local"
            value={dateTimeValue(record?.archivedAt ?? defaults.archivedAt)}
          />
        </>
      );
    case "documento":
      return (
        <>
          <Notice
            tone="info"
            description="No hay almacenamiento de archivos configurado: esta ficha registra metadatos y una URL HTTPS o ruta interna si ya existe un archivo real."
          />
          <Field
            name="name"
            label="Nombre documental"
            required
            value={record?.name ?? defaults.name}
          />
          <Field
            name="originalName"
            label="Nombre original"
            value={record?.originalName ?? defaults.originalName}
          />
          <Select
            name="category"
            label="Categoría"
            options={statusOptions.documentoCategoria}
            value={record?.category ?? defaults.category ?? "otro"}
          />
          <Select
            name="mimeType"
            label="Tipo MIME"
            options={statusOptions.mimeType}
            value={record?.mimeType ?? defaults.mimeType ?? "application/pdf"}
          />
          <Field
            name="size"
            label="Tamaño en bytes"
            type="number"
            value={record?.size ?? defaults.size}
          />
          <Field
            name="url"
            label="URL segura o ruta interna existente"
            value={record?.url ?? defaults.url}
          />
          <RelationSelect
            name="clientId"
            label="Cliente"
            optional
            options={clients.map((client) => [client.id, client.nombre])}
            value={record?.clientId ?? defaults.clientId}
          />
          <RelationSelect
            name="workId"
            label="Obra"
            optional
            options={works.map((work) => [
              work.id,
              `${work.titulo} · ${work.client.nombre}`,
            ])}
            value={record?.workId ?? defaults.workId}
          />
          <RelationSelect
            name="budgetId"
            label="Presupuesto"
            optional
            options={budgets.map((budget) => [
              budget.id,
              `${budget.numero} · ${budget.client.nombre}`,
            ])}
            value={record?.budgetId ?? defaults.budgetId}
          />
          <RelationSelect
            name="invoiceId"
            label="Factura"
            optional
            options={invoices.map((invoice) => [
              invoice.id,
              `${invoice.numero} · ${invoice.client.nombre}`,
            ])}
            value={record?.invoiceId ?? defaults.invoiceId}
          />
          <Checkbox
            name="archived"
            label="Archivar documento"
            checked={
              Boolean(record?.archivedAt) || defaults.archived === "true"
            }
          />
          <Field
            name="archivedAt"
            label="Fecha archivo"
            type="datetime-local"
            value={dateTimeValue(record?.archivedAt ?? defaults.archivedAt)}
          />
        </>
      );
    case "foto":
      return (
        <>
          <RelationSelect
            name="obraId"
            label="Obra"
            options={works.map((work) => [
              work.id,
              `${work.titulo} · ${work.client.nombre}`,
            ])}
            value={record?.obraId ?? defaults.obraId}
          />
          <RelationSelect
            name="documentId"
            label="Documento relacionado"
            optional
            options={documents.map((document) => [
              document.id,
              `${document.name} · ${document.work?.titulo ?? document.client?.nombre ?? "Sin entidad"}`,
            ])}
            value={record?.documentId ?? defaults.documentId}
          />
          <Select
            name="categoria"
            label="Categoría"
            options={statusOptions.fotoCategoria}
            value={record?.categoria ?? defaults.categoria ?? "durante"}
          />
          <Field
            name="titulo"
            label="Título"
            required
            value={record?.titulo ?? defaults.titulo}
          />
          <Field
            name="url"
            label="URL segura de imagen existente"
            value={record?.url ?? defaults.url}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              name="autor"
              label="Autor"
              value={record?.autor ?? defaults.autor}
            />
            <Field
              name="ubicacion"
              label="Ubicación"
              value={record?.ubicacion ?? defaults.ubicacion}
            />
          </div>
          <Field
            name="tomadaEn"
            label="Fecha"
            type="datetime-local"
            value={
              dateTimeValue(record?.tomadaEn ?? defaults.tomadaEn) ||
              dateTimeValue(new Date())
            }
          />
          <Textarea
            name="notas"
            label="Descripción interna"
            value={record?.notas ?? defaults.notas}
          />
        </>
      );
  }
}

function Field({
  name,
  label,
  value,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  value?: string | number | null;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <input
        className="field"
        name={name}
        type={type}
        step={type === "number" ? "0.01" : undefined}
        required={required}
        defaultValue={value ?? ""}
      />
    </label>
  );
}

function Textarea({
  name,
  label,
  value,
  required = false,
}: {
  name: string;
  label: string;
  value?: string | null;
  required?: boolean;
}) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <textarea
        className="field min-h-28 py-3 leading-6"
        name={name}
        required={required}
        defaultValue={value ?? ""}
      />
    </label>
  );
}

function Select({
  name,
  label,
  options,
  value,
}: {
  name: string;
  label: string;
  options: string[];
  value?: string | null;
}) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <select className="field" name={name} defaultValue={value ?? options[0]}>
        {options.map((option) => (
          <option key={option} value={option}>
            {statusLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Checkbox({
  name,
  label,
  checked = false,
}: {
  name: string;
  label: string;
  checked?: boolean;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
      <input
        name={name}
        type="checkbox"
        defaultChecked={checked}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}

function ClientTypeSelect({ value }: { value?: string | null }) {
  const options = [
    "Particular",
    "Autónomo",
    "Empresa",
    "Comunidad de propietarios",
    "Otro",
  ];
  const allOptions =
    value && !options.includes(value) ? [value, ...options] : options;
  return (
    <label>
      <span className="label mb-1 block">Tipo</span>
      <select
        className="field"
        name="tipoCliente"
        defaultValue={value ?? "Particular"}
      >
        {allOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function RelationSelect({
  name,
  label,
  options,
  value,
  optional = false,
}: {
  name: string;
  label: string;
  options: string[][];
  value?: string | null;
  optional?: boolean;
}) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <select
        className="field"
        name={name}
        required={!optional}
        defaultValue={value ?? ""}
      >
        {optional ? (
          <option value="">Sin asociar</option>
        ) : (
          <option value="">Seleccionar</option>
        )}
        {options.map(([id, labelText]) => (
          <option key={id} value={id}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function valueFor(
  record: ManualRecord | null,
  defaults: Record<string, string | undefined>,
  key: string,
  fallback = "",
) {
  const value = record?.[key];
  if (value !== null && value !== undefined && value !== "")
    return String(value);
  return defaults[key] ?? fallback;
}

function dateTimeValue(value?: Date | string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => part.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function tomorrowAtTen() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function defaultBudgetLines() {
  return JSON.stringify(
    [
      {
        descripcion: "Partida principal",
        cantidad: 1,
        unidad: "servicio",
        precioUnitario: 0,
        total: 0,
        categoria: "General",
      },
    ],
    null,
    2,
  );
}

function defaultInvoiceLines() {
  return JSON.stringify(
    [
      {
        descripcion: "Servicio realizado",
        cantidad: 1,
        unidad: "servicio",
        precioUnitario: 0,
        total: 0,
        categoria: "Factura",
      },
    ],
    null,
    2,
  );
}

function defaultReturnTo(tipo: EntityType) {
  const targets: Record<EntityType, string> = {
    cliente: "/clientes",
    obra: "/obras",
    presupuesto: "/presupuestos",
    factura: "/dinero",
    pago: "/dinero",
    gasto: "/gastos-materiales",
    material: "/gastos-materiales",
    recordatorio: "/recordatorios",
    eventoAgenda: "/agenda",
    contacto: "/clientes",
    notaInterna: "/hoy",
    documento: "/documentos",
    foto: "/obras",
  };
  return targets[tipo];
}
