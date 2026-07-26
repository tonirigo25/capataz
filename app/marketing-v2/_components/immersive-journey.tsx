"use client";

import { CheckCircle2, CircleDollarSign, ClipboardCheck, FileText, Mic, ReceiptText, Wrench } from "lucide-react";
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
    id: "entrada",
    label: "Audio o mensaje",
    title: "La visita entra con el lenguaje de la obra.",
    description: "Un audio sintético reúne la petición, las medidas conocidas y el plazo deseado.",
    record: "Entrada de ejemplo · 00:38",
    decision: "Todavía no se crea ningún cliente ni trabajo.",
    Icon: Mic,
  },
  {
    id: "interpretacion",
    label: "Interpretación",
    title: "Lo claro se separa de lo que falta.",
    description: "Orqena propone alcance, relaciones y tres datos pendientes para que una persona los complete.",
    record: "Alcance provisional · 3 dudas visibles",
    decision: "Una persona valida cliente, dirección y retirada de residuos.",
    Icon: ClipboardCheck,
  },
  {
    id: "presupuesto",
    label: "Presupuesto",
    title: "Partidas, coste y margen quedan juntos.",
    description: "El presupuesto ficticio muestra cantidades, costes previstos, margen editable y condiciones.",
    record: "PR-0048 · borrador sintético",
    decision: "No se comparte hasta revisar todas las partidas.",
    Icon: CircleDollarSign,
  },
  {
    id: "trabajo",
    label: "Trabajo y agenda",
    title: "El presupuesto aceptado se convierte en plan.",
    description: "La obra reúne responsables, visitas, tareas, cambios y próximos hitos en un solo contexto.",
    record: "Reforma baño · agenda de ejemplo",
    decision: "El responsable decide prioridades y asignaciones.",
    Icon: Wrench,
  },
  {
    id: "coste",
    label: "Ticket y coste",
    title: "La compra llega a la obra correcta.",
    description: "Un ticket ficticio propone proveedor, categoría, importe y relación con el trabajo.",
    record: "Ferretería Norte · 184,32 € de ejemplo",
    decision: "Administración valida documento, IVA, proveedor y obra.",
    Icon: ReceiptText,
  },
  {
    id: "factura",
    label: "Factura y cobro",
    title: "Facturación, vencimiento y cobro comparten trazabilidad.",
    description: "La factura permanece en borrador; el seguimiento económico distingue pendiente, parcial y cobrado.",
    record: "Factura de ejemplo · no emitida",
    decision: "Emitir, compartir o registrar pagos exige confirmación.",
    Icon: FileText,
  },
  {
    id: "revision",
    label: "Revisión y resultado",
    title: "La historia termina con una decisión humana.",
    description: "El equipo ve qué cambió, qué sigue pendiente y de dónde procede cada dato del ejemplo.",
    record: "Resultado sintético · trazabilidad completa",
    decision: "No se afirma ahorro ni resultado real sin una cohorte medida.",
    Icon: CheckCircle2,
  },
] as const;

const labels = stages.map((stage) => stage.label);

export function ImmersiveJourney() {
  return (
    <section id="quick-demo" className={styles.immersiveSection} aria-labelledby="immersive-title">
      <div className={styles.sectionHeading}>
        <span>Demo rápida · 60–90 segundos</span>
        <h2 id="immersive-title">De un audio al cobro, con cada decisión a la vista.</h2>
        <p>
          Siete etapas sintéticas explican el recorrido completo. Puedes pausarlo,
          recorrerlo con teclado o elegir cualquier etapa sin bloquear el scroll.
        </p>
      </div>

      <DemoController labels={labels} interval={9_000} autoplay>
        {({ activeIndex, playing, reducedMotion, select, toggle, previous, next, restart }) => {
          const shownIndex = reducedMotion ? stages.length - 1 : activeIndex;
          const stage = stages[shownIndex];
          const Icon = stage.Icon;
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

              <div className={styles.immersiveLayout}>
                <nav className={styles.immersiveRail} aria-label="Etapas de la demo rápida">
                  {stages.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={shownIndex === index ? "step" : undefined}
                      onClick={() => select(index)}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{item.label}</strong>
                      <small>{item.title}</small>
                    </button>
                  ))}
                </nav>

                <div className={styles.immersiveCanvas} aria-live="polite">
                  <div className={styles.immersiveProgress} aria-hidden="true">
                    <span style={{ width: `${((shownIndex + 1) / stages.length) * 100}%` }} />
                  </div>
                  <div className={styles.immersiveCanvasHeading}>
                    <Icon aria-hidden="true" />
                    <div>
                      <span>{stage.label}</span>
                      <h3>{stage.title}</h3>
                    </div>
                  </div>
                  <p>{stage.description}</p>
                  <dl>
                    <div>
                      <dt>Registro visible</dt>
                      <dd>{stage.record}</dd>
                    </div>
                    <div>
                      <dt>Control humano</dt>
                      <dd>{stage.decision}</dd>
                    </div>
                  </dl>
                  <div className={styles.immersiveTrace}>
                    {stages.map((item, index) => (
                      <span key={item.id} data-complete={index <= shownIndex}>
                        <i>{index + 1}</i>
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <ol className={styles.immersiveMobileCards}>
                {stages.map((item, index) => {
                  const MobileIcon = item.Icon;
                  return (
                    <li id={`journey-stage-${item.id}`} className={styles.immersiveStageCard} key={item.id}>
                      <div><MobileIcon aria-hidden="true" /><span>{String(index + 1).padStart(2, "0")}</span></div>
                      <h3>{item.label}</h3>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                      <small>{item.decision}</small>
                    </li>
                  );
                })}
              </ol>

              {reducedMotion ? (
                <ReducedMotionFallback>
                  Movimiento reducido: el estado final y las siete tarjetas permanecen visibles.
                </ReducedMotionFallback>
              ) : null}
            </div>
          );
        }}
      </DemoController>
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
