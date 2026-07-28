"use client";

import { CheckCircle2 } from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import styles from "../page.module.css";

type FieldName = "name" | "email" | "company" | "teamSize" | "problem";
type FormErrors = Partial<Record<FieldName, string>>;

const fieldOrder: readonly FieldName[] = ["name", "email", "company", "teamSize", "problem"];

export function LocalAccessForm() {
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const nextErrors: FormErrors = {};
    const name = String(values.get("name") ?? "").trim();
    const email = String(values.get("email") ?? "").trim();
    const company = String(values.get("company") ?? "").trim();
    const teamSize = String(values.get("teamSize") ?? "");
    const problem = String(values.get("problem") ?? "");

    if (name.length < 2) nextErrors.name = "Escribe un nombre de al menos dos caracteres.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = "Escribe un correo válido.";
    if (company.length < 2) nextErrors.company = "Escribe el nombre de la empresa.";
    if (!teamSize) nextErrors.teamSize = "Selecciona el tamaño del equipo.";
    if (!problem) nextErrors.problem = "Selecciona el principal problema.";

    setErrors(nextErrors);

    const firstError = fieldOrder.find((field) => nextErrors[field]);
    if (firstError) {
      setSubmitted(false);
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>(`[name="${firstError}"]`)?.focus();
      });
      return;
    }

    setSubmitted(true);
    requestAnimationFrame(() => {
      document.getElementById("local-form-status")?.focus();
    });
  };

  const clearSubmittedState = () => {
    if (submitted) setSubmitted(false);
  };

  return (
    <form
      ref={formRef}
      className={styles.accessForm}
      noValidate
      onSubmit={handleSubmit}
      onChange={clearSubmittedState}
    >
      <div className={styles.formGrid}>
        <FormField
          id="access-name"
          label="Nombre"
          error={errors.name}
        >
          <input
            id="access-name"
            name="name"
            type="text"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "access-name-error" : undefined}
          />
        </FormField>

        <FormField
          id="access-email"
          label="Correo"
          error={errors.email}
        >
          <input
            id="access-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "access-email-error" : undefined}
          />
        </FormField>

        <FormField
          id="access-company"
          label="Empresa"
          error={errors.company}
        >
          <input
            id="access-company"
            name="company"
            type="text"
            autoComplete="organization"
            aria-invalid={Boolean(errors.company)}
            aria-describedby={errors.company ? "access-company-error" : undefined}
          />
        </FormField>

        <FormField
          id="access-team-size"
          label="Tamaño del equipo"
          error={errors.teamSize}
        >
          <select
            id="access-team-size"
            name="teamSize"
            defaultValue=""
            aria-invalid={Boolean(errors.teamSize)}
            aria-describedby={errors.teamSize ? "access-team-size-error" : undefined}
          >
            <option value="" disabled>Selecciona una opción</option>
            <option value="1">1</option>
            <option value="2-5">2–5</option>
            <option value="6-15">6–15</option>
            <option value="16-25">16–25</option>
            <option value="25+">Más de 25</option>
          </select>
        </FormField>

        <FormField
          id="access-problem"
          label="Principal problema"
          error={errors.problem}
          wide
        >
          <select
            id="access-problem"
            name="problem"
            defaultValue=""
            aria-invalid={Boolean(errors.problem)}
            aria-describedby={errors.problem ? "access-problem-error" : undefined}
          >
            <option value="" disabled>Selecciona una opción</option>
            <option value="presupuestos">Presupuestos</option>
            <option value="control-obra">Control de obra</option>
            <option value="gastos-margen">Gastos y margen</option>
            <option value="facturacion-cobros">Facturación y cobros</option>
            <option value="otro">Otro</option>
          </select>
        </FormField>
      </div>

      <div className={styles.formFooter}>
        <p>Este formulario funciona solo en tu navegador. No conecta con ningún servicio.</p>
        <button type="submit">Preparar solicitud local</button>
      </div>

      {submitted ? (
        <p
          id="local-form-status"
          className={styles.formSuccess}
          role="status"
          aria-live="polite"
          tabIndex={-1}
        >
          <CheckCircle2 aria-hidden="true" />
          Demostración del formulario. No se ha enviado ni guardado ningún dato.
        </p>
      ) : null}
    </form>
  );
}

type FormFieldProps = {
  id: string;
  label: string;
  error?: string;
  wide?: boolean;
  children: ReactNode;
};

function FormField({ id, label, error, wide = false, children }: FormFieldProps) {
  return (
    <div className={styles.formField} data-wide={wide}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <p id={`${id}-error`} className={styles.fieldError}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
