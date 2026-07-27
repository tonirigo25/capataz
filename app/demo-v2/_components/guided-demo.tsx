"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FilePenLine,
  HardHat,
  LockKeyhole,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  createInitialValues,
  demoSteps,
  scenarios,
  type EditableField,
  type ScenarioId,
} from "./scenarios";
import styles from "../page.module.css";
import { brand } from "@/lib/brand";
import { journeyStages } from "@/app/marketing-v2/_components/landing-data";

const scenarioIcons = {
  presupuesto: FilePenLine,
  gasto: ReceiptText,
  obra: HardHat,
} as const;

const initialConfirmed: Record<ScenarioId, boolean> = {
  presupuesto: false,
  gasto: false,
  obra: false,
};

export function GuidedDemo() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("presupuesto");
  const [step, setStep] = useState(0);
  const [values, setValues] = useState(createInitialValues);
  const [confirmed, setConfirmed] = useState(initialConfirmed);
  const [status, setStatus] = useState("Escenario Presupuesto preparado.");
  const panelRef = useRef<HTMLElement>(null);
  const stepRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const shouldFocusPanel = useRef(false);

  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
  const currentValues = values[scenarioId];

  useEffect(() => {
    if (!shouldFocusPanel.current) return;
    shouldFocusPanel.current = false;
    requestAnimationFrame(() => panelRef.current?.focus());
  }, [scenarioId, step]);

  const selectScenario = (nextId: ScenarioId) => {
    const nextScenario = scenarios.find((item) => item.id === nextId);
    shouldFocusPanel.current = true;
    setScenarioId(nextId);
    setStep(0);
    setStatus(`Escenario ${nextScenario?.shortLabel ?? ""} preparado. Paso 1 de 6: Entrada.`);
  };

  const selectStep = (nextStep: number, focusStep = false) => {
    if (nextStep < 0 || nextStep >= demoSteps.length) return;
    if (nextStep === 5 && !confirmed[scenarioId]) {
      setStatus("Confirma la simulación antes de consultar el resultado.");
      return;
    }
    shouldFocusPanel.current = !focusStep;
    setStep(nextStep);
    setStatus(`Paso ${nextStep + 1} de 6: ${demoSteps[nextStep]}.`);
    if (focusStep) requestAnimationFrame(() => stepRefs.current[nextStep]?.focus());
  };

  const handleStepKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = Math.min(index + 1, demoSteps.length - 1);
    if (event.key === "ArrowLeft") nextIndex = Math.max(index - 1, 0);
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = confirmed[scenarioId] ? demoSteps.length - 1 : 4;
    if (nextIndex === null) return;
    event.preventDefault();
    selectStep(nextIndex, true);
  };

  const updateField = (field: EditableField, value: string) => {
    setValues((current) => ({
      ...current,
      [scenarioId]: {
        ...current[scenarioId],
        [field]: value,
      },
    }));
    setConfirmed((current) => ({ ...current, [scenarioId]: false }));
  };

  const resetScenario = () => {
    const defaults = createInitialValues();
    shouldFocusPanel.current = true;
    setValues((current) => ({ ...current, [scenarioId]: defaults[scenarioId] }));
    setConfirmed((current) => ({ ...current, [scenarioId]: false }));
    setStep(0);
    setStatus(`${scenario.shortLabel} reiniciado con sus datos de ejemplo.`);
  };

  const confirmSimulation = () => {
    setConfirmed((current) => ({ ...current, [scenarioId]: true }));
    setStatus("Confirmación simulada registrada. No se ha guardado ni enviado ningún dato.");
  };

  return (
    <div className={styles.demoPage}>
      <a className={styles.skipLink} href="#guided-demo">
        Saltar a la demostración
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.wordmark} href="/" aria-label={`${brand.productName}, volver a la portada`}>
            {brand.wordmark}
          </Link>
          <span className={styles.localBadge}>
            <LockKeyhole aria-hidden="true" />
            Demo guiada · local
          </span>
          <Link className={styles.backLink} href="/" aria-label="Volver a la portada">
            <ArrowLeft aria-hidden="true" />
            <span>Volver a la portada</span>
          </Link>
        </div>
      </header>

      <main id="guided-demo" className={styles.main} tabIndex={-1}>
        <section id="quick-demo" className={styles.intro} aria-labelledby="demo-v2-title">
          <div>
            <p className={styles.eyebrow}>Demostración guiada · 7 minutos</p>
            <h1 id="demo-v2-title">Prueba una historia completa.</h1>
            <p className={styles.introText}>
              Elige una entrada y recorre el flujo hasta el resultado. Todo es sintético,
              editable y local; no necesitas registrarte.
            </p>
          </div>
          <div className={styles.safetyColumn}>
            <Link className={styles.realDemoCta} href="/contacto">Solicitar una demo real</Link>
            <div className={styles.safetyNote}>
              <ShieldCheck aria-hidden="true" />
              <p>
                <strong>Sin registro y con datos de ejemplo.</strong>
                No se guarda, no se envía y no conecta con ningún servicio externo.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.scenarioSection} aria-labelledby="journey-title">
          <div className={styles.sectionLead}>
            <span>Historia completa · 7 minutos</span>
            <h2 id="journey-title">Del primer contacto al cobro, sin saltos.</h2>
          </div>
          <ol className={styles.journeyTimeline} data-canonical-journey="lead-visita-presupuesto-trabajo-gasto-factura-cobro">
            {journeyStages.map((stage, index) => (
              <li key={stage.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{stage.label}</strong>
                <small>{stage.action}</small>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.scenarioSection} aria-labelledby="scenario-title">
          <div className={styles.sectionLead}>
            <span>Elige una situación</span>
            <h2 id="scenario-title">Empieza por lo que necesitas resolver.</h2>
          </div>
          <div className={styles.scenarioGrid}>
            {scenarios.map((item, index) => {
              const Icon = scenarioIcons[item.id];
              const active = scenarioId === item.id;
              return (
                <button
                  key={item.id}
                  className={styles.scenarioCard}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectScenario(item.id)}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Icon aria-hidden="true" />
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                  <CheckCircle2 aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.workspace} aria-label={`Demostración de ${scenario.label}`}>
          <div className={styles.workspaceTop}>
            <div>
              <span>Escenario activo</span>
              <strong>{scenario.label}</strong>
            </div>
            <span aria-live="polite">Paso {step + 1} de {demoSteps.length}</span>
          </div>

          <nav className={styles.stepNav} aria-label="Pasos de la demostración">
            <ol>
              {demoSteps.map((label, index) => {
                const current = index === step;
                const completed = index < step || (index === 5 && confirmed[scenarioId]);
                const locked = index === 5 && !confirmed[scenarioId];
                return (
                  <li key={label}>
                    <button
                      ref={(element) => { stepRefs.current[index] = element; }}
                      type="button"
                      aria-current={current ? "step" : undefined}
                      disabled={locked}
                      data-completed={completed}
                      onClick={() => selectStep(index)}
                      onKeyDown={(event) => handleStepKey(event, index)}
                    >
                      <span aria-hidden="true">
                        {completed ? <CheckCircle2 /> : String(index + 1).padStart(2, "0")}
                      </span>
                      {label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className={styles.panelShell}>
            <StepPanel
              ref={panelRef}
              scenario={scenario}
              step={step}
              values={currentValues}
              confirmed={confirmed[scenarioId]}
              onUpdate={updateField}
              onConfirm={confirmSimulation}
              onEditStatus={() => setStatus("Cambios locales preparados para revisar.")}
            />

            <div className={styles.controls} aria-label="Controles de la demostración">
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => selectStep(step - 1)}
                disabled={step === 0}
              >
                <ArrowLeft aria-hidden="true" />
                Anterior
              </button>
              <button className={styles.resetButton} type="button" onClick={resetScenario}>
                <RotateCcw aria-hidden="true" />
                Reiniciar escenario
              </button>
              {step < demoSteps.length - 1 ? (
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={() => selectStep(step + 1)}
                  disabled={step === 4 && !confirmed[scenarioId]}
                >
                  Siguiente
                  <ArrowRight aria-hidden="true" />
                </button>
              ) : (
                <button className={styles.primaryButton} type="button" onClick={() => selectStep(0)}>
                  Ver de nuevo
                  <RotateCcw aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </section>

        <p className={styles.status} role="status" aria-live="polite">
          {status}
        </p>

        <footer className={styles.footer}>
          <div>
            <strong>{brand.productName}</strong>
            <span>Demostración aislada con datos ficticios.</span>
          </div>
          <Link href="/">Volver a la portada comercial</Link>
        </footer>
      </main>
    </div>
  );
}

type StepPanelProps = {
  scenario: (typeof scenarios)[number];
  step: number;
  values: ReturnType<typeof createInitialValues>[ScenarioId];
  confirmed: boolean;
  onUpdate: (field: EditableField, value: string) => void;
  onConfirm: () => void;
  onEditStatus: () => void;
};

const StepPanel = forwardRef<HTMLElement, StepPanelProps>(function StepPanel(
  { scenario, step, values, confirmed, onUpdate, onConfirm, onEditStatus },
  ref,
) {
  const titleId = `demo-step-${step}-title`;

  return (
    <article
      ref={ref}
      className={styles.stepPanel}
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <div className={styles.panelHeading}>
        <span>Paso {step + 1} de 6</span>
        <h2 id={titleId}>{demoSteps[step]}</h2>
        <p>{stepDescriptions[step]}</p>
      </div>

      {step === 0 ? (
        <div className={styles.inputPreview}>
          <div>
            <Sparkles aria-hidden="true" />
            <span>Entrada de ejemplo</span>
          </div>
          <blockquote>{scenario.input}</blockquote>
          <p>Texto ficticio preparado para esta demostración. No activa micrófono, cámara ni archivos.</p>
        </div>
      ) : null}

      {step === 1 ? (
        <dl className={styles.factGrid}>
          {scenario.interpretation.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {step === 2 ? (
        <div className={styles.proposalGrid}>
          {scenario.proposal.map((item, index) => (
            <div key={item.label}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <small>{item.label}</small>
                <strong>{item.value}</strong>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {step === 3 ? (
        <form className={styles.reviewForm} onSubmit={(event) => event.preventDefault()}>
          <div className={styles.reviewIntro}>
            <ClipboardCheck aria-hidden="true" />
            <p>
              <strong>Revisa los datos antes de continuar.</strong>
              Los cambios permanecen únicamente en memoria y se borran al recargar.
            </p>
          </div>
          <div className={styles.fieldGrid}>
            {scenario.editableFields.map((field) => (
              <label key={field.id}>
                <span>{field.label}</span>
                <input
                  name={`${scenario.id}-${field.id}`}
                  type="text"
                  inputMode={field.inputMode}
                  value={values[field.id]}
                  onChange={(event) => onUpdate(field.id, event.target.value)}
                  onBlur={onEditStatus}
                />
              </label>
            ))}
          </div>
        </form>
      ) : null}

      {step === 4 ? (
        <div className={styles.confirmation}>
          <div className={styles.confirmationMark}>
            <ShieldCheck aria-hidden="true" />
            <span>{confirmed ? "Confirmación simulada" : "Esperando tu decisión"}</span>
          </div>
          <h3>Esto es exactamente lo que ocurriría.</h3>
          <p>{scenario.confirmation(values)}</p>
          <div className={styles.notHappening}>
            <LockKeyhole aria-hidden="true" />
            <span>
              <strong>No ocurrirá ninguna acción real.</strong>
              No se guarda, no se envía y no se llama a ningún servicio.
            </span>
          </div>
          <button
            className={styles.confirmButton}
            type="button"
            onClick={onConfirm}
            disabled={confirmed}
          >
            <CheckCircle2 aria-hidden="true" />
            {confirmed ? "Simulación confirmada" : "Confirmar simulación"}
          </button>
        </div>
      ) : null}

      {step === 5 ? (
        <div className={styles.result}>
          <div>
            <CheckCircle2 aria-hidden="true" />
          </div>
          <span>Resultado simulado</span>
          <h3>{scenario.result}</h3>
          <p>
            La demostración termina aquí. Los valores utilizados siguen únicamente
            en memoria hasta que cambies de página o recargues.
          </p>
          <dl>
            <div>
              <dt>Obra</dt>
              <dd>{values.work}</dd>
            </div>
            <div>
              <dt>Importe</dt>
              <dd>{values.amount}</dd>
            </div>
          </dl>
          <Link className={styles.resultCta} href="/contacto">Solicitar una demo real</Link>
        </div>
      ) : null}
    </article>
  );
});

const stepDescriptions = [
  "La información llega en el lenguaje habitual del trabajo.",
  `${brand.productName} separa hechos, relaciones y dudas antes de proponer.`,
  "La acción queda preparada sin ejecutarse automáticamente.",
  "Puedes ajustar los campos sencillos antes de decidir.",
  "Revisa el efecto exacto y confirma solo la simulación.",
  "Comprueba el resultado preparado y su trazabilidad local.",
] as const;
