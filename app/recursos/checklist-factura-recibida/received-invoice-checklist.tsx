"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import { trackPublicFunnel } from "@/lib/product/public-analytics";

const items = [
  "Proveedor e identificación fiscal coinciden con el alta interna",
  "Número y fecha de factura están presentes y son legibles",
  "Conceptos, cantidades y obra o instalación están identificados",
  "Base imponible, tipo de IVA, cuota y total cuadran aritméticamente",
  "Vencimiento y forma de pago son los acordados",
  "Pedido, albarán, certificación o parte relacionado está disponible",
  "No parece un duplicado de una factura ya registrada",
  "La persona con permiso revisará y confirmará el registro o pago",
] as const;

export function ReceivedInvoiceChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const tracked = useRef(false);
  const completed = useMemo(() => items.filter((item) => checked[item]).length, [checked]);
  const markUsed = () => {
    if (tracked.current) return;
    tracked.current = true;
    trackPublicFunnel("funnel.resource_used", { resource: "received_invoice_checklist" });
  };
  const download = () => {
    markUsed();
    const content = [
      "Checklist de factura recibida — Orqena",
      "Revisión operativa; no sustituye asesoramiento fiscal.",
      "",
      ...items.map((item) => `${checked[item] ? "[x]" : "[ ]"} ${item}`),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "checklist-factura-recibida-orqena.txt";
    link.click();
    URL.revokeObjectURL(url);
  };
  return <section className="marketing-container py-14 lg:py-20">
    <p className="marketing-eyebrow">Recurso operativo · {completed} de {items.length}</p>
    <h1 className="marketing-display mt-4 max-w-5xl">Checklist de factura recibida</h1>
    <p className="marketing-lede mt-5 max-w-3xl">Una comprobación previa reduce omisiones, pero no valida por sí sola la deducibilidad, autenticidad ni tratamiento fiscal.</p>
    <div className="mt-10 grid gap-3">
      {items.map((item, index) => <label className="card flex cursor-pointer items-start gap-4 p-5" key={item}><input className="mt-1 h-5 w-5 accent-brand" type="checkbox" checked={Boolean(checked[item])} onChange={(event) => { markUsed(); setChecked((current) => ({ ...current, [item]: event.target.checked })); }} /><span><strong>{String(index + 1).padStart(2, "0")}</strong><span className="ml-3 text-sm leading-6">{item}</span></span></label>)}
    </div>
    <div className="mt-6 flex flex-wrap gap-3 print:hidden">
      <button className="marketing-outline-button" type="button" onClick={download}><Download size={17} aria-hidden="true" />Descargar como texto</button>
      <button className="marketing-outline-button" type="button" onClick={() => { markUsed(); window.print(); }}><Printer size={17} aria-hidden="true" />Imprimir o guardar PDF</button>
    </div>
    <p className="mt-6 max-w-3xl text-sm leading-6 text-content-secondary">Antes de pagar: comprueba cuenta bancaria por un canal independiente cuando haya cambios, conserva el documento original y exige confirmación humana con permisos.</p>
    <div className="sticky bottom-4 z-20 mt-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-content bg-surface-raised p-4 shadow-xl print:hidden"><p className="font-bold">¿Quieres conectar esta revisión con compras, obra y tesorería?</p><Link className="marketing-button" href="/contacto?source=invoice-checklist" onClick={() => trackPublicFunnel("funnel.resource_cta", { resource: "received_invoice_checklist", target: "contact" })}>Solicitar una demo</Link></div>
  </section>;
}
