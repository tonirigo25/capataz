"use client";

import { ErrorState, ProductPage } from "@/components/ui-primitives";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ProductPage layout="analytical">
      <ErrorState
        title="No se pudo cargar el análisis del periodo"
        description="Los datos económicos no se han modificado. Vuelve a intentarlo o abre la vista de origen correspondiente."
        retry={<button type="button" className="secondary-button" onClick={reset}>Reintentar</button>}
      />
    </ProductPage>
  );
}
