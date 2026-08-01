import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Copy,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  History,
  ImageIcon,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Receipt,
  Send,
  UserRound,
  WalletCards,
} from "lucide-react";

export type WorkOrderTone = "neutral" | "success" | "warning" | "danger" | "info";

export type WorkOrderActionIcon = "approve" | "convert" | "copy" | "document" | "edit" | "more" | "send";

export type WorkOrderAction = {
  label: string;
  href: string | null;
  allowed: boolean;
  icon?: WorkOrderActionIcon;
  variant?: "primary" | "secondary" | "link";
};

export type WorkOrderBreadcrumb = {
  label: string;
  href: string | null;
  allowed: boolean;
};

export type WorkOrderTab = {
  id: string;
  label: string;
  href: string | null;
  allowed: boolean;
  active: boolean;
  icon?: "checklist" | "costs" | "documents" | "evidence" | "history" | "scope" | "summary";
};

export type WorkOrderRelation = {
  label: string;
  code?: string | null;
  href?: string | null;
};

export type WorkOrderSupplier = {
  name: string;
  ratingLabel?: string | null;
  relationshipLabel?: string | null;
  href?: string | null;
};

export type WorkOrderResponsible = {
  name: string;
  role?: string | null;
  avatarUrl?: string | null;
  href?: string | null;
};

export type WorkOrderLine = {
  id: string;
  code?: string | null;
  concept: string;
  quantityLabel?: string | null;
  unitPrice?: number | null;
  totalAmount?: number | null;
  statusLabel?: string | null;
  statusTone?: WorkOrderTone;
  action?: WorkOrderAction | null;
};

export type WorkOrderDocument = {
  id: string;
  name: string;
  kind?: "pdf" | "spreadsheet" | "other";
  typeLabel?: string | null;
  sizeLabel?: string | null;
  dateLabel?: string | null;
  action?: WorkOrderAction | null;
};

export type WorkOrderChecklistItem = {
  id: string;
  label: string;
  completed: boolean | null;
  statusLabel?: string | null;
  tone?: WorkOrderTone;
};

export type WorkOrderEvidence = {
  id: string;
  url: string | null;
  alt: string;
  caption?: string | null;
  action?: WorkOrderAction | null;
};

export type WorkOrderEvent = {
  id: string;
  label: string;
  dateLabel?: string | null;
  actor?: string | null;
  detail?: string | null;
  tone?: WorkOrderTone;
  action?: WorkOrderAction | null;
};

export type WorkOrderAmounts = {
  currency: string | null;
  assignedBudget: number | null;
  estimatedAmount: number | null;
  approvedAmount: number | null;
  forecastFinalCost: number | null;
  deviationAmount: number | null;
  deviationPercent: number | null;
  deviationTone?: WorkOrderTone;
  actualCost: number | null;
};

export type WorkOrderStateAndDates = {
  statusLabel: string | null;
  statusTone?: WorkOrderTone;
  approvalFlowLabel?: string | null;
  commitmentDateLabel?: string | null;
  startDateLabel?: string | null;
  estimatedEndDateLabel?: string | null;
  estimatedDaysLabel?: string | null;
  elapsedDaysLabel?: string | null;
  progressPercent: number | null;
  progressTone?: WorkOrderTone;
};

export type WorkOrderDetail = {
  id: string;
  code: string | null;
  statusLabel: string | null;
  statusTone?: WorkOrderTone;
  title: string | null;
  description?: string | null;
  scope?: string | null;
  location?: string | null;
  priorityLabel?: string | null;
  priorityTone?: WorkOrderTone;
  tags: string[];
  work: WorkOrderRelation | null;
  costLine: WorkOrderRelation | null;
  supplier: WorkOrderSupplier | null;
  responsible: WorkOrderResponsible | null;
  createdAtLabel?: string | null;
  updatedAtLabel?: string | null;
  stateAndDates: WorkOrderStateAndDates;
  amounts: WorkOrderAmounts;
  lines: WorkOrderLine[];
  linesTotal: number | null;
  documents: WorkOrderDocument[];
  documentsTotal: number | null;
  checklist: WorkOrderChecklistItem[];
  checklistCompleted: number | null;
  checklistTotal: number | null;
  evidence: WorkOrderEvidence[];
  evidenceTotal: number | null;
  events: WorkOrderEvent[];
};

