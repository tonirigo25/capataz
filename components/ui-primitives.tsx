import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowLeft, ChevronDown, Info, MoreHorizontal } from "lucide-react";
import { clsx } from "clsx";
import { ResponsiveFilterPanel } from "@/components/compact-filters";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";
type ProductPageLayout = "operational" | "analytical" | "entity" | "form" | "list" | "reading";
type SurfaceVariant = "base" | "raised" | "secondary" | "feature" | "alert" | "plain";
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "row";
type StatusTone = "neutral" | "active" | "completed" | "attention" | "risk" | "archived";

const toneClasses: Record<Tone, string> = {
  neutral: "border-border bg-surface text-content-secondary",
  info: "border-info/25 bg-info/5 text-info",
  success: "border-success/25 bg-success/5 text-success",
  warning: "border-warning/25 bg-warning/5 text-warning",
  danger: "border-danger/25 bg-danger/5 text-danger"
};

const statusClasses: Record<StatusTone, string> = {
  neutral: "bg-subtle text-content-secondary",
  active: "bg-brand-soft text-brand-strong",
  completed: "bg-success/10 text-success",
  attention: "bg-warning/10 text-warning",
  risk: "bg-danger/10 text-danger",
  archived: "bg-content/8 text-content-secondary"
};

export function ProductPage({
  children,
  layout = "operational",
  className
}: {
  children: ReactNode;
  layout?: ProductPageLayout;
  className?: string;
}) {
  return <main className={clsx("product-page", className)} data-layout={layout}>{children}</main>;
}

export function PageHeader({
  title,
  description,
  action,
  secondaryActions,
  eyebrow,
  badge,
  children
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryActions?: ReactNode;
  eyebrow?: string;
  badge?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="type-meta mb-2">{eyebrow}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="type-page-title text-content">{title}</h1>
            {badge}
          </div>
          {description ? <p className="type-body mt-2 max-w-3xl text-content-secondary">{description}</p> : null}
        </div>

        {(action || secondaryActions) ? (
          <div className="flex shrink-0 flex-wrap gap-2 max-sm:[&>*]:w-full">
            {secondaryActions}
            {action}
          </div>
        ) : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </header>
  );
}

export function ParentNavigation({
  href,
  label,
  context
}: {
  href: string;
  label: string;
  context?: string;
}) {
  return (
    <nav aria-label="Contexto de la entidad">
      <Link
        href={href}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-content-secondary transition hover:bg-subtle hover:text-content"
      >
        <ArrowLeft size={18} aria-hidden="true" />
        <span>{label}</span>
        {context ? <span className="hidden text-content-tertiary sm:inline">· {context}</span> : null}
      </Link>
    </nav>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = Info,
  action,
  secondaryAction
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-subtle p-5 text-center sm:p-6">
      <Icon size={24} className="mx-auto text-content-tertiary" aria-hidden="true" />
      <h2 className="type-object-title mt-3 text-content">{title}</h2>
      {description ? <p className="type-secondary mx-auto mt-2 max-w-xl">{description}</p> : null}
      {(action || secondaryAction) ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  retry
}: {
  title: string;
  description?: string;
  retry?: ReactNode;
}) {
  return (
    <div role="alert" className="rounded-xl border border-danger/25 bg-danger/5 p-4 text-danger">
      <div className="flex gap-3">
        <AlertTriangle size={21} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6">{description}</p> : null}
          {retry ? <div className="mt-3">{retry}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function LoadingState({ label = "Cargando datos..." }: { label?: string }) {
  return (
    <div className="rounded-xl bg-subtle p-5" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="grid gap-3" aria-hidden="true">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-lg bg-slate-200", className)} aria-hidden="true" />;
}

export function Notice({
  title,
  description,
  tone = "neutral",
  action,
  className
}: {
  title?: string;
  description: string;
  tone?: Tone;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("rounded-xl border p-4", toneClasses[tone], className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {title ? <p className="font-semibold">{title}</p> : null}
          <p className={clsx("text-sm leading-6", title ? "mt-1" : "")}>{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex flex-wrap items-center gap-2 rounded-xl bg-subtle p-2", className)}>
      {children}
    </div>
  );
}

export function ResponsiveStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("grid gap-3 md:grid-cols-2 xl:grid-cols-3", className)}>{children}</div>;
}

export function EntityLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-bold text-obra-ink underline decoration-obra-yellowDark/35 underline-offset-4 hover:text-obra-yellowDark">
      {children}
    </Link>
  );
}

export function TableShell({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
      <div className="overflow-x-auto" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("screen", className)}>{children}</div>;
}

export function Section({ children, className, labelledBy }: { children: ReactNode; className?: string; labelledBy?: string }) {
  return <section className={clsx("section-shell", className)} aria-labelledby={labelledBy}>{children}</section>;
}

export function Card({ children, className, as = "article" }: { children: ReactNode; className?: string; as?: "article" | "div" }) {
  const Component = as;
  return <Component className={clsx("card p-4", className)}>{children}</Component>;
}

export function Surface({
  children,
  className,
  variant = "base",
  as = "div",
  labelledBy
}: {
  children: ReactNode;
  className?: string;
  variant?: SurfaceVariant;
  as?: "div" | "section" | "article" | "aside";
  labelledBy?: string;
}) {
  const Component = as;
  return (
    <Component
      aria-labelledby={labelledBy}
      className={clsx(
        variant === "base" && "surface",
        variant === "raised" && "surface-raised",
        variant === "secondary" && "surface-secondary",
        variant === "feature" && "surface-feature",
        variant === "alert" && "rounded-xl border border-warning/25 bg-warning/5",
        className
      )}
    >
      {children}
    </Component>
  );
}

export function DataList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("divide-y divide-slate-200", className)}>{children}</div>;
}

export function MobileList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("grid gap-3 md:hidden", className)}>{children}</div>;
}

