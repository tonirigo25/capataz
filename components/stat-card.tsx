import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
  href
}: {
  title: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  tone?: "neutral" | "warning" | "danger" | "success";
  href?: string;
}) {
  const toneClass = {
    neutral: "bg-slate-100 text-obra-graphite",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-50 text-red-700",
    success: "bg-emerald-50 text-emerald-700"
  }[tone];

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-500">{title}</p>
          <p className="mt-2 break-words text-2xl font-black tabular-nums text-obra-ink">{value}</p>
        </div>
        <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon size={22} aria-hidden="true" />
        </span>
      </div>
      {detail ? <p className="mt-3 text-sm text-slate-500">{detail}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="card block p-4 transition active:scale-[0.99] hover:border-obra-yellowDark hover:bg-obra-yellow/10 focus-visible:ring-2 focus-visible:ring-obra-yellow/35">
        {content}
      </Link>
    );
  }

  return (
    <article className="card p-4">
      {content}
    </article>
  );
}
