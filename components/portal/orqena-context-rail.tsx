"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Bot, ChevronRight, ShieldCheck, Sparkles, X } from "lucide-react";

type RailContext = {
  eyebrow: string;
  title: string;
  description: string;
  source: string;
  next: string;
  href: string;
};

const contexts: Array<{ match: (pathname: string) => boolean; value: RailContext }> = [
  { match: (path) => path.startsWith("/clientes/"), value: contextual("Cliente 360", "Revisa relación, operación, dinero y archivos sin perder el contexto del cliente.", "Cliente seleccionado y permisos vigentes", "Preparar el siguiente paso", "/capataz?contexto=cliente") },
  { match: (path) => path === "/clientes", value: contextual("Clientes", "Prioriza seguimientos y oportunidades con la información que tu rol puede consultar.", "Cartera visible para tu perfil", "Analizar cartera", "/capataz?contexto=clientes") },
  { match: (path) => path === "/hoy", value: contextual("Prioridad del día", "Ordena lo que necesita atención ahora y conserva la decisión en manos de tu equipo.", "Agenda, alertas y tareas autorizadas", "Preparar prioridades", "/capataz?contexto=hoy") },
  { match: (path) => path === "/dashboard", value: contextual("Lectura ejecutiva", "Explica tendencias y riesgos usando sólo indicadores que tu perfil puede ver.", "Indicadores agregados del periodo", "Analizar indicadores", "/capataz?contexto=dashboard") },
  { match: (path) => path === "/obras" || path.startsWith("/obras/"), value: contextual("Riesgo operativo", "Contrasta avance, hitos e incidencias antes de preparar una recomendación.", "Trabajo seleccionado y actividad registrada", "Revisar trabajo", "/capataz?contexto=trabajo") },
  { match: (path) => path.startsWith("/presupuestos"), value: contextual("Presupuesto revisable", "Comprueba partidas, margen y condiciones sin modificar cálculos ni fiscalidad.", "Versión visible del presupuesto", "Preparar revisión", "/capataz?contexto=presupuesto") },
  { match: (path) => path === "/dinero" || path.startsWith("/tesoreria"), value: contextual("Control financiero", "Ordena vencimientos y riesgos con importes protegidos por permisos financieros.", "Tesorería autorizada para tu perfil", "Preparar plan financiero", "/capataz?contexto=dinero") },
  { match: (path) => path.startsWith("/documentos") || path.startsWith("/gastos-materiales/lector"), value: contextual("Revisión documental", "Señala campos dudosos y relaciones probables; la confirmación siempre es humana.", "Documento seleccionado y extracción autorizada", "Revisar con Orqena IA", "/capataz?contexto=documentos") },
  { match: (path) => path === "/agenda", value: contextual("Coordinación de agenda", "Detecta conflictos y prepara alternativas sin mover eventos automáticamente.", "Agenda y equipo dentro de tu alcance", "Preparar alternativas", "/capataz?contexto=agenda") },
  { match: (path) => path === "/equipo" || path.startsWith("/equipos"), value: contextual("Coordinación del equipo", "Revisa carga y acceso sin ampliar permisos ni mostrar información fuera de tu alcance.", "Personas y tareas autorizadas", "Analizar coordinación", "/capataz?contexto=equipo") },
  { match: (path) => path.startsWith("/configuracion"), value: contextual("Configuración recomendada", "Comprueba plan, consumo, permisos e integraciones antes de proponer cambios.", "Configuración visible para tu rol", "Abrir guía segura", "/capataz?contexto=configuracion") },
  { match: (path) => path === "/capataz" || path.startsWith("/orqena-ia"), value: contextual("Asistente Orqena IA", "Consulta, prepara y revisa acciones con trazabilidad, límites y confirmación humana.", "Contexto mínimo autorizado", "Continuar en Orqena IA", "/capataz") },
];

const fallbackContext = contextual(
  "Ayuda contextual",
  "Orqena IA puede preparar un análisis con los datos autorizados de esta vista.",
  "Módulo actual y permisos vigentes",
  "Abrir Orqena IA",
  "/capataz",
);

function contextual(eyebrow: string, description: string, source: string, next: string, href: string): RailContext {
  return { eyebrow, title: next, description, source, next, href };
}

