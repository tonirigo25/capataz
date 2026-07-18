"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Bot,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileText,
  Hammer,
  History,
  MessageCircle,
  Mic,
  PackagePlus,
  Pencil,
  Send,
  Square,
  Trash2,
  UserPlus,
  UserRound
} from "lucide-react";
import { reprogramAgendaEvent, updateAgendaEventStatus } from "@/app/(app)/agenda/actions";
import {
  archiveChatConversation,
  createChatConversation,
  deleteChatConversation,
  getOrCreateInitialConversation,
  loadChatConversations,
  renameChatConversation,
  runChatCommand,
  type ChatActionResult,
  type ChatCommandContext,
  type ChatHistoryConversation
} from "@/app/(app)/capataz/actions";
import { saveCompanySettings, saveUserProfile } from "@/app/(app)/configuracion/actions";
import { registerPayment } from "@/app/(app)/dinero/actions";
import { saveManualRecord } from "@/app/(app)/gestion/actions";
import { convertBudgetToWork } from "@/app/(app)/presupuestos/actions";
import { updateWorkStatus } from "@/app/(app)/obras/actions";
import { DemoLimitButton } from "@/components/demo-limit-button";
import { canApplyConversationLoad } from "@/lib/chat-conversation-rules";
import { formatCurrency } from "@/lib/format";

type ChatData = {
  userProfile: {
    id: string;
    nombre: string | null;
    apellidos: string | null;
    nombrePreferido: string | null;
    telefono: string | null;
    email: string | null;
    cargo: string | null;
    oficioPrincipal: string | null;
    tonoPreferido: string;
  } | null;
  company: {
    id: string;
    nombreComercial: string;
    razonSocial: string | null;
    nifCif: string | null;
    direccionFiscal: string | null;
    codigoPostal: string | null;
    ciudad: string | null;
    provincia: string | null;
    pais: string;
    telefono: string | null;
    email: string | null;
    web: string | null;
    iban: string | null;
    condicionesPorDefecto: string | null;
    textoLegal: string | null;
    logoUrl: string | null;
    selloUrl: string | null;
    colorMarca: string;
    ivaDefecto: number;
    seriePresupuestos: string;
    serieFacturas: string;
    prefijoPresupuesto: string;
    prefijoFactura: string;
  } | null;
  completion: {
    profile: { percent: number; missingRequired: string[]; missingRecommended: string[] };
    company: { percent: number; missingRequired: string[]; missingRecommended: string[] };
  };
  clients: { id: string; nombre: string; estado: string }[];
  works: { id: string; titulo: string; clientName: string }[];
  invoices: { id: string; numero: string; clientName: string; concepto: string; pendiente: number; estado: string }[];
  budgets: { id: string; numero: string; clientName: string; titulo: string; total: number; estado: string }[];
  materials: { nombre: string; cantidad: string; estado: string; workTitle: string; clientName: string }[];
  agendaEvents: {
    id: string;
    source: string;
    title: string;
    type: string;
    status: string;
    startsAt: string;
    clientId: string | null;
    clientName: string | null;
    invoiceId: string | null;
    invoiceNumber: string | null;
    budgetId: string | null;
    budgetNumber: string | null;
    editable: boolean;
  }[];
  demoLimits: {
    clientsCount: number;
    clientsLimit: number;
    budgetCount: number;
    budgetLimit: number;
    activeWorks: number;
    activeWorkLimit: number;
    programmedReminders: number;
    reminderLimit: number;
  };
  operationalContext: {
    entityType: "cliente" | "obra";
    entityName: string;
    phrase: string;
    nextStep: string;
    urgent: number;
    attention: number;
    suggestions: string[];
  } | null;
};

type ActionCard =
  | {
      type: "expense";
      workId: string;
      concept: string;
      amount: number;
    }
  | {
      type: "payment";
      invoiceId: string;
      amount: number;
    }
  | {
      type: "follow-up";
      clientId: string;
      budgetId: string;
      invoiceId?: string;
      reminderType?: "seguimiento_presupuesto" | "recordatorio_factura" | "factura_vencida";
      message: string;
      dateTime: string;
    }
  | {
      type: "client";
      clientName: string;
      job: string;
    }
  | {
      type: "visit";
      clientId: string;
      message: string;
      dateTime: string;
    }
  | {
      type: "budget";
      clientId: string;
      title: string;
      amount: number;
    }
  | {
      type: "invoice";
      clientId: string;
      workId: string;
      concept: string;
      amount: number;
    }
  | {
      type: "accept-budget";
      budgetId: string;
    }
  | {
      type: "close-work";
      workId: string;
    }
  | {
      type: "agenda-event";
      eventType: string;
      title: string;
      description: string;
      clientId: string;
      workId?: string;
      budgetId?: string;
      invoiceId?: string;
      dateTime: string;
      requiereConfirmacion: boolean;
    }
  | {
      type: "agenda-reprogram";
      eventId: string;
      title: string;
      dateTime: string;
    }
  | {
      type: "agenda-status";
      eventId: string;
      title: string;
      status: "realizado" | "cancelado";
    }
  | {
      type: "user-profile";
      profile: {
        id: string;
        nombre: string;
        apellidos: string;
        nombrePreferido: string;
        telefono: string;
        email: string;
        cargo: string;
        oficioPrincipal: string;
        tonoPreferido: string;
      };
    }
  | {
      type: "company-settings";
      company: {
        id: string;
        nombreComercial: string;
        razonSocial: string;
        nifCif: string;
        direccionFiscal: string;
        codigoPostal: string;
        ciudad: string;
        provincia: string;
        pais: string;
        telefono: string;
        email: string;
        web: string;
        iban: string;
        condicionesPorDefecto: string;
        textoLegal: string;
        logoUrl: string;
        selloUrl: string;
        colorMarca: string;
        ivaDefecto: number;
        seriePresupuestos: string;
        serieFacturas: string;
        prefijoPresupuesto: string;
        prefijoFactura: string;
      };
    };

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
  result?: ChatActionResult;
  card?: ActionCard;
  status?: string;
  retryText?: string;
};

type ProfileCardFields = Extract<ActionCard, { type: "user-profile" }>["profile"];
type CompanyCardFields = Extract<ActionCard, { type: "company-settings" }>["company"];

const samples = [
  "Créame un presupuesto para un cliente nuevo de reforma integral, cocina + baño, por 14000 euros con material incluido",
  "Hazme un presupuesto para cambiar un baño por 6.500 euros",
  "Presupuesto para pintar un piso completo por 2300 más IVA",
  "Apunta 86 euros de material para una obra.",
  "¿Quién me debe dinero?"
];

const quickCreates = [
  { href: "/gestion?tipo=cliente&returnTo=/capataz", label: "Cliente" },
  { href: "/gestion?tipo=eventoAgenda&tipoEvento=visita&returnTo=/capataz", label: "Visita" },
  { href: "/gestion?tipo=presupuesto&returnTo=/capataz", label: "Presupuesto" },
  { href: "/gestion?tipo=factura&returnTo=/capataz", label: "Factura" },
  { href: "/gestion?tipo=gasto&returnTo=/capataz", label: "Gasto" },
  { href: "/gestion?tipo=pago&returnTo=/capataz", label: "Pago" },
  { href: "/gestion?tipo=recordatorio&returnTo=/capataz", label: "Recordatorio" }
];

const chatConversationStorageKey = "capataz-chat-conversation-id";
const defaultProgressSteps = [
  "Leyendo tu mensaje...",
  "Analizando datos...",
  "Buscando cliente/obra...",
  "Preparando respuesta...",
  "Guardando cambios..."
];

