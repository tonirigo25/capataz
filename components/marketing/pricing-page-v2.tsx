"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Gauge,
  LockKeyhole,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import {
  comparisonGroups,
  priceFor,
  pricingFaq,
  pricingPlans,
  recommendPlan,
  type BillingInterval,
  type PricingPlan,
} from "@/lib/marketing/pricing-catalog";
import styles from "./pricing-page-v2.module.css";

const commonPillars = [
  { icon: Workflow, title: "Flujo conectado", text: "Cliente, presupuesto, trabajo, documento, factura y cobro conservan el mismo contexto." },
  { icon: LockKeyhole, title: "Datos aislados", text: "Cada empresa trabaja en su propio ámbito, con permisos comprobados en servidor." },
  { icon: CheckCircle2, title: "Control humano", text: "Las propuestas de IA se revisan antes de ejecutar una acción sensible." },
  { icon: Smartphone, title: "Web y móvil", text: "La operación acompaña al equipo en oficina y en obra, sin duplicar el trabajo." },
] as const;

const scenarios = [
  { title: "Quiero ordenar la operación", text: "Centraliza clientes, presupuestos, trabajos y dinero con una base común.", plan: "Starter", href: "starter", signal: "Hasta 2 usuarios" },
  { title: "Necesito coordinar al equipo", text: "Añade documentos, automatizaciones y asistencia de IA bajo revisión.", plan: "Professional", href: "professional", signal: "Hasta 5 usuarios" },
  { title: "Necesito más capacidad y gobierno", text: "Escala usuarios, volumen de IA, permisos y control transversal.", plan: "Business", href: "business", signal: "Hasta 15 usuarios" },
] as const;

