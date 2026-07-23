import Link from "next/link";
import { Search } from "lucide-react";
import {
  EmptyState,
  InteractiveRow,
  PageHeader,
  ProductPage,
  CompactSearch
} from "@/components/ui-primitives";
import { globalSearch } from "@/lib/search";
import { requireCapability } from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireCapability("company.view");
  const query = ((await searchParams).q ?? "").trim();
  const groups = await globalSearch(query);
  const total = Object.values(groups).reduce((sum, items) => sum + items.length, 0);

  return (
    <ProductPage layout="list">
      <PageHeader
        title="Búsqueda"
        description="Encuentra clientes, obras, presupuestos, facturas y documentos desde un único lugar."
      />

      <form action="/buscar" className="mb-8 flex max-w-3xl gap-2" role="search">
        <label htmlFor="global-search-page" className="sr-only">Buscar en Orqena</label>
        <CompactSearch
          id="global-search-page"
          name="q"
          defaultValue={query}
          placeholder="Cliente, obra, factura, documento…"
          autoFocus
        />
        <button className="primary-button shrink-0" type="submit">
          <Search size={18} aria-hidden="true" />
          <span className="hidden sm:inline">Buscar</span>
        </button>
      </form>

      <nav aria-label="Accesos analíticos" className="mb-8 flex flex-wrap gap-2">
        <Link href="/dashboard" className="secondary-button">Abrir Dashboard</Link>
        <Link href="/agenda?vista=hoy" className="ghost-button">Abrir Agenda</Link>
      </nav>

      {!query ? (
        <EmptyState
          title="¿Qué necesitas encontrar?"
          description="Busca por nombre, número de documento, obra, cliente, importe o una nota relacionada."
          icon={Search}
        />
      ) : total === 0 ? (
        <EmptyState
          title="No hay resultados"
          description={`No encontramos coincidencias para “${query}”. Prueba con menos palabras o con el nombre del cliente.`}
          icon={Search}
        />
      ) : (
        <>
          <p className="mb-6 text-sm font-semibold text-content-secondary" aria-live="polite">
            {total} {total === 1 ? "resultado" : "resultados"} para “{query}”
          </p>
          <div className="grid gap-8">
            {Object.entries(groups).map(([type, items]) => (
              <section key={type} aria-labelledby={`search-${slug(type)}`}>
                <div className="mb-2 flex items-center justify-between border-b border-border pb-2">
                  <h2 id={`search-${slug(type)}`} className="type-section-title text-content">{type}</h2>
                  <span className="type-meta">{items.length}</span>
                </div>
                <div>
                  {items.map((item) => (
                    <InteractiveRow
                      key={`${type}-${item.title}-${item.href}`}
                      href={item.href}
                      title={item.title}
                      description={item.detail}
                      meta={type}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </ProductPage>
  );
}

function slug(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, "-");
}
