"use client";

import { Camera, FileText, MessageSquareText, Mic, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { demoScenarios, type DemoId } from "./demo-data";
import styles from "../page.module.css";
import { brand } from "@/lib/brand";
import { trackPublicFunnel } from "@/lib/product/public-analytics";

type LocalAction = "idle" | "reviewing" | "editing" | "discarded";

const actionLabels: Record<Exclude<LocalAction, "idle">, string> = {
  reviewing: "Revisando",
  editing: "Editando",
  discarded: "Descartado",
};

const icons = {
  audio: Mic,
  foto: Camera,
  factura: FileText,
  mensaje: MessageSquareText,
} as const;

const initialActions: Record<DemoId, LocalAction> = {
  audio: "idle",
  foto: "idle",
  factura: "idle",
  mensaje: "idle",
};

export function HeroDemo() {
  const [activeId, setActiveId] = useState<DemoId>("audio");
  const [actions, setActions] = useState(initialActions);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activeAction = actions[activeId];

  const selectTab = (index: number, focus = false) => {
    const next = demoScenarios[index];
    if (!next) return;
    setActiveId(next.id);
    if (focus) tabRefs.current[index]?.focus();
  };

  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % demoScenarios.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + demoScenarios.length) % demoScenarios.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = demoScenarios.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectTab(nextIndex, true);
  };

  const setLocalAction = (action: LocalAction) => {
    setActions((current) => ({ ...current, [activeId]: action }));
  };

  return (
    <section className={styles.hero} aria-labelledby="public-hero-title">
      <div className={styles.heroGrid}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>IA práctica para construcción y reformas</p>
          <h1 id="public-hero-title">Habla con {brand.productName}. Tu negocio se pone al día.</h1>
          <p className={styles.heroSubtitle}>
            Manda un audio, una foto, una factura o un mensaje. {brand.productName} prepara
            presupuestos, registra gastos, actualiza obras y te avisa de cobros,
            documentos y márgenes. Tú revisas y decides.
          </p>

          <div className={styles.heroActions} aria-label="Acciones principales">
            <a
              className={styles.primaryAction}
              href="#public-demo"
              onClick={() => trackPublicFunnel("funnel.hero_cta", { target: "quick_demo" })}
            >
              <Mic aria-hidden="true" />
              Ver un ejemplo con audio
            </a>
            <Link
              className={styles.secondaryAction}
              href="/contacto"
              onClick={() => trackPublicFunnel("funnel.hero_cta", { target: "contact" })}
            >
              Solicitar demo
            </Link>
            <Link
              className={styles.secondaryAction}
              href="/demo#quick-demo"
              onClick={() => trackPublicFunnel("funnel.hero_cta", { target: "deep_demo" })}
            >
              Demo rápida de 90 s
            </Link>
          </div>

          <p className={styles.demoNote}>
            <ShieldCheck aria-hidden="true" />
            Demo con datos de ejemplo. Nada se guarda ni se envía.
          </p>
        </div>

        <div className={styles.demoShell}>
          <div className={styles.demoTopline}>
            <div>
              <span>Vista previa local</span>
              <strong>{brand.productName} prepara. Tú decides.</strong>
            </div>
            <span className={styles.localBadge}>Sin conexión</span>
          </div>

          <div id="public-demo" className={styles.tabs} data-active-tab={activeId}>
            <div className={styles.tabList} role="tablist" aria-label="Tipo de entrada para la demostración">
              {demoScenarios.map((scenario, index) => {
                const Icon = icons[scenario.id];
                const selected = activeId === scenario.id;
                return (
                  <button
                    key={scenario.id}
                    ref={(element) => { tabRefs.current[index] = element; }}
                    id={`demo-tab-${scenario.id}`}
                    role="tab"
                    type="button"
                    aria-selected={selected}
                    aria-controls={`demo-panel-${scenario.id}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectTab(index)}
                    onKeyDown={(event) => handleTabKey(event, index)}
                  >
                    <Icon aria-hidden="true" />
                    <span>{scenario.label}</span>
                  </button>
                );
              })}
            </div>

            {demoScenarios.map((scenario) => {
              const selected = activeId === scenario.id;
              return (
                <div
                  key={scenario.id}
                  id={`demo-panel-${scenario.id}`}
                  className={styles.tabPanel}
                  role="tabpanel"
                  aria-labelledby={`demo-tab-${scenario.id}`}
                  hidden={!selected}
                  tabIndex={0}
                >
                  {selected ? (
                    <>
                      <div className={styles.inputCard}>
                        <span>{scenario.inputLabel}</span>
                        {scenario.fictitiousVisual ? <FictitiousReceipt /> : null}
                        <p>{scenario.input}</p>
                      </div>

                      <div className={activeAction === "discarded" ? styles.proposalDiscarded : styles.proposalCard}>
                        <div className={styles.proposalHeading}>
                          <span>Propuesta preparada</span>
                          {activeAction !== "idle" ? <strong>{actionLabels[activeAction]}</strong> : null}
                        </div>

                        {activeAction === "discarded" ? (
                          <div className={styles.discardedState}>
                            <p>Este ejemplo se ha descartado solo en la demostración.</p>
                            <button type="button" onClick={() => setLocalAction("idle")}>
                              <RotateCcw aria-hidden="true" />
                              Restaurar ejemplo
                            </button>
                          </div>
                        ) : (
                          <>
                            <dl className={styles.resultList}>
                              {scenario.details.map((detail) => (
                                <div key={detail.label}>
                                  <dt>{detail.label}</dt>
                                  <dd data-emphasis={detail.emphasis}>{detail.value}</dd>
                                </div>
                              ))}
                            </dl>

                            <div className={styles.proposalActions}>
                              <button className={styles.reviewAction} type="button" onClick={() => setLocalAction("reviewing")}>
                                {scenario.primaryAction}
                              </button>
                              <button type="button" onClick={() => setLocalAction("editing")}>Editar</button>
                              <button type="button" onClick={() => setLocalAction("discarded")}>Descartar</button>
                            </div>
                          </>
                        )}
                      </div>

                      {activeAction !== "idle" ? (
                        <p className={styles.localMessage} role="status" aria-live="polite">
                          Demostración local. No se ha guardado ni enviado ningún dato.
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function FictitiousReceipt() {
  return (
    <div className={styles.fictitiousReceipt} aria-label="Representación ficticia de un ticket, no es una imagen subida">
      <span />
      <span />
      <span />
      <small>Ejemplo</small>
    </div>
  );
}