export function PricingPageV2() {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [teamSize, setTeamSize] = useState(3);
  const [needsAi, setNeedsAi] = useState(true);
  const [workload, setWorkload] = useState<"standard" | "high">("standard");
  const recommendationKey = recommendPlan({ teamSize, needsAi, workload });
  const recommendation = pricingPlans.find((plan) => plan.key === recommendationKey) ?? pricingPlans[1];

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="pricing-title">
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><Sparkles aria-hidden="true" /> Planes claros para una operación real</p>
            <h1 id="pricing-title">Controla hoy.<br /><span>Escala cuando lo necesites.</span></h1>
            <p className={styles.heroLead}>Tres niveles de capacidad sobre una misma arquitectura: operación conectada, datos aislados, trazabilidad y decisiones bajo control humano.</p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href="#planes">Comparar planes <ArrowRight aria-hidden="true" /></a>
              <Link className={styles.secondaryButton} href="/demo">Ver el producto</Link>
            </div>
            <ul className={styles.trustList} aria-label="Condiciones principales">
              <li><Check aria-hidden="true" /> Importes netos y límites visibles</li>
              <li><Check aria-hidden="true" /> Sin cargos automáticos por IA</li>
              <li><Check aria-hidden="true" /> Solicitar acceso no inicia una compra</li>
            </ul>
          </div>

          <Recommender
            teamSize={teamSize}
            setTeamSize={setTeamSize}
            needsAi={needsAi}
            setNeedsAi={setNeedsAi}
            workload={workload}
            setWorkload={setWorkload}
            recommendation={recommendation}
          />
        </div>
      </section>

      <section className={styles.signalBar} aria-label="Principios del catálogo">
        <div><ShieldCheck aria-hidden="true" /><span><strong>Una base común</strong>Seguridad, trazabilidad y control humano</span></div>
        <div><Gauge aria-hidden="true" /><span><strong>Capacidad explícita</strong>Usuarios e IA definidos por plan</span></div>
        <div><Bot aria-hidden="true" /><span><strong>Consumo previsible</strong>Aviso al 80 % y bloqueo al 100 %</span></div>
      </section>

      <section className={styles.section} id="planes" aria-labelledby="plans-title">
        <SectionHeading eyebrow="CATÁLOGO" title="Elige capacidad, no complejidad." description="La arquitectura se mantiene. Cambian el número de usuarios, la profundidad operativa y la capacidad de Orqena IA." id="plans-title" />
        <IntervalToggle interval={interval} setInterval={setInterval} />
        <div className={styles.planGrid}>
          {pricingPlans.map((plan) => <PlanCard key={plan.key} plan={plan} interval={interval} recommended={plan.key === recommendationKey} />)}
        </div>
        <p className={styles.catalogNote}><ShieldCheck aria-hidden="true" /> Todos los importes son netos, más IVA. La disponibilidad comercial permanece sujeta a validación de acceso.</p>
      </section>

      <section className={`${styles.section} ${styles.softSection}`} aria-labelledby="foundation-title">
        <SectionHeading eyebrow="INCLUIDO EN LOS TRES PLANES" title="Una base profesional desde el primer día." description="No recortamos los controles que protegen el dato y la operación. La diferencia entre planes está en capacidad y profundidad." id="foundation-title" />
        <div className={styles.pillarGrid}>
          {commonPillars.map(({ icon: Icon, title, text }) => <article key={title}><Icon aria-hidden="true" /><div><h3>{title}</h3><p>{text}</p></div></article>)}
        </div>
        <div className={styles.decisionFlow} aria-label="Proceso de selección">
          <article><span>01</span><div><strong>Mapea la operación</strong><p>Equipo, áreas, volumen y puntos de control.</p></div></article>
          <ChevronRight aria-hidden="true" />
          <article><span>02</span><div><strong>Ajusta la capacidad</strong><p>Usuarios, nivel operativo y uso esperado de IA.</p></div></article>
          <ChevronRight aria-hidden="true" />
          <article><span>03</span><div><strong>Valida el acceso</strong><p>Alcance y condiciones antes de cualquier activación.</p></div></article>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="comparison-title">
        <SectionHeading eyebrow="COMPARACIÓN TÉCNICA" title="Comprueba exactamente qué cambia." description="Una lectura completa de operación, capacidad y gobierno, sin esconder límites en la letra pequeña." id="comparison-title" />
        <TechnicalComparison />
      </section>

      <section className={`${styles.section} ${styles.aiSection}`} aria-labelledby="ai-title">
        <div className={styles.aiCopy}>
          <p className={styles.eyebrow}><Bot aria-hidden="true" /> ORQENA IA</p>
          <h2 id="ai-title">La asistencia suma capacidad. Nunca elimina tu control.</h2>
          <p>Las operaciones de IA miden preparaciones, análisis y acciones asistidas. Leer pantallas, revisar un documento o trabajar sin IA no consume operaciones.</p>
          <div className={styles.aiRules}>
            <div><Check aria-hidden="true" /><span><strong>Cuenta</strong>Preparar, analizar o proponer una acción</span></div>
            <div><X aria-hidden="true" /><span><strong>No cuenta</strong>Leer, navegar o revisar lo ya preparado</span></div>
            <div><ShieldCheck aria-hidden="true" /><span><strong>Protección</strong>Aviso al 80 %; bloqueo al 100 % sin sobrecoste</span></div>
          </div>
        </div>
        <div className={styles.usageCard}>
          <header><span>Ejemplo de consumo</span><em>Professional · mensual</em></header>
          <div className={styles.usageValue}><strong>382</strong><span>de 500 operaciones</span></div>
          <div className={styles.usageTrack} role="progressbar" aria-label="Operaciones de IA utilizadas en el ejemplo" aria-valuemin={0} aria-valuemax={500} aria-valuenow={382}><i /></div>
          <div className={styles.usageLabels}><span>76 % usado</span><strong>118 disponibles</strong></div>
          <ul><li><span>Preparaciones</span><strong>164</strong></li><li><span>Análisis</span><strong>139</strong></li><li><span>Acciones asistidas</span><strong>79</strong></li></ul>
          <p>Ejemplo ilustrativo. El producto muestra el consumo real de cada empresa.</p>
        </div>
      </section>

      <section className={`${styles.section} ${styles.softSection}`} aria-labelledby="situations-title">
        <SectionHeading eyebrow="DECISIÓN RÁPIDA" title="Empieza por la situación que reconoces." description="El recomendador y estas rutas orientan la conversación; no sustituyen la validación de necesidades." id="situations-title" />
        <div className={styles.scenarioGrid}>
          {scenarios.map((scenario) => <article key={scenario.plan}><span>{scenario.signal}</span><h3>{scenario.title}</h3><p>{scenario.text}</p><strong>{scenario.plan}</strong><Link href={`/contacto?motivo=acceso&plan=${scenario.href}`}>Comentar esta opción <ArrowRight aria-hidden="true" /></Link></article>)}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="faq-title">
        <SectionHeading eyebrow="CONDICIONES CLARAS" title="Preguntas antes de decidir." description="Lo importante debe entenderse antes de solicitar acceso." id="faq-title" />
        <div className={styles.faqList}>{pricingFaq.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
      </section>

      <section className={styles.finalCta}>
        <div><p className={styles.eyebrow}>SIGUIENTE PASO</p><h2>Valida el plan con tu operación real.</h2><p>Cuéntanos cuántas personas trabajan, qué quieres controlar y dónde necesitas más capacidad.</p></div>
        <div><Link className={styles.primaryButton} href="/contacto?motivo=acceso">Solicitar acceso <ArrowRight aria-hidden="true" /></Link><Link className={styles.secondaryButton} href="/demo">Explorar la demo</Link></div>
      </section>
    </div>
  );
}

