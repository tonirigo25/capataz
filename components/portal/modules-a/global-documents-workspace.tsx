"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileImage,
  Files,
  FileText,
  Filter,
  Maximize2,
  Minus,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

export type GlobalDocumentKind =
  "invoice" | "ticket" | "contract" | "work_part" | "other";

export type GlobalDocumentTone =
  "neutral" | "success" | "warning" | "danger" | "info";

export type GlobalDocumentField = {
  id: string;
  label: string;
  value: string;
  href?: string | null;
  confidenceLabel?: string | null;
  tone?: GlobalDocumentTone;
};

export type GlobalDocumentPreviewRow = {
  id: string;
  cells: string[];
};

export type GlobalDocumentPreview = {
  href?: string | null;
  title?: string | null;
  subtitle?: string | null;
  facts?: GlobalDocumentField[];
  table?: {
    columns: string[];
    rows: GlobalDocumentPreviewRow[];
  } | null;
  totals?: GlobalDocumentField[];
  notes?: string[];
};

export type GlobalDocumentHistoryItem = {
  id: string;
  timestampLabel: string;
  title: string;
  detail?: string | null;
  actorLabel?: string | null;
  tone?: GlobalDocumentTone;
};

export type GlobalDocumentAction = {
  href: string;
  label: string;
  target?: "_self" | "_blank";
  download?: boolean;
};

export type GlobalDocumentAiContext = {
  documentId: string;
  title: string;
  statusLabel: string;
  relationLabel?: string | null;
  confidenceLabel?: string | null;
  attentionItems?: string[];
  reviewHref?: string | null;
};

export type GlobalDocumentTemplate = {
  id: string;
  label: string;
  kindLabel: string;
  formatLabel: string;
  previewAction?: GlobalDocumentAction | null;
  downloadAction: GlobalDocumentAction;
};

export type GlobalDocumentWorkspaceItem = {
  id: string;
  name: string;
  kind: GlobalDocumentKind;
  kindLabel: string;
  statusLabel: string;
  statusTone?: GlobalDocumentTone;
  requiresReview?: boolean;
  relatedLabel?: string | null;
  dateLabel?: string | null;
  amountLabel?: string | null;
  updatedLabel?: string | null;
  preview?: GlobalDocumentPreview | null;
  ocrFields?: GlobalDocumentField[];
  reviewDescription?: string | null;
  aiContext?: GlobalDocumentAiContext | null;
  history?: GlobalDocumentHistoryItem[];
  actions?: {
    original?: GlobalDocumentAction | null;
    download?: GlobalDocumentAction | null;
    edit?: GlobalDocumentAction | null;
    linkWork?: GlobalDocumentAction | null;
    linkPartner?: GlobalDocumentAction | null;
    confirm?: GlobalDocumentAction | null;
    correct?: GlobalDocumentAction | null;
    discard?: GlobalDocumentAction | null;
  } | null;
};

export type GlobalDocumentsWorkspaceProps = {
  documents: GlobalDocumentWorkspaceItem[];
  selectedId?: string | null;
  primaryAction?: GlobalDocumentAction | null;
  templates?: GlobalDocumentTemplate[];
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  onSelectedIdChange?: (id: string | null) => void;
};

type TabId =
  "all" | "invoice" | "ticket" | "contract" | "work_part" | "pending" | "templates";

type MobileStep = "list" | "viewer" | "review";
type SortId = "newest" | "oldest" | "name";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "invoice", label: "Facturas" },
  { id: "ticket", label: "Tickets" },
  { id: "contract", label: "Contratos" },
  { id: "work_part", label: "Partes" },
  { id: "pending", label: "Pendientes de revisión" },
  { id: "templates", label: "Plantillas" },
];

