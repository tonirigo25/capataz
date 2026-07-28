"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { trackPublicFunnel } from "@/lib/product/public-analytics";

type FormKind = "home" | "contact" | "demo";
type FormStatus = "idle" | "submitting" | "success" | "error" | "rate-limited";

export function DemoRequestForm({ kind = "demo" }: { kind?: FormKind }) {
  const [status, setStatus] = useState<FormStatus>("idle");
  const started = useRef(false);
  const title = kind === "contact" ? "Hablemos de tu operación" : "Solicita una demostración";

  const trackStartAfterConsent = (form: HTMLFormElement) => {
    if (started.current || !new FormData(form).has("consent")) return;
    started.current = true;
    trackPublicFunnel("funnel.contact_form_started", { form: kind }, true);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    trackStartAfterConsent(form);
    setStatus("submitting");
    const payload = Object.fromEntries(new FormData(form).entries());
    const attribution = currentAttribution();
    try {
      const response = await fetch("/api/demo-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, ...attribution, kind, source: kind }),
      });
      await response.json() as { error?: string };
      if (!response.ok) {
        const limited = response.status === 429;
        setStatus(limited ? "rate-limited" : "error");
        trackPublicFunnel("funnel.contact_form_error", { form: kind, error: limited ? "rate_limited" : "server" }, true);
        return;
      }
      setStatus("success");
      trackPublicFunnel("funnel.contact_form_success", { form: kind }, true);
      form.reset();
    } catch {
      setStatus("error");
      trackPublicFunnel("funnel.contact_form_error", { form: kind, error: "network" }, true);
    }
  }

  if (status === "success") {
    return (
      <div className="marketing-form-success" role="status" tabIndex={-1}>
        <CheckCircle2 size={28} aria-hidden="true" />
        <div>
          <h2 className="text-xl font-black">Hemos recibido tu solicitud.</h2>
          <p className="mt-2 text-sm leading-6 text-content-secondary">
            La revisión es manual y no hay un SLA público comprometido. Te responderemos por el correo indicado para acordar un siguiente paso real.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      className="marketing-form"
      onSubmit={submit}
      onChange={(event) => trackStartAfterConsent(event.currentTarget)}
    >
      <div>
        <p className="marketing-eyebrow">{kind === "contact" ? "Contacto" : "Demo personalizada"}</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-content-secondary">
          Cuéntanos lo justo para preparar una conversación útil. El envío se registra de forma segura; el email live permanece desactivado.
        </p>
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <label className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
          <span>Sitio web</span>
          <input name="website" type="text" autoComplete="off" tabIndex={-1} />
        </label>
        <Field label="Nombre" name="name" autoComplete="name" required />
        <Field label="Email profesional" name="email" type="email" autoComplete="email" required />
        <Field label="Empresa" name="company" autoComplete="organization" required />
        <label className="marketing-field">
          <span>Sector</span>
          <select name="sector" required defaultValue="">
            <option value="" disabled>Selecciona un sector</option>
            <option value="construction">Construcción y reformas</option>
            <option value="installations">Instalaciones y mantenimiento</option>
            <option value="other">Otro</option>
          </select>
        </label>
        <label className="marketing-field">
          <span>Tamaño del equipo</span>
          <select name="companySize" required defaultValue="">
            <option value="" disabled>Selecciona una opción</option>
            <option value="1">1 persona</option>
            <option value="2-5">2–5 personas</option>
            <option value="6-10">6–10 personas</option>
            <option value="11-20">11–20 personas</option>
          </select>
        </label>
        <label className="marketing-field sm:col-span-2">
          <span>¿Qué necesitas ordenar?</span>
          <textarea name="need" rows={4} maxLength={1500} required placeholder="Presupuestos, obras, gastos, facturas, cobros…" />
        </label>
      </div>
      <label className="mt-5 flex items-start gap-3 text-sm leading-5 text-content-secondary">
        <input className="mt-1 h-4 w-4 accent-brand" name="consent" type="checkbox" value="true" required />
        <span>
          Acepto que Orqena use estos datos para responder a esta solicitud, conforme a su{" "}
          <a className="font-semibold text-brand-strong underline" href="/privacidad">política de privacidad</a>.
        </span>
      </label>
      {status === "error" ? (
        <p className="mt-4 text-sm font-medium text-danger" role="alert">
          No hemos podido registrar la solicitud. Revisa la conexión e inténtalo de nuevo.
        </p>
      ) : null}
      {status === "rate-limited" ? (
        <p className="mt-4 text-sm font-medium text-danger" role="alert">
          Ya hemos recibido varias solicitudes recientes. Espera antes de volver a intentarlo; no se ha creado un duplicado.
        </p>
      ) : null}
      <button className="marketing-button mt-6 w-full sm:w-auto" type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : null}
        {status === "submitting" ? "Enviando…" : "Solicitar demo"}
      </button>
    </form>
  );
}

function currentAttribution() {
  const parameters = new URLSearchParams(window.location.search);
  let referrerHost: string | undefined;
  try {
    referrerHost = document.referrer ? new URL(document.referrer).host : undefined;
  } catch {
    referrerHost = undefined;
  }
  return {
    utmSource: parameters.get("utm_source") ?? undefined,
    utmMedium: parameters.get("utm_medium") ?? undefined,
    utmCampaign: parameters.get("utm_campaign") ?? undefined,
    utmTerm: parameters.get("utm_term") ?? undefined,
    utmContent: parameters.get("utm_content") ?? undefined,
    landingPath: window.location.pathname,
    referrerHost,
    consentVersion: "1.0",
  };
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="marketing-field">
      <span>{label}</span>
      <input name={name} type={type} autoComplete={autoComplete} maxLength={type === "email" ? 320 : 140} required={required} />
    </label>
  );
}
