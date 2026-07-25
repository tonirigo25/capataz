"use client";

import { ArrowRight } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { journeyStages, type JourneyId } from "./landing-data";
import styles from "../page.module.css";

export function JourneySelector() {
  const [activeId, setActiveId] = useState<JourneyId>("consulta");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectStage = (index: number, focus = false) => {
    const stage = journeyStages[index];
    if (!stage) return;
    setActiveId(stage.id);
    if (focus) tabRefs.current[index]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % journeyStages.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + journeyStages.length) % journeyStages.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = journeyStages.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectStage(nextIndex, true);
  };

  return (
    <div className={styles.journeyExperience}>
      <div
        className={styles.journeyTabs}
        role="tablist"
        aria-label="Etapas del recorrido desde la consulta hasta el cobro"
      >
        {journeyStages.map((stage, index) => (
          <button
            key={stage.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            id={`journey-tab-${stage.id}`}
            type="button"
            role="tab"
            aria-selected={activeId === stage.id}
            aria-controls={`journey-panel-${stage.id}`}
            tabIndex={activeId === stage.id ? 0 : -1}
            onClick={() => selectStage(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {stage.label}
          </button>
        ))}
      </div>

      {journeyStages.map((stage, index) => (
        <div
          key={stage.id}
          id={`journey-panel-${stage.id}`}
          className={styles.journeyPanel}
          role="tabpanel"
          aria-labelledby={`journey-tab-${stage.id}`}
          tabIndex={0}
          hidden={activeId !== stage.id}
        >
          <div className={styles.journeyPanelLead}>
            <span>Etapa {index + 1} de {journeyStages.length}</span>
            <h3>{stage.label}</h3>
            <p>{stage.action}</p>
          </div>

          <dl className={styles.journeyDetails}>
            <div>
              <dt>Información recibida</dt>
              <dd>{stage.received}</dd>
            </div>
            <div>
              <dt>Registro relacionado</dt>
              <dd>{stage.record}</dd>
            </div>
            <div>
              <dt>Responsable</dt>
              <dd>{stage.owner}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd><span>{stage.status}</span></dd>
            </div>
            <div>
              <dt>Acción propuesta</dt>
              <dd>{stage.action}</dd>
            </div>
            <div className={styles.journeyNext}>
              <dt>Siguiente paso</dt>
              <dd>
                {stage.next}
                <ArrowRight aria-hidden="true" />
              </dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  );
}