export function CapatazChat({ data }: { data: ChatData }) {
  const router = useRouter();
  const displayName = userName(data);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [progressSteps, setProgressSteps] = useState(defaultProgressSteps);
  const [progressIndex, setProgressIndex] = useState(0);
  const [showExamples, setShowExamples] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [chatContext, setChatContext] = useState<ChatCommandContext | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [conversations, setConversations] = useState<ChatHistoryConversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [chatState, setChatState] = useState<"booting" | "ready" | "sending" | "failed">("booting");
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "recording" | "transcribing" | "error">("idle");
  const [voiceError, setVoiceError] = useState("");
  const inFlightRef = useRef(false);
  const mountedRef = useRef(false);
  const loadRequestRef = useRef(0);
  const activeConversationRef = useRef("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    welcomeMessage(displayName)
  ]);

  const pendingDebt = useMemo(() => data.invoices.filter((invoice) => invoice.pendiente > 0), [data.invoices]);
  const missingProfile = data.completion.profile.missingRequired.length + data.completion.profile.missingRecommended.length;
  const missingCompany = data.completion.company.missingRequired.length + data.completion.company.missingRecommended.length;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, isSending, progressIndex]);

  useEffect(() => {
    if (!isSending) return;
    setProgressIndex(0);
    const timers = [
      window.setTimeout(() => setProgressIndex((index) => Math.max(index, 1)), 550),
      window.setTimeout(() => setProgressIndex((index) => Math.max(index, 2)), 1400),
      window.setTimeout(() => setProgressIndex((index) => Math.max(index, 3)), 2800),
      window.setTimeout(() => setProgressIndex((index) => Math.max(index, 4)), 5200),
      window.setTimeout(() => setProgressSteps((steps) => [...steps.slice(0, 5), "Estoy tardando más de lo normal, sigo trabajando..."]), 9000),
      window.setTimeout(() => setProgressIndex(5), 9200)
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [isSending]);

  useEffect(() => {
    mountedRef.current = true;
    bootConversation();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function bootConversation() {
    const requestId = ++loadRequestRef.current;
    setChatState("booting");
    try {
      const preferred = safeLocalStorageGet(chatConversationStorageKey);
      const initial = await getOrCreateInitialConversation(preferred);
      if (!mountedRef.current || requestId !== loadRequestRef.current) return;
      activeConversationRef.current = initial.selected.id;
      setConversationId(initial.selected.id);
      setConversations(initial.conversations);
      setMessages(messagesFromConversation(initial.selected, displayName));
      setChatContext(contextFromConversation(initial.selected));
      safeLocalStorageSet(chatConversationStorageKey, initial.selected.id);
      setChatState("ready");
    } catch {
      if (!mountedRef.current || requestId !== loadRequestRef.current) return;
      setMessages([welcomeMessage(displayName)]);
      setChatState("failed");
    }
  }

  async function refreshConversations(nextSelectedId = conversationId, syncSelected = false) {
    const expectedId = nextSelectedId || activeConversationRef.current;
    const requestId = ++loadRequestRef.current;
    try {
      const loaded = await loadChatConversations(false);
      if (!mountedRef.current || !canApplyConversationLoad(expectedId, activeConversationRef.current || expectedId, requestId, loadRequestRef.current)) return;
      setConversations(loaded);
      const selected = loaded.find((item) => item.id === expectedId);
      if (syncSelected && selected && selected.id === activeConversationRef.current) {
        setConversationId(selected.id);
        setMessages(messagesFromConversation(selected, displayName));
        setChatContext(contextFromConversation(selected));
      }
    } catch {
      // Si falla el historial, mantenemos vivo el chat actual en pantalla.
    }
  }

  function persistChatContext(nextContext: ChatCommandContext | null) {
    setChatContext(nextContext);
  }

  async function submit(event?: FormEvent<HTMLFormElement>, forced?: string) {
    event?.preventDefault();
    const text = (forced ?? input).trim();
    if (!text || inFlightRef.current || !conversationId) return;

    const userMessageId = crypto.randomUUID();
    const idempotencyKey = `chat:${userMessageId}`;
    const sendingConversationId = conversationId;
    const userMessage: Message = { id: userMessageId, role: "user", text };
    const startedAt = Date.now();
    setProgressSteps(progressStepsForMessage(text));
    setProgressIndex(0);
    setMessages((current) => [...current, userMessage]);
    setInput("");
    inFlightRef.current = true;
    setIsSending(true);
    setChatState("sending");
    let failed = false;

    try {
      if (process.env.NEXT_PUBLIC_APP_ENV !== "production") console.info("[capataz-chat] mensaje recibido", { text, chatContext });
      const command = await runChatCommand(text, chatContext, { messageId: userMessageId, idempotencyKey, conversationId: sendingConversationId, clientStartedAt: startedAt });
      if (process.env.NEXT_PUBLIC_APP_ENV !== "production") console.info("[capataz-chat] resultado accion", command);
      if (!mountedRef.current || activeConversationRef.current !== sendingConversationId) return;
      const assistantMessage: Message = command.handled
        ? { id: crypto.randomUUID(), role: "assistant", text: command.text, result: command.result }
        : { id: crypto.randomUUID(), role: "assistant", ...respond(text, data, pendingDebt) };
      setMessages((current) => [...current, assistantMessage]);
      if (command.clearContext) persistChatContext(null);
      else if (command.context !== undefined) persistChatContext(command.context);
      if (command.created) router.refresh();
      refreshConversations(sendingConversationId);
    } catch {
      failed = true;
      if (!mountedRef.current || activeConversationRef.current !== sendingConversationId) return;
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "No he podido guardar la acción ahora mismo. No he enviado nada al cliente. No se realizó ninguna acción nueva, salvo que el registro aparezca ya creado en la conversación. Puedes reintentar sin duplicar usando el mismo mensaje.",
          status: "failed",
          retryText: text
        }
      ]);
      setChatState("failed");
    } finally {
      if (process.env.NEXT_PUBLIC_APP_ENV !== "production") console.info("[capataz-chat] render total", { durationMs: Date.now() - startedAt });
      inFlightRef.current = false;
      setIsSending(false);
      if (mountedRef.current && activeConversationRef.current === sendingConversationId && !failed) setChatState("ready");
    }
  }

  async function startNewConversation() {
    if (inFlightRef.current) return;
    const conversation = await createChatConversation("Nueva conversación");
    activeConversationRef.current = conversation.id;
    setConversationId(conversation.id);
    persistChatContext(null);
    setMessages([welcomeMessage(displayName)]);
    setInput("");
    setChatState("ready");
    safeLocalStorageSet(chatConversationStorageKey, conversation.id);
    setShowHistory(false);
    await refreshConversations(conversation.id);
  }

  function openConversation(conversation: ChatHistoryConversation) {
    activeConversationRef.current = conversation.id;
    setConversationId(conversation.id);
    setMessages(messagesFromConversation(conversation, displayName));
    persistChatContext(contextFromConversation(conversation));
    safeLocalStorageSet(chatConversationStorageKey, conversation.id);
    setChatState("ready");
    setShowHistory(false);
  }

  async function renameConversation(conversation: ChatHistoryConversation) {
    const title = window.prompt("Nuevo título de la conversación", conversation.title);
    if (!title?.trim()) return;
    await renameChatConversation(conversation.id, title.trim());
    await refreshConversations(conversation.id);
  }

  async function archiveConversation(conversation: ChatHistoryConversation) {
    await archiveChatConversation(conversation.id);
    if (conversation.id === conversationId) {
      await startNewConversation();
      return;
    }
    await refreshConversations(conversationId);
  }

  async function removeConversation(conversation: ChatHistoryConversation) {
    const ok = window.confirm(`¿Borrar la conversación "${conversation.title}"? Esta acción no borra clientes, obras, presupuestos ni facturas.`);
    if (!ok) return;
    await deleteChatConversation(conversation.id);
    if (conversation.id === conversationId) {
      await startNewConversation();
      return;
    }
    await refreshConversations(conversationId);
  }

  async function toggleDictation() {
    if (voiceStatus === "recording") {
      recorderRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceStatus("error");
      setVoiceError("Este navegador no permite grabar audio desde el chat. Revisa permisos de micrófono o usa otro navegador.");
      return;
    }

    try {
      setVoiceError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setVoiceStatus("transcribing");
        try {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const formData = new FormData();
          formData.append("audio", blob, "dictado.webm");
          const response = await fetch("/api/capataz/transcribe", { method: "POST", body: formData });
          const payload = await response.json().catch(() => null) as { text?: string; error?: string } | null;
          if (!response.ok || !payload?.text) throw new Error(payload?.error || "No se pudo transcribir el audio.");
          const transcribedText = payload.text.trim();
          setInput((current) => current ? `${current} ${transcribedText}` : transcribedText);
          setVoiceStatus("idle");
        } catch (error) {
          setVoiceStatus("error");
          setVoiceError(error instanceof Error ? error.message : "No se pudo transcribir el audio.");
        }
      };
      recorder.start();
      setVoiceStatus("recording");
    } catch {
      setVoiceStatus("error");
      setVoiceError("No tengo permiso para usar el micrófono. Activa el permiso del navegador y vuelve a intentarlo.");
    }
  }

  return (
    <div className="grid min-h-[calc(100dvh-150px)] gap-4 lg:grid-cols-[280px_1fr]">
      <ChatHistoryPanel
        conversations={conversations}
        activeId={conversationId}
        onNew={startNewConversation}
        onOpen={openConversation}
        onRename={renameConversation}
        onArchive={archiveConversation}
        onDelete={removeConversation}
        className="hidden lg:block"
      />

      {showHistory ? (
        <div className="fixed inset-0 z-50 bg-obra-ink/40 p-3 lg:hidden" onClick={() => setShowHistory(false)}>
          <div onClick={(event) => event.stopPropagation()}>
            <ChatHistoryPanel
              conversations={conversations}
              activeId={conversationId}
              onNew={startNewConversation}
              onOpen={openConversation}
              onRename={renameConversation}
              onArchive={archiveConversation}
              onDelete={removeConversation}
              className="max-h-[92dvh] overflow-y-auto"
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-col">
      {data.operationalContext ? (
        <section className="mb-3 rounded-xl border border-border bg-surface p-4" aria-label={`Contexto de ${data.operationalContext.entityName}`}>
          <p className="type-label">Contexto operativo · {data.operationalContext.entityType}</p>
          <p className="type-object-title mt-1 text-content">{data.operationalContext.entityName}</p>
          <p className="type-secondary mt-1">{data.operationalContext.phrase}</p>
          <p className="type-meta mt-2">Siguiente paso: {data.operationalContext.nextStep}</p>
          <div className="mt-3 flex flex-wrap gap-2">{data.operationalContext.suggestions.map((suggestion) => <button key={suggestion} type="button" className="secondary-button min-h-10 px-3 text-xs" onClick={() => submit(undefined, suggestion)} disabled={isSending}>{suggestion}</button>)}</div>
        </section>
      ) : null}
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" className="secondary-button min-h-10 px-3 text-xs lg:hidden" onClick={() => setShowHistory(true)}>
          <History size={16} /> Historial
        </button>
        <button type="button" className="secondary-button min-h-10 px-3 text-xs" onClick={() => setShowExamples((open) => !open)}>
          Ver ejemplos
        </button>
        <button type="button" className="secondary-button min-h-10 px-3 text-xs" onClick={() => submit(undefined, "Completar mis datos")}>
          Completar mis datos
        </button>
        <button type="button" className="secondary-button min-h-10 px-3 text-xs" onClick={() => setShowCreate((open) => !open)}>
          Crear algo rápido
        </button>
        <button type="button" className="secondary-button min-h-10 px-3 text-xs" onClick={startNewConversation} disabled={isSending}>
          Nueva conversación
        </button>
        <button type="button" className="secondary-button min-h-10 px-3 text-xs" onClick={() => submit(undefined, "Ver pendientes")} disabled={isSending}>
          Ver pendientes
        </button>
        <button type="button" className="secondary-button min-h-10 px-3 text-xs" onClick={() => submit(undefined, "Continuar tarea")} disabled={isSending}>
          Continuar tarea
        </button>
        <button type="button" className="secondary-button min-h-10 px-3 text-xs" onClick={() => submit(undefined, "déjalo pendiente")} disabled={isSending}>
          Aparcar tarea
        </button>
      </div>

      {showExamples ? (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {samples.map((sample) => (
            <button
              key={sample}
              type="button"
              className="rounded-lg border border-slate-200 bg-white p-2 text-left text-xs font-semibold leading-5 text-obra-ink shadow-card transition hover:border-obra-yellowDark hover:bg-obra-yellow/10"
              onClick={() => {
                setShowExamples(false);
                submit(undefined, sample);
              }}
            >
              {sample}
            </button>
          ))}
        </div>
      ) : null}

      {showCreate ? (
        <div className="mb-3 flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-card">
          {quickCreates.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-obra-ink hover:bg-obra-yellow/15">
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}

      {missingProfile || missingCompany ? (
        <div className="mb-3 rounded-lg bg-obra-yellow/20 p-3 text-xs font-semibold leading-5 text-obra-yellowDark">
          {displayName ? `${displayName}, ` : ""}
          {missingCompany
            ? `te faltan ${missingCompany} datos de empresa para que los PDFs salgan completos.`
            : `tu perfil personal tiene ${missingProfile} datos pendientes.`}
        </div>
      ) : null}

      <div className="card flex-1 overflow-hidden">
        <div className="max-h-[62dvh] min-h-[360px] space-y-3 overflow-y-auto p-4">
          {chatState === "booting" ? (
            <div className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600">Cargando conversación...</div>
          ) : null}
          {chatState === "failed" ? (
            <div className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
              No he podido cargar el historial. Puedes seguir usando el chat y reintentar la carga.
              <button type="button" className="secondary-button ml-2 px-3 py-1 text-xs" onClick={bootConversation}>Reintentar</button>
            </div>
          ) : null}
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" ? (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-obra-ink text-obra-yellow">
                  <Bot size={19} />
                </span>
              ) : null}
              <div
                className={`max-w-[82%] rounded-lg px-3 py-2 text-sm leading-6 ${
                  message.role === "user" ? "bg-obra-yellow text-obra-ink" : "bg-slate-100 text-slate-700"
                }`}
              >
                <MessageText text={message.text} />
                {pdfPreviewPathFromText(message.text) ? <PdfInlinePreview path={pdfPreviewPathFromText(message.text)!} /> : null}
                {message.result ? <ActionResultCard result={message.result} /> : null}
                {message.card ? <ActionCardView card={message.card} data={data} /> : null}
                {message.retryText ? (
                  <button type="button" className="secondary-button mt-2 text-xs" onClick={() => submit(undefined, message.retryText)} disabled={isSending}>
                    Reintentar
                  </button>
                ) : null}
              </div>
              {message.role === "user" ? (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-obra-graphite ring-1 ring-slate-200">
                  <UserRound size={19} />
                </span>
              ) : null}
            </div>
          ))}
          {isSending ? (
            <div className="flex justify-start gap-2" aria-live="polite">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-obra-ink text-obra-yellow">
                <Bot size={19} />
              </span>
              <div className="max-w-[82%] rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold leading-6 text-slate-600">
                <span className="mr-2 inline-flex h-2 w-2 animate-pulse rounded-full bg-obra-yellowDark" />
                {progressSteps[Math.min(progressIndex, progressSteps.length - 1)]}
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={submit} className="border-t border-slate-200 p-3">
          {voiceStatus !== "idle" || voiceError ? (
            <div className={`mb-2 rounded-lg px-3 py-2 text-xs font-semibold ${voiceStatus === "error" ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-600"}`}>
              {voiceStatus === "recording" ? "Grabando audio... pulsa el micrófono para parar." : null}
              {voiceStatus === "transcribing" ? "Transcribiendo audio..." : null}
              {voiceStatus === "error" ? voiceError : null}
            </div>
          ) : null}
          <div className="flex gap-2">
            <input
              className="field"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              aria-label="Mensaje para Capataz"
              placeholder={isSending ? "Puedes ir escribiendo el siguiente mensaje..." : "Escribe a Capataz..."}
            />
            <button
              type="button"
              className="icon-button shrink-0 disabled:opacity-50"
              aria-label={voiceStatus === "recording" ? "Parar dictado" : "Dictar por voz"}
              onClick={toggleDictation}
              disabled={isSending || voiceStatus === "transcribing"}
            >
              {voiceStatus === "recording" ? <Square size={18} /> : <Mic size={20} />}
            </button>
            <button type="submit" className="icon-button shrink-0 disabled:opacity-50" aria-label="Enviar mensaje" disabled={isSending || chatState === "booting" || !conversationId}>
              <Send size={20} />
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}

function welcomeMessage(displayName: string | null): Message {
  return {
    id: "hello",
    role: "assistant",
    text: displayName
      ? `Hola ${displayName}, dime qué necesitas y lo dejamos ordenado.`
      : "Hola, soy Capataz. Puedo ayudarte con clientes, visitas, presupuestos, facturas, cobros y recordatorios. ¿Cómo te llamas?"
  };
}

function messagesFromConversation(conversation: ChatHistoryConversation, displayName: string | null): Message[] {
  const restored = conversation.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      id: message.id,
      role: message.role as "assistant" | "user",
      text: message.status === "failed" ? `${message.text}\n\nNo se realizó ninguna acción. Puedes reintentar.` : message.text,
      result: message.result,
      status: message.status,
      retryText: message.status === "failed" && message.role === "user" ? message.text : undefined
    } satisfies Message));
  return restored.length ? restored : [welcomeMessage(displayName)];
}


