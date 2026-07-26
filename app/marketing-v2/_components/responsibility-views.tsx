"use client";

import { ArrowRight, LockKeyhole } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { responsibilityViews, type ResponsibilityId } from "./landing-data";
import styles from "../page.module.css";

export function ResponsibilityViews() {
  const [activeId, setActiveId] = useState<ResponsibilityId>("propietario");
  const [actionNotice, setActionNotice] = useState("");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectView = (index: number, focus = false) => {
    const view = responsibilityViews[index];
    if (!view) return;
    setActiveId(view.id);
    setActionNotice("");
    if (focus) tabRefs.current[index]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % responsibilityViews.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + responsibilityViews.length) % responsibilityViews.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = responsibilityViews.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectView(nextIndex, true);
  };

  return (
    <div className={styles.responsibilityDemo}>
      <div
        className={styles.responsibilityTabs}
        role="tablist"
        aria-label="Vistas por responsabilidad"
      >
        {responsibilityViews.map((view, index) => (
          <button
            key={view.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            id={`responsibility-tab-${view.id}`}
            type="button"
            role="tab"
            aria-selected={activeId === view.id}
            aria-controls={`responsibility-panel-${view.id}`}
            tabIndex={activeId === view.id ? 0 : -1}
            onClick={() => selectView(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {view.label}
          </button>
        ))}
      </div>

      {responsibilityViews.map((view) => (
        <div
          key={view.id}
          id={`responsibility-panel-${view.id}`}
          className={styles.responsibilityPanel}
          role="tabpanel"
          aria-labelledby={`responsibility-tab-${view.id}`}
          tabIndex={0}
          hidden={activeId !== view.id}
        >
          <aside aria-label={`Navegación local de ${view.label}`}>
            <span>Vista de ejemplo</span>
            <strong>{view.label}</strong>
            <nav aria-label={`Áreas visibles para ${view.label}`} tabIndex={0}>
              {view.areas.map((area, index) => (
                <span key={area} data-active={index === 0}>{area}</span>
              ))}
            </nav>
          </aside>

          <div className={styles.responsibilityContent}>
            <div className={styles.responsibilityHeading}>
              <div>
                <span>Prioridad de esta vista</span>
                <h3>{view.primaryAction}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActionNotice(
                    `${view.primaryAction}. Demostración local: no se ha modificado ningún dato.`,
                  );
                }}
              >
                Abrir acción local
                <ArrowRight aria-hidden="true" />
              </button>
            </div>

            <div className={styles.pendingList}>
              <span>Pendientes visibles</span>
              <ol>
                {view.pending.map((item, index) => (
                  <li key={item}>
                    <span>{index + 1}</span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>

            <p className={styles.accessLevel}>
              <LockKeyhole aria-hidden="true" />
              <span>
                <strong>Nivel de acceso</strong>
                {view.access}
              </span>
            </p>

            {actionNotice && activeId === view.id ? (
              <p className={styles.responsibilityStatus} role="status" aria-live="polite">
                {actionNotice}
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
