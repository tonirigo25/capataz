"use client";

import { ErrorState, ProductPage } from "@/components/ui-primitives";

export default function TodayError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ProductPage layout="operational">
      <ErrorState title="No se pudo preparar tu día" description="Tus datos siguen intactos. Vuelve a intentarlo para recuperar prioridades y agenda." retry={<button type="button" className="secondary-button" onClick={reset}>Reintentar</button>} />
    </ProductPage>
  );
}