export function ResponsiveTable({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return <div className={clsx("hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block", className)} aria-label={label}>{children}</div>;
}

export function Tabs({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={clsx("overflow-x-auto border-b border-border", className)}>
      <div className="flex min-w-max gap-5 [&_a]:relative [&_a]:min-h-11 [&_a]:py-3 [&_a]:text-sm [&_a]:font-semibold [&_a]:text-content-secondary [&_a:hover]:text-content [&_a[aria-current=page]]:text-brand-strong [&_a[aria-current=page]]:after:absolute [&_a[aria-current=page]]:after:inset-x-0 [&_a[aria-current=page]]:after:bottom-0 [&_a[aria-current=page]]:after:h-0.5 [&_a[aria-current=page]]:after:bg-brand">
        {children}
      </div>
    </nav>
  );
}

export function CompactSearch(props: Omit<ComponentProps<"input">, "type">) {
  return <input {...props} type="search" className={clsx("field", props.className)} />;
}

export function CompactFilterBar({ children, className, label = "Buscar y filtrar" }: { children: ReactNode; className?: string; label?: string }) {
  return <ResponsiveFilterPanel className={className} label={label}>{children}</ResponsiveFilterPanel>;
}

export function ResultCount({ shown, total, noun, context }: { shown: number; total: number; noun: string; context?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-content" aria-live="polite">
        {shown === total ? `${total} ${noun}` : `${shown} de ${total} ${noun}`}
      </p>
      {context ? <div className="text-sm font-semibold text-slate-500">{context}</div> : null}
    </div>
  );
}

export function MetricStrip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}

export function DetailSection({ title, description, action, children, className }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("section-shell", className)}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="type-section-title text-content">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="form-section">
      <legend className="px-1 text-base font-semibold text-content">{title}</legend>
      {description ? <p className="text-sm leading-6 text-slate-500">{description}</p> : null}
      <div className="grid gap-3">{children}</div>
    </fieldset>
  );
}

export function StickyFormActions({ children }: { children: ReactNode }) {
  return <div className="sticky-form-actions">{children}</div>;
}