export type WorkOrderDetailActions = {
  header?: WorkOrderAction[];
  convertCost?: WorkOrderAction | null;
  allLines?: WorkOrderAction | null;
  allDocuments?: WorkOrderAction | null;
  fullChecklist?: WorkOrderAction | null;
  allEvidence?: WorkOrderAction | null;
  fullHistory?: WorkOrderAction | null;
};

export type WorkOrderDetailOverviewProps = {
  order: WorkOrderDetail | null;
  breadcrumbs?: WorkOrderBreadcrumb[];
  tabs?: WorkOrderTab[];
  actions?: WorkOrderDetailActions;
};

const toneText: Record<WorkOrderTone, string> = {
  neutral: "text-content",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-brand-strong",
};

const toneBadge: Record<WorkOrderTone, string> = {
  neutral: "bg-subtle text-content-secondary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-brand-soft text-brand-strong",
};

const toneFill: Record<WorkOrderTone, string> = {
  neutral: "bg-content-tertiary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-brand",
};

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function tone(value?: WorkOrderTone): WorkOrderTone {
  return value ?? "neutral";
}

function safeHref(value: string | null | undefined) {
  return Boolean(value && (value.startsWith("/") || value.startsWith("https://")));
}

function safeImageUrl(value: string | null | undefined) {
  return Boolean(value && (value.startsWith("/") || value.startsWith("https://")));
}

function createMoneyFormatter(currency: string | null) {
  if (!currency?.trim()) return null;
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 2 });
  } catch {
    return null;
  }
}

