"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileArchive,
  FileCheck2,
  FileImage,
  FileText,
  Filter,
  Folder,
  ImageIcon,
  LayoutGrid,
  List,
  MapPin,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";

export type WorkDocumentsMode = "summary" | "upload" | "gallery";

export type WorkDocumentItem = {
  id: string;
  kind: "folder" | "file";
  name: string;
  category: string;
  categoryLabel?: string | null;
  subtype?: string | null;
  createdAt?: string | null;
  sizeBytes?: number | null;
  uploadedBy?: string | null;
  tags?: string[];
  mimeType?: string | null;
  href?: string | null;
};

export type WorkPhotoComment = {
  id: string;
  authorName: string;
  body: string;
  createdAt?: string | null;
  avatarUrl?: string | null;
};

export type WorkPhotoTrace = {
  id: string;
  label: string;
  actorName?: string | null;
  occurredAt?: string | null;
};

export type WorkPhotoRelatedDocument = {
  id: string;
  name: string;
  type?: string | null;
  sizeBytes?: number | null;
  href?: string | null;
};

export type WorkDocumentPhoto = {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  capturedAt?: string | null;
  category: string;
  categoryLabel?: string | null;
  authorName?: string | null;
  location?: string | null;
  device?: string | null;
  sizeBytes?: number | null;
  notes?: string | null;
  isCover?: boolean;
  comments?: WorkPhotoComment[];
  relatedDocuments?: WorkPhotoRelatedDocument[];
  trace?: WorkPhotoTrace[];
  downloadHref?: string | null;
};

export type WorkDocumentUploadQueueItem = {
  id: string;
  name: string;
  sizeBytes?: number | null;
  mimeType?: string | null;
  status: "queued" | "uploading" | "uploaded" | "error";
  progress?: number | null;
  errorMessage?: string | null;
};

export type WorkDocumentUploadDraft = {
  name: string;
  description: string;
  category: string;
  chapter: string;
  tags: string[];
  version: string;
  status: string;
  responsibleId: string;
  documentDate: string;
  visibility: string;
  selectedPhotoIds: string[];
  useSelectedPhotoAsCover: boolean;
};

export type WorkDocumentUploadOption = {
  value: string;
  label: string;
};

export type WorkDocumentAnalysis = {
  state: "pending" | "processing" | "ready" | "failed";
  suggestedCategory?: string | null;
  suggestedChapter?: string | null;
  suggestedType?: string | null;
  confidence?: number | null;
  fields?: Array<{ id: string; label: string; value: string }>;
  message?: string | null;
};

export type WorkDocumentsWorkspaceProps = {
  mode: WorkDocumentsMode;
  documents: WorkDocumentItem[];
  photos: WorkDocumentPhoto[];
  initialSelectedPhotoId?: string | null;
  uploadQueue?: WorkDocumentUploadQueueItem[];
  uploadDraft?: WorkDocumentUploadDraft | null;
  uploadStep?: 1 | 2 | 3 | 4;
  uploadOptions?: {
    categories?: WorkDocumentUploadOption[];
    chapters?: WorkDocumentUploadOption[];
    statuses?: WorkDocumentUploadOption[];
    responsibles?: WorkDocumentUploadOption[];
    visibilities?: WorkDocumentUploadOption[];
  };
  uploadAnalysis?: WorkDocumentAnalysis | null;
  acceptedMimeTypes?: string[];
  maxFileSizeBytes?: number | null;
  canUpload?: boolean;
  uploadDisabledReason?: string | null;
  onFilesSelected?: (files: readonly File[]) => void;
  onRemoveQueuedFile?: (id: string) => void;
  onClearUploadQueue?: () => void;
  onUploadDraftChange?: (draft: WorkDocumentUploadDraft) => void;
  onUploadStepChange?: (step: 1 | 2 | 3 | 4) => void;
  onApplyAnalysis?: () => void;
  onAcceptAnalysis?: () => void;
  onSaveUploadDraft?: () => void;
  onSubmitUpload?: () => void;
  onCancelUpload?: () => void;
  onSelectDocument?: (id: string) => void;
  onSelectPhoto?: (id: string) => void;
  onSetCoverPhoto?: (id: string) => void;
  onRequestUploadDocuments?: () => void;
  onRequestUploadPhotos?: () => void;
  onAddPhotoComment?: (photoId: string, body: string) => void;
  uploadDocumentsHref?: string | null;
  uploadPhotosHref?: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(value: string | null | undefined, withTime = false) {
  const date = parseDate(value);
  return date ? (withTime ? dateTimeFormatter : dateFormatter).format(date) : "Fecha no registrada";
}

function formatBytes(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  if (value < 1024) return `${Math.round(value)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = value / 1024;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount.toLocaleString("es-ES", { maximumFractionDigits: amount >= 10 ? 1 : 2 })} ${units[index]}`;
}

function normalized(value: string | null | undefined) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").trim();
}

function safeResourceUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function photoSource(photo: WorkDocumentPhoto) {
  return safeResourceUrl(photo.src);
}

function DocumentIcon({ item }: { item: WorkDocumentItem }) {
  if (item.kind === "folder") return <Folder size={16} className="text-amber-500" aria-hidden="true" />;
  const type = normalized(`${item.mimeType ?? ""} ${item.category}`);
  if (type.includes("image") || type.includes("foto")) return <FileImage size={16} className="text-blue-600" aria-hidden="true" />;
  if (type.includes("pdf")) return <FileText size={16} className="text-red-600" aria-hidden="true" />;
  return <FileArchive size={16} className="text-blue-600" aria-hidden="true" />;
}

