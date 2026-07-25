import { CalendarDays, CheckCircle2, FileText, UsersRound, Wrench } from "lucide-react";

const visualModes = ["route", "schedule", "workshop", "brief", "service"] as const;

export function SectorMiniScene({ index, work, owner }: { index: number; work: string; owner: string }) {
  const mode = visualModes[index % visualModes.length];
  return (
    <div className={`sector-mini-scene is-${mode}`} aria-hidden="true">
      <span><i /><i /><i /></span>
      <div><strong>{work}</strong><small>{owner}</small></div>
      <svg viewBox="0 0 160 48" preserveAspectRatio="none"><path d={index % 2 ? "M2 40 C35 4 60 44 90 16 S132 8 158 28" : "M2 34 C30 10 52 42 80 22 S126 12 158 6"} /></svg>
    </div>
  );
}

export function SectorHeroScene({ sectorKey, work, owner }: { sectorKey: string; work: string; owner: string }) {
  const index = Math.abs([...sectorKey].reduce((sum, letter) => sum + letter.charCodeAt(0), 0));
  const Icon = [Wrench, CalendarDays, UsersRound, FileText][index % 4];
  return (
    <section className={`sector-hero-scene variant-${index % 4}`} data-sector-scene={sectorKey}>
      <header><span><Icon size={20} /> Ejemplo sintético</span><strong>{work}</strong></header>
      <div>
        <article><small>Responsable</small><strong>{owner}</strong><span>Contexto asignado</span></article>
        <article><small>Siguiente acción</small><strong>{index % 2 ? "Revisar avance" : "Preparar entrega"}</strong><span>Hoy</span></article>
        <article><small>Relaciones</small><strong>Cliente · agenda · documento</strong><CheckCircle2 size={17} /></article>
      </div>
      <footer>{["Inicio", "En curso", "Revisión", "Resultado"].map((step, stepIndex) => <span key={step} className={stepIndex <= index % 4 ? "is-done" : ""}><i />{step}</span>)}</footer>
    </section>
  );
}
