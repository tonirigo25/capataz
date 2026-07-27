"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info, X } from "lucide-react";

export function ContextDrawer({
  title,
  description,
  children,
  triggerLabel = "Contexto",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
      opener.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="secondary-button"
        data-context-drawer-trigger
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Info size={18} />
        {triggerLabel}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[70] bg-black/35"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="context-drawer-title"
            aria-describedby={description ? "context-drawer-description" : undefined}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 w-full max-w-[36rem] overflow-y-auto border-l border-border bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl outline-none sm:p-6"
          >
            <header className="sticky top-0 z-10 mb-5 flex items-start justify-between gap-4 border-b border-border bg-surface pb-4">
              <div>
                <p className="type-label">Contexto del registro</p>
                <h2 id="context-drawer-title" className="type-section-title mt-1">
                  {title}
                </h2>
                {description ? (
                  <p id="context-drawer-description" className="type-secondary mt-1">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="icon-button shrink-0"
                aria-label="Cerrar contexto"
                onClick={() => setOpen(false)}
              >
                <X />
              </button>
            </header>
            <div className="grid gap-4">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
