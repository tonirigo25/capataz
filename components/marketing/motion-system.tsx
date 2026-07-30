"use client";

import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export function useInViewportPlayback<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    if (!ref.current || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.3,
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}

export function useDocumentVisibilityPause() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState === "visible");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  return visible;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function ReducedMotionFallback({ children }: { children: ReactNode }) {
  return <div className="scene-reduced-fallback">{children}</div>;
}

export function SceneStage({
  active,
  children,
  className = "",
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`scene-stage ${active ? "is-active" : ""} ${className}`} aria-hidden={!active}>
      {children}
    </div>
  );
}

export function SceneProgress({
  labels,
  activeIndex,
  onSelect,
}: {
  labels: readonly string[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="scene-progress" role="tablist" aria-label="Etapas de la demostración">
      {labels.map((label, index) => (
        <button
          type="button"
          role="tab"
          key={label}
          aria-selected={activeIndex === index}
          className={activeIndex === index ? "is-active" : undefined}
          onClick={() => onSelect(index)}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
          {label}
        </button>
      ))}
    </div>
  );
}

export function PlaybackControls({
  playing,
  onToggle,
  onPrevious,
  onNext,
  onRestart,
}: {
  playing: boolean;
  onToggle: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="scene-controls" aria-label="Controles de la demostración">
      <button type="button" onClick={onPrevious} aria-label="Etapa anterior"><ChevronLeft size={16} /></button>
      <button type="button" onClick={onToggle} aria-label={playing ? "Pausar" : "Reproducir"}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
        <span>{playing ? "Pausar" : "Reproducir"}</span>
      </button>
      <button type="button" onClick={onNext} aria-label="Etapa siguiente"><ChevronRight size={16} /></button>
      <button type="button" onClick={onRestart} aria-label="Reiniciar"><RotateCcw size={15} /></button>
    </div>
  );
}

export function DemoController({
  labels,
  interval = 3000,
  autoplay = false,
  children,
}: {
  labels: readonly string[];
  interval?: number;
  autoplay?: boolean;
  children: (state: {
    activeIndex: number;
    playing: boolean;
    reducedMotion: boolean;
    select: (index: number) => void;
    toggle: () => void;
    previous: () => void;
    next: () => void;
    restart: () => void;
  }) => ReactNode;
}) {
  const { ref, inView } = useInViewportPlayback<HTMLDivElement>();
  const documentVisible = useDocumentVisibilityPause();
  const reducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const [engaged, setEngaged] = useState(false);
  const cycles = useRef(0);

  const select = useCallback((index: number) => {
    setActiveIndex((index + labels.length) % labels.length);
    setPlaying(false);
  }, [labels.length]);

  const nextAuto = useCallback(() => {
    setActiveIndex((current) => {
      const next = (current + 1) % labels.length;
      if (next === 0) cycles.current += 1;
      return next;
    });
  }, [labels.length]);

  useEffect(() => {
    if (!playing || !inView || !documentVisible || engaged || reducedMotion || cycles.current >= 2) return;
    const timer = window.setInterval(nextAuto, interval);
    return () => window.clearInterval(timer);
  }, [documentVisible, engaged, inView, interval, nextAuto, playing, reducedMotion]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      select(activeIndex + 1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      select(activeIndex - 1);
    }
    if (event.key === " ") {
      event.preventDefault();
      setPlaying((current) => !current);
    }
  };

  return (
    <div
      ref={ref}
      className="demo-controller"
      onMouseEnter={() => setEngaged(true)}
      onMouseLeave={() => setEngaged(false)}
      onFocusCapture={() => setEngaged(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setEngaged(false);
      }}
      onKeyDown={onKeyDown}
    >
      {children({
        activeIndex,
        playing: playing && inView && documentVisible && !engaged,
        reducedMotion,
        select,
        toggle: () => setPlaying((current) => !current),
        previous: () => select(activeIndex - 1),
        next: () => select(activeIndex + 1),
        restart: () => {
          cycles.current = 0;
          setActiveIndex(0);
          setPlaying(autoplay);
        },
      })}
    </div>
  );
}

export type ProductSceneStage = {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  metric: string;
  meta: string;
};

export function ProductScene({
  id,
  title,
  stages,
  accent = "brand",
  autoplay = false,
  device = true,
  composition = "workspace",
  render,
}: {
  id: string;
  title: string;
  stages: readonly ProductSceneStage[];
  accent?: "brand" | "blue" | "sand";
  autoplay?: boolean;
  device?: boolean;
  composition?: "workspace" | "timeline" | "mosaic" | "ledger";
  render?: (stage: ProductSceneStage, index: number) => ReactNode;
}) {
  const labels = useMemo(() => stages.map((stage) => stage.label), [stages]);
  return (
    <DemoController labels={labels} autoplay={autoplay}>
      {({ activeIndex, playing, reducedMotion, select, toggle, previous, next, restart }) => {
        const stage = reducedMotion ? stages[stages.length - 1] : stages[activeIndex];
        const shownIndex = reducedMotion ? stages.length - 1 : activeIndex;
        return (
          <section className={`product-scene product-scene--${accent} product-scene--${composition}`} aria-labelledby={`${id}-title`} data-autoplay={autoplay ? "true" : "false"}>
            <div className="product-scene__topline">
              <div>
                <span>{stage.eyebrow}</span>
                <h3 id={`${id}-title`}>{title}</h3>
              </div>
              <PlaybackControls
                playing={playing}
                onToggle={toggle}
                onPrevious={previous}
                onNext={next}
                onRestart={restart}
              />
            </div>
            <SceneProgress labels={labels} activeIndex={shownIndex} onSelect={select} />
            <div className="product-scene__canvas" aria-live="polite">
              <div className="product-scene__rail" aria-hidden="true">
                {stages.map((item, index) => (
                  <span key={item.id} className={index <= shownIndex ? "is-complete" : undefined}>
                    <i>{index + 1}</i><b>{item.label}</b>
                  </span>
                ))}
              </div>
              <div className="product-scene__workspace">
                <div className="product-scene__copy">
                  <span>{stage.label}</span>
                  <h4>{stage.title}</h4>
                  <p>{stage.description}</p>
                </div>
                <div className="product-scene__metric">
                  <span>{stage.meta}</span>
                  <strong>{stage.metric}</strong>
                  <i>Actualizado ahora</i>
                </div>
                {render ? render(stage, shownIndex) : <DefaultSceneRows stage={stage} index={shownIndex} />}
              </div>
              {device ? <div className="product-scene__phone" aria-label="Vista móvil sincronizada">
                <span className="product-scene__phone-bar" />
                <small>Hoy</small>
                <strong>{stage.label}</strong>
                <div><i style={{ width: `${Math.max(22, ((shownIndex + 1) / stages.length) * 100)}%` }} /></div>
                <p>{stage.title}</p>
                <button type="button" tabIndex={-1}>Ver detalle</button>
              </div> : null}
            </div>
            {reducedMotion ? <ReducedMotionFallback>Movimiento reducido: se muestra el estado final.</ReducedMotionFallback> : null}
          </section>
        );
      }}
    </DemoController>
  );
}

function DefaultSceneRows({ stage, index }: { stage: ProductSceneStage; index: number }) {
  return (
    <div className="product-scene__rows">
      <div><span>Actividad</span><strong>{stage.description}</strong><i>Ahora</i></div>
      <div><span>Responsable</span><strong>{index % 2 ? "Equipo comercial" : "Coordinación"}</strong><i>Asignado</i></div>
      <div><span>Siguiente paso</span><strong>{index === 0 ? "Preparar propuesta" : "Continuar el flujo"}</strong><i>Revisar</i></div>
    </div>
  );
}
