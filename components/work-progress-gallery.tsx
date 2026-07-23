"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { AccessibleDialog } from "@/components/accessible-dialog";

export type ProgressPhoto = {
  id: string;
  title: string;
  url: string;
  category: string;
  date: string;
  author?: string | null;
  notes?: string | null;
};

export function WorkProgressGallery({ photos }: { photos: ProgressPhoto[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const close = useCallback(() => setSelected(null), []);
  const move = useCallback((delta: number) => {
    setSelected((current) => current === null ? null : (current + delta + photos.length) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    if (selected === null || photos.length < 2) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [move, photos.length, selected]);

  if (!photos.length) {
    return (
      <div className="rounded-xl bg-subtle p-6 text-center">
        <ImageIcon className="mx-auto text-content-tertiary" aria-hidden="true" />
        <p className="mt-3 font-semibold text-content">Todavía no hay imágenes disponibles</p>
        <p className="type-secondary mt-1">Registra una foto con una URL segura para iniciar el progreso visual.</p>
      </div>
    );
  }

  const photo = selected === null ? null : photos[selected];
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {photos.map((item, index) => (
          <button key={item.id} type="button" onClick={() => setSelected(index)} className="group overflow-hidden rounded-xl border border-border bg-surface text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            <Image src={item.url} alt={item.title} width={640} height={480} unoptimized className="aspect-[4/3] w-full bg-subtle object-cover transition group-hover:scale-[1.02]" />
            <span className="block p-3">
              <span className="block truncate text-sm font-semibold text-content">{item.title}</span>
              <span className="type-meta mt-1 block">{item.category} · {item.date}</span>
            </span>
          </button>
        ))}
      </div>
      <AccessibleDialog title={photo?.title ?? "Fotografía"} description={photo ? `${photo.category} · ${photo.date}${photo.author ? ` · ${photo.author}` : ""}` : undefined} open={photo !== null} onClose={close}>
        {photo ? (
          <div>
            <Image src={photo.url} alt={photo.title} width={1280} height={960} unoptimized className="max-h-[58vh] w-full rounded-xl bg-subtle object-contain" />
            {photo.notes ? <p className="type-secondary mt-3">{photo.notes}</p> : null}
            {photos.length > 1 ? (
              <div className="mt-4 flex items-center justify-between gap-3">
                <button type="button" className="secondary-button" onClick={() => move(-1)}><ChevronLeft size={18} aria-hidden="true" /> Anterior</button>
                <span className="type-meta" aria-live="polite">{selected! + 1} de {photos.length}</span>
                <button type="button" className="secondary-button" onClick={() => move(1)}>Siguiente <ChevronRight size={18} aria-hidden="true" /></button>
              </div>
            ) : null}
          </div>
        ) : null}
      </AccessibleDialog>
    </>
  );
}
