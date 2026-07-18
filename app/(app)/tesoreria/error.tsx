"use client";

import { ErrorState, ProductPage } from "@/components/ui-primitives";

export default function TreasuryError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ProductPage layout="analytical">
      <ErrorState
        title="No se pudo cargar el control económico"
        description="No se ha modificado ningún documento ni movimiento. Puedes reintentar o volver al módulo de origen."
        retry={<button type="button" className="secondary-button" onClick={reset}>Reintentar</button>}
      />
    </ProductPage>
  );
}
