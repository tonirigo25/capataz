import Image from "next/image";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Mail,
  Maximize2,
  MoreHorizontal,
  Search,
  Upload,
  UserRound,
  ZoomIn,
} from "lucide-react";

export type ClientFileTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "violet";

export type ClientFileKind =
  | "pdf"
  | "word"
  | "spreadsheet"
  | "image"
  | "drawing"
  | "email"
  | "other";

export type ClientFileAction = {
  label: string;
  href: string | null;
  allowed: boolean;
};

type ClientFileScoped = {
  companyId: string;
  clientId: string;
};

export type ClientFileCategory = ClientFileScoped & {
  id: string;
  label: string;
  active: boolean;
  action: ClientFileAction;
};

export type ClientFileFolder = ClientFileScoped & {
  id: string;
  name: string;
  fileCount: number | null;
  tone?: ClientFileTone;
  action?: ClientFileAction | null;
};

export type ClientFileTag = {
  label: string;
  tone?: ClientFileTone;
};

export type ClientFileRecord = ClientFileScoped & {
  id: string;
  name: string;
  kind: ClientFileKind | null;
  typeLabel: string | null;
  versionLabel: string | null;
  dateLabel: string | null;
  sizeBytes: number | null;
  sizeLabel?: string | null;
  tags: ClientFileTag[];
  selected?: boolean;
  openAction?: ClientFileAction | null;
  selectAction?: ClientFileAction | null;
  moreAction?: ClientFileAction | null;
};

export type ClientFileDetailField = {
  label: string;
  value: string | null;
  valueTone?: ClientFileTone;
  action?: ClientFileAction | null;
};

export type ClientFileDetail = ClientFileScoped & {
  fileId: string;
  title: string;
  previewImage?: {
    src: string;
    alt: string;
    width: number;
    height: number;
  } | null;
  pageLabel?: string | null;
  previousPageAction?: ClientFileAction | null;
  nextPageAction?: ClientFileAction | null;
  zoomAction?: ClientFileAction | null;
  fullscreenAction?: ClientFileAction | null;
  moreAction?: ClientFileAction | null;
  fields: ClientFileDetailField[];
  permissionAvatars?: Array<{
    id: string;
    src: string;
    alt: string;
  }>;
  permissionOverflowLabel?: string | null;
  managePermissionsAction?: ClientFileAction | null;
};

export type ClientFileStorage = ClientFileScoped & {
  usedLabel: string | null;
  totalLabel: string | null;
  usedPercent: number | null;
};

export type ClientFileSearch = {
  allowed: boolean;
  actionHref: string | null;
  name?: string;
  value?: string;
  placeholder?: string;
  hiddenFields?: Array<{ name: string; value: string }>;
};

export type ClientFilePagination = ClientFileScoped & {
  summaryLabel: string | null;
  previous?: ClientFileAction | null;
  next?: ClientFileAction | null;
  pages: Array<ClientFileAction & { active: boolean }>;
  pageSizeAction?: ClientFileAction | null;
};

export type Client360FilesOverviewProps = {
  scope: {
    companyId: string | null;
    clientId: string | null;
    tenantScopeVerified: boolean;
    clientScopeVerified: boolean;
  };
  categories: ClientFileCategory[] | null;
  folders: ClientFileFolder[] | null;
  files: ClientFileRecord[] | null;
  storage?: ClientFileStorage | null;
  detail?: ClientFileDetail | null;
  pagination?: ClientFilePagination | null;
  search?: ClientFileSearch | null;
  uploadAction?: ClientFileAction | null;
  newFolderAction?: ClientFileAction | null;
  className?: string;
};

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

/**
 * Client 360 file library from the selected Archivos view.
 *
 * It is intentionally separate from the global Documentos repository. The
 * complete view blocks when any received entity escapes the verified tenant
 * and client scope; folders, versions, tags, states and actions are never
 * reconstructed inside the component.
 */
