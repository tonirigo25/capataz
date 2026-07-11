import { LoadingState } from "@/components/ui-primitives";

export default function ClientesLoading() {
  return (
    <main className="screen">
      <LoadingState label="Cargando CRM de clientes..." />
    </main>
  );
}
