import Link from "next/link";
import { EmptyState } from "@/components/ui-primitives";

export default function NotFound() {
  return (
    <main className="screen">
      <EmptyState
        title="No encontramos esta página"
        description="El enlace puede haber cambiado o el elemento no está disponible para tu empresa."
        action={<Link href="/hoy" className="primary-button">Volver a Hoy</Link>}
        secondaryAction={<Link href="/" className="secondary-button">Ir al inicio</Link>}
      />
    </main>
  );
}