export function GlobalDocumentsWorkspace({
  documents,
  selectedId,
  primaryAction,
  templates = [],
  pageSize = 7,
  emptyTitle = "No hay documentos en esta vista",
  emptyDescription = "Cambia los filtros o incorpora documentación desde una acción autorizada.",
  onSelectedIdChange,
}: GlobalDocumentsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [activeId, setActiveId] = useState<string | null>(() =>
    selectedId && documents.some((document) => document.id === selectedId)
      ? selectedId
      : null,
  );
  const [mobileStep, setMobileStep] = useState<MobileStep>(() =>
    selectedId ? "viewer" : "list",
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<SortId>("newest");
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const previewFrameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedId === undefined) return;
    const nextId =
      selectedId && documents.some((document) => document.id === selectedId)
        ? selectedId
        : null;
    setActiveId(nextId);
    setMobileStep(nextId ? "viewer" : "list");
  }, [documents, selectedId]);

  const statuses = useMemo(
    () =>
      Array.from(
        new Set(documents.map((document) => document.statusLabel)),
      ).sort((left, right) => left.localeCompare(right, "es")),
    [documents],
  );

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = normalize(query);
    const filtered = documents.filter((document) => {
      const tabMatches =
        activeTab === "all" ||
        (activeTab === "pending"
          ? Boolean(document.requiresReview)
          : document.kind === activeTab);
      const statusMatches =
        statusFilter === "all" || document.statusLabel === statusFilter;
      const text = normalize(
        [
          document.name,
          document.kindLabel,
          document.statusLabel,
          document.relatedLabel,
          document.amountLabel,
        ]
          .filter(Boolean)
          .join(" "),
      );
      return (
        tabMatches &&
        statusMatches &&
        (!normalizedQuery || text.includes(normalizedQuery))
      );
    });

    return filtered.toSorted((left, right) => {
      if (sort === "name") return left.name.localeCompare(right.name, "es");
      const leftOrder = documents.findIndex(
        (document) => document.id === left.id,
      );
      const rightOrder = documents.findIndex(
        (document) => document.id === right.id,
      );
      return sort === "oldest"
        ? rightOrder - leftOrder
        : leftOrder - rightOrder;
    });
  }, [activeTab, documents, query, sort, statusFilter]);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === activeId) ?? null,
    [activeId, documents],
  );
  const effectivePageSize = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.max(
    1,
    Math.ceil(filteredDocuments.length / effectivePageSize),
  );
  const safePage = Math.min(page, totalPages);
  const visibleDocuments = filteredDocuments.slice(
    (safePage - 1) * effectivePageSize,
    safePage * effectivePageSize,
  );
  const pendingCount = documents.filter(
    (document) => document.requiresReview,
  ).length;
  const previewHref = safeHref(selectedDocument?.preview?.href);

  useEffect(() => {
    const detail = activeTab === "templates" ? null : selectedDocument?.aiContext ?? null;
    const publish = () => window.dispatchEvent(new CustomEvent("orqena:document-context", { detail }));
    publish();
    const frame = window.requestAnimationFrame(publish);
    return () => {
      window.cancelAnimationFrame(frame);
      window.dispatchEvent(new CustomEvent("orqena:document-context", { detail: null }));
    };
  }, [activeTab, selectedDocument]);

  function selectDocument(id: string) {
    setActiveId(id);
    setMobileStep("viewer");
    setZoom(100);
    setRotation(0);
    onSelectedIdChange?.(id);
  }

  function clearSelection() {
    setActiveId(null);
    setMobileStep("list");
    onSelectedIdChange?.(null);
  }

  function changeTab(tab: TabId) {
    setActiveTab(tab);
    setPage(1);
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("all");
    setSort("newest");
    setPage(1);
  }

  async function openFullscreen() {
    if (!previewFrameRef.current || !document.fullscreenEnabled) return;
    await previewFrameRef.current.requestFullscreen();
  }

  return (
    <section className="global-documents-workspace grid min-w-0 w-full grid-cols-[minmax(0,1fr)] gap-4" aria-labelledby="global-documents-title">
      <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1
            id="global-documents-title"
            className="type-page-title text-content"
          >
            Documentos
          </h1>
          <p className="type-secondary mt-1">
            Entrada, OCR y revisión humana de documentos para su validación y
            archivo.
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          {validAction(primaryAction) ? <ActionLink action={primaryAction!} icon={Plus} primary /> : null}
        </div>
      </header>

      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav
          aria-label="Tipos de documento"
          className="flex min-w-0 gap-1 overflow-x-auto pb-1"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => changeTab(tab.id)}
              aria-pressed={activeTab === tab.id}
              className={clsx(
                "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                activeTab === tab.id
                  ? "border-brand/30 bg-brand-soft text-brand-strong"
                  : "border-border bg-surface text-content-secondary hover:bg-subtle hover:text-content",
              )}
            >
              {tab.label}
              {tab.id === "pending" && pendingCount > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            className="secondary-button"
            aria-expanded={filtersOpen}
            aria-controls="global-document-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <Filter size={16} aria-hidden="true" />
            Filtros
          </button>
          <label className="relative">
            <span className="sr-only">Ordenar documentos</span>
            <SlidersHorizontal
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary"
            />
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as SortId);
                setPage(1);
              }}
              className="field min-h-11 min-w-40 appearance-none pl-9 pr-8 text-xs font-semibold"
            >
              <option value="newest">Más recientes</option>
              <option value="oldest">Más antiguos</option>
              <option value="name">Nombre A–Z</option>
            </select>
          </label>
        </div>
      </div>

      {filtersOpen ? (
        <div
          id="global-document-filters"
          className="grid gap-3 rounded-xl border border-border bg-subtle p-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,.4fr)_auto] sm:items-end"
        >
          <label>
            <span className="type-label mb-1 block">Buscar</span>
            <span className="relative block">
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Nombre, entidad, estado o importe"
                className="field pl-9"
              />
            </span>
          </label>
          <label>
            <span className="type-label mb-1 block">Estado</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="field"
            >
              <option value="all">Todos los estados</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="secondary-button"
            onClick={resetFilters}
          >
            <X size={16} aria-hidden="true" />
            Limpiar
          </button>
        </div>
      ) : null}

      {activeTab === "templates" ? (
        <DocumentTemplatesPanel templates={templates} />
      ) : <>
      <MobileFlowNavigation
        step={mobileStep}
        hasSelection={Boolean(selectedDocument)}
        onStepChange={setMobileStep}
      />

      <div
        className="global-documents-panes min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-soft"
        data-mobile-step={mobileStep}
      >
        <DocumentList
          className="global-documents-pane global-documents-pane--list"
          documents={visibleDocuments}
          selectedId={activeId}
          total={filteredDocuments.length}
          page={safePage}
          totalPages={totalPages}
          onSelect={selectDocument}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
        />

        <DocumentViewer
          className="global-documents-pane global-documents-pane--viewer"
          document={selectedDocument}
          previewHref={previewHref}
          zoom={zoom}
          rotation={rotation}
          frameRef={previewFrameRef}
          onBack={() => setMobileStep("list")}
          onClear={clearSelection}
          onZoomOut={() => setZoom((current) => Math.max(70, current - 10))}
          onZoomIn={() => setZoom((current) => Math.min(150, current + 10))}
          onRotate={() => setRotation((current) => (current + 90) % 360)}
          onFullscreen={openFullscreen}
          onReview={() => setMobileStep("review")}
        />

        <DocumentReviewPanel
          className="global-documents-pane global-documents-pane--review"
          document={selectedDocument}
          onBack={() => setMobileStep("viewer")}
        />
      </div>
      </>}
    </section>
  );
}

