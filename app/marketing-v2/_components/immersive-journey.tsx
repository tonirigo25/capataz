"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Building2,
  Check,
  CircleDollarSign,
  ClipboardList,
  FileCheck2,
  Pause,
  Play,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import styles from "./public-home.module.css";

type Scene = { label: string; input: string; prepared: string; decision: string; status: string };
type Stage = { id: string; label: string; title: string; outcome: string; action: string; icon: LucideIcon; scenes: readonly [Scene, Scene, Scene] };

const stages: readonly Stage[] = [
  { id: "contacto", label: "Contacto", title: "De una llamada a una visita preparada.", outcome: "Oportunidad preparada", action: "Confirmar visita", icon: Building2, scenes: [
    { label: "Entrada", input: "Audio de 46 s · cliente nuevo", prepared: "Nombre, necesidad y dirección", decision: "Revisar datos extraídos", status: "Conversación recibida" },
    { label: "Contexto", input: "Reforma integral de oficina", prepared: "Cliente y oportunidad relacionados", decision: "Elegir responsable", status: "Contexto conectado" },
    { label: "Siguiente paso", input: "Disponibilidad del viernes", prepared: "Visita · 10:30", decision: "Confirmar fecha", status: "Visita lista" },
  ] },
  { id: "presupuesto", label: "Presupuesto", title: "De la visita a una propuesta con margen.", outcome: "Propuesta revisable", action: "Revisar dudas", icon: CircleDollarSign, scenes: [
    { label: "Mediciones", input: "Notas y 12 partidas", prepared: "Base de 19.840 €", decision: "Comprobar cantidades", status: "Partidas ordenadas" },
    { label: "Margen", input: "Coste y precio previstos", prepared: "24.600 € · margen 28,4 %", decision: "Aceptar objetivo", status: "Margen visible" },
    { label: "Revisión", input: "Plazo y forma de pago", prepared: "Dos dudas señaladas", decision: "Resolver antes de enviar", status: "Borrador seguro" },
  ] },
  { id: "trabajo", label: "Trabajo", title: "De lo vendido a una obra coordinada.", outcome: "Plan coordinado", action: "Revisar plan", icon: ClipboardList, scenes: [
    { label: "Plan", input: "Presupuesto PR-104 aceptado", prepared: "3 hitos · 14 tareas", decision: "Confirmar calendario", status: "Plan generado" },
    { label: "Equipo", input: "4 responsables disponibles", prepared: "Carga y agenda relacionadas", decision: "Confirmar asignaciones", status: "Equipo coordinado" },
    { label: "Incidencia", input: "Material incompleto", prepared: "Impacto sobre el hito", decision: "Elegir respuesta", status: "Riesgo visible" },
  ] },
  { id: "compras", label: "Compras", title: "De una factura al margen correcto.", outcome: "Coste validado", action: "Validar datos", icon: ReceiptText, scenes: [
    { label: "Documento", input: "Factura FR-882 · 2 páginas", prepared: "Proveedor e importe extraídos", decision: "Comprobar original", status: "Documento leído" },
    { label: "Relación", input: "1.840,50 € · IVA 21 %", prepared: "Obra Costa Norte encontrada", decision: "Confirmar vínculo", status: "Coste relacionado" },
    { label: "Desviación", input: "Compra prevista: 1.760 €", prepared: "+80,50 € de desviación", decision: "Aceptar o revisar", status: "Margen actualizado" },
  ] },
  { id: "cobro", label: "Cobro", title: "Del hito al vencimiento bajo control.", outcome: "Caja prevista", action: "Revisar factura", icon: WalletCards, scenes: [
    { label: "Hito", input: "Certificación parcial", prepared: "8.450 € facturables", decision: "Confirmar trabajo", status: "Hito listo" },
    { label: "Factura", input: "Cliente y datos fiscales", prepared: "F-2031 preparada", decision: "Revisar destinatario", status: "Factura revisable" },
    { label: "Vencimiento", input: "Condición de pago a 30 días", prepared: "Cobro previsto · 30 ago", decision: "Confirmar emisión", status: "Caja proyectada" },
  ] },
] as const;

const SCENE_MS = 3600;

