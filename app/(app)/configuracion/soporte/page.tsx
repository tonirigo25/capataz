import Link from "next/link";
import { requireCompanyRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { createSupportTicket, submitSupportFeedback, updateTestimonialConsent } from "./actions";

export const dynamic = "force-dynamic";

export default async function AuthenticatedSupportPage() {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  const tickets = await prisma.supportTicket.findMany({ where: { companyId: actor.companyId }, orderBy: { createdAt: "desc" }, take: 30, include: { attachments: { select: { id: true } } } });
  return <main className="screen">
    <Link href="/configuracion" className="text-sm text-muted">← Configuración</Link>
    <h1 className="type-page-title mt-2">Soporte autenticado</h1>
    <p className="type-secondary mt-2">Describe el problema sin incluir datos de clientes, facturas, claves ni información fiscal. Orqena añade sólo ruta, release y correlación técnica.</p><Link href="/configuracion/soporte/ayuda" className="secondary-button mt-3">Abrir guía de resolución</Link>
    <section className="card mt-6 p-5">
      <form action={createSupportTicket} className="grid gap-3" encType="multipart/form-data">
        <div className="grid gap-3 sm:grid-cols-2"><select className="field" name="category" aria-label="Categoría del ticket"><option value="OPERATIONS">Operaciones</option><option value="DOCUMENTS">Documentos</option><option value="ACCESS">Acceso</option><option value="BILLING">Plan y facturación</option><option value="PRIVACY">Privacidad</option><option value="OTHER">Otro</option></select><select className="field" name="priority" aria-label="Prioridad del ticket"><option value="NORMAL">Normal</option><option value="LOW">Baja</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option></select></div>
        <input className="field" name="subject" maxLength={160} placeholder="Resumen" aria-label="Resumen del ticket" required/>
        <textarea className="field min-h-32" name="description" maxLength={4000} placeholder="Qué esperabas, qué ocurrió y cómo reproducirlo con datos sintéticos" aria-label="Descripción del ticket" required/>
        <input className="field" name="route" maxLength={120} defaultValue="/configuracion/soporte" aria-label="Ruta afectada"/>
        <label><span className="label">Captura opcional (PNG, JPEG o WebP; máx. 5 MB)</span><input className="field mt-1" type="file" name="attachment" accept="image/png,image/jpeg,image/webp"/></label>
        <button className="primary-button">Crear ticket</button>
      </form>
    </section>
    <section className="card mt-6 p-5"><h2 className="type-section-title">Valorar la experiencia</h2><p className="type-secondary mt-1">Participación opcional, iniciada por ti y sin comunicaciones posteriores salvo permiso separado.</p><form action={submitSupportFeedback} className="mt-4 grid gap-3 sm:grid-cols-2"><select className="field" name="category" aria-label="Tipo de valoración"><option value="CSAT">Satisfacción con soporte (1–5)</option><option value="NPS">Recomendación (0–10)</option></select><input className="field" name="score" type="number" min="0" max="10" aria-label="Puntuación de la valoración" required/><textarea className="field sm:col-span-2" name="comment" maxLength={1000} placeholder="Comentario opcional; no incluyas datos personales" aria-label="Comentario opcional de la valoración"/><label className="flex gap-2 sm:col-span-2"><input type="checkbox" name="consent" required/>Consiento registrar esta valoración para mejorar el producto.</label><label className="flex gap-2 sm:col-span-2"><input type="checkbox" name="contactAllowed"/>Pueden contactarme sobre esta valoración.</label><button className="primary-button sm:col-span-2">Enviar valoración</button></form></section>
    <section className="card mt-6 p-5"><h2 className="type-section-title">Testimonios y casos</h2><p className="type-secondary mt-1">Nada se publica sin alcance explícito. Puedes retirar el permiso en cualquier momento.</p><form action={updateTestimonialConsent} className="mt-4 grid gap-3"><label className="flex gap-2"><input type="checkbox" name="scope" value="anonymous_quote"/>Cita anónima</label><label className="flex gap-2"><input type="checkbox" name="scope" value="named_quote"/>Cita con nombre</label><label className="flex gap-2"><input type="checkbox" name="scope" value="logo"/>Logotipo</label><label className="flex gap-2"><input type="checkbox" name="scope" value="case_study"/>Caso de estudio</label><div className="flex gap-2"><button className="primary-button" name="decision" value="GRANT">Conceder alcance seleccionado</button><button className="secondary-button" name="decision" value="WITHDRAW">Retirar permiso</button></div></form></section>
    <section className="mt-6 grid gap-3"><h2 className="type-section-title">Tickets de la empresa</h2>{tickets.map((ticket) => <article className="card p-4" key={ticket.id}><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{ticket.subject}</p><p className="type-meta">{ticket.category} · {ticket.priority} · {ticket.createdAt.toLocaleString("es-ES")} · adjuntos {ticket.attachments.length}</p></div><span className="status-badge">{ticket.status}</span></div><p className="type-secondary mt-2">{ticket.description}</p></article>)}{!tickets.length ? <div className="rounded-xl border border-dashed border-border p-8 text-center">No hay tickets.</div> : null}</section>
  </main>;
}
