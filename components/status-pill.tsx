import { statusClass, statusLabel } from "@/lib/status";

export function StatusPill({ status }: { status: string }) {
  const label = statusLabel(status);

  return (
    <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${statusClass(status)}`} aria-label={`Estado: ${label}`} title={label}>
      {label}
    </span>
  );
}

export const StatusBadge = StatusPill;
