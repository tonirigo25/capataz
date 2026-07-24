"use client";

import { useMemo, useState } from "react";

type Option = { id: string; label: string; clientId?: string | null; workId?: string | null };

export function AgendaContextSelector({ clients, works, contacts, budgets, invoices, documents, initial }: { clients: Option[]; works: Option[]; contacts: Option[]; budgets: Option[]; invoices: Option[]; documents: Option[]; initial: { clientId?: string | null; workId?: string | null; contactId?: string | null; budgetId?: string | null; invoiceId?: string | null; documentId?: string | null } }) {
  const initialWork = works.find((item) => item.id === initial.workId);
  const [workId, setWorkId] = useState(initial.workId ?? "");
  const [clientId, setClientId] = useState(initialWork?.clientId ?? initial.clientId ?? "");
  const [contactId, setContactId] = useState(initial.contactId ?? "");
  const [budgetId, setBudgetId] = useState(initial.budgetId ?? "");
  const [invoiceId, setInvoiceId] = useState(initial.invoiceId ?? "");
  const [documentId, setDocumentId] = useState(initial.documentId ?? "");
  const filtered = useMemo(() => ({
    works: works.filter((item) => !clientId || item.clientId === clientId), contacts: contacts.filter((item) => !clientId || item.clientId === clientId),
    budgets: budgets.filter((item) => (!clientId || item.clientId === clientId) && (!workId || !item.workId || item.workId === workId)),
    invoices: invoices.filter((item) => (!clientId || item.clientId === clientId) && (!workId || !item.workId || item.workId === workId)),
    documents: documents.filter((item) => (!clientId || !item.clientId || item.clientId === clientId) && (!workId || !item.workId || item.workId === workId))
  }), [budgets, clientId, contacts, documents, invoices, workId, works]);

  function chooseWork(next: string) {
    const work = works.find((item) => item.id === next);
    setWorkId(next);
    if (work?.clientId) setClientId(work.clientId);
    setContactId(""); setBudgetId(""); setInvoiceId(""); setDocumentId("");
  }
  function chooseClient(next: string) {
    setClientId(next); setWorkId(""); setContactId(""); setBudgetId(""); setInvoiceId(""); setDocumentId("");
  }
  return <fieldset className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2"><legend className="px-2 font-semibold">Relaciones</legend>
    <Select name="obraId" label="Trabajo" value={workId} options={filtered.works} onChange={chooseWork}/>
    <Select name="clienteId" label="Cliente" value={clientId} options={clients} onChange={chooseClient} disabled={Boolean(workId)} hint={workId ? "Fijado por el trabajo seleccionado" : undefined}/>
    <Select name="contactId" label="Contacto" value={contactId} options={filtered.contacts} onChange={setContactId}/>
    {budgets.length ? <Select name="presupuestoId" label="Presupuesto" value={budgetId} options={filtered.budgets} onChange={setBudgetId}/> : null}
    {invoices.length ? <Select name="facturaId" label="Factura" value={invoiceId} options={filtered.invoices} onChange={setInvoiceId}/> : null}
    {documents.length ? <Select name="documentoId" label="Documento" value={documentId} options={filtered.documents} onChange={setDocumentId}/> : null}
  </fieldset>;
}

function Select({ name, label, value, options, onChange, disabled, hint }: { name: string; label: string; value: string; options: Option[]; onChange: (value: string) => void; disabled?: boolean; hint?: string }) {
  return <label><span className="label mb-1 block">{label}</span><select className="field" name={name} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}><option value="">Sin asociar</option>{options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>{disabled ? <input type="hidden" name={name} value={value}/> : null}{hint ? <span className="mt-1 block text-xs text-content-tertiary">{hint}</span> : null}</label>;
}
