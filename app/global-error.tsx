"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body>
        <main className="screen">
          <section className="empty-state" role="alert">
            <h1>Capataz no puede mostrar esta pantalla</h1>
            <p>No se ha enviado ninguna acción. Puedes reintentar o volver al inicio.</p>
            <div className="button-row">
              <button type="button" className="primary-button" onClick={reset}>Reintentar</button>
              <a href="/" className="secondary-button">Volver al inicio</a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
