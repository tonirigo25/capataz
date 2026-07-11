import Link from "next/link";
import { Search } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { EmptyState } from "@/components/ui-primitives";
import { globalSearch } from "@/lib/search";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const query = (await searchParams).q ?? "";
  const groups = await globalSearch(query);
  const total = Object.values(groups).reduce((sum, items) => sum + items.length, 0);

  return (
    <main className="screen">
      <SectionHeader title="Buscador global" description="Clientes, obras, facturas, agenda, gastos, materiales y configuración." />

      <form action="/buscar" className="card mb-4 flex gap-2 p-3">
        <input className="field" name="q" defaultValue={query} placeholder="Buscar cliente, factura vencida, cemento cola..." />
        <button className="icon-button shrink-0" type="submit" aria-label="Buscar">
          <Search size={20} />
        </button>
      </form>

      {query ? (
        <p className="mb-4 text-sm font-semibold text-slate-500">
          {total} resultados para “{query}”.
        </p>
      ) : null}

      <div className="grid gap-5">
        {Object.entries(groups).map(([type, items]) => (
          <section key={type}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-base font-black text-obra-ink">{type}</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{items.length}</span>
            </div>
            <div className="grid gap-2">
              {items.slice(0, 8).map((item) => (
                <Link key={`${type}-${item.title}-${item.href}`} href={item.href} className="card block p-4 transition hover:border-obra-yellowDark hover:bg-obra-yellow/10">
                  <p className="text-sm font-black text-obra-ink">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      {query && total === 0 ? (
        <EmptyState
          title="No hay resultados"
          description="Prueba con cliente, obra, factura, material, importe o una nota. La búsqueda usa datos reales de Capataz."
          icon={Search}
        />
      ) : null}
    </main>
  );
}
