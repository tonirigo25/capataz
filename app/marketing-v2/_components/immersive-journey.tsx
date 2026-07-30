"use client";

import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FileCheck2,
  ReceiptText,
  ShieldCheck,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import styles from "./public-home.module.css";
import { brand } from "@/lib/brand";

type Stage = {
  id: string;
  label: string;
  title: string;
  input: string;
  prepared: string;
  decision: string;
  outcome: string;
  action: string;
  icon: LucideIcon;
};

const stages: readonly Stage[] = [
  { id: "contacto-visita", label: "Contacto", title: "De una llamada a una visita preparada.", input: "Audio de 46 s · cliente nuevo", prepared: "Cliente, necesidad, dirección y seguimiento", decision: "Confirmar responsable y fecha", outcome: "Oportunidad preparada", action: "Confirmar visita", icon: Building2 },
  { id: "presupuesto", label: "Presupuesto", title: "De la visita a una propuesta con margen.", input: "Mediciones y notas de visita", prepared: "12 partidas · 24.600 € · margen 28,4 %", decision: "Resolver 2 dudas antes de enviar", outcome: "Propuesta revisable", action: "Revisar dudas", icon: CircleDollarSign },
  { id: "trabajo-planificacion", label: "Trabajo", title: "De lo vendido a una obra coordinada.", input: "Presupuesto PR-104 aceptado", prepared: "3 hitos · 14 tareas · 4 responsables", decision: "Confirmar calendario y primera compra", outcome: "Plan coordinado", action: "Revisar plan", icon: ClipboardList },
  { id: "compras-costes", label: "Costes", title: "De una factura al margen correcto.", input: "Factura FR-882 · Suministros Norte", prepared: "1.840,50 € vinculados a Costa Norte", decision: "Validar IVA, proveedor y desviación", outcome: "Margen actualizado", action: "Validar datos", icon: ReceiptText },
  { id: "factura-cobro", label: "Cobro", title: "Del hito al vencimiento bajo control.", input: "Hito certificado · 8.450 €", prepared: "Factura y vencimiento a 30 días", decision: "Confirmar emisión y destinatario", outcome: "Caja prevista", action: "Revisar factura", icon: WalletCards },
] as const;

export function ImmersiveJourney() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [actionState, setActionState] = useState("Sin acciones simuladas.");
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const stage = stages[activeIndex];

  const selectStage = (index: number, focus = false) => {
    const next = Math.max(0, Math.min(stages.length - 1, index));
    setActiveIndex(next);
    setActionState(`${stages[next].label}: preparado para revisar.`);
    if (focus) requestAnimationFrame(() => buttonRefs.current[next]?.focus());
  };

  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? stages.length - 1 : index + (event.key === "ArrowRight" ? 1 : -1);
    selectStage(next, true);
  };

  const simulateAction = () => setActionState(`${stage.outcome}. Simulación local completada; no se han escrito datos.`);

  return (
    <section id="como-funciona" className={styles.guidedSection} aria-labelledby="immersive-title">
      <div className={styles.guidedIntro}>
        <span>Demo guiada</span>
        <h2 id="immersive-title">Del contacto al cobro en cinco decisiones.</h2>
        <p>Recorre un caso sintético compacto. Cada etapa cambia la interfaz y toda acción visible responde sin modificar datos reales.</p>
        <Link href="/demo#quick-demo">Abrir demo completa <ArrowRight /></Link>
      </div>

      <div className={styles.guidedConsole}>
        <div className={styles.guidedTopbar}>
          <span>Reforma Costa Norte</span>
          <strong>{String(activeIndex + 1).padStart(2, "0")} / {String(stages.length).padStart(2, "0")}</strong>
          <i aria-hidden="true"><b style={{ width: `${((activeIndex + 1) / stages.length) * 100}%` }} /></i>
        </div>
        <nav className={styles.guidedNav} aria-label="Etapas de la demo guiada">
          {stages.map((item, index) => {
            const Icon = item.icon;
            return (
              <button ref={(node) => { buttonRefs.current[index] = node; }} key={item.id} type="button" aria-current={index === activeIndex ? "step" : undefined} onClick={() => selectStage(index)} onKeyDown={(event) => handleKey(event, index)}>
                <span>{index < activeIndex ? <Check /> : String(index + 1).padStart(2, "0")}</span><Icon /><strong>{item.label}</strong>
              </button>
            );
          })}
        </nav>

        <div className={styles.guidedPanel} aria-live="polite" key={stage.id}>
          <div className={styles.guidedStory}>
            <span>{stage.label}</span>
            <h3>{stage.title}</h3>
            <dl>
              <div><dt>Entra</dt><dd>{stage.input}</dd></div>
              <div><dt>{brand.productName} prepara</dt><dd>{stage.prepared}</dd></div>
              <div><dt>Tú confirmas</dt><dd>{stage.decision}</dd></div>
            </dl>
            <button type="button" onClick={simulateAction}>{stage.action} <ArrowRight /></button>
            <strong><ShieldCheck />{stage.outcome}</strong>
          </div>
          <StagePreview index={activeIndex} actionState={actionState} onAction={simulateAction} />
        </div>

        <div className={styles.guidedFooter}>
          <span role="status"><Bot /> {actionState}</span>
          <div><button type="button" onClick={() => selectStage(activeIndex - 1)} disabled={activeIndex === 0}>Anterior</button><button type="button" onClick={() => selectStage(activeIndex + 1)} disabled={activeIndex === stages.length - 1}>Siguiente <ChevronRight /></button></div>
        </div>
      </div>
    </section>
  );
}

