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
    warning: "bg-obra-yellow/30 text-obra-yellowDark",
    danger: "bg-obra-red/10 text-obra-red",
    success: "bg-obra-green/10 text-obra-green"
  }[tone];

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-obra-ink">{value}</p>
        </div>
        <span className={`inline-flex h-11 w-11 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon size={22} aria-hidden="true" />
        </span>
      </div>
      {detail ? <p className="mt-3 text-sm text-slate-500">{detail}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="card block p-4 transition active:scale-[0.99] hover:border-obra-yellowDark hover:bg-obra-yellow/10">
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
