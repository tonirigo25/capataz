import { LoadingState, ProductPage } from "@/components/ui-primitives";

export default function DashboardLoading() {
  return (
    <ProductPage layout="analytical">
      <div className="mb-8 grid gap-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-5 max-w-2xl animate-pulse rounded-lg bg-slate-200" />
      </div>
      <div className="grid gap-6">
        <LoadingState label="Cargando resumen económico" />
        <LoadingState label="Cargando tendencia del periodo" />
        <LoadingState label="Cargando riesgos y rentabilidad" />
      </div>
    </ProductPage>
  );
}