function MessageText({ text }: { text: string }) {
  const urlPattern = /(\/[^\s]+?\/pdf(?:\?preview=1)?)/g;
  const parts = text.split(urlPattern);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, index) => {
        if (urlPattern.test(part)) {
          urlPattern.lastIndex = 0;
          return (
            <a key={`${part}-${index}`} href={part} target="_blank" rel="noreferrer" className="font-bold text-obra-blue underline underline-offset-2">
              {part}
            </a>
          );
        }
        urlPattern.lastIndex = 0;
        return <span key={`${index}-${part.slice(0, 8)}`}>{part}</span>;
      })}
    </span>
  );
}

function pdfPreviewPathFromText(text: string) {
  return text.match(/\/[^\s]+?\/pdf\?preview=1/)?.[0] ?? null;
}

function PdfInlinePreview({ path }: { path: string }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-xs font-bold text-obra-ink">
        <span>Vista previa del PDF</span>
        <a href={path} target="_blank" rel="noreferrer" className="text-obra-blue underline underline-offset-2">Abrir grande</a>
      </div>
      <iframe title="Vista previa PDF" src={path} className="h-[520px] w-full bg-white" />
    </div>
  );
}

function ActionResultCard({ result }: { result: ChatActionResult }) {
  const entries = Object.entries(result.summary).filter(([, value]) => value !== null && value !== undefined && value !== "");
  const safeActions = result.actions.filter((action) => action.href || action.action);
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-obra-ink shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black">{result.title}</p>
          <p className="text-[11px] font-bold uppercase text-slate-400">{result.entityType}</p>
        </div>
        <span className="rounded-full bg-obra-yellow/20 px-2 py-1 text-[11px] font-black text-obra-yellowDark">{result.type}</span>
      </div>
      {entries.length ? (
        <dl className="grid gap-1">
          {entries.slice(0, 8).map(([key, value]) => (
            <div key={key} className="grid grid-cols-[110px_1fr] gap-2">
              <dt className="font-bold capitalize text-slate-500">{key.replace(/_/g, " ")}</dt>
              <dd className="font-semibold text-slate-700">{formatSummaryValue(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {result.pendingFields?.length ? (
        <div className="mt-2 rounded-md bg-amber-50 p-2 text-amber-800">
          <p className="font-black">Datos pendientes</p>
          <ul className="mt-1 list-disc pl-4">
            {result.pendingFields.slice(0, 5).map((field) => (
              <li key={field.key}>{field.label}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {safeActions.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {safeActions.map((action) => action.href ? (
            <Link key={`${action.label}-${action.href}`} href={action.href} target={action.href.includes("/pdf") ? "_blank" : undefined} className={action.style === "primary" ? "primary-button px-3 py-2 text-xs" : "secondary-button px-3 py-2 text-xs"}>
              {action.label}
            </Link>
          ) : (
            <button key={action.label} type="button" className="secondary-button px-3 py-2 text-xs" disabled>
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {safeActions.some((action) => /enviar/i.test(action.label)) ? (
        <p className="mt-2 text-[11px] font-semibold text-slate-500">Antes de enviar a cliente se pedirá confirmación explícita.</p>
      ) : null}
    </div>
  );
}

function formatSummaryValue(value: string | number | boolean | null) {
  if (value === null) return "";
  if (typeof value === "number") {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
  }
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  return value;
}


function contextFromConversation(conversation: ChatHistoryConversation): ChatCommandContext | null {
  if (conversation.activeTask) return conversation.activeTask;
  for (const message of [...conversation.messages].reverse()) {
    const metadata = isObject(message.metadata) ? message.metadata : null;
    const result = isObject(metadata?.result) ? metadata.result : null;
    if (!result) continue;
    if (result.clearContext) return null;
    if ("context" in result) return (result.context ?? null) as ChatCommandContext | null;
  }
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeLocalStorageGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // PostgreSQL is the source of truth. localStorage only remembers the last selected conversation id.
  }
}

function ChatHistoryPanel({
  conversations,
  activeId,
  onNew,
  onOpen,
  onRename,
  onArchive,
  onDelete,
  className = ""
}: {
  conversations: ChatHistoryConversation[];
  activeId: string;
  onNew: () => void;
  onOpen: (conversation: ChatHistoryConversation) => void;
  onRename: (conversation: ChatHistoryConversation) => void;
  onArchive: (conversation: ChatHistoryConversation) => void;
  onDelete: (conversation: ChatHistoryConversation) => void;
  className?: string;
}) {
  const groups = groupConversations(conversations);
  return (
    <aside className={`card p-3 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-extrabold text-obra-ink">
          <History size={18} /> Historial
        </div>
        <button type="button" className="primary-button px-3 py-2 text-xs" onClick={onNew}>Nuevo</button>
      </div>
      <div className="space-y-4">
        {groups.map((group) => group.items.length ? (
          <div key={group.label}>
            <p className="mb-1 px-1 text-[11px] font-black uppercase tracking-wide text-slate-400">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((conversation) => (
                <div key={conversation.id} className={`rounded-lg border p-2 ${conversation.id === activeId ? "border-obra-yellowDark bg-obra-yellow/15" : "border-slate-200 bg-white"}`}>
                  <button type="button" className="w-full text-left text-xs font-bold leading-5 text-obra-ink" onClick={() => onOpen(conversation)}>
                    {conversation.title}
                  </button>
                  <div className="mt-2 flex gap-1">
                    <button type="button" className="rounded-md bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600" onClick={() => onRename(conversation)} aria-label="Renombrar conversación">
                      <Pencil size={12} />
                    </button>
                    <button type="button" className="rounded-md bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600" onClick={() => onArchive(conversation)}>
                      Archivar
                    </button>
                    <button type="button" className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700" onClick={() => onDelete(conversation)} aria-label="Borrar conversación">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null)}
        {!conversations.length ? (
          <p className="rounded-lg bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-500">Todavía no hay conversaciones guardadas en PostgreSQL.</p>
        ) : null}
      </div>
    </aside>
  );
}

function groupConversations(conversations: ChatHistoryConversation[]) {
  const now = new Date();
  const today = startOfDay(now).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const last7 = today - 6 * 24 * 60 * 60 * 1000;
  const groups = [
    { label: "Hoy", items: [] as ChatHistoryConversation[] },
    { label: "Ayer", items: [] as ChatHistoryConversation[] },
    { label: "Últimos 7 días", items: [] as ChatHistoryConversation[] },
    { label: "Anteriores", items: [] as ChatHistoryConversation[] }
  ];
  for (const conversation of conversations) {
    const value = startOfDay(new Date(conversation.updatedAt)).getTime();
    if (value >= today) groups[0].items.push(conversation);
    else if (value >= yesterday) groups[1].items.push(conversation);
    else if (value >= last7) groups[2].items.push(conversation);
    else groups[3].items.push(conversation);
  }
  return groups;
}

function progressStepsForMessage(text: string) {
  const normalized = normalize(text);
  const shortReply = /^(si|sí|no|vale|ok|esa|ese|la misma|el mismo|con iva|mas iva|más iva|hazlo)$/i.test(normalized.trim());
  const contextQuestion = /(hola|dimelos|dímelos|que datos|qué datos|que falta|qué falta|cuanto era|cuánto era|importe|como se llama el cliente|cómo se llama el cliente|nuevo chat|nueva conversacion|nueva conversación|dejalo pendiente|déjalo pendiente|aparcalo|apárcalo|volver al|sigue con|resumen)/i.test(normalized);
  if (contextQuestion) {
    return ["Leyendo tu mensaje...", "Revisando contexto...", "Preparando respuesta..."];
  }
  if (shortReply) {
    return ["Leyendo tu respuesta...", "Aplicando contexto...", "Guardando cambios..."];
  }
  if (normalized.includes("pdf")) {
    return ["Leyendo tu mensaje...", "Localizando documento...", "Generando PDF...", "Preparando enlace..."];
  }
  if (normalized.includes("presupuesto")) {
    return ["Leyendo tu mensaje...", "Analizando datos...", "Buscando cliente/obra...", "Preparando presupuesto...", "Guardando cambios..."];
  }
  if (normalized.includes("factura")) {
    return ["Leyendo tu mensaje...", "Analizando datos...", "Buscando cliente/obra...", "Preparando factura...", "Guardando cambios..."];
  }
  if (normalized.includes("visita") || normalized.includes("reunion") || normalized.includes("reunión")) {
    return ["Leyendo tu mensaje...", "Detectando fecha y hora...", "Buscando cliente/obra...", "Guardando visita..."];
  }
  return defaultProgressSteps;
}

function respond(text: string, data: ChatData, pendingDebt: ChatData["invoices"]): Omit<Message, "id" | "role"> {
  const normalized = normalize(text);
  const amount = extractAmount(normalized);
  const displayName = userName(data);
  const profileName = extractProfileName(text, normalized);
  const preferredTone = extractPreferredTone(normalized);
  const companyProposal = extractCompanyProposal(text, normalized);

  if (normalized.includes("completar mis datos") || normalized.includes("mis datos")) {
    if (!displayName) {
      return {
        text: "Antes de empezar, dime cómo quieres que te llame. He preparado tu perfil para que lo revises antes de guardar.",
        card: profileCard(data, {})
      };
    }
    if (data.completion.company.missingRequired.length || data.completion.company.missingRecommended.length) {
      return {
        text: `${displayName}, he preparado tus datos de empresa para completarlos sin interrogatorio. Puedes guardar ahora o dejarlo para después.`,
        card: companyCard(data, {})
      };
    }
    return { text: `${displayName}, tu perfil y los datos principales de empresa están listos. Puedes revisarlos en /configuracion.` };
  }

  if (profileName || preferredTone) {
    const nextProfile = profileCard(data, {
      nombre: profileName ?? undefined,
      nombrePreferido: profileName ?? undefined,
      tonoPreferido: preferredTone ?? undefined
    });
    return {
      text: profileName
        ? `He preparado tu perfil para llamarte ${profileName}. Revisa los campos y confirma antes de guardarlo.`
        : `${displayName ? `${displayName}, ` : ""}he preparado el cambio de tono. Revisa y confirma antes de guardarlo.`,
      card: nextProfile
    };
  }

  if (!displayName && looksLikeSimpleName(text)) {
    const name = cleanName(text);
    return {
      text: `Perfecto. He preparado tu perfil para llamarte ${name}. Confirma si está bien.`,
      card: profileCard(data, { nombre: name, nombrePreferido: name })
    };
  }

  if (companyProposal) {
    return {
      text: `${displayName ? `${displayName}, ` : ""}he preparado estos datos de empresa. Revísalos antes de guardarlos; se usarán en presupuestos, facturas y PDFs.`,
      card: companyCard(data, companyProposal)
    };
  }

  if (normalized.includes("genera") && normalized.includes("pdf") && normalized.includes("presupuesto")) {
    const client = findClient(normalized, data.clients);
    const budget = data.budgets.find((item) => (client ? item.clientName === client.nombre : true)) ?? data.budgets[0];
    if (!budget) return { text: "No encuentro un presupuesto para generar PDF. Crea uno manualmente o desde plantilla." };
    return {
      text: `Vista previa preparada para ${budget.numero} (${budget.clientName}). Abre /presupuestos/${budget.id}/pdf?preview=1 o descarga /presupuestos/${budget.id}/pdf.`
    };
  }

  if (normalized.includes("genera") && normalized.includes("pdf") && normalized.includes("factura")) {
    const client = findClient(normalized, data.clients);
    const invoice = data.invoices.find((item) => (client ? item.clientName === client.nombre : true)) ?? data.invoices[0];
    if (!invoice) return { text: "No encuentro una factura para generar PDF. Crea una factura antes de generar el borrador." };
    return {
      text: `Vista previa preparada para ${invoice.numero} (${invoice.clientName}). Abre /dinero/${invoice.id}/pdf?preview=1 o descarga /dinero/${invoice.id}/pdf.`
    };
  }

  if (normalized.startsWith("busca") || normalized.includes("buscar ")) {
    const query = text.replace(/busca(r)?/i, "").trim() || text;
    const matches = [
      ...data.clients.filter((client) => normalize(client.nombre).includes(normalize(query))).map((client) => `Cliente: ${client.nombre}`),
      ...data.works.filter((work) => normalize(`${work.titulo} ${work.clientName}`).includes(normalize(query))).map((work) => `Obra: ${work.titulo} · ${work.clientName}`),
      ...data.invoices.filter((invoice) => normalize(`${invoice.numero} ${invoice.clientName} ${invoice.concepto}`).includes(normalize(query)) || (normalized.includes("factura vencida") && invoice.estado === "vencida")).map((invoice) => `Factura: ${invoice.numero} · ${invoice.clientName} · ${formatCurrency(invoice.pendiente)} pendiente`),
      ...data.budgets.filter((budget) => normalize(`${budget.numero} ${budget.clientName} ${budget.titulo}`).includes(normalize(query))).map((budget) => `Presupuesto: ${budget.numero} · ${budget.clientName}`),
      ...data.materials.filter((material) => normalize(`${material.nombre} ${material.workTitle}`).includes(normalize(query))).map((material) => `Material: ${material.nombre} · ${material.workTitle}`),
      ...data.agendaEvents.filter((event) => normalize(`${event.title} ${event.clientName ?? ""}`).includes(normalize(query))).map((event) => `Agenda: ${event.title}`)
    ];
    return {
      text: matches.length
        ? `He encontrado esto:\n${matches.slice(0, 8).join("\n")}\n\nTambién puedes abrir /buscar?q=${encodeURIComponent(query)} para ver resultados agrupados.`
        : `No veo coincidencias rápidas. Abre /buscar?q=${encodeURIComponent(query)} para buscar en toda la app.`
    };
  }

  if (normalized.includes("que tengo manana") || normalized.includes("tengo manana")) {
    const events = agendaEventsForDay(data.agendaEvents, addDays(new Date(), 1));
    if (!events.length) return { text: "Mañana no veo eventos en la agenda interna." };
    return { text: `Mañana tienes:\n${formatAgendaLines(events)}` };
  }

  if (normalized.includes("visitas") && normalized.includes("esta semana")) {
    const events = agendaEventsForRange(data.agendaEvents, startOfDay(new Date()), addDays(startOfDay(new Date()), 7)).filter(
      (event) => event.type === "visita"
    );
    if (!events.length) return { text: "Esta semana no veo visitas en la agenda." };
    return { text: `Visitas de esta semana:\n${formatAgendaLines(events)}` };
  }

  if (normalized.includes("cambia la visita") || normalized.includes("reprograma la visita")) {
    const client = findClient(normalized, data.clients);
    const event = findAgendaEvent(data.agendaEvents, "visita", client?.nombre, true);
    if (!event) return { text: "No encuentro una visita editable para ese cliente. Crea o edita el evento desde Agenda." };
    return {
      text: "He preparado la reprogramación de la visita. Revisa la nueva fecha antes de confirmar.",
      card: {
        type: "agenda-reprogram",
        eventId: event.id,
        title: event.title,
        dateTime: dayExpressionToInput(normalized)
      }
    };
  }

  if (normalized.includes("marca la visita") && normalized.includes("realizada")) {
    const client = findClient(normalized, data.clients);
    const event = findAgendaEvent(data.agendaEvents, "visita", client?.nombre, true);
    if (!event) return { text: "No encuentro una visita editable para marcar como realizada." };
    return {
      text: "He preparado el cambio de estado. Confirma antes de marcar la visita como realizada.",
      card: {
        type: "agenda-status",
        eventId: event.id,
        title: event.title,
        status: "realizado"
      }
    };
  }

  if (normalized.includes("recuerdame llamar") || (normalized.includes("llamar") && normalized.includes("viernes"))) {
    const client = findClient(normalized, data.clients);
    return {
      text: "He preparado un recordatorio interno de agenda. Revisa fecha y cliente antes de guardarlo.",
      card: {
        type: "agenda-event",
        eventType: "recordatorio_interno",
        title: `Llamar a ${client?.nombre ?? findMentionedName(text) ?? "cliente"}`,
        description: "Llamada preparada desde Capataz.",
        clientId: client?.id ?? data.clients[0]?.id ?? "",
        dateTime: normalized.includes("viernes") ? nextFridayAtTen() : tomorrowAtTen(),
        requiereConfirmacion: false
      }
    };
  }

  if (normalized.includes("pon seguimiento") && normalized.includes("factura")) {
    const client = findClient(normalized, data.clients);
    const openInvoice = pendingDebt.find((invoice) => (client ? invoice.clientName === client.nombre : true));
    return {
      text: "He preparado un seguimiento de cobro en agenda. Revisa todo antes de guardarlo.",
      card: {
        type: "agenda-event",
        eventType: "seguimiento_cobro",
        title: `Seguimiento cobro ${openInvoice?.numero ?? ""}`.trim() || "Seguimiento de cobro",
        description: openInvoice
          ? `Revisar cobro pendiente de ${formatCurrency(openInvoice.pendiente)}.`
          : "Seguimiento de cobro preparado desde Capataz.",
        clientId: client?.id ?? data.clients[0]?.id ?? "",
        invoiceId: openInvoice?.id,
        dateTime: normalized.includes("lunes") ? nextWeekdayAt(1, 10) : tomorrowAtTen(),
        requiereConfirmacion: true
      }
    };
  }

  if (normalized.includes("ha entrado") || normalized.includes("cliente para") || normalized.includes("nuevo cliente")) {
    return {
      text: "He preparado una ficha de lead. Revisa los datos antes de guardarlo como cliente.",
      card: {
        type: "client",
        clientName: findMentionedName(text) ?? "Nuevo lead",
        job: normalized.includes("bano") ? "Reforma de baño" : "Trabajo pendiente de definir"
      }
    };
  }

  if (normalized.includes("agenda visita") || normalized.includes("visita con")) {
    const client = findClient(normalized, data.clients);
    return {
      text: "He preparado una visita de agenda. Revisa cliente, fecha y notas antes de guardarla.",
      card: {
        type: "visit",
        clientId: client?.id ?? data.clients[0]?.id ?? "",
        message: "Visita para medir y revisar calidades.",
        dateTime: normalized.includes("manana") ? tomorrowAtTen() : nowInputValue()
      }
    };
  }

  if (normalized.includes("haz presupuesto") || normalized.includes("crear presupuesto")) {
    const client = findClient(normalized, data.clients);
    const templateTitle = normalized.includes("banera") || normalized.includes("ducha")
      ? "Cambio bañera por plato de ducha"
      : normalized.includes("bano")
        ? "Presupuesto reforma de baño"
        : "Presupuesto de obra";
    return {
      text: normalized.includes("banera") || normalized.includes("ducha")
        ? "He preparado un presupuesto editable basado en plantilla. También puedes abrir /presupuestos/plantillas para elegir otra."
        : "He preparado un presupuesto básico editable.",
      card: {
        type: "budget",
        clientId: client?.id ?? data.clients[0]?.id ?? "",
        title: templateTitle,
        amount: amount ?? (normalized.includes("banera") || normalized.includes("ducha") ? 0 : 1500)
      }
    };
  }

  if (normalized.includes("acepta el presupuesto") || normalized.includes("acepta presupuesto")) {
    const client = findClient(normalized, data.clients);
    const budget = data.budgets.find((item) => (client ? item.clientName === client.nombre : true) && ["enviado", "pendiente_respuesta", "visto"].includes(item.estado)) ?? data.budgets[0];
    return {
      text: "He preparado la aceptación del presupuesto. Al confirmar se marcará aceptado y se creará una obra.",
      card: {
        type: "accept-budget",
        budgetId: budget?.id ?? ""
      }
    };
  }

  if (normalized.includes("crea factura") || normalized.includes("factura de")) {
    const client = findClient(normalized, data.clients);
    const work = findWork(normalized, data.works, client?.nombre);
    return {
      text: "He preparado una factura editable. Revisa concepto, importe y vencimiento antes de guardar.",
      card: {
        type: "invoice",
        clientId: client?.id ?? data.clients[0]?.id ?? "",
        workId: work?.id ?? "",
        concept: "Factura de trabajos realizados",
        amount: amount ?? 1500
      }
    };
  }

  if (normalized.includes("recuerdale") || normalized.includes("recordatorio")) {
    const client = findClient(normalized, data.clients);
    const openInvoice = pendingDebt.find((invoice) => (client ? invoice.clientName === client.nombre : true));
    return {
      text: "He preparado un recordatorio de cobro editable. No se envía nada real.",
      card: {
        type: "follow-up",
        clientId: client?.id ?? data.clients[0]?.id ?? "",
        budgetId: data.budgets.find((budget) => client && budget.clientName === client.nombre)?.id ?? data.budgets[0]?.id ?? "",
        invoiceId: openInvoice?.id,
        reminderType: openInvoice?.estado === "vencida" ? "factura_vencida" : "recordatorio_factura",
        message: openInvoice
          ? `Buenos días. Te escribo para recordar que queda pendiente ${formatCurrency(openInvoice.pendiente)} de la factura ${openInvoice.numero}. Cuando puedas, ¿me confirmas si lo has podido revisar? Gracias.`
          : "Buenos días. Te escribo para hacer seguimiento del tema pendiente. Cuando puedas me dices. Gracias.",
        dateTime: normalized.includes("viernes") ? nextFridayAtTen() : tomorrowAtTen()
      }
    };
  }

  if (normalized.includes("cierra la obra") || normalized.includes("cerrar obra")) {
    const client = findClient(normalized, data.clients);
    const work = findWork(normalized, data.works, client?.nombre);
    return {
      text: "He preparado el cierre de obra. Confirma sólo si no quedan pendientes críticos.",
      card: {
        type: "close-work",
        workId: work?.id ?? data.works[0]?.id ?? ""
      }
    };
  }

  if (normalized.includes("facturas") && normalized.includes("vencidas")) {
    const overdue = data.invoices.filter((invoice) => invoice.estado === "vencida");
    if (!overdue.length) return { text: "No veo facturas marcadas como vencidas en la demo." };
    return {
      text: overdue.map((invoice) => `${invoice.numero} · ${invoice.clientName} · ${formatCurrency(invoice.pendiente)} pendiente. Abre /dinero/${invoice.id}`).join("\n")
    };
  }

  if (normalized.includes("quien") && (normalized.includes("debe") || normalized.includes("dinero"))) {
    if (!pendingDebt.length) return { text: "Ahora mismo no veo facturas pendientes de cobro." };
    const lines = pendingDebt
      .map((invoice) => `${invoice.clientName}: ${formatCurrency(invoice.pendiente)} pendiente en ${invoice.numero}`)
      .join("\n");
    return { text: `Te deben dinero estos clientes:\n${lines}` };
  }

  if (normalized.includes("presupuesto") && (normalized.includes("pendiente") || normalized.includes("tengo"))) {
    const pending = data.budgets.filter((budget) =>
      ["borrador", "pendiente_revision", "pendiente_respuesta", "enviado", "visto"].includes(budget.estado)
    );
    if (!pending.length) return { text: "No tienes presupuestos pendientes ahora mismo." };
    return {
      text: pending
        .map((budget) => `${budget.numero} para ${budget.clientName}: ${budget.titulo}, ${formatCurrency(budget.total)}, estado ${budget.estado.replaceAll("_", " ")}.`)
        .join("\n")
    };
  }

  if (normalized.includes("material") && (normalized.includes("falta") || normalized.includes("faltan") || normalized.includes("manana"))) {
    const missing = data.materials.filter((material) => ["pendiente", "falta"].includes(material.estado));
    if (!missing.length) return { text: "No veo materiales pendientes para mañana." };
    return {
      text: missing
        .map((material) => `${material.workTitle}: ${material.cantidad} de ${material.nombre} (${material.estado}).`)
        .join("\n")
    };
  }

  if (normalized.includes("apunta") || normalized.includes("apuntame")) {
    const client = findClient(normalized, data.clients);
    const work = findWork(normalized, data.works, client?.nombre);
    return {
      text: "He preparado una tarjeta de gasto. Revisa obra, importe y concepto antes de guardar.",
      card: {
        type: "expense",
        workId: work?.id ?? data.works[0]?.id ?? "",
        concept: normalized.includes("material") ? "Material" : "Gasto",
        amount: amount ?? 0
      }
    };
  }

  if (normalized.includes("pagado") || normalized.includes("senal") || normalized.includes("pago a cuenta")) {
    const client = findClient(normalized, data.clients);
    const openInvoice = pendingDebt.find((invoice) =>
      client ? invoice.clientName.toLowerCase().includes(client.nombre.split(" ")[0].toLowerCase()) : true
    );
    const quantity = amount ? formatCurrency(amount) : "ese pago";
    if (!openInvoice) {
      return { text: `Veo ${quantity}, pero necesito que me confirmes factura u obra antes de marcar nada como pagado.` };
    }
    return {
      text: `He encontrado ${openInvoice.numero} de ${openInvoice.clientName}. Revisa el pago antes de confirmar.`,
      card: {
        type: "payment",
        invoiceId: openInvoice.id,
        amount: amount ?? 0
      }
    };
  }

  if (normalized.includes("toque") || normalized.includes("mandale") || normalized.includes("seguimiento")) {
    const client = findClient(normalized, data.clients);
    const target = client?.nombre ?? "el cliente";
    const budget = data.budgets.find((item) => (client ? item.clientName === client.nombre : true) && ["enviado", "visto", "pendiente_respuesta"].includes(item.estado)) ?? data.budgets[0];
    return {
      text: "He preparado una tarjeta de seguimiento. Puedes cambiar mensaje, canal y hora antes de programar.",
      card: {
        type: "follow-up",
        clientId: client?.id ?? data.clients[0]?.id ?? "",
        budgetId: budget?.id ?? "",
        reminderType: "seguimiento_presupuesto",
        message: `Hola ${target.split(" ")[0]}, te escribo para saber si pudiste revisar el presupuesto. Si quieres ajustamos fechas o partidas.`,
        dateTime: tomorrowAtTen()
      }
    };
  }

  return { text: "Necesito un poco más de contexto. Dime, por ejemplo: “crear presupuesto para un cliente por 14000”, “haz factura de una cocina por 4200” o “genera el PDF del último documento”." };
}

function ActionCardView({ card, data }: { card: ActionCard; data: ChatData }) {
  if (card.type === "expense") return <ExpenseCard card={card} data={data} />;
  if (card.type === "payment") return <PaymentCard card={card} data={data} />;
  if (card.type === "follow-up") return <FollowUpCard card={card} data={data} />;
  if (card.type === "client") return <ClientCard card={card} data={data} />;
  if (card.type === "visit") return <VisitCard card={card} data={data} />;
  if (card.type === "budget") return <BudgetCard card={card} data={data} />;
  if (card.type === "invoice") return <InvoiceCard card={card} data={data} />;
  if (card.type === "accept-budget") return <AcceptBudgetCard card={card} data={data} />;
  if (card.type === "close-work") return <CloseWorkCard card={card} data={data} />;
  if (card.type === "agenda-event") return <AgendaEventCard card={card} data={data} />;
  if (card.type === "agenda-reprogram") return <AgendaReprogramCard card={card} />;
  if (card.type === "user-profile") return <UserProfileCard card={card} />;
  if (card.type === "company-settings") return <CompanySettingsCard card={card} />;
  return <AgendaStatusCard card={card} />;
}

function UserProfileCard({ card }: { card: Extract<ActionCard, { type: "user-profile" }> }) {
  return (
    <form action={saveUserProfile} className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 text-obra-ink">
      <input type="hidden" name="id" value={card.profile.id} />
      <CardTitle icon={UserRound} title="Mi perfil preparado" />
      <div className="rounded-lg bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-600">
        Estos datos son personales del profesional que usa Capataz. No sustituyen los datos fiscales de empresa.
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <InputField name="nombre" label="Nombre" value={card.profile.nombre} />
        <InputField name="apellidos" label="Apellidos" value={card.profile.apellidos} />
        <InputField name="nombrePreferido" label="Nombre preferido" value={card.profile.nombrePreferido} />
        <InputField name="telefono" label="Teléfono personal" value={card.profile.telefono} />
        <InputField name="email" label="Email personal" type="email" value={card.profile.email} />
        <InputField name="cargo" label="Cargo" value={card.profile.cargo} />
        <InputField name="oficioPrincipal" label="Oficio principal" value={card.profile.oficioPrincipal} />
        <SelectField
          name="tonoPreferido"
          label="Tono"
          value={card.profile.tonoPreferido}
          options={[
            ["cercano", "Cercano"],
            ["formal", "Formal"],
            ["directo", "Directo"],
            ["muy_educado", "Muy educado"]
          ]}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <button type="submit" className="primary-button w-full">Guardar</button>
        <Link href="/configuracion#perfil" className="secondary-button w-full">Editar</Link>
        <button type="reset" className="secondary-button w-full">Cancelar</button>
      </div>
    </form>
  );
}

function CompanySettingsCard({ card }: { card: Extract<ActionCard, { type: "company-settings" }> }) {
  return (
    <form action={saveCompanySettings} className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 text-obra-ink">
      <input type="hidden" name="id" value={card.company.id} />
      <CardTitle icon={Building2} title="Datos de empresa preparados" />
      <div className="rounded-lg bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-600">
        Estos datos se usarán en presupuestos, facturas y PDFs. Capataz no los usará para llamarte por tu nombre.
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <InputField name="nombreComercial" label="Nombre comercial" value={card.company.nombreComercial} />
        <InputField name="razonSocial" label="Razón social" value={card.company.razonSocial} />
        <InputField name="nifCif" label="NIF/CIF" value={card.company.nifCif} />
        <InputField name="telefono" label="Teléfono empresa" value={card.company.telefono} />
        <InputField name="email" label="Email empresa" type="email" value={card.company.email} />
        <InputField name="web" label="Web" value={card.company.web} />
        <InputField name="direccionFiscal" label="Dirección fiscal" value={card.company.direccionFiscal} />
        <InputField name="codigoPostal" label="Código postal" value={card.company.codigoPostal} />
        <InputField name="ciudad" label="Ciudad" value={card.company.ciudad} />
        <InputField name="provincia" label="Provincia" value={card.company.provincia} />
        <InputField name="pais" label="País" value={card.company.pais} />
        <InputField name="iban" label="IBAN / datos bancarios" value={card.company.iban} />
        <InputField name="logoUrl" label="Logo URL o ruta local" value={card.company.logoUrl} />
        <InputField name="selloUrl" label="Sello URL o ruta local" value={card.company.selloUrl} />
        <InputField name="colorMarca" label="Color marca" type="color" value={card.company.colorMarca} />
        <InputField name="ivaDefecto" label="IVA por defecto" type="number" value={card.company.ivaDefecto} />
        <InputField name="seriePresupuestos" label="Serie presupuestos" value={card.company.seriePresupuestos} />
        <InputField name="serieFacturas" label="Serie facturas" value={card.company.serieFacturas} />
        <InputField name="prefijoPresupuesto" label="Prefijo presupuesto" value={card.company.prefijoPresupuesto} />
        <InputField name="prefijoFactura" label="Prefijo factura" value={card.company.prefijoFactura} />
      </div>
      <TextareaField name="condicionesPorDefecto" label="Condiciones por defecto" value={card.company.condicionesPorDefecto} />
      <TextareaField name="textoLegal" label="Texto legal" value={card.company.textoLegal} />
      <div className="grid gap-2 sm:grid-cols-3">
        <button type="submit" className="primary-button w-full">Guardar</button>
        <Link href="/configuracion#empresa" className="secondary-button w-full">Editar</Link>
        <button type="reset" className="secondary-button w-full">Cancelar</button>
      </div>
    </form>
  );
}

function ExpenseCard({ card, data }: { card: Extract<ActionCard, { type: "expense" }>; data: ChatData }) {
  return (
    <form action={saveManualRecord} className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 text-obra-ink">
      <input type="hidden" name="tipo" value="gasto" />
      <input type="hidden" name="returnTo" value="/capataz" />
      <CardTitle icon={PackagePlus} title="Gasto preparado" />
      <SelectField name="obraId" label="Obra" value={card.workId} options={data.works.map((work) => [work.id, `${work.titulo} · ${work.clientName}`])} />
      <SelectField name="categoria" label="Categoría" value="material" options={[["material", "Material"], ["mano_obra", "Mano de obra"], ["transporte", "Transporte"], ["herramienta", "Herramienta"], ["gasolina", "Gasolina"], ["subcontrata", "Subcontrata"], ["otros", "Otros"]]} />
      <InputField name="importe" label="Importe" type="number" value={card.amount} />
      <InputField name="concepto" label="Concepto" value={card.concept} />
      <InputField name="proveedor" label="Proveedor" value="Proveedor pendiente" />
      <InputField name="fecha" label="Fecha" type="datetime-local" value={nowInputValue()} />
      <TextareaField name="notas" label="Notas" value="Preparado por Capataz" />
      <button type="submit" className="primary-button w-full">Guardar</button>
    </form>
  );
}

function PaymentCard({ card, data }: { card: Extract<ActionCard, { type: "payment" }>; data: ChatData }) {
  return (
    <form action={registerPayment} className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 text-obra-ink">
      <input type="hidden" name="confirmadoPorUsuario" value="true" />
      <input type="hidden" name="redirectTo" value="/capataz" />
      <CardTitle icon={CreditCard} title="Pago preparado" />
      <SelectField name="facturaId" label="Factura" value={card.invoiceId} options={data.invoices.map((invoice) => [invoice.id, `${invoice.numero} · ${invoice.clientName} · ${formatCurrency(invoice.pendiente)} pendiente`])} />
      <InputField name="importe" label="Importe" type="number" value={card.amount} />
      <SelectField name="metodo" label="Método" value="transferencia" options={[["transferencia", "Transferencia"], ["bizum", "Bizum"], ["efectivo", "Efectivo"], ["tarjeta", "Tarjeta"]]} />
      <SelectField name="tipo" label="Tipo" value="pago_parcial" options={[["senal", "Señal"], ["pago_parcial", "Pago parcial"], ["pago_final", "Pago final"], ["regularizacion", "Regularización"]]} />
      <InputField name="fecha" label="Fecha" type="datetime-local" value={nowInputValue()} />
      <TextareaField name="notas" label="Notas" value="Pago preparado por Capataz" />
      <button type="submit" className="primary-button w-full">Confirmar pago</button>
    </form>
  );
}

function FollowUpCard({ card, data }: { card: Extract<ActionCard, { type: "follow-up" }>; data: ChatData }) {
  const type = card.reminderType ?? "seguimiento_presupuesto";

  return (
    <form action={saveManualRecord} className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 text-obra-ink">
      <input type="hidden" name="tipo" value="recordatorio" />
      <input type="hidden" name="tipoRecordatorio" value={type} />
      <input type="hidden" name="estado" value="programado" />
      <input type="hidden" name="returnTo" value="/capataz" />
      <CardTitle icon={MessageCircle} title={type === "seguimiento_presupuesto" ? "Seguimiento preparado" : "Recordatorio de cobro preparado"} />
      <SelectField name="clienteId" label="Cliente" value={card.clientId} options={data.clients.map((client) => [client.id, client.nombre])} />
      <SelectField name="presupuestoId" label="Presupuesto" value={card.budgetId} optional options={data.budgets.map((budget) => [budget.id, `${budget.numero} · ${budget.clientName}`])} />
      <SelectField name="facturaId" label="Factura" value={card.invoiceId ?? ""} optional options={data.invoices.map((invoice) => [invoice.id, `${invoice.numero} · ${invoice.clientName} · ${formatCurrency(invoice.pendiente)} pendiente`])} />
      <SelectField name="canal" label="Canal" value="whatsapp" options={[["whatsapp", "WhatsApp"], ["email", "Email"], ["interno", "Interno"]]} />
      <TextareaField name="mensaje" label="Mensaje" value={card.message} />
      <InputField name="fechaProgramada" label="Fecha/hora" type="datetime-local" value={card.dateTime} />
      <div className="rounded-lg bg-obra-yellow/20 p-3 text-xs font-semibold leading-5 text-obra-yellowDark">
        Confirmar programación no envía WhatsApp real. Sólo deja el recordatorio programado en la app.
      </div>
      {data.demoLimits.programmedReminders >= data.demoLimits.reminderLimit ? (
        <DemoLimitButton
          className="primary-button w-full"
          currentCount={data.demoLimits.programmedReminders}
          limit={data.demoLimits.reminderLimit}
          icon={MessageCircle}
        >
          Confirmar programación
        </DemoLimitButton>
      ) : (
        <button type="submit" className="primary-button w-full">Confirmar programación</button>
      )}
    </form>
  );
}

function ClientCard({ card, data }: { card: Extract<ActionCard, { type: "client" }>; data: ChatData }) {
  const limited = data.demoLimits.clientsCount >= data.demoLimits.clientsLimit;

  return (
    <form action={saveManualRecord} className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 text-obra-ink">
      <input type="hidden" name="tipo" value="cliente" />
      <input type="hidden" name="returnTo" value="/capataz" />
      <input type="hidden" name="estado" value="nuevo" />
      <CardTitle icon={UserPlus} title="Lead preparado" />
      <InputField name="nombre" label="Nombre" value={card.clientName} />
      <InputField name="telefono" label="Teléfono" value="Pendiente" />
      <InputField name="email" label="Email" type="email" value="" />
      <InputField name="direccion" label="Dirección" value="Pendiente" />
      <InputField name="tipoCliente" label="Tipo" value="Particular" />
      <InputField name="origen" label="Origen" value="Asistente Capataz" />
      <TextareaField name="notas" label="Notas" value={`Lead preparado por Capataz. Trabajo solicitado: ${card.job}.`} />
      {limited ? (
        <DemoLimitButton
          className="primary-button w-full"
          currentCount={data.demoLimits.clientsCount}
          limit={data.demoLimits.clientsLimit}
          icon={UserPlus}
        >
          Guardar cliente
        </DemoLimitButton>
      ) : (
        <button type="submit" className="primary-button w-full">Guardar cliente</button>
      )}
    </form>
  );
}

function VisitCard({ card, data }: { card: Extract<ActionCard, { type: "visit" }>; data: ChatData }) {
  return (
    <form action={saveManualRecord} className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 text-obra-ink">
      <input type="hidden" name="tipo" value="eventoAgenda" />
      <input type="hidden" name="tipoEvento" value="visita" />
      <input type="hidden" name="estado" value="pendiente" />
      <input type="hidden" name="returnTo" value="/capataz" />
      <CardTitle icon={CalendarClock} title="Visita preparada" />
      <SelectField name="clienteId" label="Cliente" value={card.clientId} options={data.clients.map((client) => [client.id, client.nombre])} />
      <InputField name="titulo" label="Título" value="Visita con cliente" />
      <InputField name="fechaInicio" label="Fecha/hora" type="datetime-local" value={card.dateTime} />
      <TextareaField name="descripcion" label="Notas de la visita" value={card.message} />
      <button type="submit" className="primary-button w-full">Guardar visita</button>
    </form>
  );
}

function BudgetCard({ card, data }: { card: Extract<ActionCard, { type: "budget" }>; data: ChatData }) {
  const ivaPercent = data.company?.ivaDefecto ?? 21;
  const base = baseFromTotal(card.amount, ivaPercent);
  const iva = Math.max(0, Math.round((card.amount - base) * 100) / 100);
  const limited = data.demoLimits.budgetCount >= data.demoLimits.budgetLimit;

  return (
    <form action={saveManualRecord} className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 text-obra-ink">
      <input type="hidden" name="tipo" value="presupuesto" />
      <input type="hidden" name="returnTo" value="/capataz" />
      <CardTitle icon={FileText} title="Presupuesto preparado" />
      <SelectField name="clienteId" label="Cliente" value={card.clientId} options={data.clients.map((client) => [client.id, client.nombre])} />
      <InputField name="titulo" label="Título" value={card.title} />
      <SelectField name="estado" label="Estado" value="borrador" options={[["borrador", "Borrador"], ["pendiente_revision", "Pendiente revisión"]]} />
      <input type="hidden" name="ivaPercent" value={ivaPercent} />
      <TextareaField name="partidas" label="Partidas" value={JSON.stringify([{ descripcion: "Partida preparada por Capataz", cantidad: 1, unidad: "servicio", precioUnitario: base, total: base, categoria: "General" }], null, 2)} />
      <InputField name="subtotal" label="Subtotal" type="number" value={base} />
      <InputField name="iva" label="IVA" type="number" value={iva} />
      <InputField name="descuento" label="Descuento" type="number" value={0} />
      <InputField name="total" label="Total" type="number" value={card.amount} />
      <InputField name="margenEstimado" label="Margen estimado" type="number" value={Math.round(card.amount * 0.25 * 100) / 100} />
      <InputField name="fechaValidez" label="Fecha validez" type="datetime-local" value={inDaysInputValue(15)} />
      <TextareaField name="condiciones" label="Condiciones" value="Validez 15 días. Fechas sujetas a disponibilidad de materiales." />
      <TextareaField name="observaciones" label="Observaciones" value="Propuesta preparada por Capataz. Revisar antes de enviar." />
      <InputField name="formaPago" label="Forma de pago" value="Transferencia / según acuerdo" />
      {limited ? (
        <DemoLimitButton
          className="primary-button w-full"
          currentCount={data.demoLimits.budgetCount}
          limit={data.demoLimits.budgetLimit}
          icon={FileText}
        >
          Guardar presupuesto
        </DemoLimitButton>
      ) : (
        <button type="submit" className="primary-button w-full">Guardar presupuesto</button>
      )}
    </form>
  );
}

function InvoiceCard({ card, data }: { card: Extract<ActionCard, { type: "invoice" }>; data: ChatData }) {
  const base = baseFromTotal(card.amount, data.company?.ivaDefecto ?? 21);
  const iva = Math.max(0, Math.round((card.amount - base) * 100) / 100);

  return (
    <form action={saveManualRecord} className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 text-obra-ink">
      <input type="hidden" name="tipo" value="factura" />
      <input type="hidden" name="returnTo" value="/capataz" />
      <CardTitle icon={CreditCard} title="Factura preparada" />
      <SelectField name="clienteId" label="Cliente" value={card.clientId} options={data.clients.map((client) => [client.id, client.nombre])} />
      <SelectField name="obraId" label="Obra" value={card.workId} optional options={data.works.map((work) => [work.id, `${work.titulo} · ${work.clientName}`])} />
      <InputField name="concepto" label="Concepto" value={card.concept} />
      <SelectField name="estado" label="Estado" value="pendiente_pago" options={[["pendiente_pago", "Pendiente pago"], ["emitida", "Emitida"], ["enviada", "Enviada"]]} />
      <InputField name="importeBase" label="Base imponible" type="number" value={base} />
      <InputField name="iva" label="IVA" type="number" value={iva} />
      <InputField name="total" label="Total" type="number" value={card.amount} />
      <InputField name="pagado" label="Pagado" type="number" value={0} />
      <InputField name="pendiente" label="Pendiente" type="number" value={card.amount} />
      <InputField name="fechaEmision" label="Fecha emisión" type="datetime-local" value={nowInputValue()} />
      <InputField name="fechaVencimiento" label="Fecha vencimiento" type="datetime-local" value={inDaysInputValue(7)} />
      <TextareaField name="observaciones" label="Observaciones" value="Borrador preparado por Capataz. Revisa con gestoría antes de usarlo como factura legal." />
      <InputField name="metodoPago" label="Método de pago" value="transferencia" />
      <TextareaField name="datosBancarios" label="Datos bancarios" value={data.company?.iban ?? ""} />
      <div className="rounded-lg bg-obra-yellow/20 p-3 text-xs font-semibold leading-5 text-obra-yellowDark">
        Esta acción sólo crea la factura en la demo. No se envía email ni WhatsApp.
      </div>
      <button type="submit" className="primary-button w-full">Guardar factura</button>
    </form>
  );
}

function AcceptBudgetCard({ card, data }: { card: Extract<ActionCard, { type: "accept-budget" }>; data: ChatData }) {
  const limited = data.demoLimits.activeWorks >= data.demoLimits.activeWorkLimit;

  return (
    <form action={convertBudgetToWork} className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 text-obra-ink">
      <CardTitle icon={CheckCircle2} title="Aceptar presupuesto" />
      <SelectField name="id" label="Presupuesto" value={card.budgetId} options={data.budgets.map((budget) => [budget.id, `${budget.numero} · ${budget.clientName} · ${formatCurrency(budget.total)}`])} />
      <div className="rounded-lg bg-obra-yellow/20 p-3 text-xs font-semibold leading-5 text-obra-yellowDark">
        Al confirmar se marcará como aceptado y se creará una obra local. Revisa antes de ejecutar.
      </div>
      {limited ? (
        <DemoLimitButton
          className="primary-button w-full"
          currentCount={data.demoLimits.activeWorks}
          limit={data.demoLimits.activeWorkLimit}
          icon={Hammer}
        >
          Confirmar aceptación
        </DemoLimitButton>
      ) : (
        <button type="submit" className="primary-button w-full">Confirmar aceptación</button>
      )}
    </form>
  );
}

function CloseWorkCard({ card, data }: { card: Extract<ActionCard, { type: "close-work" }>; data: ChatData }) {
  return (
    <form action={updateWorkStatus} className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 text-obra-ink">
      <input type="hidden" name="estado" value="cerrada" />
      <CardTitle icon={Hammer} title="Cierre de obra preparado" />
      <SelectField name="id" label="Obra" value={card.workId} options={data.works.map((work) => [work.id, `${work.titulo} · ${work.clientName}`])} />
      <div className="rounded-lg bg-obra-yellow/20 p-3 text-xs font-semibold leading-5 text-obra-yellowDark">
        Si hay facturas pendientes, Capataz dejará la obra como pendiente de cobro en lugar de cerrarla.
      </div>
      <button type="submit" className="primary-button w-full">Confirmar cierre</button>
    </form>
  );
}

function AgendaEventCard({ card, data }: { card: Extract<ActionCard, { type: "agenda-event" }>; data: ChatData }) {
  return (
    <form action={saveManualRecord} className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 text-obra-ink">
      <input type="hidden" name="tipo" value="eventoAgenda" />
      <input type="hidden" name="returnTo" value="/capataz" />
      <CardTitle icon={CalendarClock} title="Evento de agenda preparado" />
      <InputField name="titulo" label="Título" value={card.title} />
      <SelectField
        name="tipoEvento"
        label="Tipo"
        value={card.eventType}
        options={[
          ["visita", "Visita"],
          ["llamada", "Llamada"],
          ["seguimiento_presupuesto", "Seguimiento presupuesto"],
          ["seguimiento_cobro", "Seguimiento cobro"],
          ["recordatorio_interno", "Recordatorio interno"],
          ["tarea_obra", "Tarea de obra"]
        ]}
      />
      <SelectField
        name="estado"
        label="Estado"
        value="pendiente"
        options={[
          ["pendiente", "Pendiente"],
          ["confirmado", "Confirmado"]
        ]}
      />
      <InputField name="fechaInicio" label="Fecha/hora" type="datetime-local" value={card.dateTime} />
      <SelectField name="clienteId" label="Cliente" value={card.clientId} optional options={data.clients.map((client) => [client.id, client.nombre])} />
      <SelectField name="obraId" label="Obra" value={card.workId ?? ""} optional options={data.works.map((work) => [work.id, `${work.titulo} · ${work.clientName}`])} />
      <SelectField name="presupuestoId" label="Presupuesto" value={card.budgetId ?? ""} optional options={data.budgets.map((budget) => [budget.id, `${budget.numero} · ${budget.clientName}`])} />
      <SelectField name="facturaId" label="Factura" value={card.invoiceId ?? ""} optional options={data.invoices.map((invoice) => [invoice.id, `${invoice.numero} · ${invoice.clientName}`])} />
      <TextareaField name="descripcion" label="Descripción" value={card.description} />
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        <input name="requiereConfirmacion" type="checkbox" defaultChecked={card.requiereConfirmacion} />
        Requiere confirmación antes de notificar o modificar algo sensible
      </label>
      <div className="rounded-lg bg-obra-yellow/20 p-3 text-xs font-semibold leading-5 text-obra-yellowDark">
        Guardar crea un evento interno. No se integra Google Calendar, Outlook, WhatsApp ni email.
      </div>
      <button type="submit" className="primary-button w-full">Guardar evento</button>
    </form>
  );
}

function AgendaReprogramCard({ card }: { card: Extract<ActionCard, { type: "agenda-reprogram" }> }) {
  return (
    <form action={reprogramAgendaEvent} className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 text-obra-ink">
      <input type="hidden" name="id" value={card.eventId} />
      <input type="hidden" name="confirmadoPorUsuario" value="true" />
      <CardTitle icon={CalendarClock} title="Reprogramación preparada" />
      <div className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-obra-ink">{card.title}</div>
      <InputField name="fechaInicio" label="Nueva fecha/hora" type="datetime-local" value={card.dateTime} />
      <div className="rounded-lg bg-obra-yellow/20 p-3 text-xs font-semibold leading-5 text-obra-yellowDark">
        Reprogramar sólo cambia la agenda interna. No se avisa al cliente fuera de la app.
      </div>
      <button type="submit" className="primary-button w-full">Confirmar reprogramación</button>
    </form>
  );
}

function AgendaStatusCard({ card }: { card: Extract<ActionCard, { type: "agenda-status" }> }) {
  return (
    <form action={updateAgendaEventStatus} className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 text-obra-ink">
      <input type="hidden" name="id" value={card.eventId} />
      <input type="hidden" name="estado" value={card.status} />
      <input type="hidden" name="confirmadoPorUsuario" value="true" />
      <CardTitle icon={CheckCircle2} title="Cambio de estado preparado" />
      <div className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-obra-ink">{card.title}</div>
      <div className="rounded-lg bg-obra-yellow/20 p-3 text-xs font-semibold leading-5 text-obra-yellowDark">
        Confirma sólo si quieres aplicar este estado en la agenda interna.
      </div>
      <button type="submit" className="primary-button w-full">Confirmar cambio</button>
    </form>
  );
}

function CardTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-black text-obra-ink">
      <Icon size={18} className="text-obra-yellowDark" />
      {title}
    </div>
  );
}

function InputField({ name, label, value, type = "text" }: { name: string; label: string; value: string | number; type?: string }) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <input className="field" name={name} type={type} step={type === "number" ? "0.01" : undefined} defaultValue={value} />
    </label>
  );
}

function TextareaField({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <textarea className="field min-h-24 py-3 leading-6" name={name} defaultValue={value} />
    </label>
  );
}

function SelectField({
  name,
  label,
  value,
  options,
  optional = false
}: {
  name: string;
  label: string;
  value: string;
  options: string[][];
  optional?: boolean;
}) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <select className="field" name={name} defaultValue={value}>
        {optional ? <option value="">Sin asociar</option> : null}
        {options.map(([id, labelText]) => (
          <option key={id} value={id}>{labelText}</option>
        ))}
      </select>
    </label>
  );
}

function userName(data: ChatData) {
  return cleanNullable(data.userProfile?.nombrePreferido) || cleanNullable(data.userProfile?.nombre) || null;
}

function profileCard(data: ChatData, overrides: Partial<ProfileCardFields>): Extract<ActionCard, { type: "user-profile" }> {
  const profile = data.userProfile;
  return {
    type: "user-profile",
    profile: {
      id: overrides.id ?? profile?.id ?? "usuario-demo",
      nombre: overrides.nombre ?? cleanNullable(profile?.nombre) ?? "",
      apellidos: overrides.apellidos ?? cleanNullable(profile?.apellidos) ?? "",
      nombrePreferido: overrides.nombrePreferido ?? cleanNullable(profile?.nombrePreferido) ?? "",
      telefono: overrides.telefono ?? cleanNullable(profile?.telefono) ?? "",
      email: overrides.email ?? cleanNullable(profile?.email) ?? "",
      cargo: overrides.cargo ?? cleanNullable(profile?.cargo) ?? "",
      oficioPrincipal: overrides.oficioPrincipal ?? cleanNullable(profile?.oficioPrincipal) ?? "",
      tonoPreferido: overrides.tonoPreferido ?? profile?.tonoPreferido ?? "directo"
    }
  };
}

function companyCard(data: ChatData, overrides: Partial<CompanyCardFields>): Extract<ActionCard, { type: "company-settings" }> {
  const company = data.company;
  return {
    type: "company-settings",
    company: {
      id: overrides.id ?? company?.id ?? "empresa-demo",
      nombreComercial: overrides.nombreComercial ?? cleanNullable(company?.nombreComercial) ?? "",
      razonSocial: overrides.razonSocial ?? cleanNullable(company?.razonSocial) ?? "",
      nifCif: overrides.nifCif ?? cleanNullable(company?.nifCif) ?? "",
      direccionFiscal: overrides.direccionFiscal ?? cleanNullable(company?.direccionFiscal) ?? "",
      codigoPostal: overrides.codigoPostal ?? cleanNullable(company?.codigoPostal) ?? "",
      ciudad: overrides.ciudad ?? cleanNullable(company?.ciudad) ?? "",
      provincia: overrides.provincia ?? cleanNullable(company?.provincia) ?? "",
      pais: overrides.pais ?? cleanNullable(company?.pais) ?? "España",
      telefono: overrides.telefono ?? cleanNullable(company?.telefono) ?? "",
      email: overrides.email ?? cleanNullable(company?.email) ?? "",
      web: overrides.web ?? cleanNullable(company?.web) ?? "",
      iban: overrides.iban ?? cleanNullable(company?.iban) ?? "",
      condicionesPorDefecto: overrides.condicionesPorDefecto ?? cleanNullable(company?.condicionesPorDefecto) ?? "",
      textoLegal: overrides.textoLegal ?? cleanNullable(company?.textoLegal) ?? "",
      logoUrl: overrides.logoUrl ?? cleanNullable(company?.logoUrl) ?? "",
      selloUrl: overrides.selloUrl ?? cleanNullable(company?.selloUrl) ?? "",
      colorMarca: overrides.colorMarca ?? cleanNullable(company?.colorMarca) ?? "#f6c945",
      ivaDefecto: overrides.ivaDefecto ?? company?.ivaDefecto ?? 21,
      seriePresupuestos: overrides.seriePresupuestos ?? cleanNullable(company?.seriePresupuestos) ?? "2026",
      serieFacturas: overrides.serieFacturas ?? cleanNullable(company?.serieFacturas) ?? "2026",
      prefijoPresupuesto: overrides.prefijoPresupuesto ?? cleanNullable(company?.prefijoPresupuesto) ?? "P",
      prefijoFactura: overrides.prefijoFactura ?? cleanNullable(company?.prefijoFactura) ?? "F"
    }
  };
}

function extractProfileName(text: string, normalized: string) {
  if (!/(me llamo|llamame|llámame|mi nombre es|soy)\s+/.test(normalized)) return null;
  const match = text.match(/(?:me llamo|ll[aá]mame|mi nombre es|soy)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)/i);
  return match?.[1] ? cleanName(match[1]) : null;
}

function extractPreferredTone(normalized: string) {
  if (!normalized.includes("tono")) return null;
  if (normalized.includes("muy educado") || normalized.includes("muy_educado")) return "muy_educado";
  if (normalized.includes("cercano")) return "cercano";
  if (normalized.includes("formal")) return "formal";
  if (normalized.includes("directo")) return "directo";
  return null;
}

function looksLikeSimpleName(text: string) {
  const trimmed = text.trim();
  return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?$/.test(trimmed) && trimmed.length <= 32;
}

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function extractCompanyProposal(text: string, normalized: string): Partial<CompanyCardFields> | null {
  const isCompanyData =
    normalized.includes("empresa") ||
    normalized.includes("cif") ||
    normalized.includes("nif") ||
    normalized.includes("iban") ||
    normalized.includes("iva") ||
    normalized.includes("logo") ||
    normalized.includes("sello");
  if (!isCompanyData) return null;

  const proposal: Partial<CompanyCardFields> = {};
  const companyName = text.match(/(?:mi empresa se llama|empresa se llama|nombre comercial es)\s+([^.,\n]+)/i)?.[1];
  const fiscalName = text.match(/(?:raz[oó]n social es)\s+([^.,\n]+)/i)?.[1];
  const taxId = text.match(/\b[A-ZABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]\b/i)?.[0];
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const iban = text.match(/\bES\d{2}[A-Z0-9 ]{10,}\b/i)?.[0];
  const iva = normalized.match(/iva(?:\s+por defecto)?(?:\s+al|\s+de|\s+es)?\s+(\d+(?:[,.]\d+)?)/)?.[1];
  const asset = text.match(/(?:https?:\/\/|\/)[^\s]+/)?.[0];

  if (companyName) proposal.nombreComercial = cleanCompanyValue(companyName);
  if (fiscalName) proposal.razonSocial = cleanCompanyValue(fiscalName);
  if (taxId) proposal.nifCif = taxId.toUpperCase();
  if (email && normalized.includes("empresa")) proposal.email = email;
  if (iban) proposal.iban = iban.toUpperCase().replace(/\s+/g, " ");
  if (iva) proposal.ivaDefecto = Number(iva.replace(",", "."));
  if (asset && normalized.includes("logo")) proposal.logoUrl = asset;
  if (asset && normalized.includes("sello")) proposal.selloUrl = asset;

  return Object.keys(proposal).length || normalized.includes("logo") || normalized.includes("sello") ? proposal : null;
}

function cleanNullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function cleanCompanyValue(value: string) {
  return value
    .replace(/\s+y\s+mi\s+(cif|nif|email|iban|iva).*/i, "")
    .replace(/\s+y\s+el\s+(cif|nif|email|iban|iva).*/i, "")
    .trim();
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractAmount(text: string) {
  const pattern = /(\d+(?:[,.]\d{1,2})?)/g;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    const value = match[1];
    const before = text.slice(Math.max(0, index - 12), index);
    const after = text.slice(index + value.length, index + value.length + 4);
    if (/^\s*(h|:)/.test(after) || /\b(a\s+)?las\s+$/.test(before)) continue;
    return Number(value.replace(",", "."));
  }
  return null;
}

function findMentionedName(text: string) {
  const explicit = text.match(/(?:ha entrado|cliente|visita con|con|para)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/);
  if (explicit?.[1]) return explicit[1];

  const matches = text.match(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\b/g) ?? [];
  return matches.find((match) => !["Ha", "Agenda", "Haz", "Crea", "Cierra"].includes(match)) ?? null;
}

function findClient(text: string, clients: ChatData["clients"]) {
  return clients.find((client) => {
    const first = normalize(client.nombre.split(" ")[0]);
    const full = normalize(client.nombre);
    return text.includes(first) || text.includes(full);
  });
}

function findWork(text: string, works: ChatData["works"], clientName?: string) {
  return works.find((work) => text.includes(normalize(work.titulo)) || (clientName && work.clientName === clientName));
}

function findAgendaEvent(events: ChatData["agendaEvents"], type: string, clientName?: string, editableOnly = false) {
  return events.find((event) => {
    const sameType = event.type === type;
    const sameClient = clientName ? event.clientName === clientName : true;
    const editable = editableOnly ? event.editable && event.source === "evento" : true;
    return sameType && sameClient && editable && event.status !== "cancelado";
  });
}

function agendaEventsForDay(events: ChatData["agendaEvents"], day: Date) {
  const start = startOfDay(day);
  const end = addDays(start, 1);
  return agendaEventsForRange(events, start, end);
}

function agendaEventsForRange(events: ChatData["agendaEvents"], start: Date, end: Date) {
  return events
    .filter((event) => {
      const date = new Date(event.startsAt);
      return date >= start && date < end && event.status !== "cancelado";
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

function formatAgendaLines(events: ChatData["agendaEvents"]) {
  return events.map((event) => `${formatAgendaDate(event.startsAt)} · ${event.title}${event.clientName ? ` · ${event.clientName}` : ""}`).join("\n");
}

function formatAgendaDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function nowInputValue() {
  return toInputValue(new Date());
}

function tomorrowAtTen() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return toInputValue(date);
}

function nextFridayAtTen() {
  return nextWeekdayAt(5, 10);
}

function nextWeekdayAt(day: number, hour: number) {
  const date = new Date();
  const daysUntil = (day - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntil);
  date.setHours(hour, 0, 0, 0);
  return toInputValue(date);
}

function dayExpressionToInput(text: string) {
  const hourMatch = text.match(/(?:a las|las)\s+(\d{1,2})/);
  const hour = hourMatch ? Number(hourMatch[1]) : 10;
  if (text.includes("lunes")) return nextWeekdayAt(1, hour);
  if (text.includes("martes")) return nextWeekdayAt(2, hour);
  if (text.includes("miercoles")) return nextWeekdayAt(3, hour);
  if (text.includes("jueves")) return nextWeekdayAt(4, hour);
  if (text.includes("viernes")) return nextWeekdayAt(5, hour);
  if (text.includes("sabado")) return nextWeekdayAt(6, hour);
  if (text.includes("domingo")) return nextWeekdayAt(0, hour);
  if (text.includes("manana")) {
    const date = addDays(new Date(), 1);
    date.setHours(hour, 0, 0, 0);
    return toInputValue(date);
  }
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return toInputValue(date);
}

function inDaysInputValue(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(12, 0, 0, 0);
  return toInputValue(date);
}

function baseFromTotal(total: number, ivaPercent = 21) {
  return Math.round((total / (1 + ivaPercent / 100)) * 100) / 100;
}

function toInputValue(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