export function Button({
  variant = "primary",
  loading = false,
  loadingLabel = "Guardando…",
  fullWidthOnMobile = false,
  className,
  children,
  disabled,
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingLabel?: string;
  fullWidthOnMobile?: boolean;
}) {
  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      className={clsx(
        variant === "primary" && "primary-button",
        variant === "secondary" && "secondary-button",
        variant === "ghost" && "ghost-button",
        variant === "danger" && "danger-button",
        variant === "row" && "ghost-button min-h-10 px-2",
        fullWidthOnMobile && "max-sm:w-full",
        className
      )}
      disabled={disabled || loading}
    >
      {loading ? loadingLabel : children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className,
  ...props
}: Omit<ComponentProps<"button">, "aria-label"> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <button {...props} aria-label={label} className={clsx("icon-button", className)}>
      {children}
    </button>
  );
}

export function FieldGroup({
  title,
  description,
  children,
  className
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("grid gap-4", className)}>
      {title || description ? (
        <div>
          {title ? <h3 className="type-object-title text-content">{title}</h3> : null}
          {description ? <p className="type-secondary mt-1">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function FieldFrame({
  id,
  label,
  required,
  help,
  error,
  success,
  children
}: {
  id: string;
  label: string;
  required?: boolean;
  help?: string;
  error?: string;
  success?: string;
  children: ReactNode;
}) {
  const messageId = error || help || success ? `${id}-message` : undefined;
  return (
    <label htmlFor={id} className="grid gap-1.5">
      <span className="label">
        {label}
        {required ? <span aria-hidden="true"> · obligatorio</span> : null}
      </span>
      {children}
      {error ? <span id={messageId} className="text-sm text-danger">{error}</span> : null}
      {!error && success ? <span id={messageId} className="text-sm text-success">{success}</span> : null}
      {!error && !success && help ? <span id={messageId} className="type-meta">{help}</span> : null}
    </label>
  );
}

type SharedFieldProps = {
  id: string;
  label: string;
  help?: string;
  error?: string;
  success?: string;
};

export function TextField({
  label,
  help,
  error,
  success,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & SharedFieldProps & {
  type?: "text" | "search" | "number" | "date";
}) {
  const messageId = error || help || success ? `${props.id}-message` : undefined;
  return (
    <FieldFrame id={props.id} label={label} required={props.required} help={help} error={error} success={success}>
      <input
        {...props}
        aria-describedby={messageId}
        aria-invalid={Boolean(error) || undefined}
        className={clsx("field", props.type === "number" && "tabular", className)}
      />
    </FieldFrame>
  );
}

export function MoneyField({
  currency = "EUR",
  ...props
}: Omit<ComponentProps<"input">, "type" | "inputMode"> & SharedFieldProps & {
  currency?: string;
}) {
  const { label, help, error, success, className, ...inputProps } = props;
  const messageId = error || help || success ? `${inputProps.id}-message` : undefined;
  return (
    <FieldFrame id={inputProps.id} label={label} required={inputProps.required} help={help} error={error} success={success}>
      <div className="relative">
        <input
          {...inputProps}
          type="text"
          inputMode="decimal"
          aria-describedby={messageId}
          aria-invalid={Boolean(error) || undefined}
          className={clsx("field pr-14 tabular", className)}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-content-tertiary" aria-hidden="true">
          {currency}
        </span>
      </div>
    </FieldFrame>
  );
}

export function SelectField({
  label,
  help,
  error,
  success,
  className,
  children,
  ...props
}: ComponentProps<"select"> & SharedFieldProps) {
  const messageId = error || help || success ? `${props.id}-message` : undefined;
  return (
    <FieldFrame id={props.id} label={label} required={props.required} help={help} error={error} success={success}>
      <select
        {...props}
        aria-describedby={messageId}
        aria-invalid={Boolean(error) || undefined}
        className={clsx("field", className)}
      >
        {children}
      </select>
    </FieldFrame>
  );
}

export function TextareaField({
  label,
  help,
  error,
  success,
  className,
  ...props
}: ComponentProps<"textarea"> & SharedFieldProps) {
  const messageId = error || help || success ? `${props.id}-message` : undefined;
  return (
    <FieldFrame id={props.id} label={label} required={props.required} help={help} error={error} success={success}>
      <textarea
        {...props}
        aria-describedby={messageId}
        aria-invalid={Boolean(error) || undefined}
        className={clsx("field min-h-28 py-3", className)}
      />
    </FieldFrame>
  );
}

export function EntityHeader({
  title,
  context,
  status,
  description,
  back,
  action,
  menu
}: {
  title: string;
  context?: ReactNode;
  status?: ReactNode;
  description?: string;
  back?: ReactNode;
  action?: ReactNode;
  menu?: ReactNode;
}) {
  return (
    <header className="mb-8">
      {back ? <div className="mb-4">{back}</div> : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {context ? <div className="type-meta mb-2">{context}</div> : null}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="type-entity-title text-content">{title}</h1>
            {status}
          </div>
          {description ? <p className="type-body mt-2 max-w-3xl text-content-secondary">{description}</p> : null}
        </div>
        {action || menu ? <div className="flex shrink-0 gap-2 max-sm:[&>*]:flex-1">{action}{menu}</div> : null}
      </div>
    </header>
  );
}

export function AnalyticsHeader({
  title,
  description,
  controls,
  menu
}: {
  title: string;
  description?: string;
  controls?: ReactNode;
  menu?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="type-page-title text-content">{title}</h1>
        {description ? <p className="type-body mt-2 text-content-secondary">{description}</p> : null}
      </div>
      {controls || menu ? <div className="flex flex-wrap gap-2">{controls}{menu}</div> : null}
    </header>
  );
}

export function Status({
  children,
  tone = "neutral",
  className
}: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span className={clsx("inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none", statusClasses[tone], className)}>
      {children}
    </span>
  );
}

export function Metric({
  label,
  value,
  detail,
  href,
  className
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  href?: string;
  className?: string;
}) {
  const content = (
    <>
      <span className="type-label block">{label}</span>
      <span className="type-amount-primary mt-1 block text-content">{value}</span>
      {detail ? <span className="type-meta mt-1 block">{detail}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} className={clsx("block rounded-lg p-3 transition hover:bg-subtle", className)}>{content}</Link>
  ) : (
    <div className={clsx("p-3", className)}>{content}</div>
  );
}

export function MetricGroup({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  return (
    <section aria-label={label} className={clsx("grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4", className)}>
      {children}
    </section>
  );
}

export function InteractiveRow({
  href,
  title,
  description,
  meta,
  status,
  action,
  className
}: {
  href: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("group relative flex min-h-16 items-start gap-3 border-b border-border px-1 py-3 last:border-0 hover:bg-subtle", className)}>
      <Link href={href} className="min-w-0 flex-1 rounded-md after:absolute after:inset-0">
        <span className="type-object-title block text-content">{title}</span>
        {description ? <span className="type-secondary mt-1 block">{description}</span> : null}
        {meta ? <span className="type-meta mt-1 block">{meta}</span> : null}
      </Link>
      {status ? <div className="relative z-10 shrink-0">{status}</div> : null}
      {action ? <div className="relative z-10 shrink-0">{action}</div> : null}
    </div>
  );
}

export function TimelineItem({
  title,
  meta,
  children,
  last = false
}: {
  title: string;
  meta: ReactNode;
  children?: ReactNode;
  last?: boolean;
}) {
  return (
    <article className="relative grid grid-cols-[1rem_1fr] gap-3">
      <div className="relative flex justify-center">
        <span className="mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-brand bg-white" aria-hidden="true" />
        {!last ? <span className="absolute bottom-0 top-4 w-px bg-border" aria-hidden="true" /> : null}
      </div>
      <div className="pb-6">
        <p className="type-object-title text-content">{title}</p>
        <div className="type-meta mt-1">{meta}</div>
        {children ? <div className="type-body mt-2 text-content-secondary">{children}</div> : null}
      </div>
    </article>
  );
}

export function ActionMenu({ label = "Más acciones", children, className }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <details className={clsx("action-menu", className)}>
      <summary className="secondary-button cursor-pointer list-none">
        <MoreHorizontal size={17} aria-hidden="true" />
        <span>{label}</span>
        <ChevronDown size={17} aria-hidden="true" />
      </summary>
      <div className="action-menu-panel">{children}</div>
    </details>
  );
}
