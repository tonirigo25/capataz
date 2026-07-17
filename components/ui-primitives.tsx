import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { clsx } from "clsx";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral: "border-slate-200 bg-white text-slate-700",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-800"
};

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
    <header className="mb-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="label mb-2">{eyebrow}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-black leading-tight tracking-tight text-obra-ink sm:text-4xl">{title}</h1>
            {badge}
          </div>
          {description ? <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">{description}</p> : null}
        </div>

        {(action || secondaryActions) ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {secondaryActions}
            {action}
          </div>
        ) : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </header>
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
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-obra-yellow/20 text-obra-yellowDark">
        <Icon size={23} aria-hidden="true" />
      </span>
      <h2 className="mt-3 text-base font-black text-obra-ink">{title}</h2>
      {description ? <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{description}</p> : null}
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
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
      <div className="flex gap-3">
        <AlertTriangle size={21} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="font-black">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6">{description}</p> : null}
          {retry ? <div className="mt-3">{retry}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function LoadingState({ label = "Cargando datos..." }: { label?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
        <Loader2 size={19} className="animate-spin text-obra-yellowDark" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="mt-4 grid gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
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
  action
}: {
  title?: string;
  description: string;
  tone?: Tone;
  action?: ReactNode;
}) {
  return (
    <div className={clsx("rounded-xl border p-4", toneClasses[tone])}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {title ? <p className="font-black">{title}</p> : null}
          <p className={clsx("text-sm leading-6", title ? "mt-1" : "")}>{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-soft", className)}>
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
  return <div role="tablist" aria-label={label} className={clsx("flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1", className)}>{children}</div>;
}

export function SearchInput(props: Omit<ComponentProps<"input">, "type">) {
  return <input {...props} type="search" className={clsx("field", props.className)} />;
}
