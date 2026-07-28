"use client";

import { Building2, CircleDollarSign, ClipboardList, ReceiptText, WalletCards } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  DemoController,
  PlaybackControls,
  ReducedMotionFallback,
} from "@/components/marketing/motion-system";
import { trackPublicFunnel } from "@/lib/product/public-analytics";
import styles from "../page.module.css";

const stages = [
  {
    id: "contacto-visita",
    label: "Contacto y visita",
    title: "Audio, mensaje o llamada; contexto preparado.",
    record: "Petición, visita y datos pendientes en una historia.",
    decision: "Una persona confirma cliente, alcance y siguiente paso.",
    outcome: "Cliente preparado",
    Icon: Building2,
  },
  {
    id: "presupuesto",
    label: "Presupuesto",
    title: "Partidas, precio, margen y condiciones revisables.",
    record: "Borrador sintético con cantidades y dudas visibles.",
    decision: "No se comparte hasta revisar cada partida.",
    outcome: "Decisión comercial",
    Icon: CircleDollarSign,
  },
  {
    id: "trabajo-planificacion",
    label: "Trabajo y planificación",
    title: "Responsables, hitos, tareas, materiales y evidencia.",
    record: "El presupuesto aceptado conserva todo su contexto.",
    decision: "El responsable decide prioridades y asignaciones.",
    outcome: "Obra en marcha",
    Icon: ClipboardList,
  },
  {
    id: "compras-costes",
    label: "Compras y costes",
    title: "Tickets, facturas y subcontratas ligados al trabajo.",
    record: "Cada coste propone proveedor, categoría y obra.",
    decision: "Administración valida documento, IVA y relación.",
    outcome: "Margen actualizado",
    Icon: ReceiptText,
  },
  {
    id: "factura-cobro",
    label: "Factura y cobro",
    title: "Vencimiento, pagos parciales y seguimiento.",
    record: "Factura, vencimiento y cobro comparten trazabilidad.",
    decision: "Emitir, compartir o registrar pagos exige confirmación.",
    outcome: "Caja controlada",
    Icon: WalletCards,
  },
] as const;

const labels = stages.map((stage) => stage.label);

export function ImmersiveJourney() {
  return (
    <section id="como-funciona" className={styles.immersiveSection} aria-labelledby="immersive-title">
      <div className={styles.immersiveStoryGrid}>
        <div className={styles.immersiveStoryIntro}>
          <span>Una relación que no se reinicia</span>
          <h2 id="immersive-title">Lo que pasa en la obra sigue hasta el cobro.</h2>
          <p>
            La historia conserva cliente, responsable, fecha, documento y siguiente
            decisión. No es una lista de funciones ni ejecuta acciones reales.
          </p>
          <Link href="/producto">Explorar el producto</Link>
        </div>

        <DemoController labels={labels} interval={9_000} autoplay>
          {({ activeIndex, playing, reducedMotion, select, toggle, previous, next, restart }) => {
            const shownIndex = reducedMotion ? stages.length - 1 : activeIndex;
            const stage = stages[shownIndex];
            return (
              <div className={styles.immersiveExperience} data-reduced-motion={reducedMotion}>
                <JourneyTracker activeIndex={shownIndex} playing={playing} />
                <div className={styles.immersiveTopline}>
                  <div>
                    <span>Historia guiada</span>
                    <strong>Etapa {shownIndex + 1} de {stages.length}</strong>
                  </div>
                  <PlaybackControls
                    playing={playing}
                    onToggle={toggle}
                    onPrevious={previous}
                    onNext={next}
                    onRestart={restart}
                  />
                </div>

                <nav className={styles.immersiveRail} aria-label="Cinco etapas del recorrido">
                  {stages.map((item, index) => {
                    const Icon = item.Icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={shownIndex === index ? "step" : undefined}
                        onClick={() => select(index)}
                      >
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <Icon aria-hidden="true" />
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.title}</small>
                        </span>
                        <em>{item.outcome}</em>
                      </button>
                    );
                  })}
                </nav>

                <div className={styles.immersiveActiveDetail} aria-live="polite">
                  <span>{stage.record}</span>
                  <strong>{stage.decision}</strong>
                </div>

                {reducedMotion ? (
                  <ReducedMotionFallback>
                    Movimiento reducido: las cinco etapas y el estado final permanecen visibles.
                  </ReducedMotionFallback>
                ) : null}
              </div>
            );
          }}
        </DemoController>
      </div>
    </section>
  );
}

function JourneyTracker({ activeIndex, playing }: { activeIndex: number; playing: boolean }) {
  const started = useRef(false);
  const completed = useRef(false);
  useEffect(() => {
    if (playing && !started.current) {
      started.current = true;
      trackPublicFunnel("funnel.quick_demo_started", { mode: "60-90s" });
    }
    if (activeIndex === stages.length - 1 && !completed.current) {
      completed.current = true;
      trackPublicFunnel("funnel.quick_demo_completed", { mode: "60-90s" });
    }
  }, [activeIndex, playing]);
  return null;
}
