"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  File,
  FileCheck2,
  FileImage,
  FileSignature,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderPlus,
  MoreHorizontal,
  PenTool,
  Search,
  SlidersHorizontal,
  Upload,
  UserRound,
} from "lucide-react";

export type ClientDocumentTone = "neutral" | "info" | "success" | "warning" | "danger" | "violet";
export type ClientDocumentMetricKind = "active" | "contracts" | "budgets" | "invoices" | "pending_signatures";
export type ClientDocumentFileKind = "pdf" | "word" | "spreadsheet" | "image" | "other";

export type ClientDocumentMetric = {
  kind: ClientDocumentMetricKind;
  value: number | null;
  detail?: string | null;
  tone?: ClientDocumentTone;
};

export type ClientDocumentFolder = {
  id: string;
  name: string;
  documentCount?: number | null;
  tone?: ClientDocumentTone;
  href?: string | null;
};

type ClientDocumentBase = {
  id: string;
  name: string;
  fileKind?: ClientDocumentFileKind | null;
  sizeBytes?: number | null;
  sizeLabel?: string | null;
  category?: string | null;
  categoryTone?: ClientDocumentTone;
  version?: string | null;
  createdAt?: string | null;
  status?: string | null;
  statusTone?: ClientDocumentTone;
  sourceLabel?: string | null;
  responsibleName?: string | null;
  responsibleRole?: string | null;
  tags?: string[];
  viewHref?: string | null;
  moreHref?: string | null;
};

export type ClientScopedDocument = ClientDocumentBase & {
  scope: "client";
  workId?: never;
  workTitle?: never;
};

export type ClientWorkScopedDocument = ClientDocumentBase & {
  scope: "work";
  workId: string;
  workTitle?: string | null;
};

export type ClientDocumentRecord = ClientScopedDocument | ClientWorkScopedDocument;

export type Client360DocumentsOverviewProps = {
  clientId: string;
  metrics: ClientDocumentMetric[];
  folders: ClientDocumentFolder[];
  documents: ClientDocumentRecord[];
  uploadHref?: string | null;
  newFolderHref?: string | null;
  requestSignatureHref?: string | null;
  moreFiltersHref?: string | null;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  className?: string;
};

type Filters = {
  query: string;
  category: string;
  status: string;
  responsible: string;
  tag: string;
};

const emptyFilters: Filters = { query: "", category: "", status: "", responsible: "", tag: "" };

const metricPresentation: Record<ClientDocumentMetricKind, { label: string; icon: typeof Folder }> = {
  active: { label: "Documentos activos", icon: Folder },
  contracts: { label: "Contratos", icon: FileText },
  budgets: { label: "Presupuestos", icon: FileCheck2 },
  invoices: { label: "Facturas", icon: FileSpreadsheet },
  pending_signatures: { label: "Firmas pendientes", icon: FileSignature },
};

