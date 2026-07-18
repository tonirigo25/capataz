"use client";

import { ErrorState, PageHeader, ProductPage } from "@/components/ui-primitives";

export default function SearchError({ reset }: { reset: () => void }) {
  return (
    <ProductPage layout="list">
      <PageHeader title="Búsqueda" description="Encuentra información de toda la empresa." />
      <ErrorState
        title="No se pudo completar la búsqueda"
        description="El resto de Capataz sigue disponible. Vuelve a intentarlo."
        retry={<button type="button" className="secondary-button" onClick={reset}>Reintentar</button>}
      />
    </ProductPage>
  );
}