export function WorkOrderDetailOverview({ order, breadcrumbs = [], tabs = [], actions = {} }: WorkOrderDetailOverviewProps) {
  if (!order) return <MissingOrder />;
  const money = createMoneyFormatter(order.amounts.currency);
  const formatMoney = (value: number | null | undefined) => finite(value) && money ? money.format(value) : "—";
  const number = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
  const formatPercent = (value: number | null | undefined) => finite(value) ? `${number.format(value)}%` : "—";
  const visibleHeaderActions = (actions.header ?? []).filter(canRenderAction);
  const visibleTabs = tabs.filter((tab) => tab.allowed && (tab.active || safeHref(tab.href)));

  return (
    <section className="grid min-w-0 gap-3" aria-labelledby="work-order-title">
      {breadcrumbs.length ? <Breadcrumbs items={breadcrumbs} /> : null}

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 id="work-order-title" className="text-2xl font-black text-content">{order.code?.trim() || "Detalle de orden"}</h2><StatusBadge label={order.statusLabel} toneValue={order.statusTone} /></div>{order.title ? <p className="mt-1 text-xs text-content-secondary">{order.title}</p> : null}</div>
        {visibleHeaderActions.length ? <div className="flex flex-wrap gap-2">{visibleHeaderActions.map((action) => <ActionLink key={`${action.label}-${action.href}`} action={action} />)}</div> : null}
      </header>

      <section className="grid min-w-0 gap-3 rounded-xl border border-border bg-surface p-3 shadow-soft sm:grid-cols-2 xl:grid-cols-[1.15fr_1fr_1.08fr_1fr_.85fr]" aria-label="Datos principales de la orden">
        <IdentityFact icon={ClipboardList} label="Obra"><RelationValue relation={order.work} /></IdentityFact>
        <IdentityFact icon={Receipt} label="Partida"><RelationValue relation={order.costLine} /></IdentityFact>
        <IdentityFact icon={Building2} label="Proveedor / subcontratista"><SupplierValue supplier={order.supplier} /></IdentityFact>
        <IdentityFact icon={UserRound} label="Responsable"><ResponsibleValue responsible={order.responsible} /></IdentityFact>
        <IdentityFact icon={CalendarDays} label="Registro"><span className="grid gap-1 text-[9px] text-content-secondary"><span><strong className="text-content">Creada</strong> {order.createdAtLabel ?? "—"}</span><span><strong className="text-content">Actualizada</strong> {order.updatedAtLabel ?? "—"}</span></span></IdentityFact>
      </section>

      {visibleTabs.length ? <OrderTabs tabs={visibleTabs} /> : null}

      <section className="grid min-w-0 gap-3 xl:grid-cols-[1.15fr_1fr_.95fr]">
        <OrderPanel title="Resumen de la orden">
          <dl className="grid gap-3 p-3 text-[10px]">
            <DetailRow label="Título" value={order.title} />
            <DetailRow label="Descripción" value={order.description} multiline />
            <DetailRow label="Alcance" value={order.scope} multiline />
            <DetailRow label="Ubicación" value={order.location} />
            <div className="grid grid-cols-[5.2rem_minmax(0,1fr)] gap-3"><dt className="font-semibold text-content-secondary">Prioridad</dt><dd><StatusBadge label={order.priorityLabel} toneValue={order.priorityTone} /></dd></div>
            <div className="grid grid-cols-[5.2rem_minmax(0,1fr)] gap-3"><dt className="font-semibold text-content-secondary">Etiquetas</dt><dd className="flex flex-wrap gap-1.5">{order.tags.length ? order.tags.map((tag) => <span key={tag} className="rounded-md bg-brand-soft px-2 py-1 text-[8px] font-semibold text-brand-strong">{tag}</span>) : <span className="text-content-secondary">—</span>}</dd></div>
          </dl>
        </OrderPanel>

        <OrderPanel title="Estado y fechas">
          <StateAndDatesPanel state={order.stateAndDates} number={number} />
        </OrderPanel>

        <OrderPanel title="Coste y presupuesto">
          <AmountsPanel amounts={order.amounts} formatMoney={formatMoney} formatPercent={formatPercent} action={actions.convertCost} />
        </OrderPanel>
      </section>

      {order.lines.length || finite(order.linesTotal) ? (
        <OrderPanel title={`Líneas de la orden${finite(order.linesTotal) ? ` (${number.format(order.linesTotal)})` : ""}`} footerAction={actions.allLines}>
          <LinesTable lines={order.lines} formatMoney={formatMoney} />
        </OrderPanel>
      ) : null}

      <section className="grid min-w-0 gap-3 xl:grid-cols-[1fr_1fr_1fr]">
        <OrderPanel title={`Documentos vinculados${finite(order.documentsTotal) ? ` (${number.format(order.documentsTotal)})` : ""}`} footerAction={actions.allDocuments}>
          <DocumentsList documents={order.documents} />
        </OrderPanel>

        <OrderPanel title="Checklist de la orden" footerAction={actions.fullChecklist} meta={finite(order.checklistCompleted) || finite(order.checklistTotal) ? `${finite(order.checklistCompleted) ? number.format(order.checklistCompleted) : "—"} / ${finite(order.checklistTotal) ? number.format(order.checklistTotal) : "—"} completadas` : null}>
          <Checklist items={order.checklist} />
        </OrderPanel>

        <OrderPanel title={`Evidencias fotográficas${finite(order.evidenceTotal) ? ` (${number.format(order.evidenceTotal)})` : ""}`} footerAction={actions.allEvidence}>
          <EvidenceGrid evidence={order.evidence} />
        </OrderPanel>
      </section>

      <OrderPanel title="Timeline / Historial de la orden" footerAction={actions.fullHistory}>
        <OrderTimeline events={order.events} />
      </OrderPanel>
    </section>
  );
}

function Breadcrumbs({ items }: { items: WorkOrderBreadcrumb[] }) {
  const visible = items.filter((item) => item.allowed);
  return <nav aria-label="Ruta de navegación"><ol className="flex flex-wrap items-center gap-2 text-[10px] text-content-secondary">{visible.map((item, index) => <li key={`${item.label}-${index}`} className="flex items-center gap-2">{index ? <span aria-hidden="true">/</span> : null}{safeHref(item.href) ? <Link href={item.href!} className="inline-flex min-h-11 items-center hover:text-content hover:underline">{item.label}</Link> : <span>{item.label}</span>}</li>)}</ol></nav>;
}

