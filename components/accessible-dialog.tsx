"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function AccessibleDialog({ title, description, open, onClose, children }: { title: string; description?: string; open: boolean; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-obra-ink/55 p-3 sm:items-center sm:justify-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className="max-h-[min(86vh,46rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><h2 id={titleId} className="text-lg font-black text-obra-ink">{title}</h2>{description ? <p id={descriptionId} className="mt-1 text-sm leading-6 text-slate-600">{description}</p> : null}</div>
          <button ref={closeRef} type="button" className="icon-button shrink-0" aria-label="Cerrar diálogo" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}