function DocumentTemplatesPanel({ templates }: { templates: GlobalDocumentTemplate[] }) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-soft sm:p-5" aria-labelledby="document-templates-title">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id="document-templates-title" className="text-base font-semibold text-content">Plantillas autorizadas</h2>
          <p className="mt-1 text-xs leading-5 text-content-secondary">
            Previsualiza o descarga los modelos oficiales sin crear registros ni modificar documentos existentes.
          </p>
        </div>
        <span className="type-meta shrink-0">{templates.length} formatos</span>
      </div>
      {templates.length ? (
        <ul className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {templates.map((template) => (
            <li key={template.id} className="grid min-w-0 content-between gap-4 rounded-xl border border-border bg-subtle/45 p-4">
              <div className="min-w-0">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand-strong">
                  <Files size={19} aria-hidden="true" />
                </span>
                <h3 className="mt-3 break-words text-sm font-semibold text-content">{template.label}</h3>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-content-tertiary">
                  {template.kindLabel} · {template.formatLabel}
                </p>
              </div>
              <div className="grid gap-2">
                {validAction(template.previewAction) ? (
                  <ActionLink action={template.previewAction!} icon={Eye} full />
                ) : null}
                <ActionLink action={template.downloadAction} icon={Download} full primary={!template.previewAction} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-border p-5 text-center text-xs text-content-secondary">
          No hay plantillas autorizadas disponibles.
        </p>
      )}
    </section>
  );
}

function MobileFlowNavigation({
  step,
  hasSelection,
  onStepChange,
}: {
  step: MobileStep;
  hasSelection: boolean;
  onStepChange: (step: MobileStep) => void;
}) {
  return (
    <nav
      aria-label="Flujo documental móvil"
      className="global-documents-mobile-nav grid min-w-0 grid-cols-3 gap-1"
    >
      {(
        [
          ["list", "1. Lista"],
          ["viewer", "2. Visor"],
          ["review", "3. Revisión"],
        ] as Array<[MobileStep, string]>
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          disabled={id !== "list" && !hasSelection}
          onClick={() => onStepChange(id)}
          aria-current={step === id ? "step" : undefined}
          className={clsx(
            "min-h-10 rounded-lg border px-2 text-xs font-semibold",
            step === id
              ? "border-brand bg-brand text-white"
              : "border-border bg-surface text-content-secondary",
            id !== "list" && !hasSelection && "cursor-not-allowed opacity-45",
          )}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

function DocumentList({
  className,
  documents,
  selectedId,
  total,
  page,
  totalPages,
  onSelect,
  onPrevious,
  onNext,
  emptyTitle,
  emptyDescription,
}: {
  className?: string;
  documents: GlobalDocumentWorkspaceItem[];
  selectedId: string | null;
  total: number;
  page: number;
  totalPages: number;
  onSelect: (id: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <section
      className={clsx(
        "min-w-0 flex min-h-[38rem] flex-col border-border",
        className,
      )}
    >
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-3">
        <h2 className="text-sm font-semibold text-content">
          Lista de documentos
        </h2>
        <span className="type-meta tabular-nums">{total}</span>
      </header>

      {documents.length ? (
        <div className="divide-y divide-border">
          {documents.map((document) => {
            const Icon = documentIcon(document.kind);
            const selected = document.id === selectedId;
            return (
              <button
                key={document.id}
                type="button"
                onClick={() => onSelect(document.id)}
                aria-pressed={selected}
                className={clsx(
                  "grid w-full grid-cols-[1.75rem_minmax(0,1fr)] gap-2.5 px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand",
                  selected
                    ? "bg-brand-soft ring-1 ring-inset ring-brand/45"
                    : "bg-surface hover:bg-subtle",
                )}
              >
                <span
                  className={clsx(
                    "mt-0.5 grid h-7 w-7 place-items-center rounded-lg",
                    iconTone(document.kind),
                  )}
                >
                  <Icon size={16} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <strong className="block truncate text-xs font-semibold text-content">
                        {document.name}
                      </strong>
                      <span className="mt-0.5 block truncate text-[10px] text-content-secondary">
                        {[document.kindLabel, document.relatedLabel]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <StatusBadge
                      label={document.statusLabel}
                      tone={document.statusTone}
                    />
                  </span>
                  <span className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-content-tertiary">
                    <span className="truncate">
                      {[document.dateLabel, document.amountLabel]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {document.updatedLabel ? (
                      <span className="shrink-0">{document.updatedLabel}</span>
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid flex-1 place-items-center p-5 text-center">
          <div className="max-w-56">
            <FileText
              size={26}
              className="mx-auto text-content-tertiary"
              aria-hidden="true"
            />
            <h3 className="mt-3 text-sm font-semibold text-content">
              {emptyTitle}
            </h3>
            <p className="mt-1 text-xs leading-5 text-content-secondary">
              {emptyDescription}
            </p>
          </div>
        </div>
      )}

      <footer className="mt-auto flex min-h-12 items-center justify-between gap-3 border-t border-border px-3 text-[10px] text-content-secondary">
        <span>
          Página {page} de {totalPages}
        </span>
        <span className="flex gap-1">
          <button
            type="button"
            aria-label="Página anterior"
            disabled={page <= 1}
            onClick={onPrevious}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border disabled:opacity-35"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Página siguiente"
            disabled={page >= totalPages}
            onClick={onNext}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border disabled:opacity-35"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </span>
      </footer>
    </section>
  );
}

function DocumentViewer({
  className,
  document,
  previewHref,
  zoom,
  rotation,
  frameRef,
  onBack,
  onClear,
  onZoomOut,
  onZoomIn,
  onRotate,
  onFullscreen,
  onReview,
}: {
  className?: string;
  document: GlobalDocumentWorkspaceItem | null;
  previewHref: string | null;
  zoom: number;
  rotation: number;
  frameRef: React.RefObject<HTMLDivElement | null>;
  onBack: () => void;
  onClear: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onRotate: () => void;
  onFullscreen: () => void;
  onReview: () => void;
}) {
  if (!document) {
    return (
      <section
        className={clsx(
          "grid min-h-[38rem] place-items-center bg-subtle/55 p-6",
          className,
        )}
      >
        <div className="max-w-sm text-center">
          <FileCheck2
            size={30}
            className="mx-auto text-content-tertiary"
            aria-hidden="true"
          />
          <h2 className="mt-3 text-base font-semibold text-content">
            Selecciona un documento
          </h2>
          <p className="mt-2 text-sm leading-6 text-content-secondary">
            La vista y los datos sólo aparecen al elegir un registro real de la
            lista.
          </p>
        </div>
      </section>
    );
  }

  const originalAction = validAction(document.actions?.original);
  const downloadAction = validAction(document.actions?.download);
  const linkWorkAction = validAction(document.actions?.linkWork);
  const linkPartnerAction = validAction(document.actions?.linkPartner);
  const confirmAction = validAction(document.actions?.confirm);
  const correctAction = validAction(document.actions?.correct);
  const viewerStyle = {
    "--document-zoom": zoom / 100,
    "--document-rotation": `${rotation}deg`,
  } as CSSProperties;

  return (
    <section
      className={clsx(
        "flex min-h-[38rem] min-w-0 flex-col bg-subtle/55",
        className,
      )}
    >
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="global-documents-mobile-only ghost-button"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Lista
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-content">
              {document.name}
            </h2>
            {document.relatedLabel ? (
              <p className="truncate text-[10px] text-content-secondary">
                {document.relatedLabel}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {previewHref ? (
            <>
              <button
                type="button"
                onClick={onZoomOut}
                aria-label="Alejar documento"
                className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface"
              >
                <Minus size={15} aria-hidden="true" />
              </button>
              <span className="min-w-12 text-center text-[10px] font-semibold tabular-nums">
                {zoom}%
              </span>
              <button
                type="button"
                onClick={onZoomIn}
                aria-label="Acercar documento"
                className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface"
              >
                <Plus size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onRotate}
                aria-label="Girar documento"
                className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface"
              >
                <RotateCcw size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onFullscreen}
                aria-label="Ver documento a pantalla completa"
                className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface"
              >
                <Maximize2 size={15} aria-hidden="true" />
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={onClear}
            aria-label="Cerrar documento"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div
        ref={frameRef}
        className="relative flex min-h-[30rem] flex-1 items-start justify-center overflow-auto p-3 sm:p-5"
        style={viewerStyle}
      >
        {previewHref ? (
          <div
            className="origin-top overflow-hidden rounded-sm bg-white shadow-sm"
            style={{
              transform:
                "scale(var(--document-zoom)) rotate(var(--document-rotation))",
              width: "min(100%, 46rem)",
              height: "42rem",
            }}
          >
            <iframe
              src={previewHref}
              title={`Vista de ${document.name}`}
              className="h-full w-full border-0 bg-white"
            />
          </div>
        ) : document.preview ? (
          <StructuredDocumentPreview preview={document.preview} />
        ) : (
          <div className="m-auto max-w-sm rounded-xl border border-dashed border-border bg-surface p-6 text-center">
            <FileText
              size={28}
              className="mx-auto text-content-tertiary"
              aria-hidden="true"
            />
            <h3 className="mt-3 text-sm font-semibold text-content">
              Original no disponible
            </h3>
            <p className="mt-1 text-xs leading-5 text-content-secondary">
              Este registro no incluye una vista o archivo autorizado.
            </p>
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-border bg-surface p-2.5">
        {downloadAction ? (
          <ActionLink action={downloadAction} icon={Download} />
        ) : null}
        {originalAction ? (
          <ActionLink action={originalAction} icon={ExternalLink} />
        ) : null}
        {linkWorkAction ? (
          <ActionLink action={linkWorkAction} icon={BriefcaseBusiness} />
        ) : null}
        {linkPartnerAction ? (
          <ActionLink action={linkPartnerAction} icon={UserRound} />
        ) : null}
        {correctAction ? (
          <ActionLink action={correctAction} icon={Pencil} />
        ) : null}
        {confirmAction ? (
          <ActionLink action={confirmAction} icon={CheckCircle2} primary />
        ) : null}
        <button
          type="button"
          onClick={onReview}
          className="global-documents-mobile-only secondary-button ml-auto"
        >
          Revisar datos
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </footer>
    </section>
  );
}

function StructuredDocumentPreview({
  preview,
}: {
  preview: GlobalDocumentPreview;
}) {
  const hasContent = Boolean(
    preview.title ||
    preview.subtitle ||
    preview.facts?.length ||
    preview.table?.rows.length ||
    preview.totals?.length ||
    preview.notes?.length,
  );
  if (!hasContent) {
    return (
      <div className="m-auto max-w-sm rounded-xl border border-dashed border-border bg-surface p-6 text-center">
        <FileText
          size={28}
          className="mx-auto text-content-tertiary"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-semibold text-content">
          Sin contenido de vista disponible
        </p>
      </div>
    );
  }

  return (
    <article className="min-w-0 w-full max-w-[46rem] bg-white p-5 shadow-sm sm:p-7">
      <header className="border-b border-border pb-4">
        {preview.title ? (
          <h3 className="text-lg font-bold text-content">{preview.title}</h3>
        ) : null}
        {preview.subtitle ? (
          <p className="mt-1 text-xs text-content-secondary">
            {preview.subtitle}
          </p>
        ) : null}
        {preview.facts?.length ? (
          <dl className="mt-4 grid min-w-0 gap-2 text-xs">
            {preview.facts.map((field) => (
              <div
                key={field.id}
                className="grid min-w-0 grid-cols-[minmax(6rem,.42fr)_minmax(0,1fr)] gap-2"
              >
                <dt className="text-content-tertiary">{field.label}</dt>
                <dd className="min-w-0 break-words font-semibold text-content">{field.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </header>

      {preview.table?.rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-[10px]">
            <thead>
              <tr className="border-y border-border bg-subtle text-left text-content-secondary">
                {preview.table.columns.map((column) => (
                  <th key={column} className="px-2 py-2 font-semibold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {preview.table.rows.map((row) => (
                <tr key={row.id}>
                  {row.cells.map((cell, index) => (
                    <td
                      key={`${row.id}-${preview.table?.columns[index] ?? index}`}
                      className="px-2 py-2 text-content-secondary"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {preview.totals?.length ? (
        <dl className="ml-auto mt-4 grid max-w-xs gap-1.5 border-t border-border pt-3 text-xs">
          {preview.totals.map((field) => (
            <div
              key={field.id}
              className="flex items-center justify-between gap-4"
            >
              <dt className="text-content-secondary">{field.label}</dt>
              <dd className="font-semibold text-content">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {preview.notes?.length ? (
        <div className="mt-7 grid gap-1 text-[10px] leading-5 text-content-secondary">
          {preview.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function DocumentReviewPanel({
  className,
  document,
  onBack,
}: {
  className?: string;
  document: GlobalDocumentWorkspaceItem | null;
  onBack: () => void;
}) {
  if (!document) {
    return (
      <aside
        className={clsx(
          "grid min-h-[38rem] place-items-center border-border bg-surface p-5",
          className,
        )}
      >
        <div className="max-w-56 text-center">
          <ClipboardList
            size={26}
            className="mx-auto text-content-tertiary"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-semibold text-content">
            Sin documento seleccionado
          </p>
          <p className="mt-1 text-xs leading-5 text-content-secondary">
            Los datos extraídos y el historial aparecerán aquí.
          </p>
        </div>
      </aside>
    );
  }

  const editAction = validAction(document.actions?.edit);
  const confirmAction = validAction(document.actions?.confirm);
  const correctAction = validAction(document.actions?.correct);
  const discardAction = validAction(document.actions?.discard);

  return (
    <aside
      className={clsx(
        "min-h-[38rem] min-w-0 border-border bg-surface",
        className,
      )}
      aria-label={`Revisión de ${document.name}`}
    >
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-3">
        <button
          type="button"
          onClick={onBack}
          className="global-documents-mobile-only ghost-button"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Visor
        </button>
        <h2 className="text-sm font-semibold text-content">
          Datos extraídos (OCR)
        </h2>
        {editAction ? (
          <ActionLink action={editAction} icon={Pencil} compact />
        ) : null}
      </header>

      <div className="divide-y divide-border">
        {document.ocrFields?.length ? (
          document.ocrFields.map((field) => (
            <ReviewField key={field.id} field={field} />
          ))
        ) : (
          <p className="p-4 text-xs leading-5 text-content-secondary">
            Sin datos extraídos disponibles.
          </p>
        )}
      </div>

      <section className="border-t border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-content">
            Estado de revisión
          </h3>
          <StatusBadge
            label={document.statusLabel}
            tone={document.statusTone}
          />
        </div>
        {document.reviewDescription ? (
          <p className="mt-2 text-[10px] leading-5 text-content-secondary">
            {document.reviewDescription}
          </p>
        ) : null}
      </section>

      <section className="border-t border-border p-3">
        <h3 className="text-xs font-semibold text-content">Historial</h3>
        {document.history?.length ? (
          <ol className="mt-3 grid gap-3">
            {document.history.map((event) => (
              <li
                key={event.id}
                className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2 text-[10px]"
              >
                <HistoryMarker tone={event.tone} />
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <strong className="font-semibold text-content">
                      {event.title}
                    </strong>
                    <time className="shrink-0 text-content-tertiary">
                      {event.timestampLabel}
                    </time>
                  </div>
                  {event.detail ? (
                    <p className="mt-0.5 leading-4 text-content-secondary">
                      {event.detail}
                    </p>
                  ) : null}
                  {event.actorLabel ? (
                    <p className="mt-0.5 text-content-tertiary">
                      {event.actorLabel}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-[10px] leading-5 text-content-secondary">
            Sin historial disponible.
          </p>
        )}
      </section>

      {confirmAction || correctAction || discardAction ? (
        <footer className="grid gap-2 border-t border-border p-3">
          {confirmAction ? (
            <ActionLink
              action={confirmAction}
              icon={CheckCircle2}
              primary
              full
            />
          ) : null}
          {correctAction ? (
            <ActionLink action={correctAction} icon={Pencil} full />
          ) : null}
          {discardAction ? (
            <ActionLink action={discardAction} icon={X} full />
          ) : null}
        </footer>
      ) : null}
    </aside>
  );
}

function ReviewField({ field }: { field: GlobalDocumentField }) {
  const href = safeHref(field.href);
  const content = (
    <>
      <span className="text-[10px] text-content-tertiary">{field.label}</span>
      <span className="mt-1 flex items-start justify-between gap-2 text-xs font-semibold text-content">
        <span className="min-w-0 break-words">{field.value}</span>
        {field.confidenceLabel ? (
          <span className={clsx("shrink-0 text-[10px]", fieldTone(field.tone))}>
            {field.confidenceLabel}
          </span>
        ) : null}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className="block p-3 transition hover:bg-subtle">
      {content}
    </Link>
  ) : (
    <div className="p-3">{content}</div>
  );
}

function ActionLink({
  action,
  icon: Icon,
  primary = false,
  compact = false,
  full = false,
}: {
  action: GlobalDocumentAction;
  icon: typeof Download;
  primary?: boolean;
  compact?: boolean;
  full?: boolean;
}) {
  return (
    <Link
      href={action.href}
      target={action.target}
      rel={action.target === "_blank" ? "noopener noreferrer" : undefined}
      download={action.download || undefined}
      className={clsx(
        primary ? "primary-button" : "secondary-button",
        compact && "min-h-9 px-2 text-[10px]",
        full && "w-full justify-center",
      )}
    >
      <Icon size={compact ? 14 : 16} aria-hidden="true" />
      {action.label}
    </Link>
  );
}

function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: GlobalDocumentTone;
}) {
  return (
    <span
      className={clsx(
        "inline-flex min-h-5 shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-semibold",
        statusTone(tone),
      )}
    >
      {label}
    </span>
  );
}

function HistoryMarker({ tone = "neutral" }: { tone?: GlobalDocumentTone }) {
  const Icon =
    tone === "danger" || tone === "warning" ? AlertCircle : CheckCircle2;
  return (
    <span
      className={clsx(
        "mt-0.5 grid h-4 w-4 place-items-center rounded-full",
        statusTone(tone),
      )}
    >
      <Icon size={10} aria-hidden="true" />
    </span>
  );
}

function documentIcon(kind: GlobalDocumentKind) {
  if (kind === "invoice") return ReceiptText;
  if (kind === "ticket") return FileImage;
  if (kind === "contract") return FileText;
  if (kind === "work_part") return ClipboardList;
  return FileText;
}

function iconTone(kind: GlobalDocumentKind) {
  if (kind === "invoice") return "bg-danger/10 text-danger";
  if (kind === "ticket") return "bg-success/10 text-success";
  if (kind === "contract") return "bg-info/10 text-info";
  if (kind === "work_part") return "bg-warning/10 text-warning";
  return "bg-subtle text-content-secondary";
}

function statusTone(tone: GlobalDocumentTone) {
  return {
    neutral: "bg-subtle text-content-secondary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-danger/10 text-danger",
    info: "bg-info/10 text-info",
  }[tone];
}

function fieldTone(tone: GlobalDocumentTone = "neutral") {
  return {
    neutral: "text-content-tertiary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    info: "text-info",
  }[tone];
}

function validAction(action: GlobalDocumentAction | null | undefined) {
  const href = safeHref(action?.href);
  return href && action?.label.trim()
    ? { ...action, href, label: action.label.trim() }
    : null;
}

function safeHref(value: string | null | undefined) {
  const href = value?.trim();
  if (!href) return null;
  if (href.startsWith("/") || /^https?:\/\//i.test(href)) return href;
  return null;
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