function OrderTabs({ tabs }: { tabs: WorkOrderTab[] }) {
  return <nav className="overflow-x-auto border-b border-border" aria-label="Secciones de la orden"><div className="flex min-w-max">{tabs.map((tab) => { const Icon = tabIcon(tab.icon); const classes = `inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-[10px] font-semibold ${tab.active ? "border-success text-success" : "border-transparent text-content-secondary hover:text-content"}`; return tab.active && !safeHref(tab.href) ? <span key={tab.id} aria-current="page" className={classes}><Icon size={14} aria-hidden="true" />{tab.label}</span> : <Link key={tab.id} href={tab.href!} aria-current={tab.active ? "page" : undefined} className={classes}><Icon size={14} aria-hidden="true" />{tab.label}</Link>; })}</div></nav>;
}

function tabIcon(icon?: WorkOrderTab["icon"]) {
  if (icon === "checklist") return ListChecks;
  if (icon === "costs") return WalletCards;
  if (icon === "documents") return FileText;
  if (icon === "evidence") return ImageIcon;
  if (icon === "history") return History;
  if (icon === "scope") return ClipboardCheck;
  return ClipboardList;
}

function IdentityFact({ icon: Icon, label, children }: { icon: typeof ClipboardList; label: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 items-start gap-3 border-b border-border pb-3 last:border-0 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3 sm:last:border-r-0"><span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong"><Icon size={18} aria-hidden="true" /></span><span className="min-w-0"><span className="block text-[8px] font-semibold text-content-secondary">{label}</span><span className="mt-1 block min-w-0">{children}</span></span></div>;
}

function RelationValue({ relation }: { relation: WorkOrderRelation | null }) {
  if (!relation) return <span className="text-[10px] text-content-secondary">Sin relación registrada</span>;
  const content = <><strong className="block truncate text-[10px] text-content">{relation.label}</strong>{relation.code ? <small className="mt-1 block text-[8px] text-content-secondary">{relation.code}</small> : null}</>;
  return safeHref(relation.href) ? <Link href={relation.href!} className="block hover:underline">{content}</Link> : <span className="block">{content}</span>;
}

function SupplierValue({ supplier }: { supplier: WorkOrderSupplier | null }) {
  if (!supplier) return <span className="text-[10px] text-content-secondary">Sin proveedor registrado</span>;
  const content = <><strong className="block truncate text-[10px] text-content">{supplier.name}</strong><small className="mt-1 block truncate text-[8px] text-content-secondary">{[supplier.ratingLabel, supplier.relationshipLabel].filter(Boolean).join(" · ") || "Sin valoración registrada"}</small></>;
  return safeHref(supplier.href) ? <Link href={supplier.href!} className="block hover:underline">{content}</Link> : <span className="block">{content}</span>;
}

function ResponsibleValue({ responsible }: { responsible: WorkOrderResponsible | null }) {
  if (!responsible) return <span className="text-[10px] text-content-secondary">Sin responsable registrado</span>;
  const content = <span className="flex min-w-0 items-center gap-2"><Avatar name={responsible.name} url={responsible.avatarUrl} /><span className="min-w-0"><strong className="block truncate text-[10px] text-content">{responsible.name}</strong><small className="block truncate text-[8px] text-content-secondary">{responsible.role ?? "Rol sin informar"}</small></span></span>;
  return safeHref(responsible.href) ? <Link href={responsible.href!} className="block hover:underline">{content}</Link> : content;
}

function OrderPanel({ title, action, footerAction, meta, children }: { title: string; action?: WorkOrderAction | null; footerAction?: WorkOrderAction | null; meta?: string | null; children: React.ReactNode }) {
  return <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-soft"><header className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-border px-3"><h2 className="text-xs font-black text-content">{title}</h2>{canRenderAction(action) ? <ActionLink action={{ ...action!, variant: action!.variant ?? "link" }} /> : meta ? <span className="text-[9px] font-semibold text-content-secondary">{meta}</span> : null}</header>{children}{canRenderAction(footerAction) ? <footer className="flex min-h-11 items-center justify-center border-t border-border px-3"><ActionLink action={{ ...footerAction!, variant: footerAction!.variant ?? "link" }} /></footer> : null}</article>;
}

function DetailRow({ label, value, multiline = false }: { label: string; value?: string | null; multiline?: boolean }) {
  return <div className="grid grid-cols-[5.2rem_minmax(0,1fr)] gap-3"><dt className="font-semibold text-content-secondary">{label}</dt><dd className={`${multiline ? "leading-5" : "truncate"} text-content`}>{value?.trim() || "—"}</dd></div>;
}

function StateAndDatesPanel({ state, number }: { state: WorkOrderStateAndDates; number: Intl.NumberFormat }) {
  const resolvedTone = tone(state.progressTone);
  const rows = [
    ["Flujo de aprobación", state.approvalFlowLabel],
    ["Fecha compromiso", state.commitmentDateLabel],
    ["Fecha de inicio", state.startDateLabel],
    ["Fecha fin estimada", state.estimatedEndDateLabel],
    ["Días estimados", state.estimatedDaysLabel],
    ["Días transcurridos", state.elapsedDaysLabel],
  ];
  return <div className="grid gap-3 p-3 text-[10px]"><div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3"><span className="font-semibold text-content-secondary">Estado</span><StatusBadge label={state.statusLabel} toneValue={state.statusTone} /></div>{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3"><span className="font-semibold text-content-secondary">{label}</span><span className="text-content">{value ?? "—"}</span></div>)}<div className="mt-2"><div className="flex items-center justify-between gap-3"><strong className="text-[10px] text-content">Progreso</strong><span className={`text-[10px] font-bold tabular-nums ${toneText[resolvedTone]}`}>{finite(state.progressPercent) ? `${number.format(state.progressPercent)}%` : "—"}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">{finite(state.progressPercent) ? <span className={`block h-full ${toneFill[resolvedTone]}`} style={{ width: `${Math.min(100, Math.max(0, state.progressPercent))}%` }} /> : null}</div>{!finite(state.progressPercent) ? <p className="mt-2 text-[8px] text-content-secondary">Sin progreso autorizado</p> : null}</div></div>;
}

