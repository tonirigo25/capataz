import Link from "next/link";
import { requireCompanyRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { createSupportTicket } from "./actions";

export const dynamic = "force-dynamic";

export default async function AuthenticatedSupportPage() {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  const tickets = await prisma.supportTicket.findMany({ where: { companyId: actor.companyId }, orderBy: { createdAt: "desc" }, take: 30, include: { attachments: { select: { id: true } } } });
  return <main className="screen">
    <Link href="/configuracion" className="text-sm text-muted">← Configuración</Link>
    <h1 className="type-page-title mt-2">Soporte autenticado</h1>
    <p className="type-secondary mt-2">Describe el problema sin incluir datos de clientes, facturas, claves ni información fiscal. Orqena añade sólo ruta, release y correlación técnica.</p>
    <section className="card mt-6 p-5">
      <form action={createSupportTicket} className="grid gap-3" encType="multipart/form-data">
        <div className="grid gap-3 sm:grid-cols-2"><select className="field" name="category"><option value="OPERATIONS">Operaciones</option><option value="DOCUMENTS">Documentos</option><option value="ACCESS">Acceso</option><option value="BILLING">Plan y facturación</option><option value="PRIVACY">Privacidad</option><option value="OTHER">Otro</option></select><select className="field" name="priority"><option value="NORMAL">Normal</option><option value="LOW">Baja</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option></select></div>
        <input className="field" name="subject" maxLength={160} placeholder="Resumen" required/>
        <textarea className="field min-h-32" name="description" maxLength={4000} placeholder="Qué esperabas, qué ocurrió y cómo reproducirlo con datos sintéticos" required/>
        <input className="field" name="route" maxLength={120} defaultValue="/configuracion/soporte" aria-label="Ruta afectada"/>
        <label><span className="label">Captura opcional (PNG, JPEG o WebP; máx. 5 MB)</span><input className="field mt-1" type="file" name="attachment" accept="image/png,image/jpeg,image/webp"/></label>
        <button className="primary-button">Crear ticket</button>
      </form>
    </section>
    <section className="mt-6 grid gap-3"><h2 className="type-section-title">Tickets de la empresa</h2>{tickets.map((ticket) => <article className="card p-4" key={ticket.id}><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{ticket.subject}</p><p className="type-meta">{ticket.category} · {ticket.priority} · {ticket.createdAt.toLocaleString("es-ES")} · adjuntos {ticket.attachments.length}</p></div><span className="status-badge">{ticket.status}</span></div><p className="type-secondary mt-2">{ticket.description}</p></article>)}{!tickets.length ? <div className="rounded-xl border border-dashed border-border p-8 text-center">No hay tickets.</div> : null}</section>
  </main>;
}
