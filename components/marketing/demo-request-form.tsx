"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";

type FormKind = "demo" | "contact";

export function DemoRequestForm({ kind = "demo" }: { kind?: FormKind }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const title = kind === "demo" ? "Solicita una demostración" : "Hablemos de tu operación";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/demo-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, kind }) });
      if (!response.ok) throw new Error("REQUEST_FAILED");
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") return <div className="marketing-form-success" role="status"><CheckCircle2 size={28} /><div><h2 className="text-xl font-black">Hemos recibido tu solicitud.</h2><p className="mt-2 text-sm leading-6 text-content-secondary">Te responderemos usando el correo que nos has indicado.</p></div></div>;
  return <form className="marketing-form" onSubmit={submit}><div><p className="marketing-eyebrow">{kind === "demo" ? "Demo personalizada" : "Contacto"}</p><h1 className="mt-3 text-3xl font-black tracking-tight">{title}</h1><p className="mt-3 text-sm leading-6 text-content-secondary">Cuéntanos lo justo para preparar una conversación útil. No enviamos correos automatizados desde este formulario.</p></div><div className="mt-7 grid gap-4 sm:grid-cols-2"><Field label="Nombre" name="name" autoComplete="name" required /><Field label="Email profesional" name="email" type="email" autoComplete="email" required /><Field label="Empresa" name="company" autoComplete="organization" required /><label className="marketing-field"><span>Sector</span><select name="sector" required defaultValue=""><option value="" disabled>Selecciona un sector</option><option value="construction">Construcción y obra</option><option value="installations">Instalaciones y mantenimiento</option><option value="professional_services">Servicios profesionales</option><option value="repair_workshop">Taller y reparación</option><option value="hospitality">Hostelería y servicios</option><option value="other">Otro</option></select></label><label className="marketing-field"><span>Tamaño del equipo</span><select name="companySize" required defaultValue=""><option value="" disabled>Selecciona una opción</option><option value="1-5">1–5 personas</option><option value="6-20">6–20 personas</option><option value="21-100">21–100 personas</option><option value="101+">Más de 100 personas</option></select></label><label className="marketing-field sm:col-span-2"><span>¿Qué necesitas ordenar?</span><textarea name="need" rows={4} required placeholder="Clientes, trabajo, agenda, finanzas, coordinación…" /></label></div><label className="mt-5 flex items-start gap-3 text-sm leading-5 text-content-secondary"><input className="mt-1 h-4 w-4 accent-[#176a62]" name="consent" type="checkbox" value="true" required />Acepto que Orqena use estos datos para responder a esta solicitud, conforme a su <a className="font-semibold text-[#11574f] underline" href="/privacidad">política de privacidad</a>.</label>{status === "error" ? <p className="mt-4 text-sm font-medium text-danger" role="alert">No hemos podido enviar la solicitud. Revisa tu conexión e inténtalo de nuevo.</p> : null}<button className="marketing-button mt-6 w-full sm:w-auto" type="submit" disabled={status === "submitting"}>{status === "submitting" ? <LoaderCircle className="animate-spin" size={18} /> : null}{status === "submitting" ? "Enviando…" : "Enviar solicitud"}</button></form>;
}

function Field({ label, name, type = "text", autoComplete, required }: { label: string; name: string; type?: string; autoComplete?: string; required?: boolean }) {
  return <label className="marketing-field"><span>{label}</span><input name={name} type={type} autoComplete={autoComplete} required={required} /></label>;
}