export function Client360DocumentsOverview({
  clientId,
  metrics,
  folders,
  documents,
  uploadHref,
  newFolderHref,
  requestSignatureHref,
  moreFiltersHref,
  initialPageSize = 8,
  pageSizeOptions = [8, 16, 32],
  selectedIds = [],
  onSelectionChange,
  className = "",
}: Client360DocumentsOverviewProps) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const safePageSizes = useMemo(() => normalizePageSizes(initialPageSize, pageSizeOptions), [initialPageSize, pageSizeOptions]);
  const [pageSize, setPageSize] = useState(() => safePageSizes[0]);
  const options = useMemo(() => ({
    categories: uniqueValues(documents.map((document) => document.category)),
    statuses: uniqueValues(documents.map((document) => document.status)),
    responsibles: uniqueValues(documents.map((document) => document.responsibleName)),
    tags: uniqueValues(documents.flatMap((document) => document.tags ?? [])),
  }), [documents]);
  const filteredDocuments = useMemo(() => {
    const query = normalize(filters.query);
    return documents.filter((document) => {
      const searchable = normalize([
        document.name,
        document.category,
        document.status,
        document.sourceLabel,
        document.responsibleName,
        document.scope === "work" ? document.workTitle : null,
        ...(document.tags ?? []),
      ].filter(Boolean).join(" "));
      return (!query || searchable.includes(query))
        && (!filters.category || document.category === filters.category)
        && (!filters.status || document.status === filters.status)
        && (!filters.responsible || document.responsibleName === filters.responsible)
        && (!filters.tag || document.tags?.includes(filters.tag));
    });
  }, [documents, filters]);
  const pageCount = Math.max(1, Math.ceil(filteredDocuments.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageDocuments = filteredDocuments.slice(start, start + pageSize);
  const filtersActive = Object.values(filters).some(Boolean);
  const selectableIds = filteredDocuments.map((document) => document.id);
  const allVisibleSelected = Boolean(onSelectionChange && selectableIds.length && selectableIds.every((id) => selectedIds.includes(id)));

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const toggleDocument = (id: string) => {
    if (!onSelectionChange) return;
    onSelectionChange(selectedIds.includes(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id]);
  };

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allVisibleSelected) onSelectionChange(selectedIds.filter((id) => !selectableIds.includes(id)));
    else onSelectionChange(Array.from(new Set([...selectedIds, ...selectableIds])));
  };

  return (
    <section className={`grid min-w-0 gap-4 ${className}`} aria-labelledby={`client-documents-${clientId}`}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id={`client-documents-${clientId}`} className="text-xl font-black text-content">Documentos</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-content-secondary">Repositorio documental de este cliente. Los documentos vinculados a una obra se identifican expresamente y no se confunden con documentos propios del cliente.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {uploadHref ? <ActionLink href={uploadHref} label="Subir documento" icon={Upload} primary /> : null}
          {newFolderHref ? <ActionLink href={newFolderHref} label="Nueva carpeta" icon={FolderPlus} /> : null}
          {requestSignatureHref ? <ActionLink href={requestSignatureHref} label="Solicitar firma" icon={PenTool} /> : null}
        </div>
      </header>

      {metrics.length ? <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5" aria-label="Indicadores documentales recibidos para el cliente">{metrics.map((metric) => <DocumentMetricCard key={metric.kind} metric={metric} />)}</div> : <HonestEmpty icon={Folder} title="Sin indicadores documentales" detail="No se han recibido totales autorizados para este cliente." compact />}

      <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_auto] lg:items-center">
        <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-content-secondary"><Search size={16} aria-hidden="true" /><span className="sr-only">Buscar documento</span><input value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-xs text-content outline-none" placeholder="Buscar documento…" /></label>
        <div className="flex flex-wrap gap-2">
          <FilterSelect label="Categoría" value={filters.category} options={options.categories} onChange={(value) => updateFilter("category", value)} />
          <FilterSelect label="Estado" value={filters.status} options={options.statuses} onChange={(value) => updateFilter("status", value)} />
          <FilterSelect label="Responsable" value={filters.responsible} options={options.responsibles} onChange={(value) => updateFilter("responsible", value)} />
          <FilterSelect label="Etiqueta" value={filters.tag} options={options.tags} onChange={(value) => updateFilter("tag", value)} />
          {moreFiltersHref ? <ActionLink href={moreFiltersHref} label="Más filtros" icon={SlidersHorizontal} /> : null}
          {filtersActive ? <button type="button" onClick={() => { setFilters(emptyFilters); setPage(1); }} className="inline-flex min-h-11 items-center rounded-lg border border-border bg-surface px-3 text-[10px] font-bold text-content-secondary hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Limpiar</button> : null}
        </div>
      </div>

      {folders.length ? (
        <section aria-labelledby={`client-folders-${clientId}`}>
          <h3 id={`client-folders-${clientId}`} className="mb-2 text-[10px] font-bold text-content-secondary">Carpetas principales</h3>
          <div className="flex min-w-0 gap-2 overflow-x-auto pb-1" tabIndex={0} role="region" aria-label="Carpetas principales del cliente">{folders.map((folder) => <FolderCard key={folder.id} folder={folder} />)}</div>
        </section>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <p className="sr-only" aria-live="polite">{filteredDocuments.length} documentos visibles de {documents.length} recibidos.</p>
        {pageDocuments.length ? (
          <>
            <DocumentsDesktopTable documents={pageDocuments} selectedIds={selectedIds} selectionEnabled={Boolean(onSelectionChange)} allVisibleSelected={allVisibleSelected} onToggle={toggleDocument} onToggleAll={toggleAll} />
            <DocumentsMobileList documents={pageDocuments} selectedIds={selectedIds} selectionEnabled={Boolean(onSelectionChange)} onToggle={toggleDocument} />
            <DocumentsPagination currentPage={currentPage} pageCount={pageCount} pageSize={pageSize} pageSizes={safePageSizes} start={start} visibleCount={pageDocuments.length} total={filteredDocuments.length} onPage={setPage} onPageSize={(value) => { setPageSize(value); setPage(1); }} />
          </>
        ) : <HonestEmpty icon={File} title="No hay documentos para estos filtros" detail="Cambia los filtros para revisar el repositorio recibido." />}
      </div>
    </section>
  );
}

function DocumentMetricCard({ metric }: { metric: ClientDocumentMetric }) {
  const presentation = metricPresentation[metric.kind];
  const Icon = presentation.icon;
  return <article className="min-w-0 rounded-xl border border-border bg-surface p-3"><div className="flex items-center gap-3"><span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneSurface(metric.tone)}`}><Icon size={18} aria-hidden="true" /></span><div className="min-w-0"><h3 className="truncate text-[9px] font-semibold text-content-secondary">{presentation.label}</h3><strong className="mt-1 block truncate text-xl font-black tabular-nums text-content">{finite(metric.value) ? new Intl.NumberFormat("es-ES").format(metric.value) : "—"}</strong></div></div><p className={`mt-2 min-h-4 truncate text-[9px] ${toneText(metric.tone)}`} title={metric.detail ?? undefined}>{metric.detail ?? "Sin comparación informada"}</p></article>;
}

function FolderCard({ folder }: { folder: ClientDocumentFolder }) {
  const content = <><Folder size={20} className={toneText(folder.tone)} aria-hidden="true" /><span className="min-w-0"><strong className="block truncate text-[10px] text-content">{folder.name}</strong><span className="mt-1 block text-[8px] text-content-secondary">{finite(folder.documentCount) ? `${folder.documentCount} documentos` : "Recuento no informado"}</span></span></>;
  const className = "grid min-h-14 min-w-[10rem] grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-2 rounded-lg border border-border bg-surface px-3 text-left hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
  return folder.href ? <Link href={folder.href} className={className}>{content}</Link> : <div className={className}>{content}</div>;
}

function DocumentsDesktopTable({ documents, selectedIds, selectionEnabled, allVisibleSelected, onToggle, onToggleAll }: { documents: ClientDocumentRecord[]; selectedIds: string[]; selectionEnabled: boolean; allVisibleSelected: boolean; onToggle: (id: string) => void; onToggleAll: () => void }) {
  return (
    <div className="hidden overflow-x-auto lg:block" tabIndex={0} role="region" aria-label="Tabla desplazable de documentos del cliente">
      <table className="w-full min-w-[62rem] border-collapse text-left text-[9px]">
        <thead className="bg-subtle text-content-secondary"><tr>{selectionEnabled ? <th scope="col" className="w-10 px-3 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={onToggleAll} aria-label="Seleccionar todos los documentos filtrados" className="h-4 w-4 accent-brand" /></th> : null}<TableHead>Nombre</TableHead><TableHead>Categoría</TableHead><TableHead>Versión</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead><TableHead>Origen</TableHead><TableHead>Responsable</TableHead><TableHead align="right">Acciones</TableHead></tr></thead>
        <tbody className="divide-y divide-border">{documents.map((document) => <tr key={document.id} className="hover:bg-subtle/70">{selectionEnabled ? <td className="px-3 py-3"><input type="checkbox" checked={selectedIds.includes(document.id)} onChange={() => onToggle(document.id)} aria-label={`Seleccionar ${document.name}`} className="h-4 w-4 accent-brand" /></td> : null}<td className="max-w-[20rem] px-3 py-3"><DocumentName document={document} /></td><td className="px-3 py-3">{document.category ? <StatusBadge label={document.category} tone={document.categoryTone} /> : <MissingValue />}</td><td className="px-3 py-3 text-content-secondary">{document.version ?? "—"}</td><td className="px-3 py-3 text-content-secondary">{formatDate(document.createdAt)}</td><td className="px-3 py-3">{document.status ? <StatusBadge label={document.status} tone={document.statusTone} /> : <MissingValue />}</td><td className="max-w-40 px-3 py-3"><DocumentOrigin document={document} /></td><td className="px-3 py-3"><Responsible document={document} /></td><td className="px-3 py-3 text-right">{document.moreHref ? <IconLink href={document.moreHref} label={`Más acciones para ${document.name}`} /> : <MissingValue />}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function DocumentsMobileList({ documents, selectedIds, selectionEnabled, onToggle }: { documents: ClientDocumentRecord[]; selectedIds: string[]; selectionEnabled: boolean; onToggle: (id: string) => void }) {
  return <div className="divide-y divide-border lg:hidden" role="list">{documents.map((document) => <article key={document.id} role="listitem" className="p-4"><div className="flex items-start gap-3">{selectionEnabled ? <input type="checkbox" checked={selectedIds.includes(document.id)} onChange={() => onToggle(document.id)} aria-label={`Seleccionar ${document.name}`} className="mt-1 h-5 w-5 shrink-0 accent-brand" /> : null}<DocumentFileIcon kind={document.fileKind} /><div className="min-w-0 flex-1"><h3 className="truncate text-xs font-bold text-content">{document.viewHref ? <Link href={document.viewHref} className="hover:text-brand-strong hover:underline">{document.name}</Link> : document.name}</h3><span className="mt-1 block text-[9px] text-content-secondary">{formatSize(document)}</span></div>{document.moreHref ? <IconLink href={document.moreHref} label={`Más acciones para ${document.name}`} /> : null}</div><div className="mt-3 flex flex-wrap gap-2">{document.category ? <StatusBadge label={document.category} tone={document.categoryTone} /> : null}{document.status ? <StatusBadge label={document.status} tone={document.statusTone} /> : null}<ScopeBadge document={document} /></div><dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3"><MobileFact label="Versión" value={document.version ?? "No informada"} /><MobileFact label="Fecha" value={formatDate(document.createdAt)} /><MobileFact label="Origen" value={originLabel(document)} /><MobileFact label="Responsable" value={document.responsibleName ?? "No informado"} /></dl></article>)}</div>;
}

function DocumentName({ document }: { document: ClientDocumentRecord }) {
  return <span className="flex min-w-0 items-center gap-2"><DocumentFileIcon kind={document.fileKind} /><span className="min-w-0"><strong className="block truncate text-content">{document.viewHref ? <Link href={document.viewHref} className="hover:text-brand-strong hover:underline">{document.name}</Link> : document.name}</strong><span className="mt-0.5 block text-[8px] text-content-secondary">{formatSize(document)}</span></span></span>;
}

function DocumentFileIcon({ kind }: { kind?: ClientDocumentFileKind | null }) {
  const Icon = kind === "spreadsheet" ? FileSpreadsheet : kind === "image" ? FileImage : kind === "pdf" || kind === "word" ? FileText : File;
  const color = kind === "pdf" ? "text-danger" : kind === "word" ? "text-brand-strong" : kind === "spreadsheet" ? "text-success" : kind === "image" ? "text-warning" : "text-content-secondary";
  return <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-subtle ${color}`}><Icon size={16} aria-hidden="true" /></span>;
}