function AmountsPanel({ amounts, formatMoney, formatPercent, action }: { amounts: WorkOrderAmounts; formatMoney: (value: number | null | undefined) => string; formatPercent: (value: number | null | undefined) => string; action?: WorkOrderAction | null }) {
  const resolvedTone = tone(amounts.deviationTone);
  const rows: Array<[string, number | null, WorkOrderTone?]> = [["Presupuesto asignado", amounts.assignedBudget], ["Importe estimado", amounts.estimatedAmount], ["Importe aprobado", amounts.approvedAmount], ["Coste previsto final", amounts.forecastFinalCost], ["Coste real registrado", amounts.actualCost]];
  return <div className="grid gap-3 p-3 text-[10px]">{rows.map(([label, value, rowTone]) => <div key={label} className="flex items-start justify-between gap-3"><span className="font-semibold text-content-secondary">{label}</span><strong className={`text-right tabular-nums ${toneText[rowTone ?? "neutral"]}`}>{formatMoney(value)}</strong></div>)}<div className={`mt-1 rounded-lg p-3 ${toneBadge[resolvedTone]}`}><div className="flex items-start justify-between gap-3"><span className="font-semibold">Desviación estimada</span><strong className="text-right tabular-nums">{formatMoney(amounts.deviationAmount)}{finite(amounts.deviationPercent) ? ` · ${formatPercent(amounts.deviationPercent)}` : ""}</strong></div>{!finite(amounts.deviationAmount) && !finite(amounts.deviationPercent) ? <p className="mt-1 text-[8px]">Sin desviación autorizada</p> : null}</div>{canRenderAction(action) ? <div className="flex justify-end"><ActionLink action={{ ...action!, variant: action!.variant ?? "link" }} /></div> : null}</div>;
}

