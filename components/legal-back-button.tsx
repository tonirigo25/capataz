"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function LegalBackButton({ fallback = "/hoy" }: { fallback?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label="Volver atrás"
      className="fixed left-[calc(env(safe-area-inset-left)+1rem)] top-[calc(env(safe-area-inset-top)+1rem)] z-50 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-obra-ink shadow-card ring-1 ring-slate-200 transition hover:bg-obra-yellow/15"
      onClick={() => {
        if (window.history.length > 1) window.history.back();
        else router.push(fallback);
      }}
    >
      <ArrowLeft size={21} aria-hidden="true" />
    </button>
  );
}

