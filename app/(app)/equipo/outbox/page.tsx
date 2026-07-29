import { requireActiveOwner } from "@/lib/commercial/owner-governance";
import { prisma } from "@/lib/prisma";
import { LocalOutboxProcessor } from "@/components/local-outbox-processor";

export default async function EmailOutboxPage() {
  const owner = await requireActiveOwner();
  const liveEnabled = process.env.EMAIL_LIVE_ENABLED === "true";
  const environment = (process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "development").toLowerCase();
  const localProcessing = !liveEnabled && ["development", "test", "staging"].includes(environment);
  const items = await prisma.emailOutbox.findMany({
    where: { companyId: owner.companyId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { deliveryAttempts: true, webhookEvents: { orderBy: { occurredAt: "desc" }, take: 1 } },
  });
  return <main className="screen">
    <p className="type-label">Correo transaccional · vista protegida</p>
    <h1 className="type-page-title mt-2">Bandeja interna</h1>
    <p className="type-secondary mt-2">{liveEnabled ? "El worker gestiona los envíos. Aceptado por el proveedor y entregado al destinatario se muestran por separado." : "El envío externo está desactivado. La cola se conserva sin entregas reales."}</p>
    <div className="mt-6 grid gap-3">{items.length ? items.map((item) => {
      const providerEvent = item.webhookEvents[0]?.eventType;
      const deliveryLabel = providerEvent === "email.delivered" ? "DELIVERED" : providerEvent?.replace(/^email\./, "").toUpperCase() ?? item.status;
      const canProcessLocally = localProcessing && ["PENDING", "FAILED", "RETRYING"].includes(item.status);
      const canReplayLive = liveEnabled && item.status === "FAILED" && Boolean(item.deadLetteredAt);
      return <article key={item.id} className="card p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><strong>{item.subject}</strong><p className="type-secondary">Para {item.recipient} · {deliveryLabel}</p></div>{canProcessLocally || canReplayLive ? <LocalOutboxProcessor outboxId={item.id} label={canReplayLive ? "Reintentar envío auditado" : item.status === "FAILED" ? "Reprocesar de forma local" : "Procesar de forma local"}/> : null}</div></article>;
    }) : <div className="rounded-xl border border-dashed border-border bg-subtle p-6"><h2 className="type-object-title text-content">No hay mensajes en la bandeja</h2><p className="type-secondary mt-2">Las invitaciones y avisos autorizados aparecerán aquí con su estado real.</p></div>}</div>
  </main>;
}
