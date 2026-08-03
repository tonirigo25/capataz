import { ProductPage } from "@/components/ui-primitives";

export default function TodayLoading() {
  return (
    <ProductPage layout="operational" className="hoy-page" aria-busy="true" aria-label="Cargando la vista de hoy">
      <header className="hoy-header">
        <span className="hoy-skeleton hoy-skeleton--title" />
        <span className="hoy-skeleton hoy-skeleton--subtitle" />
      </header>
      <section className="hoy-priorities" aria-label="Cargando prioridades">
        <div className="hoy-section-heading"><span className="hoy-skeleton hoy-skeleton--heading" /></div>
        <div className="hoy-priority-grid">
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="hoy-priority-card"><span className="hoy-skeleton hoy-skeleton--icon" /><span className="hoy-skeleton hoy-skeleton--line" /><span className="hoy-skeleton hoy-skeleton--line hoy-skeleton--line-short" /></div>)}
        </div>
      </section>
      <div className="hoy-operational-grid">
        {Array.from({ length: 3 }, (_, index) => <div key={index} className="hoy-panel"><span className="hoy-skeleton hoy-skeleton--heading" />{Array.from({ length: 5 }, (__, row) => <span key={row} className="hoy-skeleton hoy-skeleton--row" />)}</div>)}
      </div>
      <div className="hoy-bottom-grid">
        <div className="hoy-panel hoy-money-panel"><div className="hoy-money-column"><span className="hoy-skeleton hoy-skeleton--heading" /></div><div className="hoy-money-column"><span className="hoy-skeleton hoy-skeleton--heading" /></div></div>
        <div className="hoy-panel"><span className="hoy-skeleton hoy-skeleton--heading" />{Array.from({ length: 4 }, (_, row) => <span key={row} className="hoy-skeleton hoy-skeleton--row" />)}</div>
      </div>
    </ProductPage>
  );
}
