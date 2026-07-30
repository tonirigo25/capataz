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
import { useState } from "react";
import styles from "./public-home.module.css";
import { brand } from "@/lib/brand";

type Stage = {
  id: string;
  label: string;
  title: string;
  input: string;
  record: string;
  decision: string;
  outcome: string;
  icon: LucideIcon;
};

const stages: readonly Stage[] = [
  {
    id: "contacto-visita",
    label: "Contacto y visita",
    title: "Una llamada se convierte en una oportunidad ordenada.",
    input: "Audio de 46 segundos · cliente nuevo",
    record: "Cliente, necesidad, dirección y próxima visita",
    decision: "Confirmar responsable y fecha",
    outcome: "Oportunidad preparada",
    icon: Building2,
  },
  {
    id: "presupuesto",
    label: "Presupuesto",
    title: "La visita termina en una propuesta con margen visible.",
    input: "Mediciones y notas de la visita",
    record: "12 partidas · 24.600 € · margen 28,4 %",
    decision: "Resolver 2 dudas antes de enviar",
    outcome: "Propuesta revisable",
    icon: CircleDollarSign,
  },
  {
    id: "trabajo-planificacion",
    label: "Trabajo y planificación",
    title: "Lo vendido conserva el contexto al empezar la obra.",
    input: "Presupuesto PR-104 aceptado",
    record: "3 hitos · 14 tareas · 4 responsables",
    decision: "Confirmar calendario y primera compra",
    outcome: "Obra coordinada",
    icon: ClipboardList,
  },
  {
    id: "compras-costes",
    label: "Compras y costes",
    title: "Cada documento actualiza la lectura económica correcta.",
    input: "Factura FR-882 · Suministros Norte",
    record: "1.840,50 € vinculados a Costa Norte",
    decision: "Validar IVA, proveedor y desviación",
    outcome: "Margen actualizado",
    icon: ReceiptText,
  },
  {
    id: "factura-cobro",
    label: "Factura y cobro",
    title: "El trabajo termina con el vencimiento bajo control.",
    input: "Hito certificado · 8.450 €",
    record: "Factura preparada · vencimiento 30 días",
    decision: "Confirmar emisión y destinatario",
    outcome: "Caja prevista",
    icon: WalletCards,
  },
] as const;

export function ImmersiveJourney() {
  const [activeIndex, setActiveIndex] = useState(0);
  const stage = stages[activeIndex];
  return (
    <section id="como-funciona" className={styles.guidedSection} aria-labelledby="immersive-title">
      <div className={styles.guidedIntro}>
        <span>Demo guiada</span>
        <h2 id="immersive-title">Del primer contacto al cobro, sin perder el hilo.</h2>
        <p>Recorre una historia sintética y comprueba qué cambia en cada etapa. Los ejemplos son interactivos y no ejecutan acciones reales.</p>
        <Link href="/demo#quick-demo">Abrir la demo completa <ArrowRight /></Link>
      </div>

      <div className={styles.guidedConsole}>
        <div className={styles.guidedTopbar}><span>Historia · Reforma Costa Norte</span><strong>Etapa {activeIndex + 1} de {stages.length}</strong></div>
        <nav className={styles.guidedNav} aria-label="Etapas de la demo guiada">
          {stages.map((item, index) => {
            const Icon = item.icon;
            return <button key={item.id} type="button" aria-current={index === activeIndex ? "step" : undefined} onClick={() => setActiveIndex(index)}><span>{index < activeIndex ? <Check /> : String(index + 1).padStart(2, "0")}</span><Icon /><strong>{item.label}</strong></button>;
          })}
        </nav>

        <div className={styles.guidedPanel} aria-live="polite" key={stage.id}>
          <div className={styles.guidedStory}>
            <span>{stage.label}</span>
            <h3>{stage.title}</h3>
            <dl>
              <div><dt>Entrada</dt><dd>{stage.input}</dd></div>
              <div><dt>Registro preparado</dt><dd>{stage.record}</dd></div>
              <div><dt>Decisión humana</dt><dd>{stage.decision}</dd></div>
            </dl>
            <strong><ShieldCheck />{stage.outcome}</strong>
          </div>
          <StagePreview index={activeIndex} />
        </div>

        <div className={styles.guidedFooter}>
          <span><Bot /> {brand.productName} prepara el siguiente paso y explica por qué.</span>
          <div><button type="button" onClick={() => setActiveIndex((current) => Math.max(0, current - 1))} disabled={activeIndex === 0}>Anterior</button><button type="button" onClick={() => setActiveIndex((current) => Math.min(stages.length - 1, current + 1))} disabled={activeIndex === stages.length - 1}>Siguiente <ChevronRight /></button></div>
        </div>
      </div>
    </section>
  );
}

function StagePreview({ index }: { index: number }) {
  if (index === 1) return <div className={styles.stagePreview}><PreviewHeader icon={CircleDollarSign} title="Presupuesto PR-104" state="Borrador" /><div className={styles.previewRows}><span><small>Partidas</small><strong>12</strong></span><span><small>Base</small><strong>19.840 €</strong></span><span><small>Margen</small><strong>28,4 %</strong></span></div><div className={styles.previewNotice}><Bot /><span><strong>2 dudas señaladas</strong><small>Plazo y condición de pago.</small></span></div></div>;
  if (index === 2) return <div className={styles.stagePreview}><PreviewHeader icon={BriefcaseBusiness} title="Obra Costa Norte" state="Planificación" /><div className={styles.previewProgress}><span><strong>Preparación</strong><em>100 %</em><i><b style={{ width: "100%" }} /></i></span><span><strong>Instalaciones</strong><em>64 %</em><i><b style={{ width: "64%" }} /></i></span><span><strong>Acabados</strong><em>12 %</em><i><b style={{ width: "12%" }} /></i></span></div></div>;
  if (index === 3) return <div className={styles.stagePreview}><PreviewHeader icon={ReceiptText} title="Factura FR-882" state="Extraída" /><div className={styles.previewDocument}><span><small>Proveedor</small><strong>Suministros Norte</strong></span><span><small>Total</small><strong>1.840,50 €</strong></span><span><small>Obra</small><strong>Costa Norte</strong></span><span><small>Confianza</small><strong>98 %</strong></span></div><div className={styles.previewNotice}><FileCheck2 /><span><strong>Relación encontrada</strong><small>Compra prevista en instalaciones.</small></span></div></div>;
  if (index === 4) return <div className={styles.stagePreview}><PreviewHeader icon={WalletCards} title="Factura F-2031" state="Preparada" /><div className={styles.previewInvoice}><strong>8.450,00 €</strong><span>Vence el 30 de agosto</span><dl><div><dt>Cliente</dt><dd>Grupo Norte</dd></div><div><dt>Hito</dt><dd>Certificación parcial</dd></div></dl><button type="button">Revisar antes de emitir</button></div></div>;
  return <div className={styles.stagePreview}><PreviewHeader icon={Building2} title="Grupo Norte" state="Nuevo" /><div className={styles.previewClient}><span><small>Necesidad</small><strong>Reforma integral de oficina</strong></span><span><small>Próxima acción</small><strong>Visita técnica · viernes 10:30</strong></span><span><small>Responsable</small><strong>Toni Rigo</strong></span></div><div className={styles.previewNotice}><Bot /><span><strong>Contexto ordenado</strong><small>Dirección y dos dudas por completar.</small></span></div></div>;
}

function PreviewHeader({ icon: Icon, title, state }: { icon: LucideIcon; title: string; state: string }) {
  return <header className={styles.previewHeader}><span><Icon />{title}</span><em>{state}</em></header>;
}