function DocumentOrigin({ document }: { document: ClientDocumentRecord }) {
  return <span className="min-w-0"><span className="block truncate text-content">{document.sourceLabel ?? "Origen no informado"}</span><ScopeBadge document={document} /></span>;
}

function ScopeBadge({ document }: { document: ClientDocumentRecord }) {
  return document.scope === "work" ? <span className="mt-1 inline-flex min-h-5 max-w-full items-center rounded-md border border-warning/20 bg-warning/10 px-1.5 text-[8px] font-bold text-warning" title={document.workTitle ?? document.workId}>Obra · {document.workTitle ?? document.workId}</span> : <span className="mt-1 inline-flex min-h-5 items-center rounded-md border border-brand/20 bg-brand-soft px-1.5 text-[8px] font-bold text-brand-strong">Cliente</span>;
}

function Responsible({ document }: { document: ClientDocumentRecord }) {
  if (!document.responsibleName) return <MissingValue />;
  return <span className="flex min-w-0 items-center gap-2"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtle text-content-secondary"><UserRound size={14} aria-hidden="true" /></span><span className="min-w-0"><strong className="block truncate text-content">{document.responsibleName}</strong>{document.responsibleRole ? <span className="block truncate text-[8px] text-content-secondary">{document.responsibleRole}</span> : null}</span></span>;
}