function StagePreview({ index, actionState, onAction }: { index: number; actionState: string; onAction: () => void }) {
  if (index === 1) return <div className={styles.stagePreview}><PreviewHeader icon={CircleDollarSign} title="Presupuesto PR-104" state="Borrador" /><div className={styles.previewRows}><span><small>Partidas</small><strong>12</strong></span><span><small>Base</small><strong>19.840 €</strong></span><span><small>Margen</small><strong>28,4 %</strong></span></div><div className={styles.previewNotice}><Bot /><span><strong>2 dudas señaladas</strong><small>Plazo y condición de pago.</small></span><button type="button" onClick={onAction}>Resolver</button></div></div>;
  if (index === 2) return <div className={styles.stagePreview}><PreviewHeader icon={BriefcaseBusiness} title="Obra Costa Norte" state="Planificación" /><div className={styles.previewProgress}>{[["Preparación", 100], ["Instalaciones", 64], ["Acabados", 12]].map(([label, progress]) => <span key={label}><strong>{label}</strong><em>{progress} %</em><i><b style={{ width: `${progress}%` }} /></i></span>)}</div><button className={styles.previewAction} type="button" onClick={onAction}>Revisar calendario</button></div>;
  if (index === 3) return <div className={styles.stagePreview}><PreviewHeader icon={ReceiptText} title="Factura FR-882" state="Extraída" /><div className={styles.previewDocument}><span><small>Proveedor</small><strong>Suministros Norte</strong></span><span><small>Total</small><strong>1.840,50 €</strong></span><span><small>Obra</small><strong>Costa Norte</strong></span><span><small>Confianza</small><strong>98 %</strong></span></div><div className={styles.previewNotice}><FileCheck2 /><span><strong>Relación encontrada</strong><small>Compra prevista en instalaciones.</small></span><button type="button" onClick={onAction}>Validar</button></div></div>;
  if (index === 4) return <div className={styles.stagePreview}><PreviewHeader icon={WalletCards} title="Factura F-2031" state="Preparada" /><div className={styles.previewInvoice}><strong>8.450,00 €</strong><span>Vence el 30 de agosto</span><dl><div><dt>Cliente</dt><dd>Grupo Norte</dd></div><div><dt>Hito</dt><dd>Certificación parcial</dd></div></dl><button type="button" onClick={onAction}>Revisar antes de emitir</button></div></div>;
  return <div className={styles.stagePreview}><PreviewHeader icon={Building2} title="Grupo Norte" state="Nuevo" /><div className={styles.previewClient}><span><small>Necesidad</small><strong>Reforma integral de oficina</strong></span><span><small>Próxima acción</small><strong>Visita · viernes 10:30</strong></span><span><small>Responsable</small><strong>Toni Rigo</strong></span></div><div className={styles.previewNotice}><Bot /><span><strong>Contexto ordenado</strong><small>{actionState}</small></span><button type="button" onClick={onAction}>Confirmar</button></div></div>;
}

function PreviewHeader({ icon: Icon, title, state }: { icon: LucideIcon; title: string; state: string }) {
  return <header className={styles.previewHeader}><span><Icon />{title}</span><em>{state}</em></header>;
}