export function Client360FilesOverview({
  scope,
  categories,
  folders,
  files,
  storage,
  detail,
  pagination,
  search,
  uploadAction,
  newFolderAction,
  className = "",
}: Client360FilesOverviewProps) {
  const scopedCategories = categories ?? [];
  const scopedFolders = folders ?? [];
  const scopedFiles = files ?? [];
  const scopeAccepted = hasVerifiedScope({
    scope,
    categories: scopedCategories,
    folders: scopedFolders,
    files: scopedFiles,
    storage,
    detail,
    pagination,
  });

  if (!scopeAccepted) {
    return (
      <section
        className={`grid min-h-64 place-content-center justify-items-center rounded-xl border border-danger/25 bg-danger/5 p-6 text-center ${className}`}
        aria-labelledby="client-files-scope-title"
      >
        <FolderOpen size={24} className="text-danger" aria-hidden="true" />
        <h2 id="client-files-scope-title" className="mt-3 text-sm font-black text-content">
          Archivos no disponibles
        </h2>
        <p className="mt-2 max-w-md text-xs leading-5 text-content-secondary">
          No se recibió un alcance de empresa y cliente autorizado y coherente. No se muestran archivos del repositorio general.
        </p>
      </section>
    );
  }

  return (
    <section
      className={`grid min-w-0 gap-3 ${className}`}
      aria-labelledby="client-files-title"
      data-client-files-overview
      data-company-id={scope.companyId}
      data-client-id={scope.clientId}
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="client-files-title" className="flex items-center gap-2 text-lg font-black text-content">
          <Folder size={18} aria-hidden="true" />
          Archivos
        </h2>
        <ActionLink action={uploadAction} icon={Upload} primary trailingIcon={ChevronDown} />
      </header>

      {scopedCategories.length ? (
        <nav className="flex min-w-0 gap-2 overflow-x-auto pb-1" aria-label="Categorías de archivos del cliente">
          {scopedCategories.map((category) => (
            <CategoryLink key={category.id} category={category} />
          ))}
        </nav>
      ) : null}

      <div className={`grid min-w-0 gap-3 ${detail ? "xl:grid-cols-[10.5rem_minmax(0,1fr)_15rem]" : "xl:grid-cols-[10.5rem_minmax(0,1fr)]"}`}>
        <FolderRail folders={scopedFolders} storage={storage} newFolderAction={newFolderAction} />

        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="border-b border-border p-2">
            {search?.allowed && safeHref(search.actionHref) ? (
              <SearchForm search={search} />
            ) : (
              <p className="flex min-h-11 items-center px-2 text-[10px] text-content-secondary">
                La búsqueda no está autorizada para esta vista.
              </p>
            )}
          </div>

          {scopedFiles.length ? (
            <>
              <FilesDesktopTable files={scopedFiles} />
              <FilesMobileList files={scopedFiles} />
            </>
          ) : (
            <HonestEmpty title="No hay archivos informados" detail="No se han recibido archivos autorizados para este cliente." />
          )}

          {pagination ? <FilesPagination pagination={pagination} /> : null}
        </div>

        {detail ? <FileDetailPanel detail={detail} /> : null}
      </div>
    </section>
  );
}

function CategoryLink({ category }: { category: ClientFileCategory }) {
  if (!canRenderAction(category.action)) return null;
  return (
    <Link
      href={category.action.href}
      aria-current={category.active ? "page" : undefined}
      className={`inline-flex min-h-10 shrink-0 items-center rounded-lg border px-3 text-[9px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${category.active ? "border-success bg-success/5 text-success" : "border-border bg-subtle text-content-secondary hover:bg-surface hover:text-content"}`}
    >
      {category.label}
    </Link>
  );
}