function DocumentsPagination({ currentPage, pageCount, pageSize, pageSizes, start, visibleCount, total, onPage, onPageSize }: { currentPage: number; pageCount: number; pageSize: number; pageSizes: number[]; start: number; visibleCount: number; total: number; onPage: (page: number) => void; onPageSize: (size: number) => void }) {
  const pages = pageWindow(currentPage, pageCount);
  return <footer className="flex flex-col gap-3 border-t border-border px-3 py-3 text-[10px] text-content-secondary sm:flex-row sm:items-center sm:justify-between"><span>Mostrando {total ? start + 1 : 0} a {start + visibleCount} de {total} documentos recibidos</span><div className="flex flex-wrap items-center gap-2">{pageSizes.length > 1 ? <label className="flex min-h-10 items-center gap-2"><select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className="min-h-10 rounded-lg border border-border bg-surface px-2 font-bold text-content" aria-label="Documentos por página">{pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select><span>por página</span></label> : null}<nav className="flex items-center gap-1" aria-label="Paginación de documentos"><PageButton label="Anterior" disabled={currentPage <= 1} onClick={() => onPage(currentPage - 1)}>‹</PageButton>{pages.map((pageNumber) => <PageButton key={pageNumber} label={`Página ${pageNumber}`} active={pageNumber === currentPage} onClick={() => onPage(pageNumber)}>{pageNumber}</PageButton>)}<PageButton label="Siguiente" disabled={currentPage >= pageCount} onClick={() => onPage(currentPage + 1)}>›</PageButton></nav></div></footer>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[10px] text-content-secondary"><span className="font-semibold">{label}:</span><select value={value} onChange={(event) => onChange(event.target.value)} className="max-w-36 border-0 bg-transparent font-bold text-content outline-none"><option value="">Todas</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function ActionLink({ href, label, icon: Icon, primary = false }: { href: string; label: string; icon: typeof Upload; primary?: boolean }) {
  return <Link href={href} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${primary ? "bg-brand text-on-brand hover:bg-brand-strong" : "border border-border bg-surface text-content hover:bg-subtle"}`}><Icon size={15} aria-hidden="true" />{label}</Link>;
}

function IconLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} aria-label={label} title={label} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-content-secondary hover:bg-subtle hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><MoreHorizontal size={16} aria-hidden="true" /></Link>;
}

function TableHead({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th scope="col" className={`whitespace-nowrap px-3 py-3 font-semibold ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}

function StatusBadge({ label, tone }: { label: string; tone?: ClientDocumentTone }) {
  return <span className={`inline-flex min-h-6 items-center rounded-md border px-2 py-1 text-[8px] font-bold ${toneBadge(tone)}`}>{label}</span>;
}

function MobileFact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="truncate text-[8px] text-content-tertiary">{label}</dt><dd className="mt-1 truncate text-[10px] font-semibold text-content">{value}</dd></div>;
}

