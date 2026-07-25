"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Check, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, UsersRound } from "lucide-react";

type DemoSector = {
  slug: string;
  name: string;
  lead: string;
  work: string;
  owner: string;
};

const profiles = [
  { id: "owner", name: "Propietario", focus: "Prioridades, control y decisiones" },
  { id: "direction", name: "Dirección", focus: "Coordinación entre áreas" },
  { id: "sales", name: "Comercial", focus: "Clientes, propuestas y agenda" },
  { id: "finance", name: "Finanzas", focus: "Documentos, vencimientos y tesorería" },
  { id: "purchases", name: "Compras", focus: "Solicitudes, pedidos y recepción" },
  { id: "manager", name: "Responsable", focus: "Planificación, equipo y avance" },
  { id: "employee", name: "Empleado", focus: "Tareas e instrucciones de hoy" },
] as const;

const objectives = [
  { id: "captar-cliente", name: "Captar cliente", steps: ["Contexto", "Cliente", "Seguimiento", "Propuesta", "Orqena", "Móvil", "Resultado"] },
  { id: "preparar-presupuesto", name: "Preparar presupuesto", steps: ["Contexto", "Cliente", "Partidas", "Aprobación", "Orqena", "Móvil", "Resultado"] },
  { id: "coordinar-trabajo", name: "Coordinar trabajo", steps: ["Contexto", "Plan", "Equipo", "Avance", "Orqena", "Móvil", "Resultado"] },
  { id: "registrar-factura", name: "Registrar factura", steps: ["Contexto", "Documento", "Relación", "Vencimiento", "Orqena", "Móvil", "Resultado"] },
  { id: "controlar-pagos", name: "Controlar pagos", steps: ["Contexto", "Vencimiento", "Cobro", "Tesorería", "Orqena", "Móvil", "Resultado"] },
  { id: "gestionar-equipo", name: "Gestionar equipo", steps: ["Contexto", "Portal", "Alcance", "Tarea", "Orqena", "Móvil", "Resultado"] },
] as const;

export function DemoStudio({ sectors }: { sectors: DemoSector[] }) {
  const [sectorSlug, setSectorSlug] = useState(sectors[0]?.slug || "");
  const [profileId, setProfileId] = useState("owner");
  const [objectiveId, setObjectiveId] = useState<(typeof objectives)[number]["id"]>("captar-cliente");
  const [activeStep, setActiveStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const sector = useMemo(() => sectors.find((item) => item.slug === sectorSlug) || sectors[0], [sectorSlug, sectors]);
  const profile = profiles.find((item) => item.id === profileId) || profiles[0];
  const objective = objectives.find((item) => item.id === objectiveId) || objectives[0];

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setActiveStep((current) => {
      if (current >= objective.steps.length - 1) {
        setPlaying(false);
        return current;
      }
      return current + 1;
    }), 7000);
    return () => window.clearInterval(timer);
  }, [objective.steps.length, playing]);

  if (!sector) return null;

  return (
    <section className="demo-studio" aria-labelledby="demo-studio-title">
      <div className="demo-studio__controls">
        <div>
          <label htmlFor="demo-sector">Sector</label>
          <select id="demo-sector" value={sectorSlug} onChange={(event) => setSectorSlug(event.target.value)}>
            {sectors.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="demo-profile">Perfil</label>
          <select id="demo-profile" value={profileId} onChange={(event) => setProfileId(event.target.value)}>
            {profiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="demo-objective">Objetivo</label>
          <select id="demo-objective" value={objectiveId} onChange={(event) => { setObjectiveId(event.target.value as typeof objectiveId); setActiveStep(0); setPlaying(false); }}>
            {objectives.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
      </div>
      <div className="demo-studio__playback">
        <div><span>Paso {activeStep + 1} de {objective.steps.length}</span><strong>{objective.steps[activeStep]}</strong><small>Recorrido completo: 49 segundos</small></div>
        <div>
          <button type="button" onClick={() => { setPlaying(false); setActiveStep((current) => Math.max(0, current - 1)); }} aria-label="Paso anterior"><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => setPlaying((current) => !current)}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "Pausar" : "Reproducir"}</button>
          <button type="button" onClick={() => { setPlaying(false); setActiveStep((current) => Math.min(objective.steps.length - 1, current + 1)); }} aria-label="Paso siguiente"><ChevronRight size={16} /></button>
          <button type="button" onClick={() => { setPlaying(false); setActiveStep(0); }} aria-label="Reiniciar"><RotateCcw size={15} /></button>
        </div>
      </div>
      <div className="demo-studio__progress" role="tablist" aria-label="Pasos de la demo">
        {objective.steps.map((step, index) => <button type="button" role="tab" aria-selected={index === activeStep} className={index === activeStep ? "is-active" : index < activeStep ? "is-complete" : ""} key={step} onClick={() => { setPlaying(false); setActiveStep(index); }}><span>{index + 1}</span>{step}</button>)}
      </div>
      <div className="demo-studio__shell">
        <aside>
          <div><BriefcaseBusiness size={18} /><span><strong>{sector.name}</strong><small>Demo sintética</small></span></div>
          {["Hoy", "Clientes", sector.work, profileId === "finance" ? "Tesorería" : "Agenda", "Documentos"].map((item, index) => (
            <button type="button" key={item} className={index === Math.min(activeStep, 4) ? "is-active" : undefined}>{item}<ChevronRight size={14} /></button>
          ))}
        </aside>
        <div className="demo-studio__main">
          <header>
            <div><span>{profile.name}</span><h2 id="demo-studio-title">Hoy, con foco en {profile.focus.toLocaleLowerCase("es")}</h2><p>{sector.lead}</p></div>
            <strong><UsersRound size={16} />{sector.owner}</strong>
          </header>
          <div className="demo-studio__metrics">
            <article><small>Prioridad</small><strong>Revisar el siguiente paso</strong><span>Contexto listo</span></article>
            <article><small>{sector.work}</small><strong>Actividad en curso</strong><span>Actualizado ahora</span></article>
            <article><small>Agenda</small><strong>Próxima actividad</strong><span>Relación completa</span></article>
          </div>
          <section>
            <h3>Recorrido recomendado</h3>
            {[`Objetivo: ${objective.name}`, `${objective.steps[activeStep]} en ${sector.work.toLocaleLowerCase("es")}`, activeStep === objective.steps.length - 1 ? "Resultado listo para revisar" : "Continuar el recorrido"].map((item, index) => (
              <div key={item}><span>{index + 1}</span><strong>{item}</strong><Check size={16} /></div>
            ))}
          </section>
        </div>
      </div>
    </section>
  );
}
