import type { CapabilityKey } from "@/lib/commercial/catalog";

export type ManualEntity = "cliente"|"obra"|"presupuesto"|"factura"|"pago"|"gasto"|"material"|"recordatorio"|"eventoAgenda"|"contacto"|"notaInterna"|"documento"|"foto";

export function managementCapability(type: ManualEntity, editing: boolean): CapabilityKey {
  const map: Record<ManualEntity, [CapabilityKey, CapabilityKey]> = {
    cliente:["clients.create","clients.update"], obra:["work.create","work.update"], presupuesto:["sales.budgets.create","sales.budgets.update"], factura:["sales.invoices.create","sales.invoices.create"], pago:["treasury.collections.register","treasury.collections.register"], gasto:["purchases.received_invoices.manage","purchases.received_invoices.manage"], material:["purchases.received_invoices.manage","purchases.received_invoices.manage"], recordatorio:["agenda.manage","agenda.manage"], eventoAgenda:["agenda.manage","agenda.manage"], contacto:["clients.update","clients.update"], notaInterna:["work.update","work.update"], documento:["documents.upload","documents.manage"], foto:["documents.upload","documents.manage"]
  };
  return map[type][editing?1:0];
}
