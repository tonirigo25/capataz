import { statusClass, statusDescription, statusLabel } from "@/lib/status";

export function StatusPill({ status }: { status: string }) {
  const label = statusLabel(status);
  const description = statusDescription(status);

  return (
    <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${statusClass(status)}`} aria-label={`Estado: ${label}. ${description}`} title={`${label}. ${description}`}>
      {label}
    </span>
  );
}

export const StatusBadge = StatusPill;
