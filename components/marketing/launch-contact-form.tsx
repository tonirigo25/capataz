"use client";

import { FormEvent, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";

type ContactState = "idle" | "submitting" | "success" | "invalid" | "error";

export function LaunchContactForm() {
  const [state, setState] = useState<ContactState>("idle");
  const renderedAt = useRef(Date.now());

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/marketing/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, renderedAt: renderedAt.current }),
      });
      if (response.status === 400) {
        setState("invalid");
        return;
      }
      if (!response.ok) throw new Error("CONTACT_REQUEST_FAILED");
      form.reset();
      renderedAt.current = Date.now();
      setState("success");
    } catch {
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="launch-contact-success" role="status">
        <CheckCircle2 size={30} />
        <div>
          <h2>Mensaje recibido</h2>
          <p>Lo revisaremos desde hola@orqenatech.com y responderemos al correo indicado.</p>
        </div>
      </div>
    );
  }

  return (
    <form className="launch-contact-form" onSubmit={submit}>
      <div className="launch-contact-grid">
        <Field label="Nombre" name="name" autoComplete="name" />
        <Field label="Correo" name="email" type="email" autoComplete="email" />
        <Field label="Empresa (opcional)" name="company" autoComplete="organization" required={false} />
        <label>
          <span>Motivo</span>
          <select name="reason" defaultValue="informacion" required>
            <option value="informacion">Información sobre Orqena</option>
            <option value="acceso">Acceso anticipado</option>
            <option value="soporte">Soporte</option>
            <option value="privacidad">Privacidad</option>
          </select>
        </label>
      </div>
      <label>
        <span>Mensaje</span>
        <textarea name="message" minLength={10} maxLength={2_000} rows={6} required />
      </label>
      <label className="launch-contact-consent">
        <input name="consent" type="checkbox" value="true" required />
        <span>Acepto el tratamiento de estos datos para responder a mi solicitud.</span>
      </label>
      <label className="launch-contact-trap" aria-hidden="true">
        <span>Sitio web</span>
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {state === "invalid" ? <p className="launch-form-error" role="alert">Revisa los datos introducidos.</p> : null}
      {state === "error" ? <p className="launch-form-error" role="alert">No se pudo enviar. Inténtalo de nuevo más tarde.</p> : null}
      <button className="marketing-button" type="submit" disabled={state === "submitting"}>
        {state === "submitting" ? <LoaderCircle className="animate-spin" size={18} /> : null}
        {state === "submitting" ? "Enviando…" : "Enviar mensaje"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span>{label}</span>
      <input name={name} type={type} autoComplete={autoComplete} maxLength={160} required={required} />
    </label>
  );
}
