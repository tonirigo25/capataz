"use client";

import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FilePenLine,
  Pause,
  Play,
  ReceiptText,
  ShoppingCart,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./public-home.module.css";

type FlowStage = {
  label: string;
  title: string;
  detail: string;
  outcome: string;
  context: string;
  status: string;
  nextDecision: string;
  impact: string;
  icon: LucideIcon;
};

const stages: readonly FlowStage[] = [
  { label: "Contacto", title: "Entrada ordenada", detail: "Llamada, necesidad y siguiente paso quedan unidos al cliente.", outcome: "Visita preparada", context: "Grupo Norte Demo · Oficina Centro", status: "Necesidad revisada", nextDecision: "Confirmar visita del viernes", impact: "Oportunidad lista para presupuestar", icon: Users },
  { label: "Presupuesto", title: "Propuesta con margen", detail: "Partidas, dudas y condiciones se revisan antes de enviar.", outcome: "24.600 € · margen 28,4 %", context: "PR-104 · 12 partidas", status: "2 dudas abiertas", nextDecision: "Resolver plazo y primer pago", impact: "Propuesta revisable", icon: FilePenLine },
  { label: "Trabajo", title: "Ejecución coordinada", detail: "Hitos, tareas, equipo e incidencias conservan el contexto.", outcome: "14 tareas · 4 responsables", context: "TR-021 · Reforma Oficina Centro", status: "3 hitos planificados", nextDecision: "Confirmar inicio el 5 de agosto", impact: "Agenda y responsables conectados", icon: BriefcaseBusiness },
  { label: "Compras", title: "Coste relacionado", detail: "La compra llega al trabajo correcto y muestra la desviación.", outcome: "Total 1.840,50 €", context: "FR-882 · Materiales Levante Demo", status: "Vinculada al trabajo", nextDecision: "Validar base e IVA", impact: "+80,50 € sobre lo previsto", icon: ShoppingCart },
  { label: "Factura", title: "Emisión revisable", detail: "El hito prepara una factura, sin emitirla hasta confirmar.", outcome: "F-2031 · 8.450 €", context: "Hito 2 · certificación parcial", status: "Borrador preparado", nextDecision: "Revisar destinatario y emitir", impact: "Vencimiento calculado a 30 días", icon: ReceiptText },
  { label: "Cobro", title: "Caja bajo control", detail: "Vencimiento, seguimiento y previsión terminan el recorrido.", outcome: "Cobro previsto · 30 ago", context: "F-2031 · Grupo Norte Demo", status: "Pendiente de emisión", nextDecision: "Confirmar factura o devolver", impact: "Previsión incorporada a tesorería", icon: WalletCards },
] as const;

const FLOW_AUTOPLAY_MS = 6000;

export function PublicFlowShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [inViewport, setInViewport] = useState(false);
  const [playing, setPlaying] = useState(true);
  const sectionRef = useRef<HTMLElement | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = stages[activeIndex];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => {
      setInViewport(entry.isIntersecting && entry.intersectionRatio >= 0.35);
    }, { threshold: [0, 0.35, 0.7] });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reducedMotion || !inViewport || !playing) return;
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % stages.length);
      setConfirmed(false);
    }, FLOW_AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, cycle, inViewport, playing, reducedMotion]);

  useEffect(() => {
    buttonRefs.current[activeIndex]?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeIndex, reducedMotion]);

  const select = (index: number) => {
    setActiveIndex(index);
    setConfirmed(false);
    setCycle((current) => current + 1);
  };

  return (
    <section ref={sectionRef} id="flujos" className={styles.flowSection} aria-labelledby="flow-title">
      <div className={styles.sectionHeading}>
        <span>Producto en movimiento</span>
        <h2 id="flow-title">Del primer contacto al cobro, todo sigue el mismo hilo.</h2>
        <p>Orqena convierte conversaciones, documentos y tareas en un flujo claro: presupuesto, trabajo, coste, factura y cobro, sin perder contexto.</p>
        <button
          className={styles.flowPlayback}
          type="button"
          onClick={() => setPlaying((current) => !current)}
          disabled={reducedMotion}
        >
          {playing ? <><Pause />Pausar recorrido</> : <><Play />Reanudar recorrido</>}
        </button>
      </div>
      <div className={styles.connectedFlow}>
        <nav className={styles.connectedFlowTrack} aria-label="Recorrido de producto">
          {stages.map(({ label, status, icon: Icon }, index) => (
            <button ref={(node) => { buttonRefs.current[index] = node; }} key={label} type="button" aria-current={index === activeIndex ? "step" : undefined} onClick={() => select(index)}>
              <span>{index < activeIndex || confirmed && index === activeIndex ? <CheckCircle2 /> : <Icon />}</span>
              <strong>{label}</strong>
              <small>{status}</small>
              {index < stages.length - 1 ? <i aria-hidden="true"><b data-complete={index < activeIndex} /></i> : null}
            </button>
          ))}
        </nav>
        <article className={styles.connectedFlowPanel} key={active.label}>
          <div><span>{String(activeIndex + 1).padStart(2, "0")} · {active.label}</span><h3>{active.title}</h3><p>{active.detail}</p></div>
          <dl><div><dt>Contexto</dt><dd>{active.context}</dd></div><div><dt>Estado</dt><dd>{active.status}</dd></div><div><dt>Próxima decisión</dt><dd>{active.nextDecision}</dd></div><div><dt>Impacto</dt><dd>{active.impact}</dd></div></dl>
          <aside><small>Resultado preparado</small><strong>{active.outcome}</strong><em>{confirmed ? "Confirmación simulada · sin escribir datos" : "Pendiente de confirmación humana"}</em><button type="button" onClick={() => setConfirmed((current) => !current)}>{confirmed ? "Reabrir revisión" : "Revisar paso"}<ArrowRight /></button></aside>
        </article>
      </div>
    </section>
  );
}