function EmptyRecord({ icon: Icon, title, detail }: { icon: typeof FileText; title: string; detail: string }) {
  return <div className="grid min-h-36 place-content-center rounded-xl border border-dashed border-border bg-subtle/40 p-5 text-center"><Icon size={24} className="mx-auto text-content-tertiary" aria-hidden="true" /><strong className="mt-3 text-xs text-content">{title}</strong><p className="mt-1 max-w-sm text-[10px] leading-4 text-content-secondary">{detail}</p></div>;
}

function MetricCard({ label, value, detail, icon: Icon, tone = "neutral" }: { label: string; value: string; detail: string; icon: typeof FileText; tone?: "neutral" | "green" | "blue" | "violet" | "amber" }) {
  const iconTone = tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "blue" ? "bg-blue-50 text-blue-700" : tone === "violet" ? "bg-violet-50 text-violet-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700";
  return <article className="min-w-0 rounded-lg border border-border bg-surface p-3"><div className="flex items-start gap-2"><span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconTone}`}><Icon size={17} aria-hidden="true" /></span><span className="min-w-0"><small className="block truncate text-[9px] font-semibold text-content-secondary">{label}</small><strong className="mt-1 block truncate text-xl font-black tabular-nums text-content">{value}</strong><span className="mt-1 block truncate text-[8px] text-content-tertiary">{detail}</span></span></div></article>;
}

export function WorkDocumentsWorkspace(props: WorkDocumentsWorkspaceProps) {
  if (props.mode === "upload") return <UploadWorkspace {...props} />;
  if (props.mode === "gallery") return <GalleryWorkspace {...props} />;
  return <SummaryWorkspace {...props} />;
}

function SummaryWorkspace({ documents, photos, onSelectDocument, onSelectPhoto, onRequestUploadDocuments, uploadDocumentsHref }: WorkDocumentsWorkspaceProps) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const ordered = useMemo(() => [...documents].sort((a, b) => (parseDate(b.createdAt)?.getTime() ?? 0) - (parseDate(a.createdAt)?.getTime() ?? 0)), [documents]);
  const categories = useMemo(() => Array.from(new Map(ordered.map((item) => [item.category, item.categoryLabel ?? item.category])).entries()).sort((a, b) => a[1].localeCompare(b[1], "es-ES")), [ordered]);
  const filtered = useMemo(() => {
    const needle = normalized(query);
    return ordered.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      return !needle || normalized(`${item.name} ${item.categoryLabel ?? item.category} ${item.subtype ?? ""} ${item.uploadedBy ?? ""} ${(item.tags ?? []).join(" ")}`).includes(needle);
    });
  }, [category, ordered, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const activePage = Math.min(page, pages);
  const visible = filtered.slice((activePage - 1) * pageSize, activePage * pageSize);
  const files = ordered.filter((item) => item.kind === "file");
  const fileCount = (tokens: string[]) => files.filter((item) => tokens.some((token) => normalized(`${item.category} ${item.subtype ?? ""}`).includes(token))).length;
  const storage = files.reduce((sum, item) => sum + (item.sizeBytes != null && item.sizeBytes >= 0 ? item.sizeBytes : 0), 0);
  const cover = photos.find((photo) => photo.isCover) ?? null;
  const coverSrc = cover ? photoSource(cover) : null;
  const resetFilters = () => { setQuery(""); setCategory("all"); setPage(1); };

  return <div className="grid min-w-0 gap-3">
    <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Resumen documental de la obra">
      <MetricCard label="Carpetas" value={String(ordered.filter((item) => item.kind === "folder").length)} detail="Registradas en la obra" icon={Folder} tone="amber" />
      <MetricCard label="Documentos" value={String(files.length)} detail={storage ? `${formatBytes(storage)} registrados` : "Sin tamaño registrado"} icon={FileText} tone="blue" />
      <MetricCard label="Planos" value={String(fileCount(["plano", "dwg"]))} detail="Clasificación registrada" icon={FileArchive} tone="violet" />
      <MetricCard label="Permisos" value={String(fileCount(["permiso", "licencia", "certificado", "garantia"]))} detail="Clasificación registrada" icon={ShieldCheck} tone="green" />
      <MetricCard label="Facturas" value={String(fileCount(["factura"]))} detail="Vinculadas a la obra" icon={FileCheck2} tone="violet" />
      <MetricCard label="Fotos de obra" value={String(photos.length)} detail="Evidencias registradas" icon={ImageIcon} tone="green" />
    </section>

    <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface" aria-label="Repositorio documental">
        <header className="flex flex-col gap-2 border-b border-border p-3 md:flex-row md:items-center">
          <label htmlFor={`${id}-document-search`} className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border px-3"><Search size={15} className="shrink-0 text-content-tertiary" aria-hidden="true" /><span className="sr-only">Buscar documento</span><input id={`${id}-document-search`} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="min-w-0 flex-1 bg-transparent text-xs text-content outline-none" placeholder="Buscar documento, carpeta o etiqueta…" /></label>
          <label htmlFor={`${id}-document-category`} className="flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-[10px] text-content-secondary"><Filter size={14} aria-hidden="true" /><span className="sr-only">Filtrar por categoría</span><select id={`${id}-document-category`} value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="min-w-40 bg-transparent font-bold text-content outline-none"><option value="all">Todas las categorías</option>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {query || category !== "all" ? <button type="button" onClick={resetFilters} className="min-h-10 px-2 text-[10px] font-bold text-brand-strong hover:underline">Limpiar</button> : null}
          {uploadDocumentsHref ? <Link href={uploadDocumentsHref} className="primary-button justify-center"><Plus size={15} aria-hidden="true" /> Subir documento</Link> : onRequestUploadDocuments ? <button type="button" onClick={onRequestUploadDocuments} className="primary-button justify-center"><Plus size={15} aria-hidden="true" /> Subir documento</button> : null}
        </header>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[54rem] border-collapse text-left text-[10px]">
            <thead className="border-b border-border bg-subtle text-content-secondary"><tr><th className="w-8 px-3 py-2"><span className="sr-only">Tipo</span></th><th className="min-w-52 px-3 py-2 font-semibold">Nombre</th><th className="px-3 py-2 font-semibold">Tipo</th><th className="px-3 py-2 font-semibold">Subtipo</th><th className="px-3 py-2 font-semibold">Fecha</th><th className="px-3 py-2 text-right font-semibold">Tamaño</th><th className="px-3 py-2 font-semibold">Subido por</th><th className="px-3 py-2 font-semibold">Etiquetas</th><th className="w-12 px-3 py-2"><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody className="divide-y divide-border">{visible.map((item) => {
              const href = safeResourceUrl(item.href);
              return <tr key={item.id} className="text-content-secondary hover:bg-subtle/60"><td className="px-3 py-2"><DocumentIcon item={item} /></td><td className="px-3 py-2">{onSelectDocument ? <button type="button" onClick={() => onSelectDocument(item.id)} className="max-w-64 truncate text-left font-bold text-content hover:underline">{item.name}</button> : <span className="block max-w-64 truncate font-bold text-content">{item.name}</span>}</td><td className="px-3 py-2">{item.kind === "folder" ? "Carpeta" : item.categoryLabel ?? item.category}</td><td className="px-3 py-2">{item.subtype?.trim() || "—"}</td><td className="px-3 py-2"><time dateTime={item.createdAt ?? undefined}>{dateLabel(item.createdAt)}</time></td><td className="px-3 py-2 text-right tabular-nums">{formatBytes(item.sizeBytes) ?? "—"}</td><td className="px-3 py-2">{item.uploadedBy?.trim() || "—"}</td><td className="px-3 py-2"><span className="flex max-w-44 flex-wrap gap-1">{(item.tags ?? []).slice(0, 2).map((tagValue) => <span key={tagValue} className="rounded bg-brand-soft px-1.5 py-0.5 text-[8px] font-bold text-brand-strong">{tagValue}</span>)}{(item.tags?.length ?? 0) > 2 ? <span className="text-[8px] font-semibold text-content-tertiary">+{item.tags!.length - 2}</span> : null}</span></td><td className="px-3 py-2 text-right">{href ? <Link href={href} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${item.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-content-secondary hover:bg-subtle hover:text-content"><Download size={14} aria-hidden="true" /></Link> : <span className="text-content-tertiary">—</span>}</td></tr>;
            })}</tbody>
          </table>
        </div>
        {visible.length === 0 ? <div className="p-4"><EmptyRecord icon={FileArchive} title="Sin resultados" detail={documents.length ? "No hay documentos que coincidan con los filtros actuales." : "Esta obra no tiene documentos registrados."} /></div> : null}
        <footer className="flex flex-col gap-3 border-t border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[9px] text-content-secondary" aria-live="polite">Mostrando {visible.length ? (activePage - 1) * pageSize + 1 : 0}–{Math.min(activePage * pageSize, filtered.length)} de {filtered.length}</p>{pages > 1 ? <nav className="flex items-center gap-1" aria-label="Paginación documental"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={activePage === 1} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border disabled:opacity-40"><ChevronLeft size={14} aria-hidden="true" /><span className="sr-only">Página anterior</span></button>{Array.from({ length: pages }, (_, index) => index + 1).slice(Math.max(0, activePage - 3), Math.max(0, activePage - 3) + 5).map((value) => <button key={value} type="button" onClick={() => setPage(value)} aria-current={value === activePage ? "page" : undefined} className={`h-8 min-w-8 rounded-lg border px-2 text-[10px] font-bold ${value === activePage ? "border-brand bg-brand text-white" : "border-border text-content-secondary"}`}>{value}</button>)}<button type="button" onClick={() => setPage((current) => Math.min(pages, current + 1))} disabled={activePage === pages} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border disabled:opacity-40"><ChevronRight size={14} aria-hidden="true" /><span className="sr-only">Página siguiente</span></button></nav> : null}</footer>
      </section>

      <aside className="grid content-start gap-3" aria-label="Portada y fotografías de la obra">
        <section className="rounded-xl border border-border bg-surface p-3"><h2 className="text-[11px] font-black text-content">Imagen de portada de la obra</h2><p className="mt-1 text-[9px] leading-4 text-content-secondary">La portada sólo cambia mediante una acción confirmada.</p>{cover && coverSrc ? <button type="button" onClick={() => onSelectPhoto?.(cover.id)} disabled={!onSelectPhoto} className="group relative mt-3 block aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-subtle disabled:cursor-default"><Image src={coverSrc} alt={cover.alt} width={Math.max(1, cover.width)} height={Math.max(1, cover.height)} unoptimized className="h-full w-full object-cover transition group-enabled:hover:scale-[1.02]" /><span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-slate-950/80 px-2 py-1 text-[9px] font-bold text-white"><Star size={12} aria-hidden="true" /> Portada actual</span></button> : <div className="mt-3"><EmptyRecord icon={ImageIcon} title="Sin portada registrada" detail="Selecciona una fotografía real de la obra para establecerla como portada." /></div>}<div className="mt-3 grid grid-cols-3 gap-2">{photos.slice(0, 6).map((photo) => { const src = photoSource(photo); return src ? <button key={photo.id} type="button" onClick={() => onSelectPhoto?.(photo.id)} disabled={!onSelectPhoto} aria-label={`Abrir ${photo.alt}`} className={`relative aspect-square overflow-hidden rounded-lg border bg-subtle ${photo.isCover ? "border-brand ring-1 ring-brand" : "border-border"}`}><Image src={src} alt="" width={Math.max(1, photo.width)} height={Math.max(1, photo.height)} unoptimized className="h-full w-full object-cover" />{photo.isCover ? <CheckCircle2 size={15} className="absolute right-1 top-1 rounded-full bg-white text-brand-strong" aria-hidden="true" /> : null}</button> : null; })}</div>{photos.length > 6 ? <p className="mt-2 text-[9px] font-semibold text-content-secondary">+{photos.length - 6} fotografías registradas</p> : null}</section>
      </aside>
    </div>
  </div>;
}

function UploadWorkspace(props: WorkDocumentsWorkspaceProps) {
  const { uploadQueue = [], uploadDraft, uploadStep = 1, uploadOptions, uploadAnalysis, photos, acceptedMimeTypes, maxFileSizeBytes, canUpload = false, uploadDisabledReason, onFilesSelected, onRemoveQueuedFile, onClearUploadQueue, onUploadDraftChange, onUploadStepChange, onApplyAnalysis, onAcceptAnalysis, onSaveUploadDraft, onSubmitUpload, onCancelUpload } = props;
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const draft = uploadDraft ?? { name: "", description: "", category: "", chapter: "", tags: [], version: "", status: "", responsibleId: "", documentDate: "", visibility: "", selectedPhotoIds: [], useSelectedPhotoAsCover: false };
  const updateDraft = <K extends keyof WorkDocumentUploadDraft>(key: K, value: WorkDocumentUploadDraft[K]) => onUploadDraftChange?.({ ...draft, [key]: value });
  const uploadReady = canUpload && Boolean(onFilesSelected);
  const accept = acceptedMimeTypes?.join(",") || undefined;
  const steps = [[1, "Archivos", "Sube tus archivos"], [2, "Detalles", "Completa la información"], [3, "Revisión", "Verifica y confirma"], [4, "Confirmación", "Documento listo"]] as const;
  const handleFiles = (fileList: FileList | null) => { if (!fileList || !uploadReady) return; onFilesSelected?.(Array.from(fileList)); };

  return <div className="grid min-w-0 gap-3">
    <ol className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-4" aria-label="Proceso de subida">{steps.map(([number, label, detail]) => <li key={number} className="bg-surface"><button type="button" onClick={() => onUploadStepChange?.(number)} disabled={!onUploadStepChange} aria-current={uploadStep === number ? "step" : undefined} className="flex min-h-16 w-full items-center gap-3 px-4 text-left disabled:cursor-default"><span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${uploadStep === number ? "bg-brand text-white" : uploadStep > number ? "bg-brand-soft text-brand-strong" : "bg-subtle text-content-secondary"}`}>{uploadStep > number ? <CheckCircle2 size={14} aria-hidden="true" /> : number}</span><span className="min-w-0"><strong className="block text-[10px] text-content">{label}</strong><small className="mt-0.5 block truncate text-[8px] text-content-secondary">{detail}</small></span></button></li>)}</ol>

    <div className="grid min-w-0 gap-3 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <section className="grid content-start gap-3" aria-label="Selección de archivos">
        <div onDragEnter={(event) => { event.preventDefault(); if (uploadReady) setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); handleFiles(event.dataTransfer.files); }} className={`grid min-h-48 place-content-center rounded-xl border border-dashed p-5 text-center ${dragging ? "border-brand bg-brand-soft/50" : "border-border bg-surface"}`}>
          <UploadCloud size={32} className="mx-auto text-content-tertiary" aria-hidden="true" /><strong className="mt-3 text-xs text-content">Arrastra y suelta archivos aquí</strong><p className="mt-1 text-[9px] text-content-secondary">{acceptedMimeTypes?.length ? acceptedMimeTypes.join(", ") : "Los formatos permitidos los define la configuración del servidor."}{maxFileSizeBytes ? ` · Máximo ${formatBytes(maxFileSizeBytes)} por archivo` : ""}</p><input ref={fileInput} id={`${id}-files`} type="file" multiple accept={accept} disabled={!uploadReady} className="sr-only" onChange={(event) => { handleFiles(event.target.files); event.currentTarget.value = ""; }} /><button type="button" onClick={() => fileInput.current?.click()} disabled={!uploadReady} className="secondary-button mx-auto mt-4 justify-center">Seleccionar archivos</button>{!uploadReady ? <p className="mt-3 max-w-sm text-[9px] font-semibold text-warning">{uploadDisabledReason?.trim() || "La subida no está conectada para este contexto."}</p> : null}
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-surface"><header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2"><h2 className="text-[11px] font-black text-content">Archivos <span className="font-medium text-content-secondary">({uploadQueue.length})</span></h2>{uploadQueue.length && onClearUploadQueue ? <button type="button" onClick={onClearUploadQueue} className="text-[9px] font-bold text-content-secondary hover:text-content">Limpiar todo</button> : null}</header>{uploadQueue.length ? <ul className="divide-y divide-border">{uploadQueue.map((item) => <li key={item.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-3"><FileArchive size={16} className={item.status === "error" ? "text-danger" : "text-blue-600"} aria-hidden="true" /><span className="min-w-0"><strong className="block truncate text-[10px] text-content">{item.name}</strong><small className={`mt-0.5 block text-[8px] ${item.status === "error" ? "text-danger" : "text-content-secondary"}`}>{item.errorMessage?.trim() || [formatBytes(item.sizeBytes), item.mimeType, item.status === "uploading" && item.progress != null ? `${Math.max(0, Math.min(100, item.progress))}%` : null].filter(Boolean).join(" · ") || item.status}</small>{item.status === "uploading" && item.progress != null ? <progress max={100} value={Math.max(0, Math.min(100, item.progress))} className="mt-1 h-1 w-full accent-brand">{item.progress}%</progress> : null}</span>{onRemoveQueuedFile && item.status !== "uploading" ? <button type="button" onClick={() => onRemoveQueuedFile(item.id)} aria-label={`Quitar ${item.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-content-tertiary hover:bg-subtle hover:text-danger"><X size={14} aria-hidden="true" /></button> : null}</li>)}</ul> : <p className="p-5 text-center text-[10px] text-content-secondary">No hay archivos en la cola.</p>}</div>
      </section>

      <section className="min-w-0 rounded-xl border border-border bg-surface p-4" aria-label="Información del documento"><h2 className="text-sm font-black text-content">Información del documento</h2><div className="mt-4 grid gap-3">
        <Field label="Nombre del documento" required><input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} disabled={!onUploadDraftChange} className="field-control" /></Field>
        <Field label="Descripción"><textarea value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} disabled={!onUploadDraftChange} rows={3} className="field-control resize-y" /></Field>
        <div className="grid gap-3 sm:grid-cols-2"><SelectField label="Categoría" required value={draft.category} options={uploadOptions?.categories} disabled={!onUploadDraftChange} onChange={(value) => updateDraft("category", value)} /><SelectField label="Capítulo" value={draft.chapter} options={uploadOptions?.chapters} disabled={!onUploadDraftChange} onChange={(value) => updateDraft("chapter", value)} /></div>
        <Field label="Etiquetas"><div className="flex min-h-10 flex-wrap items-center gap-1 rounded-lg border border-border px-2">{draft.tags.map((value) => <span key={value} className="inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-1 text-[9px] font-semibold text-content-secondary"><Tag size={10} aria-hidden="true" />{value}{onUploadDraftChange ? <button type="button" onClick={() => updateDraft("tags", draft.tags.filter((tagValue) => tagValue !== value))} aria-label={`Quitar etiqueta ${value}`}><X size={10} aria-hidden="true" /></button> : null}</span>)}{draft.tags.length === 0 ? <span className="text-[9px] text-content-tertiary">Sin etiquetas</span> : null}</div></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Versión"><input value={draft.version} onChange={(event) => updateDraft("version", event.target.value)} disabled={!onUploadDraftChange} className="field-control" /></Field><SelectField label="Estado" value={draft.status} options={uploadOptions?.statuses} disabled={!onUploadDraftChange} onChange={(value) => updateDraft("status", value)} /></div>
        <div className="grid gap-3 sm:grid-cols-2"><SelectField label="Responsable" value={draft.responsibleId} options={uploadOptions?.responsibles} disabled={!onUploadDraftChange} onChange={(value) => updateDraft("responsibleId", value)} /><Field label="Fecha del documento"><input type="date" value={draft.documentDate} onChange={(event) => updateDraft("documentDate", event.target.value)} disabled={!onUploadDraftChange} className="field-control" /></Field></div>
        <SelectField label="Permisos de visibilidad" value={draft.visibility} options={uploadOptions?.visibilities} disabled={!onUploadDraftChange} onChange={(value) => updateDraft("visibility", value)} />
      </div></section>
    </div>

    <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,.9fr)]">
      <section className="rounded-xl border border-border bg-surface p-3"><header><h2 className="text-[11px] font-black text-content">Fotos de obra</h2><p className="mt-1 text-[9px] text-content-secondary">Selecciona únicamente fotografías ya registradas en la obra.</p></header>{photos.length ? <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{photos.map((photo) => { const src = photoSource(photo); const selected = draft.selectedPhotoIds.includes(photo.id); return src ? <button key={photo.id} type="button" disabled={!onUploadDraftChange} onClick={() => updateDraft("selectedPhotoIds", selected ? draft.selectedPhotoIds.filter((idValue) => idValue !== photo.id) : [...draft.selectedPhotoIds, photo.id])} aria-pressed={selected} className={`relative overflow-hidden rounded-lg border bg-subtle text-left ${selected ? "border-brand ring-1 ring-brand" : "border-border"}`}><Image src={src} alt={photo.alt} width={Math.max(1, photo.width)} height={Math.max(1, photo.height)} unoptimized className="aspect-[4/3] w-full object-cover" /><span className="block truncate px-2 py-1.5 text-[8px] font-semibold text-content-secondary">{photo.alt}</span>{selected ? <CheckCircle2 size={16} className="absolute right-1.5 top-1.5 rounded-full bg-white text-brand-strong" aria-hidden="true" /> : null}</button> : null; })}</div> : <div className="mt-3"><EmptyRecord icon={Camera} title="Sin fotografías registradas" detail="No se muestran imágenes de ejemplo ni archivos inventados." /></div>}{draft.selectedPhotoIds.length ? <label className="mt-3 flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-[10px] font-semibold text-content-secondary"><input type="checkbox" checked={draft.useSelectedPhotoAsCover} onChange={(event) => updateDraft("useSelectedPhotoAsCover", event.target.checked)} disabled={!onUploadDraftChange} className="h-4 w-4 accent-brand" />Usar la primera fotografía seleccionada como portada</label> : null}</section>
      <AnalysisPanel analysis={uploadAnalysis} onApply={onApplyAnalysis} onAccept={onAcceptAnalysis} />
    </div>

    <footer className="flex flex-col-reverse gap-2 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:justify-end">{onCancelUpload ? <button type="button" onClick={onCancelUpload} className="secondary-button justify-center">Cancelar</button> : null}{onSaveUploadDraft ? <button type="button" onClick={onSaveUploadDraft} className="secondary-button justify-center">Guardar borrador</button> : null}{onSubmitUpload ? <button type="button" onClick={onSubmitUpload} disabled={!canUpload || uploadQueue.length === 0} className="primary-button justify-center disabled:cursor-not-allowed disabled:opacity-50">Subir y finalizar</button> : null}</footer>
  </div>;
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-[10px] font-bold text-content"><span>{label}{required ? <span className="ml-0.5 text-danger" aria-hidden="true">*</span> : null}</span>{children}</label>;
}

