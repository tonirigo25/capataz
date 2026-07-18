import { LoadingState, ProductPage } from "@/components/ui-primitives";

export default function TodayLoading() {
  return (
    <ProductPage layout="operational">
      <div className="mb-8 grid gap-3"><div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" /><div className="h-5 max-w-xl animate-pulse rounded-lg bg-slate-200" /></div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(17rem,.6fr)]"><LoadingState label="Cargando prioridades" /><LoadingState label="Cargando agenda inmediata" /></div>
    </ProductPage>
  );
}
