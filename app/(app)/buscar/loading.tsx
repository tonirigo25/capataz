import { LoadingState, PageHeader, ProductPage } from "@/components/ui-primitives";

export default function SearchLoading() {
  return (
    <ProductPage layout="list">
      <PageHeader title="Búsqueda" description="Buscando coincidencias en Capataz." />
      <div className="max-w-3xl">
        <LoadingState label="Buscando en Capataz…" />
      </div>
    </ProductPage>
  );
}
