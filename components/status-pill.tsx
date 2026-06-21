import { statusClass, statusLabel } from "@/lib/status";

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(status)}`}>
      {statusLabel(status)}
    </span>
  );
}