function PageButton({ children, label, disabled = false, active = false, onClick }: { children: React.ReactNode; label: string; disabled?: boolean; active?: boolean; onClick: () => void }) {
  return <button type="button" aria-label={label} aria-current={active ? "page" : undefined} disabled={disabled} onClick={onClick} className={`inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-2 font-bold disabled:cursor-not-allowed disabled:opacity-40 ${active ? "border-brand bg-brand text-on-brand" : "border-border bg-surface text-content hover:bg-subtle"}`}>{children}</button>;
}

function MissingValue() {
  return <span className="text-content-tertiary">—</span>;
}

function HonestEmpty({ icon: Icon, title, detail, compact = false }: { icon: typeof Folder; title: string; detail: string; compact?: boolean }) {
  return <div className={`grid place-content-center justify-items-center p-6 text-center ${compact ? "min-h-32" : "min-h-52"}`}><Icon size={22} className="text-content-tertiary" aria-hidden="true" /><h3 className="mt-3 text-xs font-bold text-content">{title}</h3><p className="mt-1 max-w-sm text-[10px] leading-5 text-content-secondary">{detail}</p></div>;
}

function originLabel(document: ClientDocumentRecord) {
  if (document.scope === "work") return document.workTitle ? `Obra · ${document.workTitle}` : `Obra · ${document.workId}`;
  return document.sourceLabel ?? "Cliente";
}

