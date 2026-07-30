"use client";

import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  FileCheck2,
  FileText,
  Mic,
  ReceiptText,
  ScanText,
  ShieldCheck,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import styles from "./public-home.module.css";
import { brand } from "@/lib/brand";

type FlowId = "venta" | "obra" | "documento";

const flows: ReadonlyArray<{ id: FlowId; label: string; icon: LucideIcon; title: string; text: string }> = [
  { id: "venta", label: "Vender y presupuestar", icon: Users, title: "De una conversación a una propuesta revisable", text: "El seguimiento comercial termina en un presupuesto con margen y dudas visibles." },
  { id: "obra", label: "Ejecutar y coordinar", icon: BriefcaseBusiness, title: "De lo que ocurre en obra al siguiente paso", text: "Avances, tareas e incidencias llegan al equipo sin perder responsable ni fecha." },
  { id: "documento", label: "Ordenar y controlar", icon: ScanText, title: "De un documento a una decisión económica", text: "El dato se extrae, se relaciona y se propone; una persona valida antes de guardar." },
] as const;

export function PublicFlowShowcase() {
  const [activeFlow, setActiveFlow] = useState<FlowId>("venta");
  const flow = flows.find((item) => item.id === activeFlow) ?? flows[0];
  return (
    <section id="flujos" className={styles.flowSection} aria-labelledby="flow-title">
      <div className={styles.flowIntro}>
        <div className={styles.sectionHeading}>
          <span>Producto en movimiento</span>
          <h2 id="flow-title">No son módulos sueltos. Son recorridos completos.</h2>
          <p>Elige un flujo y comprueba cómo cambia la información, el contexto y la decisión preparada.</p>
        </div>
        <div className={styles.flowTabs} role="tablist" aria-label="Flujos públicos de ejemplo">
          {flows.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={activeFlow === id} aria-controls={`flow-panel-${id}`} onClick={() => setActiveFlow(id)}><Icon /><span>{label}</span></button>)}
        </div>
      </div>
      <div id={`flow-panel-${activeFlow}`} role="tabpanel" className={styles.flowCanvas} key={activeFlow}>
        <div className={styles.flowNarrative}><span>Flujo seleccionado</span><h3>{flow.title}</h3><p>{flow.text}</p><strong><ShieldCheck /> Contexto y confirmación en cada paso</strong></div>
        <FlowVisual id={activeFlow} />
      </div>
    </section>
  );
}

function FlowVisual({ id }: { id: FlowId }) {
  if (id === "obra") return <WorkFlow />;
  if (id === "documento") return <DocumentFlow />;
  return <SalesFlow />;
}

function SalesFlow() {
  return (
    <div className={styles.flowProduct} aria-label="Flujo comercial de ejemplo">
      <FlowHeader icon={Users} label="Cliente · Grupo Norte" status="Oportunidad activa" />
      <div className={styles.flowSteps}>
        <FlowStep icon={Mic} label="Entrada" value="Llamada registrada" state="09:42" />
        <ChevronRight />
        <FlowStep icon={FileText} label="Propuesta" value="PR-104 · 24.600 €" state="Borrador" />
        <ChevronRight />
        <FlowStep icon={WalletCards} label="Decisión" value="Margen 28,4 %" state="Revisar" />
      </div>
      <div className={styles.flowDecision}><Bot /><span><strong>{brand.productName} ha señalado dos dudas</strong><small>Plazo de ejecución y condición de pago sin confirmar.</small></span><button type="button">Abrir propuesta</button></div>
    </div>
  );
}

function WorkFlow() {
  return (
    <div className={styles.flowProduct} aria-label="Flujo de trabajo de ejemplo">
      <FlowHeader icon={BriefcaseBusiness} label="Obra · Costa Norte" status="78 % completado" />
      <div className={styles.workBoard}>
        <article><span>Hoy</span><strong>Instalación eléctrica</strong><small>3 tareas · Carlos y Marta</small><i><b style={{ width: "72%" }} /></i></article>
        <article><span>Incidencia</span><strong>Material incompleto</strong><small>Proveedor avisado · respuesta 13:00</small><em>Prioridad alta</em></article>
        <article><span>Siguiente hito</span><strong>Certificación parcial</strong><small>Viernes · 8.450 €</small><button type="button">Preparar revisión</button></article>
      </div>
    </div>
  );
}

function DocumentFlow() {
  return (
    <div className={styles.flowProduct} aria-label="Flujo documental de ejemplo">
      <FlowHeader icon={ReceiptText} label="Factura recibida · FR-882" status="Pendiente de revisión" />
      <div className={styles.documentFlow}>
        <article><ReceiptText /><span><small>Documento</small><strong>Suministros Norte</strong><em>PDF · 2 páginas</em></span></article>
        <ArrowRight />
        <article><ScanText /><span><small>Extracción</small><strong>1.840,50 € · IVA 21 %</strong><em>Confianza 98 %</em></span></article>
        <ArrowRight />
        <article><FileCheck2 /><span><small>Relación</small><strong>Obra Costa Norte</strong><em>Coste previsto</em></span></article>
      </div>
      <div className={styles.documentDecision}><ShieldCheck /><span><strong>Listo para validar</strong><small>No se contabiliza hasta confirmar proveedor, IVA y obra.</small></span><button type="button"><Check /> Revisar datos</button></div>
    </div>
  );
}

function FlowHeader({ icon: Icon, label, status }: { icon: LucideIcon; label: string; status: string }) {
  return <header className={styles.flowProductHeader}><span><Icon />{label}</span><em>{status}</em></header>;
}

function FlowStep({ icon: Icon, label, value, state }: { icon: LucideIcon; label: string; value: string; state: string }) {
  return <article><Icon /><span><small>{label}</small><strong>{value}</strong><em>{state}</em></span></article>;
}
