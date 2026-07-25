"use client";

import { CheckCircle2, Pencil, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import styles from "../page.module.css";

type ControlState = "idle" | "editing" | "cancelled" | "confirmed";

const stateMessages: Record<Exclude<ControlState, "idle">, string> = {
  editing: "Edición local abierta. Revisa los datos claros y dudosos antes de decidir.",
  cancelled: "Demostración cancelada. No se ha guardado ni enviado ningún dato.",
  confirmed: "Demostración local. No se ha guardado ni enviado ningún dato.",
};

export function HumanControlDemo() {
  const [state, setState] = useState<ControlState>("idle");

  return (
    <div className={styles.controlDemo}>
      <div className={styles.controlSummary}>
        <div className={styles.controlSummaryTop}>
          <span>Confirmación antes de actuar</span>
          <strong data-state={state}>
            {state === "idle" ? "Esperando tu decisión" : stateMessages[state].split(".")[0]}
          </strong>
        </div>

        <div className={styles.controlAction}>
          <span>Acción propuesta</span>
          <h3>Crear partidas en un presupuesto</h3>
          <p>
            Al confirmar se crearán 12 partidas en el presupuesto PR-0048.
            No se enviará nada al cliente.
          </p>
        </div>

        <dl className={styles.controlFacts}>
          <div>
            <dt>Registro afectado</dt>
            <dd>Presupuesto PR-0048 · Reforma baño</dd>
          </div>
          <div>
            <dt>Fuentes utilizadas</dt>
            <dd>Audio transcrito y datos de la obra de ejemplo</dd>
          </div>
          <div data-kind="clear">
            <dt>Datos claros</dt>
            <dd>Baño de 8 m², demolición, fontanería, alicatado, sanitarios y pintura</dd>
          </div>
          <div data-kind="doubt">
            <dt>Datos dudosos</dt>
            <dd>Retirada de escombros y modelo final de sanitarios</dd>
          </div>
        </dl>
      </div>

      <div className={styles.controlChanges}>
        <section aria-labelledby="control-create-title">
          <span aria-hidden="true">+</span>
          <div>
            <h4 id="control-create-title">Campos que se crearán</h4>
            <ul>
              <li>12 partidas con descripción y cantidad</li>
              <li>Condiciones del borrador</li>
              <li>Dos dudas para revisión</li>
            </ul>
          </div>
        </section>
        <section aria-labelledby="control-update-title">
          <span aria-hidden="true">↻</span>
          <div>
            <h4 id="control-update-title">Campos que se modificarán</h4>
            <ul>
              <li>Total provisional del presupuesto</li>
              <li>Estado: borrador pendiente de revisión</li>
            </ul>
          </div>
        </section>
        <section className={styles.controlBlocked} aria-labelledby="control-blocked-title">
          <span aria-hidden="true">—</span>
          <div>
            <h4 id="control-blocked-title">Acción que todavía no ocurrirá</h4>
            <p>No se enviará el presupuesto ni se notificará al cliente.</p>
          </div>
        </section>
      </div>

      <div className={styles.controlActions}>
        {state === "cancelled" || state === "confirmed" ? (
          <button type="button" onClick={() => setState("idle")}>
            <RotateCcw aria-hidden="true" />
            Reiniciar demostración
          </button>
        ) : (
          <>
            <button type="button" onClick={() => setState("editing")}>
              <Pencil aria-hidden="true" />
              Editar
            </button>
            <button type="button" onClick={() => setState("cancelled")}>
              <X aria-hidden="true" />
              Cancelar
            </button>
            <button className={styles.confirmAction} type="button" onClick={() => setState("confirmed")}>
              <CheckCircle2 aria-hidden="true" />
              Confirmar demostración
            </button>
          </>
        )}
      </div>

      {state !== "idle" ? (
        <p className={styles.controlStatus} role="status" aria-live="polite">
          {stateMessages[state]}
        </p>
      ) : null}
    </div>
  );
}
