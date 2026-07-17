import { LoadingState } from "@/components/ui-primitives";

export default function RootLoading() {
  return (
    <main className="screen" aria-live="polite" aria-busy="true">
      <LoadingState label="Cargando Capataz..." />
    </main>
  );
}
