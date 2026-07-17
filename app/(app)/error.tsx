"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[capataz] Error controlado en el área principal", { digest: error.digest || "unavailable" });
  }, [error.digest]);

  return (
    <main className="screen">
      <section className="empty-state">
        <h1>Capataz no puede cargar los datos ahora mismo</h1>
        <p>
          La aplicación sigue disponible, pero esta pantalla no se ha podido completar. No se ha guardado ni enviado ninguna acción.
        </p>
        <div className="button-row">
          <button type="button" className="primary-button" onClick={reset}>
            Reintentar
          </button>
          <Link href="/" className="secondary-button">
            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
