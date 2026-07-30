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

type Scene = {
  label: string;
  input: string;
  prepared: string;
  decision: string;
  status: string;
  context: string;
  metric: readonly [string, string];
  nextAction: string;
};
type Stage = { id: string; label: string; title: string; outcome: string; action: string; icon: LucideIcon; scenes: readonly [Scene, Scene, Scene] };

const stages: readonly Stage[] = [
  { id: "contacto", label: "Contacto", title: "De una llamada a una visita preparada.", outcome: "Oportunidad preparada", action: "Confirmar visita", icon: Building2, scenes: [
    { label: "Entrada", input: "Audio de 46 s · cliente nuevo", prepared: "Nombre, necesidad y dirección", decision: "Revisar datos extraídos", status: "Conversación recibida", context: "Grupo Norte Demo · oficina", metric: ["Datos detectados", "6 de 7"], nextAction: "Resolver el teléfono pendiente" },
    { label: "Contexto", input: "Reforma integral de oficina", prepared: "Cliente y oportunidad relacionados", decision: "Elegir responsable", status: "Contexto conectado", context: "Oportunidad · Reforma Oficina Centro", metric: ["Valor orientativo", "24.600 €"], nextAction: "Asignar responsable comercial" },
    { label: "Siguiente paso", input: "Disponibilidad del viernes", prepared: "Visita · 10:30", decision: "Confirmar fecha", status: "Visita lista", context: "Marta Ruiz · agenda comercial", metric: ["Tiempo reservado", "45 min"], nextAction: "Confirmar visita con el cliente" },
  ] },
  { id: "presupuesto", label: "Presupuesto", title: "De la visita a una propuesta con margen.", outcome: "Propuesta revisable", action: "Revisar dudas", icon: CircleDollarSign, scenes: [
    { label: "Mediciones", input: "Notas de visita y 12 partidas", prepared: "Capítulos, unidades y cantidades", decision: "Comprobar mediciones", status: "Partidas ordenadas", context: "Presupuesto PR-104 · versión 2", metric: ["Coste base", "19.840 €"], nextAction: "Revisar 2 cantidades señaladas" },
    { label: "Margen", input: "Coste y precio previstos", prepared: "Precio objetivo y desviaciones", decision: "Aceptar objetivo", status: "Margen visible", context: "Reforma Oficina Centro", metric: ["Margen previsto", "28,4 %"], nextAction: "Confirmar precio de 24.600 €" },
    { label: "Revisión", input: "Plazo y forma de pago", prepared: "Dos dudas antes del envío", decision: "Resolver antes de compartir", status: "Propuesta revisable", context: "Cliente · Grupo Norte Demo", metric: ["Importe", "24.600 €"], nextAction: "Resolver plazo y primer pago" },
  ] },
  { id: "trabajo", label: "Trabajo", title: "De lo vendido a una obra coordinada.", outcome: "Plan coordinado", action: "Revisar plan", icon: ClipboardList, scenes: [
    { label: "Plan", input: "Presupuesto PR-104 aceptado", prepared: "3 hitos y 14 tareas enlazadas", decision: "Confirmar calendario", status: "Plan generado", context: "Trabajo TR-021 · Oficina Centro", metric: ["Duración prevista", "18 días"], nextAction: "Validar inicio el 5 de agosto" },
    { label: "Equipo", input: "4 responsables disponibles", prepared: "Carga y agenda relacionadas", decision: "Confirmar asignaciones", status: "Equipo coordinado", context: "Hito 1 · Preparación", metric: ["Carga asignada", "32 h"], nextAction: "Confirmar 4 responsables" },
    { label: "Incidencia", input: "Material incompleto", prepared: "Impacto sobre el hito y alternativas", decision: "Elegir respuesta", status: "Riesgo visible", context: "Hito 2 · Instalación", metric: ["Impacto estimado", "+1 día"], nextAction: "Reprogramar o cambiar proveedor" },
  ] },
  { id: "compras", label: "Compras", title: "De una factura al margen correcto.", outcome: "Coste validado", action: "Validar datos", icon: ReceiptText, scenes: [
    { label: "Documento", input: "Factura FR-882 · 2 páginas", prepared: "Proveedor, fecha e importes extraídos", decision: "Comprobar original", status: "Documento leído", context: "Materiales Levante Demo", metric: ["Total", "1.840,50 €"], nextAction: "Revisar base e IVA detectados" },
    { label: "Relación", input: "Total 1.840,50 € · IVA 21 %", prepared: "Trabajo y pedido compatibles", decision: "Confirmar vínculo", status: "Coste relacionado", context: "Trabajo TR-021 · pedido P-188", metric: ["Coincidencia", "98 %"], nextAction: "Relacionar con Oficina Centro" },
    { label: "Desviación", input: "Compra prevista: 1.760 €", prepared: "+80,50 € y efecto sobre margen", decision: "Aceptar o revisar", status: "Margen actualizado", context: "Capítulo · Material eléctrico", metric: ["Desviación", "+4,6 %"], nextAction: "Solicitar explicación al responsable" },
  ] },
  { id: "cobro", label: "Cobro", title: "Del hito al vencimiento bajo control.", outcome: "Caja prevista", action: "Revisar factura", icon: WalletCards, scenes: [
    { label: "Hito", input: "Certificación parcial confirmable", prepared: "Trabajo ejecutado y partidas facturables", decision: "Confirmar ejecución", status: "Hito listo", context: "Trabajo TR-021 · hito 2", metric: ["Facturable", "8.450 €"], nextAction: "Confirmar avance del 65 %" },
    { label: "Factura", input: "Cliente, dirección y datos fiscales", prepared: "Borrador F-2031 con trazabilidad", decision: "Revisar destinatario", status: "Factura revisable", context: "Grupo Norte Demo · PR-104", metric: ["Importe", "8.450 €"], nextAction: "Revisar antes de emitir" },
    { label: "Vencimiento", input: "Condición de pago a 30 días", prepared: "Previsión de cobro y recordatorio", decision: "Confirmar emisión", status: "Caja proyectada", context: "Tesorería · agosto", metric: ["Cobro previsto", "30 ago"], nextAction: "Emitir o devolver a revisión" },
  ] },
] as const;

