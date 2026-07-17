import { LoadingState } from "@/components/ui-primitives";

export default function AppLoading() {
  return (
    <main className="screen" aria-live="polite" aria-busy="true">
      <LoadingState label="Cargando los datos de tu empresa..." />
    </main>
  );
}
