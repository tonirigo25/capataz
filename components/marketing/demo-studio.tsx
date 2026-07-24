"use client";

import { useMemo, useState } from "react";
import { BriefcaseBusiness, Check, ChevronRight, UsersRound } from "lucide-react";

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

export function DemoStudio({ sectors }: { sectors: DemoSector[] }) {
  const [sectorSlug, setSectorSlug] = useState(sectors[0]?.slug || "");
  const [profileId, setProfileId] = useState("owner");
  const sector = useMemo(() => sectors.find((item) => item.slug === sectorSlug) || sectors[0], [sectorSlug, sectors]);
  const profile = profiles.find((item) => item.id === profileId) || profiles[0];

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
      </div>
      <div className="demo-studio__shell">
        <aside>
          <div><BriefcaseBusiness size={18} /><span><strong>{sector.name}</strong><small>Demo sintética</small></span></div>
          {["Hoy", "Clientes", sector.work, profileId === "finance" ? "Tesorería" : "Agenda", "Documentos"].map((item, index) => (
            <button type="button" key={item} className={index === 0 ? "is-active" : undefined}>{item}<ChevronRight size={14} /></button>
          ))}
        </aside>
        <main>
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
            {["Abrir la prioridad", `Revisar ${sector.work.toLocaleLowerCase("es")}`, "Confirmar o continuar"].map((item, index) => (
              <div key={item}><span>{index + 1}</span><strong>{item}</strong><Check size={16} /></div>
            ))}
          </section>
        </main>
      </div>
    </section>
  );
}
