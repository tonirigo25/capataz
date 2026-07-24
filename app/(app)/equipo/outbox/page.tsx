import { requireActiveOwner } from "@/lib/commercial/owner-governance";
import { prisma } from "@/lib/prisma";
import { LocalOutboxProcessor } from "@/components/local-outbox-processor";

export default async function EmailOutboxPage() {
  const owner = await requireActiveOwner();
  const items = await prisma.emailOutbox.findMany({ where: { companyId: owner.companyId }, orderBy: { createdAt: "desc" }, take: 100, include: { deliveryAttempts: true } });
  return <main className="screen"><p className="type-label">Staging · correo local</p><h1 className="type-page-title mt-2">Bandeja interna</h1><p className="type-secondary mt-2">Vista protegida para validar destinatario, asunto y plantilla sin realizar entregas externas.</p><div className="mt-6 grid gap-3">{items.map((item) => <article key={item.id} className="card p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><strong>{item.subject}</strong><p className="type-secondary">Para {item.recipient} · {item.status}</p><div className="prose mt-3 text-sm" dangerouslySetInnerHTML={{ __html: item.htmlBody ?? "" }}/></div>{["PENDING", "FAILED", "RETRYING"].includes(item.status) ? <LocalOutboxProcessor outboxId={item.id}/> : null}</div></article>)}</div></main>;
}