export function OrqenaContextRail({ pathname }: { pathname: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [feedback, setFeedback] = useState<"postponed" | "dismissed" | null>(null);
  const titleId = useId();
  const context = contexts.find((entry) => entry.match(pathname))?.value ?? fallbackContext;

  useEffect(() => {
    setMobileOpen(false);
    setFeedback(null);
  }, [pathname]);

  return (
    <>
      <aside className="orqena-context-rail" aria-label="Ayuda contextual de Orqena IA">
        <RailContent context={context} titleId={titleId} feedback={feedback} onFeedback={setFeedback} />
      </aside>

      <button
        type="button"
        className="orqena-context-trigger"
        aria-expanded={mobileOpen}
        aria-controls={`${titleId}-panel`}
        onClick={() => setMobileOpen(true)}
      >
        <Sparkles size={18} aria-hidden="true" />
        <span>Ayuda IA</span>
      </button>

      {mobileOpen ? (
        <div className="orqena-context-sheet-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setMobileOpen(false);
        }}>
          <aside id={`${titleId}-panel`} className="orqena-context-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <button type="button" className="icon-button absolute right-4 top-4" aria-label="Cerrar ayuda contextual" onClick={() => setMobileOpen(false)}>
              <X size={19} aria-hidden="true" />
            </button>
            <RailContent context={context} titleId={titleId} feedback={feedback} onFeedback={setFeedback} />
          </aside>
        </div>
      ) : null}
    </>
  );
}

function RailContent({
  context,
  titleId,
  feedback,
  onFeedback,
}: {
  context: RailContext;
  titleId: string;
  feedback: "postponed" | "dismissed" | null;
  onFeedback: (feedback: "postponed" | "dismissed") => void;
}) {
  return (
    <div className="orqena-context-rail__inner">
      <header className="orqena-context-rail__header">
        <span className="orqena-context-rail__spark"><Sparkles size={17} aria-hidden="true" /></span>
        <span>Orqena IA</span>
      </header>

      <p className="type-label mt-7 text-brand-strong">{context.eyebrow}</p>
      <div className="orqena-context-card mt-3">
        <span className="orqena-context-card__icon"><Bot size={22} aria-hidden="true" /></span>
        <h2 id={titleId} className="mt-5 text-lg font-bold leading-6 text-content">{context.title}</h2>
        <p className="mt-3 text-sm leading-6 text-content-secondary">{context.description}</p>

        <dl className="mt-5 grid gap-3 rounded-xl bg-brand-soft p-4 text-xs leading-5">
          <div>
            <dt className="font-semibold text-content-secondary">Origen</dt>
            <dd className="mt-1 text-content">{context.source}</dd>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-brand/10 pt-3">
            <div><dt className="font-semibold text-content-secondary">Confianza</dt><dd className="mt-1 text-content">Se calcula al analizar</dd></div>
            <div><dt className="font-semibold text-content-secondary">Impacto</dt><dd className="mt-1 text-content">Sin cambios aplicados</dd></div>
          </div>
        </dl>

        <div className="mt-5 flex items-start gap-2 rounded-xl border border-border bg-surface p-3 text-xs leading-5 text-content-secondary">
          <ShieldCheck className="mt-0.5 shrink-0 text-brand-strong" size={17} aria-hidden="true" />
          <p>Tu equipo revisa y confirma cada acción. Descartar o posponer no modifica datos.</p>
        </div>

        <Link href={context.href} className="primary-button mt-5 w-full">
          Revisar y confirmar<ChevronRight size={17} aria-hidden="true" />
        </Link>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" className="secondary-button min-h-10 px-3 text-xs" onClick={() => onFeedback("postponed")}>Posponer</button>
          <button type="button" className="ghost-button min-h-10 px-3 text-xs" onClick={() => onFeedback("dismissed")}>Descartar</button>
        </div>
        {feedback ? <p role="status" className="mt-2 text-center text-xs leading-5 text-content-secondary">
          {feedback === "postponed" ? "Pospuesta durante esta sesión; no se ha modificado ningún dato." : "Descartada en esta vista; no se ha ejecutado ninguna acción."}
        </p> : null}
        <Link href="/configuracion/ia" className="ghost-button mt-1 w-full text-xs">Ver límites y control</Link>
      </div>
    </div>
  );
}