export function ImmersiveJourney() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [actionState, setActionState] = useState("Demo preparada. Pulsa reproducir para recorrerla.");
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const stage = stages[activeIndex];
  const scene = stage.scenes[sceneIndex];
  const absoluteScene = activeIndex * 3 + sceneIndex;
  const totalScenes = stages.length * 3;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setReducedMotion(media.matches); if (media.matches) setPlaying(false); };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const move = (delta: number) => {
    const next = Math.max(0, Math.min(totalScenes - 1, absoluteScene + delta));
    setActiveIndex(Math.floor(next / 3));
    setSceneIndex(next % 3);
    setActionState(`${stages[Math.floor(next / 3)].label}: ${stages[Math.floor(next / 3)].scenes[next % 3].status}.`);
  };

  useEffect(() => {
    if (!playing || reducedMotion) return;
    if (absoluteScene === totalScenes - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => move(1), SCENE_MS);
    return () => window.clearTimeout(timer);
  }, [absoluteScene, playing, reducedMotion]);

  const selectStage = (index: number, focus = false) => {
    const next = Math.max(0, Math.min(stages.length - 1, index));
    setActiveIndex(next); setSceneIndex(0); setActionState(`${stages[next].label}: ${stages[next].scenes[0].status}.`);
    if (focus) requestAnimationFrame(() => buttonRefs.current[next]?.focus());
  };
  const restart = () => { setActiveIndex(0); setSceneIndex(0); setPlaying(!reducedMotion); setActionState("Recorrido reiniciado desde Contacto."); };
  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
    if (event.key === " ") { event.preventDefault(); setPlaying((current) => !current); }
    if (event.key === "Home") { event.preventDefault(); restart(); }
    if (event.key === "End") { event.preventDefault(); setActiveIndex(stages.length - 1); setSceneIndex(2); setPlaying(false); }
  };

  return (
    <section id="como-funciona" className={styles.guidedSection} aria-labelledby="immersive-title">
      <div className={styles.guidedIntro}>
        <span>Demo guiada</span><h2 id="immersive-title">Cinco decisiones. Quince escenas. Un único hilo.</h2>
        <p>Reproduce el caso sintético, avanza con el teclado o abre cada etapa. Nada se escribe y cada decisión sigue bajo control humano.</p>
        <Link href="/demo#quick-demo">Abrir demo completa <ArrowRight /></Link>
      </div>
      <div className={styles.guidedConsole} tabIndex={0} onKeyDown={handleKey} aria-label="Demo guiada interactiva">
        <div className={styles.guidedTopbar}><span>Reforma Costa Norte · {scene.label}</span><strong>{String(absoluteScene + 1).padStart(2, "0")} / {totalScenes}</strong><i aria-hidden="true"><b style={{ width: `${((absoluteScene + 1) / totalScenes) * 100}%` }} /></i></div>
        <nav className={styles.guidedNav} aria-label="Etapas de la demo guiada">
          {stages.map((item, index) => { const Icon = item.icon; return <button ref={(node) => { buttonRefs.current[index] = node; }} key={item.id} type="button" aria-current={index === activeIndex ? "step" : undefined} onClick={() => selectStage(index)}><span>{index < activeIndex ? <Check /> : String(index + 1).padStart(2, "0")}</span><Icon /><strong>{item.label}</strong></button>; })}
        </nav>
        <div className={styles.guidedPanel} aria-live="polite" key={`${stage.id}-${sceneIndex}`}>
          <div className={styles.guidedStory}><span>{stage.label} · {scene.label}</span><h3>{stage.title}</h3><dl><div><dt>Entra</dt><dd>{scene.input}</dd></div><div><dt>Orqena prepara</dt><dd>{scene.prepared}</dd></div><div><dt>Tú confirmas</dt><dd>{scene.decision}</dd></div></dl><button type="button" onClick={() => setActionState(`${stage.outcome}. Simulación completada; no se han escrito datos.`)}>{stage.action} <ArrowRight /></button><strong><ShieldCheck />{stage.outcome}</strong></div>
          <StagePreview stageIndex={activeIndex} sceneIndex={sceneIndex} actionState={actionState} />
        </div>
        <div className={styles.guidedSceneDots} aria-label="Microescenas de la etapa">{stage.scenes.map((item, index) => <button key={item.label} type="button" aria-current={index === sceneIndex ? "step" : undefined} onClick={() => { setSceneIndex(index); setActionState(`${stage.label}: ${item.status}.`); }}>{item.label}</button>)}</div>
        <div className={styles.guidedFooter}><span role="status"><Bot /> {actionState}</span><div><button type="button" onClick={restart} aria-label="Reiniciar demo"><RotateCcw /></button><button type="button" onClick={() => move(-1)} disabled={absoluteScene === 0}><ArrowLeft />Anterior</button><button type="button" onClick={() => setPlaying((current) => !current)} disabled={reducedMotion}>{playing ? <><Pause />Pausar</> : <><Play />Reproducir</>}</button><button type="button" onClick={() => move(1)} disabled={absoluteScene === totalScenes - 1}>Siguiente <ArrowRight /></button></div></div>
      </div>
    </section>
  );
}

function StagePreview({ stageIndex, sceneIndex, actionState }: { stageIndex: number; sceneIndex: number; actionState: string }) {
  const stage = stages[stageIndex]; const scene = stage.scenes[sceneIndex]; const Icon = stage.icon;
  const metrics = stageIndex === 0 ? [["Cliente", "Grupo Norte Demo"], ["Responsable", "Marta López"], ["Próxima acción", "Visita · viernes 10:30"]] : stageIndex === 1 ? [["Partidas", "12"], ["Presupuesto", "24.600 €"], ["Margen", "28,4 %"]] : stageIndex === 2 ? [["Hitos", "3"], ["Tareas", "14"], ["Progreso", "64 %"]] : stageIndex === 3 ? [["Proveedor", "Suministros Norte"], ["Total", "1.840,50 €"], ["Confianza", "98 %"]] : [["Factura", "F-2031"], ["Importe", "8.450 €"], ["Vencimiento", "30 ago"]];
  return <div className={styles.stagePreview}><header className={styles.previewHeader}><span><Icon />{scene.status}</span><em>Escena {sceneIndex + 1}/3</em></header><div className={styles.previewRows}>{metrics.map(([label, value]) => <span key={label}><small>{label}</small><strong>{value}</strong></span>)}</div><div className={styles.previewNotice}><FileCheck2 /><span><strong>{stage.outcome}</strong><small>{actionState}</small></span></div></div>;
}
