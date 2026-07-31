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
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./public-home.module.css";

type FlowStage = {
  label: string;
  summary: string;
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
  { label: "Contacto", summary: "Necesidad y siguiente paso", title: "Consulta convertida en siguiente paso", detail: "La conversación, la necesidad y la próxima acción quedan unidas al cliente.", outcome: "Visita preparada", context: "Grupo Norte Demo · Oficina Centro", status: "Necesidad revisada", nextDecision: "Confirmar visita propuesta", impact: "Oportunidad lista para presupuestar", icon: Users },
  { label: "Presupuesto", summary: "Partidas, condiciones y margen", title: "Propuesta revisable con margen", detail: "Partidas, dudas y condiciones se revisan antes de enviar.", outcome: "24.600 € · margen 28,4 %", context: "PR-104 · 12 partidas", status: "2 dudas abiertas", nextDecision: "Resolver plazo y primer pago", impact: "Propuesta lista para revisión", icon: FilePenLine },
  { label: "Trabajo", summary: "Hitos, tareas e incidencias", title: "Ejecución coordinada con contexto", detail: "Hitos, tareas, equipo e incidencias permanecen conectados al trabajo.", outcome: "14 tareas · 4 responsables", context: "TR-021 · Reforma Oficina Centro", status: "3 hitos planificados", nextDecision: "Confirmar fecha de inicio", impact: "Agenda y responsables conectados", icon: BriefcaseBusiness },
  { label: "Compras", summary: "Costes vinculados al trabajo", title: "Coste vinculado al trabajo", detail: "Cada compra conserva su origen y muestra la desviación frente a lo previsto.", outcome: "Total 1.840,50 €", context: "FR-882 · Materiales Levante Demo", status: "Vinculada al trabajo", nextDecision: "Validar base e IVA", impact: "+80,50 € sobre lo previsto", icon: ShoppingCart },
  { label: "Factura", summary: "Borrador listo para revisar", title: "Factura preparada para revisar", detail: "El hito prepara el borrador, pero la factura no se emite hasta confirmar.", outcome: "F-2031 · 8.450 €", context: "Hito 2 · certificación parcial", status: "Borrador preparado", nextDecision: "Revisar destinatario y emitir", impact: "Vencimiento calculado a 30 días", icon: ReceiptText },
  { label: "Cobro", summary: "Vencimiento y previsión de caja", title: "Vencimiento y caja bajo control", detail: "El vencimiento y su seguimiento completan el recorrido sin inventar cobros.", outcome: "Previsión tras emisión · 30 días", context: "F-2031 · Grupo Norte Demo", status: "Pendiente de emisión", nextDecision: "Confirmar factura o devolver a revisión", impact: "Previsión incorporada a tesorería", icon: WalletCards },
] as const;

const FLOW_AUTOPLAY_MS = 6000;
const FLOW_PANEL_ID = "flow-panel";
const FLOW_STAGE_TITLE_ID = "flow-stage-title";

export function PublicFlowShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [inViewport, setInViewport] = useState(false);
  const [playing, setPlaying] = useState(true);
  const sectionRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLOListElement | null>(null);
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
    const track = trackRef.current;
    const button = buttonRefs.current[activeIndex];
    if (!track || !button) return;
    track.scrollTo({
      behavior: reducedMotion ? "auto" : "smooth",
      left: button.offsetLeft - (track.clientWidth - button.clientWidth) / 2,
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
        <h2 id="flow-title">De cliente a cobro: todo el trabajo sigue el mismo hilo.</h2>
        <p>Orqena conecta el seguimiento del cliente, los presupuestos, la ejecución, las compras, la facturación y los cobros. Cada paso conserva su documento de origen y requiere revisión antes de confirmar.</p>
        <button
          className={styles.flowPlayback}
          type="button"
          aria-label={reducedMotion ? "Avance manual del recorrido" : "Reproducción automática del recorrido"}
          aria-controls={FLOW_PANEL_ID}
          aria-pressed={playing && !reducedMotion}
          onClick={() => setPlaying((current) => !current)}
          disabled={reducedMotion}
        >
          {reducedMotion ? <><Play />Avance manual</> : playing ? <><Pause />Pausar recorrido</> : <><Play />Reanudar recorrido</>}
        </button>
      </div>
      <div className={styles.connectedFlow}>
        <ol ref={trackRef} className={styles.connectedFlowTrack} aria-label="Proceso de trabajo en Orqena">
          {stages.map(({ label, summary, icon: Icon }, index) => (
            <li key={label}>
              <button id={`flow-step-${index}`} ref={(node) => { buttonRefs.current[index] = node; }} type="button" aria-controls={FLOW_PANEL_ID} aria-current={index === activeIndex ? "step" : undefined} onClick={() => select(index)}>
                <span>{index < activeIndex || confirmed && index === activeIndex ? <CheckCircle2 aria-hidden="true" /> : <Icon aria-hidden="true" />}</span>
                <strong>{label}</strong>
                <small>{summary}</small>
                {index < stages.length - 1 ? <i aria-hidden="true"><b data-complete={index < activeIndex} /></i> : null}
              </button>
            </li>
          ))}
        </ol>
        <article id={FLOW_PANEL_ID} role="region" aria-labelledby={FLOW_STAGE_TITLE_ID} className={styles.connectedFlowPanel} key={active.label}>
          <div><span>{String(activeIndex + 1).padStart(2, "0")} · {active.label}</span><h3 id={FLOW_STAGE_TITLE_ID}>{active.title}</h3><p>{active.detail}</p></div>
          <dl><div><dt>Entra</dt><dd>{active.context}</dd></div><div><dt>Orqena conecta</dt><dd>{active.status}</dd></div><div><dt>Tú decides</dt><dd>{active.nextDecision}</dd></div><div><dt>Sale preparado</dt><dd>{active.impact}</dd></div></dl>
          <aside><small>Ejemplo con datos sintéticos</small><strong>{active.outcome}</strong><em>{confirmed ? "Confirmación simulada · sin escribir datos" : "Pendiente de confirmación humana"}</em><button type="button" onClick={() => setConfirmed((current) => !current)}>{confirmed ? "Reabrir simulación" : "Simular revisión"}<ArrowRight aria-hidden="true" /></button></aside>
        </article>
      </div>
      <div className={styles.flowActions}>
        <Link className={styles.flowPrimaryCta} href="#como-funciona">Ver la demo guiada <ArrowRight aria-hidden="true" /></Link>
        <Link className={styles.flowSecondaryCta} href="/contacto?motivo=demo">Solicitar demo privada</Link>
        <p className={styles.flowTrust}>Datos sintéticos. Ninguna acción modifica tu negocio.</p>
      </div>
    </section>
  );
}
