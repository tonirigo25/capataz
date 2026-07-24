"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Check, Plus } from "lucide-react";

export function DemoLimitButton({
  children,
  reason = "Ya has probado cómo Orqena ordena tu trabajo. Activa tu cuenta para usarla con tus clientes reales.",
  href,
  currentCount,
  limit,
  onAllowed,
  icon: Icon = Plus,
  className = "secondary-button",
  unlimited
}: {
  children: React.ReactNode;
  reason?: string;
  href?: string;
  currentCount?: number;
  limit?: number;
  onAllowed?: () => void;
  icon?: LucideIcon;
  className?: string;
  unlimited?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const appMode = process.env.NEXT_PUBLIC_APP_MODE ?? (process.env.NODE_ENV === "development" ? "test" : "demo");
  const unlimitedMode = unlimited ?? appMode === "test";
  const limited = !unlimitedMode && typeof currentCount === "number" && typeof limit === "number" && currentCount >= limit;

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (limited) {
      setOpen(true);
      return;
    }

    if (onAllowed) {
      onAllowed();
      return;
    }

    if (href) router.push(href);
    else event.currentTarget.closest("form")?.requestSubmit();
  }

  return (
    <>
      <button type="button" className={className} onClick={handleClick}>
        <Icon size={18} />
        {children}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-obra-ink/50 p-4 sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-card">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-obra-yellow/30 text-obra-yellowDark">
                <AlertTriangle size={22} />
              </span>
              <div>
                <h3 className="text-lg font-bold text-obra-ink">Límite demo alcanzado</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{reason}</p>
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              Demo: 3 clientes reales, 2 presupuestos, 1 obra activa y 3 recordatorios programados.
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" className="primary-button flex-1" onClick={() => setOpen(false)}>
                <Check size={18} />
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