function formatSize(document: ClientDocumentRecord) {
  if (document.sizeLabel) return document.sizeLabel;
  if (!finite(document.sizeBytes)) return "Tamaño no informado";
  if (document.sizeBytes < 1024) return `${document.sizeBytes} B`;
  if (document.sizeBytes < 1024 ** 2) return `${(document.sizeBytes / 1024).toLocaleString("es-ES", { maximumFractionDigits: 1 })} KB`;
  return `${(document.sizeBytes / 1024 ** 2).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
}

function normalizePageSizes(initial: number, options: number[]) {
  const safeInitial = Number.isInteger(initial) && initial > 0 ? initial : 8;
  const values = [safeInitial, ...options].filter((value) => Number.isInteger(value) && value > 0);
  return Array.from(new Set(values));
}

function pageWindow(current: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))).sort((left, right) => left.localeCompare(right, "es"));
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no válida" : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function toneText(tone: ClientDocumentTone | undefined) {
  if (tone === "danger") return "text-danger";
  if (tone === "warning") return "text-warning";
  if (tone === "success") return "text-success";
  if (tone === "info") return "text-brand-strong";
  if (tone === "violet") return "text-violet-600";
  return "text-content-secondary";
}

function toneSurface(tone: ClientDocumentTone | undefined) {
  if (tone === "danger") return "bg-danger/10 text-danger";
  if (tone === "warning") return "bg-warning/10 text-warning";
  if (tone === "success") return "bg-success/10 text-success";
  if (tone === "info") return "bg-brand-soft text-brand-strong";
  if (tone === "violet") return "bg-violet-100 text-violet-600";
  return "bg-subtle text-content-secondary";
}

function toneBadge(tone: ClientDocumentTone | undefined) {
  if (tone === "danger") return "border-danger/20 bg-danger/10 text-danger";
  if (tone === "warning") return "border-warning/20 bg-warning/10 text-warning";
  if (tone === "success") return "border-success/20 bg-success/10 text-success";
  if (tone === "info") return "border-brand/20 bg-brand-soft text-brand-strong";
  if (tone === "violet") return "border-violet-200 bg-violet-100 text-violet-700";
  return "border-border bg-subtle text-content-secondary";
}
