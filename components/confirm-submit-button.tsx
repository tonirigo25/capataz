"use client";

import { useEffect, useId, useRef, useState } from "react";

export function ConfirmSubmitButton({
  children,
  className = "secondary-button",
  message
}: {
  children: React.ReactNode;
  className?: string;
  message: string;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const confirmedRef = useRef(false);

  function submitConfirmed() {
    confirmedRef.current = true;
    setOpen(false);
    buttonRef.current?.form?.requestSubmit(buttonRef.current);
    window.setTimeout(() => {
      confirmedRef.current = false;
    }, 0);
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="submit"
        className={className}
        onClick={(event) => {
          if (confirmedRef.current) return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-obra-ink/55 p-4 backdrop-blur-sm sm:items-center sm:justify-center" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md rounded-xl bg-white p-5 shadow-card">
            <h2 id={titleId} className="text-lg font-black text-obra-ink">
              Confirmar acción
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" className="secondary-button w-full" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="primary-button w-full" onClick={submitConfirmed}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
