import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function ModuleHeader({
  eyebrow,
  title,
  description,
  action,
  meta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="mb-5 border-b border-slate-200 pb-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="type-label uppercase tracking-[0.14em] text-emerald-700">
            {eyebrow}
          </p>
          <h1 className="type-page-title mt-2 text-obra-ink">{title}</h1>
          <p className="type-secondary mt-2 max-w-3xl">{description}</p>
        </div>
        {action ? (
          <div className="flex shrink-0 flex-wrap gap-2">{action}</div>
        ) : null}
      </div>
      {meta ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div>
      ) : null}
    </header>
  );
}

export function KpiGrid({
  children,
  columns = 4,
}: {
  children: ReactNode;
  columns?: 4 | 5;
}) {
  return (
    <section
      aria-label="Indicadores principales"
      className={`mb-5 grid gap-3 sm:grid-cols-2 ${columns === 5 ? "2xl:grid-cols-5" : "xl:grid-cols-4"}`}
    >
      {children}
    </section>
  );
}

export function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="type-label">{label}</p>
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${toneClass(tone)}`}
        >
          <Icon size={18} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 text-[1.45rem] font-bold leading-7 tracking-tight text-obra-ink tabular-nums">
        {value}
      </p>
      <p
        className={`mt-2 text-xs font-semibold leading-5 ${detailClass(tone)}`}
      >
        {detail}
      </p>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className="card min-h-[8.5rem] p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm"
      >
        {body}
      </a>
    );
  }
  return <article className="card min-h-[8.5rem] p-4">{body}</article>;
}

export function ModulePanel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="type-section-title text-obra-ink">{title}</h2>
          {description ? <p className="type-meta mt-1">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function CompactTabs({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <nav
      aria-label={label}
      className="flex min-h-11 gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1"
    >
      {children}
    </nav>
  );
}

export function RatioRow({
  label,
  value,
  amount,
  tone = "green",
}: {
  label: string;
  value: number;
  amount?: string;
  tone?: "green" | "blue" | "orange" | "red" | "purple";
}) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className="font-bold text-obra-ink tabular-nums">
          {amount ?? `${safeValue}%`}
        </span>
      </div>
      <meter
        min={0}
        max={100}
        value={safeValue}
        aria-label={`${label}: ${safeValue}%`}
        className={`h-2 w-full rounded-full ${meterClass(tone)}`}
      />
    </div>
  );
}

export function SoftBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
}) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full px-2.5 py-1 text-xs font-bold ${toneClass(tone)}`}
    >
      {children}
    </span>
  );
}

function toneClass(
  tone: "neutral" | "success" | "warning" | "danger" | "accent",
) {
  return {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
    accent: "bg-violet-100 text-violet-800",
  }[tone];
}

function detailClass(
  tone: "neutral" | "success" | "warning" | "danger" | "accent",
) {
  return {
    neutral: "text-slate-500",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-red-700",
    accent: "text-violet-700",
  }[tone];
}

function meterClass(tone: "green" | "blue" | "orange" | "red" | "purple") {
  return {
    green: "accent-emerald-600",
    blue: "accent-blue-600",
    orange: "accent-orange-500",
    red: "accent-red-600",
    purple: "accent-violet-600",
  }[tone];
}
