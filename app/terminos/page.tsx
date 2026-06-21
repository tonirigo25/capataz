import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/" className="text-sm font-bold text-slate-600 hover:text-obra-ink">Capataz</Link>
      <h1 className="mt-4 text-3xl font-black text-obra-ink">Términos de uso</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Capataz es una herramienta de gestión y asistencia para profesionales de reformas, construcción e instalaciones.
      </p>

      <section className="card mt-6 grid gap-4 p-5 text-sm leading-6 text-slate-600">
        <Block title="Uso de la herramienta">
          El usuario es responsable de introducir datos correctos, revisar propuestas y confirmar cualquier acción sensible antes de guardarla, enviarla o programarla.
        </Block>
        <Block title="Presupuestos y facturas">
          Los documentos generados son una ayuda operativa. Las facturas o borradores deben revisarse con una asesoría o gestoría si no hay facturación legal definitiva configurada.
        </Block>
        <Block title="Comunicaciones">
          Capataz prepara mensajes y recordatorios, pero no envía WhatsApp, emails ni reclamaciones sin confirmación explícita del usuario.
        </Block>
        <Block title="Modo demo">
          El modo demo usa datos ficticios para que revisores y usuarios puedan probar dashboard, agenda, presupuestos, facturas, PDFs, recordatorios y chat sin crear datos reales ni pagar.
        </Block>
        <Block title="Disponibilidad">
          La versión móvil puede depender de un backend web accesible. En entornos de prueba, algunas integraciones externas pueden estar simuladas o desactivadas.
        </Block>
      </section>
    </main>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-black text-obra-ink">{title}</h2>
      <p className="mt-1">{children}</p>
    </div>
  );
}
