"use client";

import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FilePenLine,
  ReceiptText,
  ShoppingCart,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./public-home.module.css";

type FlowStage = {
  label: string;
  title: string;
  detail: string;
  outcome: string;
  icon: LucideIcon;
};

const stages: readonly FlowStage[] = [
  { label: "Contacto", title: "Entrada ordenada", detail: "Llamada, necesidad y siguiente paso quedan unidos al cliente.", outcome: "Visita preparada", icon: Users },
  { label: "Presupuesto", title: "Propuesta con margen", detail: "Partidas, dudas y condiciones se revisan antes de enviar.", outcome: "24.600 € · 28,4 %", icon: FilePenLine },
  { label: "Trabajo", title: "Ejecución coordinada", detail: "Hitos, tareas, equipo e incidencias conservan el contexto.", outcome: "14 tareas · 4 responsables", icon: BriefcaseBusiness },
  { label: "Compras", title: "Coste relacionado", detail: "La compra llega al trabajo correcto y muestra la desviación.", outcome: "1.840,50 € validados", icon: ShoppingCart },
  { label: "Factura", title: "Emisión revisable", detail: "El hito prepara una factura, sin emitirla hasta confirmar.", outcome: "F-2031 preparada", icon: ReceiptText },
  { label: "Cobro", title: "Caja bajo control", detail: "Vencimiento, seguimiento y previsión terminan el recorrido.", outcome: "Cobro previsto · 30 ago", icon: WalletCards },
] as const;

const FLOW_AUTOPLAY_MS = 3000;

export function PublicFlowShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [cycle, setCycle] = useState(0);
  const active = stages[activeIndex];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % stages.length);
      setConfirmed(false);
    }, FLOW_AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, cycle, reducedMotion]);

  const select = (index: number) => {
    setActiveIndex(index);
    setConfirmed(false);
    setCycle((current) => current + 1);
  };

  return (
    <section id="flujos" className={styles.flowSection} aria-labelledby="flow-title">
      <div className={styles.sectionHeading}>
        <span>Producto en movimiento</span>
        <h2 id="flow-title">Del primer contacto al cobro, todo sigue el mismo hilo.</h2>
        <p>Orqena convierte conversaciones, documentos y tareas en un flujo claro: presupuesto, trabajo, coste, factura y cobro, sin perder contexto.</p>
      </div>
      <div className={styles.connectedFlow}>
        <nav className={styles.connectedFlowTrack} aria-label="Recorrido de producto">
          {stages.map(({ label, icon: Icon }, index) => (
            <button key={label} type="button" aria-current={index === activeIndex ? "step" : undefined} onClick={() => select(index)}>
              <span>{index < activeIndex || confirmed && index === activeIndex ? <CheckCircle2 /> : <Icon />}</span>
              <strong>{label}</strong>
              {index < stages.length - 1 ? <i aria-hidden="true"><b data-complete={index < activeIndex} /></i> : null}
            </button>
          ))}
        </nav>
        <article className={styles.connectedFlowPanel} key={active.label}>
          <div><span>{String(activeIndex + 1).padStart(2, "0")} · {active.label}</span><h3>{active.title}</h3><p>{active.detail}</p></div>
          <aside><small>Resultado preparado</small><strong>{active.outcome}</strong><em>{confirmed ? "Confirmación simulada · sin escribir datos" : "Pendiente de confirmación humana"}</em></aside>
          <button type="button" onClick={() => setConfirmed((current) => !current)}>{confirmed ? "Reabrir revisión" : "Revisar paso"}<ArrowRight /></button>
        </article>
      </div>
    </section>
  );
}