function FolderRail({
  folders,
  storage,
  newFolderAction,
}: {
  folders: ClientFileFolder[];
  storage?: ClientFileStorage | null;
  newFolderAction?: ClientFileAction | null;
}) {
  return (
    <aside className="min-w-0 rounded-xl border border-border bg-surface p-3 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:pr-2" aria-labelledby="client-files-folders-title">
      <div className="flex items-center justify-between gap-2">
        <h3 id="client-files-folders-title" className="text-[10px] font-black text-content">Carpetas</h3>
        <TextAction action={newFolderAction} icon={FolderPlus} compact />
      </div>

      {folders.length ? (
        <nav className="mt-3 flex gap-1.5 overflow-x-auto xl:grid" aria-label="Carpetas de archivos del cliente">
          {folders.map((folder) => (
            <FolderLink key={folder.id} folder={folder} />
          ))}
        </nav>
      ) : (
        <p className="mt-3 text-[9px] leading-4 text-content-secondary">No hay carpetas informadas.</p>
      )}

      {storage ? <StorageUsage storage={storage} /> : null}
    </aside>
  );
}

function FolderLink({ folder }: { folder: ClientFileFolder }) {
  const content = (
    <>
      <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${toneSurface(folder.tone)}`}>
        <Folder size={14} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate">{folder.name}</span>
      <span className="tabular-nums text-content-tertiary">{formatCount(folder.fileCount)}</span>
    </>
  );
  const className = "flex min-h-10 min-w-[10rem] items-center gap-2 rounded-lg px-2 text-[9px] font-semibold text-content-secondary hover:bg-subtle hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand xl:min-w-0";
  return canRenderAction(folder.action)
    ? <Link href={folder.action.href} className={className}>{content}</Link>
    : <div className={className}>{content}</div>;
}

function StorageUsage({ storage }: { storage: ClientFileStorage }) {
  const validPercent = finite(storage.usedPercent) && storage.usedPercent >= 0 && storage.usedPercent <= 100;
  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="text-[8px] font-semibold text-content-secondary">Almacenamiento</p>
      <p className="mt-1 text-[8px] text-content-secondary">
        {storage.usedLabel ?? "—"}{storage.totalLabel ? ` de ${storage.totalLabel} utilizados` : ""}
      </p>
      {validPercent ? (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={storage.usedPercent!}>
            <div className="h-full rounded-full bg-success" style={{ width: `${storage.usedPercent}%` }} />
          </div>
          <span className="text-[8px] font-bold tabular-nums text-content-secondary">{formatPercent(storage.usedPercent)}</span>
        </div>
      ) : null}
    </div>
  );
}

function SearchForm({ search }: { search: ClientFileSearch }) {
  return (
    <form action={search.actionHref!} method="get" className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-border px-3 text-content-secondary md:ml-auto md:max-w-xs">
      {search.hiddenFields?.map((field) => <input key={field.name} type="hidden" name={field.name} value={field.value} />)}
      <Search size={15} aria-hidden="true" />
      <span className="sr-only">Buscar documentos</span>
      <input
        type="search"
        name={search.name ?? "q"}
        defaultValue={search.value}
        placeholder={search.placeholder ?? "Buscar documentos…"}
        className="min-w-0 flex-1 border-0 bg-transparent text-[10px] text-content outline-none placeholder:text-content-tertiary"
      />
      <button type="submit" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label="Buscar">
        <Search size={14} aria-hidden="true" />
      </button>
    </form>
  );
}

function FilesDesktopTable({ files }: { files: ClientFileRecord[] }) {
  return (
    <div className="hidden min-w-0 overflow-x-auto md:block" tabIndex={0} role="region" aria-label="Tabla desplazable de archivos del cliente">
      <table className="w-full min-w-[44rem] border-collapse text-left text-[8px]">
        <thead className="bg-subtle text-content-secondary">
          <tr>
            <TableHead className="w-10"><span className="sr-only">Selección</span></TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Versión</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Tamaño</TableHead>
            <TableHead>Etiquetas</TableHead>
            <TableHead className="w-10"><span className="sr-only">Acciones</span></TableHead>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {files.map((file) => <FileDesktopRow key={file.id} file={file} />)}
        </tbody>
      </table>
    </div>
  );
}

function FileDesktopRow({ file }: { file: ClientFileRecord }) {
  return (
    <tr className={file.selected ? "bg-brand-soft/40" : "hover:bg-subtle/60"}>
      <td className="px-2 py-2"><SelectionAction file={file} /></td>
      <td className="max-w-64 px-2 py-2"><FileName file={file} /></td>
      <td className="whitespace-nowrap px-2 py-2 text-content-secondary">{file.typeLabel ?? "—"}</td>
      <td className="whitespace-nowrap px-2 py-2">{file.versionLabel ? <Tag label={file.versionLabel} tone="success" /> : <MissingValue />}</td>
      <td className="whitespace-nowrap px-2 py-2 text-content-secondary">{file.dateLabel ?? "—"}</td>
      <td className="whitespace-nowrap px-2 py-2 tabular-nums text-content-secondary">{formatSize(file)}</td>
      <td className="max-w-44 px-2 py-2"><Tags tags={file.tags} /></td>
      <td className="px-2 py-2"><IconAction action={file.moreAction} icon={MoreHorizontal} /></td>
    </tr>
  );
}

function FilesMobileList({ files }: { files: ClientFileRecord[] }) {
  return (
    <div className="divide-y divide-border md:hidden" role="list">
      {files.map((file) => (
        <article key={file.id} role="listitem" className={`p-3 ${file.selected ? "bg-brand-soft/40" : ""}`}>
          <div className="flex min-w-0 items-start gap-2">
            <SelectionAction file={file} />
            <FileIcon kind={file.kind} />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[10px] font-black text-content">
                {canRenderAction(file.openAction) ? <Link href={file.openAction.href} className="hover:text-brand-strong hover:underline">{file.name}</Link> : file.name}
              </h3>
              <p className="mt-1 text-[8px] text-content-secondary">{file.typeLabel ?? "—"} · {formatSize(file)}</p>
            </div>
            <IconAction action={file.moreAction} icon={MoreHorizontal} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {file.versionLabel ? <Tag label={file.versionLabel} tone="success" /> : null}
            <Tags tags={file.tags} />
          </div>
          <p className="mt-2 text-right text-[8px] font-semibold text-content-secondary">{file.dateLabel ?? "—"}</p>
        </article>
      ))}
    </div>
  );
}

function FileName({ file }: { file: ClientFileRecord }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <FileIcon kind={file.kind} />
      <strong className="min-w-0 truncate text-content">
        {canRenderAction(file.openAction) ? <Link href={file.openAction.href} className="hover:text-brand-strong hover:underline">{file.name}</Link> : file.name}
      </strong>
    </span>
  );
}

function FileIcon({ kind }: { kind: ClientFileKind | null }) {
  const Icon = fileKindIcon(kind);
  return (
    <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${fileKindTone(kind)}`}>
      <Icon size={14} aria-hidden="true" />
    </span>
  );
}