function Recommender({ teamSize, setTeamSize, needsAi, setNeedsAi, workload, setWorkload, recommendation }: {
  teamSize: number;
  setTeamSize: (value: number) => void;
  needsAi: boolean;
  setNeedsAi: (value: boolean) => void;
  workload: "standard" | "high";
  setWorkload: (value: "standard" | "high") => void;
  recommendation: PricingPlan;
}) {
  return <aside className={styles.recommender} aria-labelledby="recommender-title">
    <header><span><SlidersHorizontal aria-hidden="true" /> Recomendador</span><em>Orientativo</em></header>
    <h2 id="recommender-title">Encuentra un punto de partida.</h2>
    <p>Responde tres preguntas. No se crea ninguna compra o suscripción.</p>
    <label className={styles.rangeLabel}><span>Personas que usarán Orqena <strong>{teamSize}</strong></span><input type="range" min="1" max="20" value={teamSize} onChange={(event) => setTeamSize(Number(event.target.value))} /></label>
    <label className={styles.switchLabel}><span><strong>Necesitamos Orqena IA</strong><small>Preparación y análisis asistidos</small></span><input type="checkbox" checked={needsAi} onChange={(event) => setNeedsAi(event.target.checked)} /><i aria-hidden="true" /></label>
    <label className={styles.selectLabel}><span>Volumen operativo</span><select value={workload} onChange={(event) => setWorkload(event.target.value as "standard" | "high")}><option value="standard">Estándar</option><option value="high">Alto</option></select></label>
    <div className={styles.recommendationResult} aria-live="polite"><span>Recomendación orientativa</span><strong>{recommendation.name}</strong><p>{recommendation.outcome}</p><div><span>{recommendation.users} usuarios</span><span>{recommendation.aiOperations ? `${recommendation.aiOperations.toLocaleString("es-ES")} IA/mes` : "Sin IA incluida"}</span></div><Link href={`/contacto?motivo=acceso&plan=${recommendation.key}`}>Comentar esta opción <ArrowRight aria-hidden="true" /></Link></div>
  </aside>;
}

function IntervalToggle({ interval, setInterval }: { interval: BillingInterval; setInterval: (value: BillingInterval) => void }) {
  return <div className={styles.intervalToggle} role="group" aria-label="Periodicidad del precio"><button type="button" aria-pressed={interval === "monthly"} onClick={() => setInterval("monthly")}>Mensual</button><button type="button" aria-pressed={interval === "annual"} onClick={() => setInterval("annual")}>Anual <span>2 meses incluidos</span></button></div>;
}

function PlanCard({ plan, interval, recommended }: { plan: PricingPlan; interval: BillingInterval; recommended: boolean }) {
  const amount = priceFor(plan, interval);
  const annualSaving = plan.monthly * 12 - plan.annual;
  return <article className={styles.planCard} data-featured={plan.featured || undefined}>
    <header><div><span>{plan.badge ?? plan.capabilityLevel}</span>{recommended && <em>Encaja con tu selección</em>}</div><h3>{plan.name}</h3><p>{plan.audience}</p></header>
    <div className={styles.price}><strong>{formatPrice(amount)} €</strong><span>+ IVA / {interval === "monthly" ? "mes" : "año"}</span></div>
    <div className={styles.planKpis}><div><span>Usuarios</span><strong>{plan.users}</strong></div><div><span>IA / mes</span><strong>{plan.aiOperations ? plan.aiOperations.toLocaleString("es-ES") : "—"}</strong></div><div><span>{interval === "annual" ? "Ahorro anual" : "Pago"}</span><strong>{interval === "annual" ? `${annualSaving} €` : "Mensual"}</strong></div></div>
    <div className={styles.coverage} aria-label={`Cobertura ${plan.name}`}>{plan.operationalCoverage.map((item) => <span key={item}>{item}</span>)}</div>
    <p className={styles.outcome}>{plan.outcome}</p>
    <ul>{plan.features.map((feature) => <li key={feature}><Check aria-hidden="true" />{feature}</li>)}</ul>
    <Link href={`/contacto?motivo=acceso&plan=${plan.key}`}>Solicitar acceso <ArrowRight aria-hidden="true" /></Link>
  </article>;
}

function TechnicalComparison() {
  return <div className={styles.comparison} role="region" aria-label="Comparación técnica de planes" tabIndex={0}><table><thead><tr><th>Capacidad</th>{pricingPlans.map((plan) => <th key={plan.key}>{plan.name}</th>)}</tr></thead>{comparisonGroups.map((group) => <tbody key={group.title}><tr className={styles.groupRow}><th colSpan={4}>{group.title}</th></tr>{group.rows.map(([label, ...values]) => <tr key={label}><th>{label}</th>{values.map((value, index) => <td key={`${label}-${index}`}>{value === "Incluido" ? <span className={styles.included}><Check aria-hidden="true" />{value}</span> : value}</td>)}</tr>)}</tbody>)}</table></div>;
}

function SectionHeading({ eyebrow, title, description, id }: { eyebrow: string; title: string; description: string; id: string }) {
  return <header className={styles.sectionHeading}><p className={styles.eyebrow}>{eyebrow}</p><h2 id={id}>{title}</h2><p>{description}</p></header>;
}

function formatPrice(value: number) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/gu, ".");
}