function LinesTable({ lines, formatMoney }: { lines: WorkOrderLine[]; formatMoney: (value: number | null | undefined) => string }) {
  if (!lines.length) return <HonestEmpty icon={ClipboardList} text="No se han recibido líneas autorizadas para esta orden." />;
  return <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable de líneas de la orden"><table className="w-full min-w-[46rem] text-left text-[10px]"><thead className="bg-subtle text-content-secondary"><tr><th scope="col" className="px-3 py-2">Línea</th><th scope="col" className="px-3 py-2">Cantidad</th><th scope="col" className="px-3 py-2 text-right">Precio unitario</th><th scope="col" className="px-3 py-2 text-right">Importe</th><th scope="col" className="px-3 py-2">Estado</th><th scope="col" className="px-3 py-2 text-right">Acción</th></tr></thead><tbody className="divide-y divide-border">{lines.map((line) => <tr key={line.id}><td className="px-3 py-2"><strong className="block text-content">{line.concept}</strong>{line.code ? <small className="text-[8px] text-content-secondary">{line.code}</small> : null}</td><td className="px-3 py-2 text-content-secondary">{line.quantityLabel ?? "—"}</td><td className="px-3 py-2 text-right tabular-nums text-content">{formatMoney(line.unitPrice)}</td><td className="px-3 py-2 text-right font-bold tabular-nums text-content">{formatMoney(line.totalAmount)}</td><td className="px-3 py-2"><StatusBadge label={line.statusLabel} toneValue={line.statusTone} /></td><td className="px-3 py-2 text-right">{canRenderAction(line.action) ? <ActionLink action={{ ...line.action!, variant: "link" }} /> : null}</td></tr>)}</tbody></table></div>;
}

function DocumentsList({ documents }: { documents: WorkOrderDocument[] }) {
  if (!documents.length) return <HonestEmpty icon={FileText} text="No se han recibido documentos vinculados a esta orden." />;
  return <ul className="divide-y divide-border px-3">{documents.map((document) => { const Icon = document.kind === "spreadsheet" ? FileSpreadsheet : document.kind === "pdf" ? FileText : FileCheck2; const content = <span className="grid min-h-12 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 py-2"><span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${document.kind === "spreadsheet" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}><Icon size={14} aria-hidden="true" /></span><span className="min-w-0"><strong className="block truncate text-[9px] text-content">{document.name}</strong><small className="block truncate text-[8px] text-content-secondary">{[document.typeLabel, document.sizeLabel].filter(Boolean).join(" · ") || "Metadatos sin informar"}</small></span><span className="text-[8px] text-content-secondary">{document.dateLabel ?? "—"}</span></span>; return <li key={document.id}>{canRenderAction(document.action) ? <Link href={document.action!.href!} className="block hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand">{content}</Link> : content}</li>; })}</ul>;
}