function SelectField({ label, value, options, disabled, required = false, onChange }: { label: string; value: string; options?: WorkDocumentUploadOption[]; disabled: boolean; required?: boolean; onChange: (value: string) => void }) {
  return <Field label={label} required={required}><select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="field-control"><option value="">Sin seleccionar</option>{(options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>;
}

function AnalysisPanel({ analysis, onApply, onAccept }: { analysis?: WorkDocumentAnalysis | null; onApply?: () => void; onAccept?: () => void }) {
  if (!analysis) return <section className="rounded-xl border border-border bg-surface p-3"><EmptyRecord icon={Sparkles} title="Sin análisis recibido" detail="La interfaz no genera clasificaciones ni datos extraídos por su cuenta." /></section>;
  const confidence = analysis.confidence != null ? Math.max(0, Math.min(1, analysis.confidence)) : null;
  return <section className="rounded-xl border border-border bg-surface p-3"><header className="flex items-center gap-2"><Sparkles size={16} className="text-brand-strong" aria-hidden="true" /><h2 className="text-[11px] font-black text-content">Extracción automática</h2><span className="ml-auto rounded-full bg-brand-soft px-2 py-1 text-[8px] font-black uppercase text-brand-strong">{analysis.state}</span></header>{analysis.message ? <p className="mt-3 text-[10px] leading-4 text-content-secondary">{analysis.message}</p> : null}{analysis.state === "ready" ? <><dl className="mt-3 grid gap-2 text-[10px]">{analysis.suggestedType ? <DataRow label="Tipo detectado" value={analysis.suggestedType} /> : null}{analysis.suggestedCategory ? <DataRow label="Categoría sugerida" value={analysis.suggestedCategory} /> : null}{analysis.suggestedChapter ? <DataRow label="Capítulo sugerido" value={analysis.suggestedChapter} /> : null}{confidence != null ? <DataRow label="Confianza registrada" value={`${Math.round(confidence * 100)}%`} /> : null}{(analysis.fields ?? []).map((field) => <DataRow key={field.id} label={field.label} value={field.value} />)}</dl><div className="mt-4 flex flex-wrap gap-2">{onApply ? <button type="button" onClick={onApply} className="primary-button justify-center">Aplicar sugerencia</button> : null}{onAccept ? <button type="button" onClick={onAccept} className="secondary-button justify-center">Aceptar datos</button> : null}</div></> : <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-center text-[10px] text-content-secondary">{analysis.state === "failed" ? "El análisis no se completó. Revisa el error comunicado por el servicio." : "El análisis todavía no dispone de un resultado confirmado."}</p>}</section>;
}

function DataRow({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[minmax(7rem,.8fr)_minmax(0,1.2fr)] gap-3 border-b border-border pb-2 last:border-0"><dt className="text-content-secondary">{label}</dt><dd className="font-bold text-content">{value}</dd></div>;
}

function GalleryWorkspace({ photos, initialSelectedPhotoId, onSelectPhoto, onSetCoverPhoto, onRequestUploadPhotos, onAddPhotoComment, uploadPhotosHref }: WorkDocumentsWorkspaceProps) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedPhotoId ?? photos.find((photo) => photo.isCover)?.id ?? photos[0]?.id ?? null);
  const [comment, setComment] = useState("");
  const categories = useMemo(() => Array.from(new Map(photos.map((photo) => [photo.category, photo.categoryLabel ?? photo.category])).entries()).sort((a, b) => a[1].localeCompare(b[1], "es-ES")), [photos]);
  const filtered = useMemo(() => {
    const needle = normalized(query);
    return [...photos].sort((a, b) => (parseDate(b.capturedAt)?.getTime() ?? 0) - (parseDate(a.capturedAt)?.getTime() ?? 0)).filter((photo) => (category === "all" || photo.category === category) && (!needle || normalized(`${photo.alt} ${photo.categoryLabel ?? photo.category} ${photo.authorName ?? ""} ${photo.location ?? ""}`).includes(needle)));
  }, [category, photos, query]);
  const selected = filtered.find((photo) => photo.id === selectedId) ?? filtered[0] ?? null;
  const selectedIndex = selected ? filtered.findIndex((photo) => photo.id === selected.id) : -1;
  const choose = (photo: WorkDocumentPhoto) => { setSelectedId(photo.id); onSelectPhoto?.(photo.id); };
  const move = (delta: number) => { if (!filtered.length || selectedIndex < 0) return; choose(filtered[(selectedIndex + delta + filtered.length) % filtered.length]); };
  const selectedSrc = selected ? photoSource(selected) : null;
  const submitComment = () => { const body = comment.trim(); if (!selected || !body || !onAddPhotoComment) return; onAddPhotoComment(selected.id, body); setComment(""); };

  return <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(21rem,.9fr)_minmax(25rem,1.25fr)]">
    <section className="min-w-0 rounded-xl border border-border bg-surface p-3" aria-label="Galería fotográfica"><header className="flex flex-col gap-3"><div className="flex items-start justify-between gap-3"><span><h2 className="text-sm font-black text-content">Galería fotográfica</h2><p className="mt-1 text-[9px] text-content-secondary">Imágenes registradas como avance y evidencia visual de la obra.</p></span><span className="inline-flex rounded-lg border border-border p-1"><button type="button" onClick={() => setLayout("grid")} aria-pressed={layout === "grid"} aria-label="Vista en cuadrícula" className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${layout === "grid" ? "bg-subtle text-content" : "text-content-tertiary"}`}><LayoutGrid size={14} aria-hidden="true" /></button><button type="button" onClick={() => setLayout("list")} aria-pressed={layout === "list"} aria-label="Vista en lista" className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${layout === "list" ? "bg-subtle text-content" : "text-content-tertiary"}`}><List size={14} aria-hidden="true" /></button></span></div><div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><label htmlFor={`${id}-gallery-search`} className="flex min-h-10 items-center gap-2 rounded-lg border border-border px-3"><Search size={14} className="text-content-tertiary" aria-hidden="true" /><span className="sr-only">Buscar fotografía</span><input id={`${id}-gallery-search`} value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[10px] text-content outline-none" placeholder="Buscar fotografía…" /></label><label htmlFor={`${id}-gallery-category`} className="flex min-h-10 items-center gap-2 rounded-lg border border-border px-3"><Filter size={14} className="text-content-tertiary" aria-hidden="true" /><span className="sr-only">Categoría</span><select id={`${id}-gallery-category`} value={category} onChange={(event) => setCategory(event.target.value)} className="min-w-36 bg-transparent text-[10px] font-bold text-content outline-none"><option value="all">Todas las categorías</option>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{uploadPhotosHref ? <Link href={uploadPhotosHref} className="secondary-button justify-center"><Plus size={14} aria-hidden="true" /> Subir fotos</Link> : onRequestUploadPhotos ? <button type="button" onClick={onRequestUploadPhotos} className="secondary-button justify-center"><Plus size={14} aria-hidden="true" /> Subir fotos</button> : null}</div></header>

      {filtered.length ? <div className={`mt-3 ${layout === "grid" ? "grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4" : "grid gap-2"}`}>{filtered.map((photo) => { const src = photoSource(photo); if (!src) return null; const active = selected?.id === photo.id; return <button key={photo.id} type="button" onClick={() => choose(photo)} aria-pressed={active} className={`group overflow-hidden rounded-lg border bg-surface text-left ${layout === "list" ? "grid grid-cols-[7rem_minmax(0,1fr)] items-center" : ""} ${active ? "border-brand ring-1 ring-brand" : "border-border"}`}><span className="relative block overflow-hidden bg-subtle"><Image src={src} alt={photo.alt} width={Math.max(1, photo.width)} height={Math.max(1, photo.height)} unoptimized className={`${layout === "grid" ? "aspect-[4/3]" : "h-20"} w-full object-cover transition group-hover:scale-[1.02]`} />{photo.isCover ? <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white"><Star size={11} aria-hidden="true" /><span className="sr-only">Portada actual</span></span> : null}</span><span className="block min-w-0 p-2"><strong className="block truncate text-[9px] text-content">{dateLabel(photo.capturedAt)}</strong><span className="mt-1 block truncate text-[8px] text-content-secondary">{photo.categoryLabel ?? photo.category}</span></span></button>; })}</div> : <div className="mt-3"><EmptyRecord icon={ImageIcon} title="Sin fotografías" detail={photos.length ? "No hay fotografías que coincidan con los filtros." : "La obra aún no tiene evidencia fotográfica registrada."} /></div>}
    </section>

    <section className="grid min-w-0 content-start gap-3" aria-label="Detalle de fotografía">{selected && selectedSrc ? <>
      <div className="rounded-xl border border-border bg-surface p-3"><header className="flex flex-wrap items-center justify-between gap-2"><div>{selected.isCover ? <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-1 text-[8px] font-black text-brand-strong"><Star size={10} aria-hidden="true" /> Portada actual</span> : null}</div><div className="flex gap-2">{!selected.isCover && onSetCoverPhoto ? <button type="button" onClick={() => onSetCoverPhoto(selected.id)} className="secondary-button"><Star size={14} aria-hidden="true" /> Elegir como portada</button> : null}{safeResourceUrl(selected.downloadHref) ? <Link href={safeResourceUrl(selected.downloadHref)!} target="_blank" rel="noopener noreferrer" className="secondary-button" aria-label="Descargar fotografía"><Download size={14} aria-hidden="true" /></Link> : null}</div></header><div className="group relative mt-3 overflow-hidden rounded-xl border border-border bg-subtle"><Image src={selectedSrc} alt={selected.alt} width={Math.max(1, selected.width)} height={Math.max(1, selected.height)} unoptimized className="aspect-[16/9] w-full object-contain" />{filtered.length > 1 ? <><button type="button" onClick={() => move(-1)} className="absolute left-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-content shadow" aria-label="Fotografía anterior"><ChevronLeft size={17} aria-hidden="true" /></button><button type="button" onClick={() => move(1)} className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-content shadow" aria-label="Fotografía siguiente"><ChevronRight size={17} aria-hidden="true" /></button></> : null}</div><dl className="mt-3 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 xl:grid-cols-3"><PhotoFact label="Fecha" value={dateLabel(selected.capturedAt, true)} /><PhotoFact label="Categoría" value={selected.categoryLabel ?? selected.category} /><PhotoFact label="Autor" value={selected.authorName?.trim() || "No registrado"} /><PhotoFact label="Ubicación" value={selected.location?.trim() || "No registrada"} /><PhotoFact label="Tamaño" value={formatBytes(selected.sizeBytes) ?? "No registrado"} /><PhotoFact label="Dispositivo" value={selected.device?.trim() || "No registrado"} /></dl>{selected.notes ? <div className="mt-3 rounded-lg border border-border bg-subtle p-3"><strong className="text-[9px] text-content">Notas registradas</strong><p className="mt-1 whitespace-pre-wrap text-[9px] leading-4 text-content-secondary">{selected.notes}</p></div> : null}</div>

      <div className="grid gap-3 lg:grid-cols-2"><section className="rounded-xl border border-border bg-surface p-3"><header className="flex items-center justify-between gap-2"><h3 className="text-[11px] font-black text-content">Comentarios</h3><span className="text-[9px] font-bold text-content-secondary">{selected.comments?.length ?? 0}</span></header>{selected.comments?.length ? <ul className="mt-3 grid gap-3">{selected.comments.map((entry) => <li key={entry.id} className="flex gap-2"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-subtle text-content-secondary">{safeResourceUrl(entry.avatarUrl) ? <Image src={safeResourceUrl(entry.avatarUrl)!} alt="" width={28} height={28} unoptimized className="h-full w-full object-cover" /> : <UserRound size={13} aria-hidden="true" />}</span><span className="min-w-0"><span className="flex flex-wrap items-center gap-1.5"><strong className="text-[9px] text-content">{entry.authorName}</strong>{entry.createdAt ? <time dateTime={entry.createdAt} className="text-[8px] text-content-tertiary">{dateLabel(entry.createdAt, true)}</time> : null}</span><p className="mt-1 text-[9px] leading-4 text-content-secondary">{entry.body}</p></span></li>)}</ul> : <p className="mt-3 text-[9px] text-content-secondary">No hay comentarios registrados.</p>}{onAddPhotoComment ? <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); submitComment(); }}><label className="sr-only" htmlFor={`${id}-comment`}>Añadir comentario</label><input id={`${id}-comment`} value={comment} onChange={(event) => setComment(event.target.value)} className="field-control min-w-0 flex-1" placeholder="Escribe un comentario…" /><button type="submit" disabled={!comment.trim()} className="primary-button disabled:opacity-50">Enviar</button></form> : null}</section>

      <section className="rounded-xl border border-border bg-surface p-3"><header className="flex items-center justify-between gap-2"><h3 className="text-[11px] font-black text-content">Documentos relacionados</h3><span className="text-[9px] font-bold text-content-secondary">{selected.relatedDocuments?.length ?? 0}</span></header>{selected.relatedDocuments?.length ? <ul className="mt-3 grid gap-2">{selected.relatedDocuments.map((document) => { const href = safeResourceUrl(document.href); const content = <><FileText size={14} className="shrink-0 text-red-600" aria-hidden="true" /><span className="min-w-0"><strong className="block truncate text-[9px] text-content">{document.name}</strong><small className="mt-0.5 block text-[8px] text-content-secondary">{[document.type, formatBytes(document.sizeBytes)].filter(Boolean).join(" · ") || "Documento relacionado"}</small></span></>; return <li key={document.id}>{href ? <Link href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-border p-2 hover:bg-subtle">{content}</Link> : <div className="flex items-center gap-2 rounded-lg border border-border p-2">{content}</div>}</li>; })}</ul> : <p className="mt-3 text-[9px] text-content-secondary">No hay documentos relacionados.</p>}</section></div>

      <section className="rounded-xl border border-border bg-surface p-3"><h3 className="text-[11px] font-black text-content">Trazabilidad</h3>{selected.trace?.length ? <ol className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{selected.trace.map((entry) => <li key={entry.id} className="flex gap-2 rounded-lg bg-subtle p-2"><CheckCircle2 size={14} className="shrink-0 text-brand-strong" aria-hidden="true" /><span className="min-w-0"><strong className="block text-[9px] text-content">{entry.label}</strong>{entry.actorName ? <small className="mt-0.5 block truncate text-[8px] text-content-secondary">{entry.actorName}</small> : null}{entry.occurredAt ? <time dateTime={entry.occurredAt} className="mt-0.5 block text-[8px] text-content-tertiary">{dateLabel(entry.occurredAt, true)}</time> : null}</span></li>)}</ol> : <p className="mt-3 text-[9px] text-content-secondary">No hay eventos de trazabilidad registrados.</p>}</section>
    </> : <EmptyRecord icon={ImageIcon} title="Sin fotografía seleccionada" detail="Selecciona una imagen real de la galería para consultar sus datos." />}</section>
  </div>;
}

function PhotoFact({ label, value }: { label: string; value: string }) {
  const Icon = label === "Fecha" ? CalendarDays : label === "Ubicación" ? MapPin : label === "Autor" ? UserRound : label === "Categoría" ? Tag : label === "Dispositivo" ? Camera : Paperclip;
  return <div className="bg-surface p-3"><dt className="flex items-center gap-1.5 text-[8px] font-semibold text-content-secondary"><Icon size={12} aria-hidden="true" />{label}</dt><dd className="mt-1 truncate text-[9px] font-bold text-content" title={value}>{value}</dd></div>;
}