const SCENE_MS = 3000;

export function ImmersiveJourney() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [inViewport, setInViewport] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [actionState, setActionState] = useState("Demo preparada. Pulsa reproducir para recorrerla.");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const autoStartedRef = useRef(false);
  const manualPlaybackRef = useRef(false);
  const stage = stages[activeIndex];
  const scene = stage.scenes[sceneIndex];
  const absoluteScene = activeIndex * 3 + sceneIndex;
  const totalScenes = stages.length * 3;
  const markManualInteraction = () => {
    autoStartedRef.current = true;
    manualPlaybackRef.current = true;
  };
  const playFilm = () => {
    const playback = videoRef.current?.play();
    if (!playback) return;
    void playback.catch(() => {
      setPlaying(false);
      setActionState("El vídeo no pudo iniciarse. Usa Reproducir para intentarlo de nuevo.");
    });
  };

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(media.matches);
      if (media.matches) {
        setPlaying(false);
        videoRef.current?.pause();
      }
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;
    let visibleTimer: number | null = null;
    const cancelVisibleTimer = () => {
      if (visibleTimer !== null) window.clearTimeout(visibleTimer);
      visibleTimer = null;
    };
    const observer = new IntersectionObserver(([entry]) => {
      const sufficientlyVisible = entry.isIntersecting && entry.intersectionRatio >= 0.35;
      setInViewport(sufficientlyVisible);
      if (!sufficientlyVisible) {
        cancelVisibleTimer();
        videoRef.current?.pause();
        return;
      }
      if (autoStartedRef.current && playing) playFilm();
      if (autoStartedRef.current || manualPlaybackRef.current || visibleTimer !== null) return;
      visibleTimer = window.setTimeout(() => {
        visibleTimer = null;
        if (autoStartedRef.current || manualPlaybackRef.current) return;
        autoStartedRef.current = true;
        setPlaying(true);
        playFilm();
        setActionState("Recorrido automático iniciado tras 2 segundos en pantalla.");
      }, 2000);
    }, { threshold: [0, 0.35, 0.7] });
    observer.observe(video);
    return () => {
      cancelVisibleTimer();
      observer.disconnect();
    };
  }, [playing, reducedMotion]);

  const move = (delta: number, manual = false) => {
    if (manual) markManualInteraction();
    const next = Math.max(0, Math.min(totalScenes - 1, absoluteScene + delta));
    setActiveIndex(Math.floor(next / 3));
    setSceneIndex(next % 3);
    setActionState(`${stages[Math.floor(next / 3)].label}: ${stages[Math.floor(next / 3)].scenes[next % 3].status}.`);
  };

  useEffect(() => {
    if (!playing || reducedMotion || !inViewport) return;
    if (absoluteScene === totalScenes - 1) {
      setPlaying(false);
      videoRef.current?.pause();
      return;
    }
    const timer = window.setTimeout(() => move(1), SCENE_MS);
    return () => window.clearTimeout(timer);
  }, [absoluteScene, inViewport, playing, reducedMotion]);

  const selectStage = (index: number, focus = false) => {
    markManualInteraction();
    const next = Math.max(0, Math.min(stages.length - 1, index));
    setActiveIndex(next); setSceneIndex(0); setActionState(`${stages[next].label}: ${stages[next].scenes[0].status}.`);
    if (focus) requestAnimationFrame(() => buttonRefs.current[next]?.focus());
  };
  const togglePlayback = () => {
    markManualInteraction();
    const nextPlaying = !playing;
    setPlaying(nextPlaying);
    if (nextPlaying && inViewport) playFilm();
    else videoRef.current?.pause();
    setActionState(nextPlaying ? "Recorrido reanudado por ti." : "Recorrido pausado por ti.");
  };
  const restart = () => {
    markManualInteraction();
    setActiveIndex(0);
    setSceneIndex(0);
    setPlaying(!reducedMotion);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      if (!reducedMotion && inViewport) playFilm();
    }
    setActionState(reducedMotion ? "Recorrido reiniciado. Avanza manualmente entre escenas." : "Recorrido reiniciado desde Contacto.");
  };
  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") { event.preventDefault(); move(1, true); }
    if (event.key === "ArrowLeft") { event.preventDefault(); move(-1, true); }
    if (event.key === " ") { event.preventDefault(); togglePlayback(); }
    if (event.key === "Home") { event.preventDefault(); restart(); }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(stages.length - 1);
      setSceneIndex(2);
      setPlaying(false);
      videoRef.current?.pause();
    }
  };

  return (
    <section id="como-funciona" className={styles.guidedSection} aria-labelledby="immersive-title">
      <div className={styles.guidedIntro}>
        <span>Demo guiada</span><h2 id="immersive-title">Cinco decisiones. Quince escenas. Un único hilo.</h2>
        <p>Reproduce el caso sintético, avanza con el teclado o abre cada etapa. Nada se escribe y cada decisión sigue bajo control humano.</p>
        <div className={styles.guidedFilm}>
          <video
            ref={videoRef}
            aria-label="Orqena en acción: trabajo de campo y control operativo"
            loop
            muted
            playsInline
            poster="/media/orqena-marketing/scene-01-site.png"
            preload="metadata"
          >
            <source src="/media/orqena-marketing/orqena-field-os-film-v1.mp4" type="video/mp4" />
          </video>
          <span><i aria-hidden="true" />Orqena en acción · 16 s</span>
        </div>
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
        <div className={styles.guidedSceneDots} aria-label="Microescenas de la etapa">{stage.scenes.map((item, index) => <button key={item.label} type="button" aria-current={index === sceneIndex ? "step" : undefined} onClick={() => { markManualInteraction(); setSceneIndex(index); setActionState(`${stage.label}: ${item.status}.`); }}>{item.label}</button>)}</div>
        <div className={styles.guidedFooter}><span role="status"><Bot /> {actionState}</span><div><button type="button" onClick={restart} aria-label="Reiniciar demo"><RotateCcw /></button><button type="button" onClick={() => move(-1, true)} disabled={absoluteScene === 0}><ArrowLeft />Anterior</button><button type="button" onClick={togglePlayback} disabled={reducedMotion}>{playing ? <><Pause />Pausar</> : <><Play />Reproducir</>}</button><button type="button" onClick={() => move(1, true)} disabled={absoluteScene === totalScenes - 1}>Siguiente <ArrowRight /></button></div></div>
      </div>
    </section>
  );
}

function StagePreview({ stageIndex, sceneIndex, actionState }: { stageIndex: number; sceneIndex: number; actionState: string }) {
  const stage = stages[stageIndex]; const scene = stage.scenes[sceneIndex]; const Icon = stage.icon;
  const metrics = [["Estado", scene.status], ["Contexto", scene.context], [scene.metric[0], scene.metric[1]]] as const;
  return <div className={styles.stagePreview}><header className={styles.previewHeader}><span><Icon />{stage.label} · {scene.label}</span><em>Escena {sceneIndex + 1}/3</em></header><div className={styles.previewRows}>{metrics.map(([label, value]) => <span key={label}><small>{label}</small><strong>{value}</strong></span>)}</div><div className={styles.previewNotice}><FileCheck2 /><span><strong>Próxima acción</strong><small>{scene.nextAction}</small></span><em title={actionState}>{stage.outcome}</em></div></div>;
}