function Checklist({ items }: { items: WorkOrderChecklistItem[] }) {
  if (!items.length) return <HonestEmpty icon={ListChecks} text="No se ha recibido una checklist para esta orden." />;
  return <ul className="grid gap-1 p-3">{items.map((item) => { const resolvedTone = tone(item.tone ?? (item.completed === true ? "success" : "neutral")); return <li key={item.id} className="grid min-h-8 grid-cols-[1.1rem_minmax(0,1fr)_auto] items-center gap-2 text-[9px]"><span className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${item.completed === true ? "border-success bg-success text-white" : item.completed === false ? "border-content-tertiary text-transparent" : "border-border bg-subtle text-transparent"}`}><Check size={10} aria-hidden="true" /></span><span className="text-content">{item.label}</span>{item.statusLabel ? <span className={`rounded-full px-2 py-1 text-[8px] font-bold ${toneBadge[resolvedTone]}`}>{item.statusLabel}</span> : null}</li>; })}</ul>;
}

function EvidenceGrid({ evidence }: { evidence: WorkOrderEvidence[] }) {
  const safeEvidence = evidence.filter((item) => safeImageUrl(item.url));
  if (!safeEvidence.length) return <HonestEmpty icon={ImageIcon} text={evidence.length ? "Las evidencias recibidas no tienen una URL segura disponible." : "No se han recibido evidencias fotográficas."} />;
  return <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">{safeEvidence.map((item) => { const image = <figure><Image src={item.url!} alt={item.alt} width={260} height={190} unoptimized className="aspect-[4/3] w-full rounded-lg border border-border object-cover" />{item.caption ? <figcaption className="mt-1 truncate text-[8px] text-content-secondary">{item.caption}</figcaption> : null}</figure>; return canRenderAction(item.action) ? <Link key={item.id} href={item.action!.href!} className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{image}</Link> : <div key={item.id}>{image}</div>; })}</div>;
}

function OrderTimeline({ events }: { events: WorkOrderEvent[] }) {
  if (!events.length) return <HonestEmpty icon={History} text="No se han recibido eventos persistidos para el historial de esta orden." />;
  return <ol className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-5">{events.map((event) => { const resolvedTone = tone(event.tone); const content = <article className={`h-full rounded-lg border p-3 ${resolvedTone === "success" ? "border-success/30 bg-success/5" : resolvedTone === "warning" ? "border-warning/30 bg-warning/5" : resolvedTone === "danger" ? "border-danger/30 bg-danger/5" : "border-border bg-surface"}`}><span className="flex items-start gap-2"><span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${toneBadge[resolvedTone]}`}>{resolvedTone === "success" ? <CheckCircle2 size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}</span><span className="min-w-0"><strong className="block text-[9px] text-content">{event.label}</strong><small className="mt-1 block text-[8px] text-content-secondary">{event.dateLabel ?? "Fecha sin informar"}</small>{event.actor ? <small className="block text-[8px] text-content-secondary">Por {event.actor}</small> : null}</span></span>{event.detail ? <p className="mt-2 text-[8px] leading-4 text-content-secondary">{event.detail}</p> : null}</article>; return <li key={event.id}>{canRenderAction(event.action) ? <Link href={event.action!.href!} className="block h-full rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{content}</Link> : content}</li>; })}</ol>;
}

function StatusBadge({ label, toneValue }: { label?: string | null; toneValue?: WorkOrderTone }) {
  const resolvedTone = tone(toneValue);
  return label?.trim() ? <span className={`inline-flex min-h-6 items-center rounded-md px-2 py-1 text-[9px] font-bold ${toneBadge[resolvedTone]}`}>{label}</span> : <span className="text-[9px] text-content-secondary">—</span>;
}

function ActionLink({ action }: { action: WorkOrderAction }) {
  if (!canRenderAction(action)) return null;
  const Icon = actionIcon(action.icon);
  const variant = action.variant ?? "secondary";
  const className = variant === "primary" ? "primary-button min-h-11" : variant === "secondary" ? "secondary-button min-h-11" : "inline-flex min-h-11 items-center gap-2 text-[10px] font-bold text-brand-strong hover:underline";
  return <Link href={action.href!} className={className}>{Icon ? <Icon size={15} aria-hidden="true" /> : null}{action.label}</Link>;
}

function canRenderAction(action: WorkOrderAction | null | undefined): action is WorkOrderAction & { href: string } {
  return Boolean(action?.allowed === true && safeHref(action.href));
}

function actionIcon(icon?: WorkOrderActionIcon) {
  if (icon === "approve") return Check;
  if (icon === "convert") return WalletCards;
  if (icon === "copy") return Copy;
  if (icon === "document") return FileText;
  if (icon === "edit") return Pencil;
  if (icon === "more") return MoreHorizontal;
  if (icon === "send") return Send;
  return null;
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  return safeImageUrl(url) ? <Image src={url!} alt={`Foto de ${name}`} width={36} height={36} unoptimized className="h-8 w-8 shrink-0 rounded-full border border-border object-cover" /> : <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong"><UserRound size={14} aria-hidden="true" /><span className="sr-only">Sin fotografía registrada para {name}</span></span>;
}

function HonestEmpty({ icon: Icon, text }: { icon: typeof ClipboardList; text: string }) {
  return <div className="flex min-h-28 flex-col items-center justify-center p-5 text-center"><Icon size={21} className="text-content-tertiary" aria-hidden="true" /><p className="mt-2 max-w-sm text-[10px] leading-5 text-content-secondary">{text}</p></div>;
}

function MissingOrder() {
  return <section className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface p-6 text-center shadow-soft" aria-labelledby="missing-order-title"><AlertTriangle size={24} className="text-warning" aria-hidden="true" /><h2 id="missing-order-title" className="mt-3 text-sm font-black text-content">Orden no disponible</h2><p className="mt-2 max-w-lg text-xs leading-6 text-content-secondary">No se recibió una orden autorizada. Esta vista no utiliza gastos, facturas o materiales como sustitutos.</p></section>;
}
