"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import type { SearchGroups, SearchResult } from "@/lib/search";

type SearchStatus = "idle" | "loading" | "ready" | "empty" | "error";
type SearchResponse = { query: string; groups: SearchGroups; total: number };
type SearchOption = SearchResult & { group: string; optionId: string };

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 80;
const SEARCH_DELAY_MS = 250;
const GROUP_ORDER = ["Clientes", "Contactos", "Trabajo", "Presupuestos", "Facturas", "Pagos", "Gastos", "Agenda", "Documentos"];

export function GlobalSearchCombobox({
  id,
  defaultValue = "",
  autoFocus = false,
  onNavigate,
  className,
}: {
  id: string;
  defaultValue?: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(defaultValue.slice(0, MAX_QUERY_LENGTH));
  const [groups, setGroups] = useState<SearchGroups>({});
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [focused, setFocused] = useState(false);
  const [composing, setComposing] = useState(false);
  const trimmedQuery = query.trim();
  const orderedGroups = useMemo(
    () => Object.entries(groups)
      .filter(([, items]) => items.length > 0)
      .sort(([left], [right]) => groupRank(left) - groupRank(right)),
    [groups],
  );
  const options = useMemo<SearchOption[]>(() => {
    let index = 0;
    return orderedGroups.flatMap(([group, items]) => items.map((item) => ({
      ...item,
      group,
      optionId: `${id}-option-${index++}`,
    })));
  }, [id, orderedGroups]);
  const showPanel = focused && query.length > 0;
  const listboxId = `${id}-suggestions`;

  useEffect(() => {
    setActiveIndex(-1);
    if (composing || trimmedQuery.length < MIN_QUERY_LENGTH) {
      setGroups({});
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    setGroups({});
    setStatus("loading");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/search/suggestions", {
          method: "POST",
          cache: "no-store",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmedQuery }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("SEARCH_UNAVAILABLE");
        const payload = await response.json() as SearchResponse;
        if (controller.signal.aborted) return;
        setGroups(payload.groups);
        setStatus(payload.total > 0 ? "ready" : "empty");
      } catch {
        if (controller.signal.aborted) return;
        setGroups({});
        setStatus("error");
      }
    }, SEARCH_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [composing, trimmedQuery]);

  useEffect(() => {
    if (activeIndex >= options.length) setActiveIndex(options.length ? options.length - 1 : -1);
  }, [activeIndex, options.length]);

  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(options[activeIndex]?.optionId ?? "")?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, options]);

  function navigateTo(option: SearchOption) {
    setFocused(false);
    onNavigate?.();
    router.push(option.href);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && options.length) {
      event.preventDefault();
      setActiveIndex((current) => current >= options.length - 1 ? 0 : current + 1);
      return;
    }
    if (event.key === "ArrowUp" && options.length) {
      event.preventDefault();
      setActiveIndex((current) => current <= 0 ? options.length - 1 : current - 1);
      return;
    }
    if (event.key === "Home" && options.length) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End" && options.length) {
      event.preventDefault();
      setActiveIndex(options.length - 1);
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0 && options[activeIndex]) {
      event.preventDefault();
      navigateTo(options[activeIndex]);
      return;
    }
    if (event.key === "Escape") {
      setGroups({});
      setStatus("idle");
      setActiveIndex(-1);
      setFocused(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className={clsx("relative", className)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <form action="/buscar" role="search">
        <label htmlFor={id} className="sr-only">Buscar en Orqena</label>
        <div className="relative">
          <Search size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary" aria-hidden="true" />
          <input
            id={id}
            data-autofocus={autoFocus ? true : undefined}
            className="field pl-11 pr-24"
            name="q"
            type="search"
            autoComplete="off"
            autoFocus={autoFocus}
            maxLength={MAX_QUERY_LENGTH}
            value={query}
            placeholder="Cliente, trabajo, factura…"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showPanel}
            aria-controls={showPanel ? listboxId : undefined}
            aria-activedescendant={activeIndex >= 0 ? options[activeIndex]?.optionId : undefined}
            onChange={(event) => {
              setQuery(event.target.value);
              setFocused(true);
            }}
            onKeyDown={onInputKeyDown}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
          />
          <button type="submit" className="primary-button absolute right-1 top-1 min-h-10 px-3">Buscar</button>
        </div>
      </form>

      <span className="sr-only" role="status" aria-live="polite">
        {status === "loading" ? "Buscando coincidencias" : status === "ready" ? `${options.length} coincidencias disponibles` : status === "empty" ? "Sin coincidencias" : status === "error" ? "La búsqueda predictiva no está disponible" : ""}
      </span>

      {showPanel ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Coincidencias agrupadas"
          aria-busy={status === "loading"}
          className="absolute left-0 right-0 top-full z-[80] mt-2 max-h-[min(62dvh,34rem)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface shadow-card"
        >
          {trimmedQuery.length < MIN_QUERY_LENGTH ? (
            <SearchMessage>Escribe al menos dos caracteres para ver coincidencias.</SearchMessage>
          ) : status === "loading" ? (
            <SearchMessage><LoaderCircle size={17} className="animate-spin" aria-hidden="true" />Buscando por áreas…</SearchMessage>
          ) : status === "error" ? (
            <SearchMessage role="alert">No se han podido cargar las coincidencias. Puedes completar la búsqueda.</SearchMessage>
          ) : status === "empty" ? (
            <SearchMessage>No hay coincidencias para “{trimmedQuery}”.</SearchMessage>
          ) : (
            orderedGroups.map(([group, items], groupIndex) => (
              <section key={group} role="group" aria-labelledby={`${id}-group-${slug(group)}`} className="border-b border-border last:border-b-0">
                <div className="sticky top-0 z-10 flex items-center justify-between bg-subtle/95 px-3 py-2 backdrop-blur-sm">
                  <h3 id={`${id}-group-${slug(group)}`} className="text-[11px] font-bold uppercase tracking-[0.08em] text-content-secondary">{group}</h3>
                  <span className="text-[11px] font-semibold text-content-tertiary">{items.length}</span>
                </div>
                <div>
                  {items.map((item) => {
                    const index = orderedGroups.slice(0, groupIndex).reduce((sum, [, previousItems]) => sum + previousItems.length, 0) + items.indexOf(item);
                    const option = options[index];
                    if (!option) return null;
                    return (
                      <Link
                        key={`${group}-${item.href}-${item.title}`}
                        id={option.optionId}
                        href={item.href}
                        role="option"
                        aria-selected={index === activeIndex}
                        className={clsx(
                          "flex min-h-14 items-center gap-3 border-t border-border/70 px-3 py-2.5 first:border-t-0 focus:outline-none",
                          index === activeIndex ? "bg-brand-soft" : "hover:bg-subtle",
                        )}
                        onPointerMove={() => setActiveIndex(index)}
                        onClick={() => {
                          setFocused(false);
                          onNavigate?.();
                        }}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-content">{item.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-content-secondary">{item.detail}</span>
                        </span>
                        <ArrowRight size={16} className="shrink-0 text-content-tertiary" aria-hidden="true" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))
          )}
          {trimmedQuery.length >= MIN_QUERY_LENGTH ? (
            <Link
              href={`/buscar?q=${encodeURIComponent(trimmedQuery)}`}
              className="flex min-h-12 items-center justify-center gap-2 border-t border-border px-3 text-sm font-semibold text-brand-strong hover:bg-brand-soft"
              onClick={onNavigate}
            >
              Ver todos los resultados <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SearchMessage({ children, role }: { children: ReactNode; role?: "alert" }) {
  return <div role={role} className="flex min-h-16 items-center justify-center gap-2 px-4 py-5 text-center text-sm text-content-secondary">{children}</div>;
}

function groupRank(group: string) {
  const index = GROUP_ORDER.indexOf(group);
  return index === -1 ? GROUP_ORDER.length : index;
}

function slug(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, "-");
}