function SelectionAction({ file }: { file: ClientFileRecord }) {
  if (!canRenderAction(file.selectAction)) {
    return <span className={`inline-flex h-5 w-5 items-center justify-center rounded border ${file.selected ? "border-brand bg-brand text-on-brand" : "border-border bg-surface"}`}>{file.selected ? <Check size={12} aria-hidden="true" /> : null}</span>;
  }
  return (
    <Link
      href={file.selectAction.href}
      aria-label={file.selectAction.label}
      aria-current={file.selected ? "true" : undefined}
      className={`inline-flex h-7 w-7 items-center justify-center rounded border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${file.selected ? "border-brand bg-brand text-on-brand" : "border-border bg-surface text-content-secondary hover:bg-subtle"}`}
    >
      {file.selected ? <Check size={12} aria-hidden="true" /> : null}
    </Link>
  );
}

function FileDetailPanel({ detail }: { detail: ClientFileDetail }) {
  return (
    <aside className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface" aria-labelledby="client-file-detail-title">
      <header className="flex min-w-0 items-start justify-between gap-2 border-b border-border p-3">
        <h3 id="client-file-detail-title" className="min-w-0 break-words text-[10px] font-black leading-4 text-content">{detail.title}</h3>
        <IconAction action={detail.moreAction} icon={MoreHorizontal} />
      </header>

      <div className="bg-subtle p-3">
        <div className="relative mx-auto aspect-[3/4] w-full max-w-48 overflow-hidden rounded-md border border-border bg-surface shadow-sm">
          {detail.previewImage && safeImageSrc(detail.previewImage.src) ? (
            <Image
              src={detail.previewImage.src}
              alt={detail.previewImage.alt}
              width={detail.previewImage.width}
              height={detail.previewImage.height}
              className="h-full w-full object-contain"
              unoptimized
            />
          ) : (
            <div className="grid h-full place-content-center justify-items-center p-4 text-center">
              <FileText size={28} className="text-content-tertiary" aria-hidden="true" />
              <span className="mt-2 text-[8px] text-content-secondary">Vista previa no informada</span>
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <IconAction action={detail.previousPageAction} icon={ChevronLeft} compact />
            <span className="text-[8px] tabular-nums text-content-secondary">{detail.pageLabel ?? "—"}</span>
            <IconAction action={detail.nextPageAction} icon={ChevronRight} compact />
          </div>
          <div className="flex items-center gap-1">
            <IconAction action={detail.zoomAction} icon={ZoomIn} compact />
            <IconAction action={detail.fullscreenAction} icon={Maximize2} compact />
          </div>
        </div>
      </div>

      <div className="p-3">
        <h4 className="text-[9px] font-black text-content">Detalles</h4>
        {detail.fields.length ? (
          <dl className="mt-3 grid gap-2">
            {detail.fields.map((field) => (
              <div key={field.label} className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-2 text-[8px]">
                <dt className="text-content-secondary">{field.label}</dt>
                <dd className={`min-w-0 break-words font-semibold ${toneText(field.valueTone)}`}>
                  {canRenderAction(field.action) ? <Link href={field.action.href} className="inline-flex items-center gap-1 hover:underline">{field.value ?? "—"}<ArrowUpRight size={10} aria-hidden="true" /></Link> : field.value ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
        ) : <p className="mt-2 text-[8px] text-content-secondary">No se han recibido detalles.</p>}

        {detail.permissionAvatars?.length || canRenderAction(detail.managePermissionsAction) ? (
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-[8px] text-content-secondary">Permisos</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {detail.permissionAvatars?.length ? (
                <div className="flex -space-x-1.5">
                  {detail.permissionAvatars.map((avatar) => safeImageSrc(avatar.src) ? (
                    <Image key={avatar.id} src={avatar.src} alt={avatar.alt} width={24} height={24} className="h-6 w-6 rounded-full border-2 border-surface object-cover" unoptimized />
                  ) : null)}
                  {detail.permissionOverflowLabel ? <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-surface bg-subtle px-1 text-[7px] font-bold text-content-secondary">{detail.permissionOverflowLabel}</span> : null}
                </div>
              ) : <UserRound size={14} className="text-content-tertiary" aria-hidden="true" />}
              <TextAction action={detail.managePermissionsAction} compact />
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function FilesPagination({ pagination }: { pagination: ClientFilePagination }) {
  return (
    <footer className="flex flex-col gap-2 border-t border-border px-3 py-2 text-[8px] text-content-secondary sm:flex-row sm:items-center sm:justify-between">
      <span>{pagination.summaryLabel ?? "—"}</span>
      <nav className="flex flex-wrap items-center gap-1" aria-label="Paginación de archivos">
        <IconAction action={pagination.previous} icon={ChevronLeft} compact />
        {pagination.pages.map((page, index) => canRenderAction(page) ? (
          <Link key={`${page.href}-${index}`} href={page.href} aria-current={page.active ? "page" : undefined} className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${page.active ? "border-success bg-success/5 text-success" : "border-transparent text-content hover:border-border"}`}>{page.label}</Link>
        ) : null)}
        <IconAction action={pagination.next} icon={ChevronRight} compact />
        <TextAction action={pagination.pageSizeAction} trailingIcon={ChevronDown} compact />
      </nav>
    </footer>
  );
}

function Tags({ tags }: { tags: ClientFileTag[] }) {
  if (!tags.length) return <MissingValue />;
  return <span className="flex min-w-0 flex-wrap gap-1">{tags.map((tag, index) => <Tag key={`${tag.label}-${index}`} label={tag.label} tone={tag.tone} />)}</span>;
}

function Tag({ label, tone }: { label: string; tone?: ClientFileTone }) {
  return <span className={`inline-flex min-h-5 max-w-full items-center rounded px-1.5 py-0.5 text-[7px] font-bold ${toneBadge(tone)}`}><span className="truncate">{label}</span></span>;
}

function ActionLink({ action, icon: Icon, trailingIcon: TrailingIcon, primary = false }: { action?: ClientFileAction | null; icon?: Icon; trailingIcon?: Icon; primary?: boolean }) {
  if (!canRenderAction(action)) return null;
  return (
    <Link href={action.href} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-[9px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${primary ? "bg-success text-white hover:bg-success/90" : "border border-border bg-surface text-content hover:bg-subtle"}`}>
      {Icon ? <Icon size={14} aria-hidden="true" /> : null}
      {action.label}
      {TrailingIcon ? <TrailingIcon size={13} aria-hidden="true" /> : null}
    </Link>
  );
}

function TextAction({ action, icon: Icon, trailingIcon: TrailingIcon, compact = false }: { action?: ClientFileAction | null; icon?: Icon; trailingIcon?: Icon; compact?: boolean }) {
  if (!canRenderAction(action)) return null;
  return (
    <Link href={action.href} className={`inline-flex items-center gap-1 font-bold text-success hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${compact ? "min-h-8 text-[8px]" : "min-h-10 text-[9px]"}`}>
      {Icon ? <Icon size={12} aria-hidden="true" /> : null}
      {action.label}
      {TrailingIcon ? <TrailingIcon size={11} aria-hidden="true" /> : null}
    </Link>
  );
}

function IconAction({ action, icon: Icon, compact = false }: { action?: ClientFileAction | null; icon: Icon; compact?: boolean }) {
  if (!canRenderAction(action)) return null;
  return (
    <Link href={action.href} aria-label={action.label} title={action.label} className={`inline-flex shrink-0 items-center justify-center rounded-md text-content-secondary hover:bg-subtle hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${compact ? "h-8 w-8" : "h-9 w-9"}`}>
      <Icon size={compact ? 13 : 15} aria-hidden="true" />
    </Link>
  );
}

function TableHead({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th scope="col" className={`whitespace-nowrap px-2 py-2 font-semibold ${className}`}>{children}</th>;
}

function HonestEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid min-h-52 place-content-center justify-items-center p-6 text-center">
      <File size={22} className="text-content-tertiary" aria-hidden="true" />
      <h3 className="mt-3 text-xs font-black text-content">{title}</h3>
      <p className="mt-1 max-w-sm text-[9px] leading-5 text-content-secondary">{detail}</p>
    </div>
  );
}

function MissingValue() {
  return <span className="text-content-tertiary">—</span>;
}

function hasVerifiedScope({
  scope,
  categories,
  folders,
  files,
  storage,
  detail,
  pagination,
}: {
  scope: Client360FilesOverviewProps["scope"];
  categories: ClientFileCategory[];
  folders: ClientFileFolder[];
  files: ClientFileRecord[];
  storage?: ClientFileStorage | null;
  detail?: ClientFileDetail | null;
  pagination?: ClientFilePagination | null;
}) {
  if (!scope.tenantScopeVerified || !scope.clientScopeVerified || !scope.companyId || !scope.clientId) return false;
  const matches = (item: ClientFileScoped | null | undefined) => !item || (item.companyId === scope.companyId && item.clientId === scope.clientId);
  return categories.every(matches)
    && folders.every(matches)
    && files.every(matches)
    && matches(storage)
    && matches(detail)
    && matches(pagination);
}

function canRenderAction(action: ClientFileAction | null | undefined): action is ClientFileAction & { href: string } {
  return Boolean(action?.allowed && safeHref(action.href) && action.label.trim());
}

function safeHref(href: string | null | undefined): href is string {
  return Boolean(href && ((href.startsWith("/") && !href.startsWith("//")) || href.startsWith("https://")));
}

function safeImageSrc(src: string) {
  return src.startsWith("/") && !src.startsWith("//");
}

function formatCount(value: number | null) {
  return finite(value) && Number.isInteger(value) && value >= 0 ? new Intl.NumberFormat("es-ES").format(value) : "—";
}

function formatPercent(value: number | null) {
  return finite(value) && value >= 0 && value <= 100 ? `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value)} %` : "—";
}

function formatSize(file: Pick<ClientFileRecord, "sizeBytes" | "sizeLabel">) {
  if (file.sizeLabel?.trim()) return file.sizeLabel;
  if (!finite(file.sizeBytes) || file.sizeBytes < 0) return "—";
  if (file.sizeBytes < 1024) return `${file.sizeBytes} B`;
  if (file.sizeBytes < 1024 ** 2) return `${(file.sizeBytes / 1024).toLocaleString("es-ES", { maximumFractionDigits: 1 })} KB`;
  return `${(file.sizeBytes / 1024 ** 2).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
}

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function fileKindIcon(kind: ClientFileKind | null): Icon {
  if (kind === "image") return FileImage;
  if (kind === "spreadsheet") return FileSpreadsheet;
  if (kind === "email") return Mail;
  if (kind === "pdf" || kind === "word" || kind === "drawing") return FileText;
  return File;
}

function fileKindTone(kind: ClientFileKind | null) {
  if (kind === "pdf") return "bg-danger/10 text-danger";
  if (kind === "word" || kind === "drawing") return "bg-brand-soft text-brand-strong";
  if (kind === "spreadsheet") return "bg-success/10 text-success";
  if (kind === "image") return "bg-warning/10 text-warning";
  if (kind === "email") return "bg-info/10 text-info";
  return "bg-subtle text-content-secondary";
}

function toneSurface(tone?: ClientFileTone) {
  if (tone === "success") return "bg-success/10 text-success";
  if (tone === "warning") return "bg-warning/10 text-warning";
  if (tone === "danger") return "bg-danger/10 text-danger";
  if (tone === "info") return "bg-brand-soft text-brand-strong";
  if (tone === "violet") return "bg-violet-50 text-violet-700";
  return "bg-subtle text-content-secondary";
}

function toneText(tone?: ClientFileTone) {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "info") return "text-brand-strong";
  if (tone === "violet") return "text-violet-700";
  return "text-content";
}

function toneBadge(tone?: ClientFileTone) {
  if (tone === "success") return "bg-success/10 text-success";
  if (tone === "warning") return "bg-warning/10 text-warning";
  if (tone === "danger") return "bg-danger/10 text-danger";
  if (tone === "info") return "bg-brand-soft text-brand-strong";
  if (tone === "violet") return "bg-violet-50 text-violet-700";
  return "bg-subtle text-content-secondary";
}
