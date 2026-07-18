import type { ReactNode } from "react";

export function SectionHeader({
  title,
  description,
  action,
  eyebrow,
  badge
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
  badge?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="type-meta mb-2">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="type-section-title text-content">{title}</h2>
          {badge}
        </div>
        {description ? <p className="type-secondary mt-1 max-w-3xl">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}
