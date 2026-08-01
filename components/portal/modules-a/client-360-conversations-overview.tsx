"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import {
  Check,
  CheckCheck,
  CircleDot,
  Clock3,
  FileText,
  Mail,
  MessageCircle,
  MessageSquareText,
  MoreVertical,
  NotebookPen,
  Phone,
  PhoneCall,
  Search,
  UserRound,
  Video,
} from "lucide-react";

export type ClientConversationChannelKind = "whatsapp" | "email" | "call" | "video" | "internal" | "other";
export type ClientConversationTone = "neutral" | "success" | "warning" | "danger" | "info" | "violet";
export type ClientConversationMetricKind = "active" | "unanswered" | "average_response" | "latest_interaction";

export type AuthorizedConversationHref = {
  href: string;
  authorized: boolean;
};

export type ClientConversationParticipant = {
  id: string;
  clientId: string;
  name: string;
  authorized: boolean;
  role?: string | null;
  avatarUrl?: string | null;
};

export type ClientConversationAttachment = {
  id: string;
  name: string;
  authorized: boolean;
  href?: AuthorizedConversationHref | null;
  sizeBytes?: number | null;
  mimeType?: string | null;
};

export type ClientConversationMessage = {
  id: string;
  clientId: string;
  conversationId: string;
  authorized: boolean;
  direction: "inbound" | "outbound" | "internal";
  body: string;
  author?: ClientConversationParticipant | null;
  sentAt?: string | null;
  read?: boolean | null;
  attachments?: ClientConversationAttachment[];
};

export type ClientConversationRecord = {
  id: string;
  clientId: string;
  authorized: boolean;
  title: string;
  preview?: string | null;
  channel: { kind: ClientConversationChannelKind; label: string };
  status?: { label: string; tone?: ClientConversationTone } | null;
  priority?: { label: string; tone?: ClientConversationTone } | null;
  lastMessageAt?: string | null;
  unreadCount?: number | null;
  participants: ClientConversationParticipant[];
  messages: ClientConversationMessage[];
  detailHref?: AuthorizedConversationHref | null;
  replyHref?: AuthorizedConversationHref | null;
  moreHref?: AuthorizedConversationHref | null;
};

export type ClientConversationMetric = {
  kind: ClientConversationMetricKind;
  authorized: boolean;
  value: string | number | null;
  detail?: string | null;
  tone?: ClientConversationTone;
};

export type Client360ConversationsOverviewProps = {
  clientId: string;
  conversations: ClientConversationRecord[];
  metrics: ClientConversationMetric[];
  selectedConversationId?: string | null;
  newMessageHref?: AuthorizedConversationHref | null;
  scheduleCallHref?: AuthorizedConversationHref | null;
  createNoteHref?: AuthorizedConversationHref | null;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  className?: string;
};

const toneClasses: Record<ClientConversationTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
  violet: "bg-violet-50 text-violet-700",
};

const channelIcons: Record<ClientConversationChannelKind, typeof MessageCircle> = {
  whatsapp: MessageCircle,
  email: Mail,
  call: PhoneCall,
  video: Video,
  internal: NotebookPen,
  other: MessageSquareText,
};

const channelTones: Record<ClientConversationChannelKind, string> = {
  whatsapp: "bg-emerald-50 text-emerald-700",
  email: "bg-blue-50 text-blue-700",
  call: "bg-violet-50 text-violet-700",
  video: "bg-violet-50 text-violet-700",
  internal: "bg-amber-50 text-amber-800",
  other: "bg-slate-100 text-slate-700",
};

const metricPresentation: Record<ClientConversationMetricKind, { label: string; icon: typeof MessageCircle; tone: ClientConversationTone }> = {
  active: { label: "Conversaciones activas", icon: CircleDot, tone: "success" },
  unanswered: { label: "Sin respuesta", icon: Clock3, tone: "warning" },
  average_response: { label: "Tiempo medio de respuesta", icon: Clock3, tone: "success" },
  latest_interaction: { label: "Última interacción", icon: PhoneCall, tone: "violet" },
};

const dayFormatter = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalize(value: string | null | undefined) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").trim();
}

function safeHref(value: AuthorizedConversationHref | null | undefined) {
  if (!value?.authorized) return null;
  const href = value.href.trim();
  return href.startsWith("/") && !href.startsWith("//") && !href.includes("\\") ? href : null;
}

function safeImageUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function formatBytes(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  if (value < 1024) return `${Math.round(value)} B`;
  const units = ["KB", "MB", "GB"];
  let amount = value / 1024;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index += 1; }
  return `${amount.toLocaleString("es-ES", { maximumFractionDigits: amount >= 10 ? 1 : 2 })} ${units[index]}`;
}

function normalizePageSizes(initialPageSize: number, values: number[]) {
  return Array.from(new Set([initialPageSize, ...values].map((value) => Math.floor(value)).filter((value) => Number.isFinite(value) && value > 0))).sort((a, b) => a - b);
}

export function Client360ConversationsOverview({
  clientId,
  conversations,
  metrics,
  selectedConversationId,
  newMessageHref,
  scheduleCallHref,
  createNoteHref,
  initialPageSize = 8,
  pageSizeOptions = [8, 16, 32],
  className = "",
}: Client360ConversationsOverviewProps) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<ClientConversationChannelKind | "all">("all");
  const [page, setPage] = useState(1);
  const pageSizes = useMemo(() => normalizePageSizes(initialPageSize, pageSizeOptions), [initialPageSize, pageSizeOptions]);
  const [pageSize, setPageSize] = useState(pageSizes[0] ?? 8);
  const scopedConversations = useMemo(() => conversations.filter((conversation) => conversation.authorized === true && conversation.clientId === clientId), [clientId, conversations]);
  const filteredConversations = useMemo(() => {
    const needle = normalize(query);
    return [...scopedConversations].filter((conversation) => {
      if (channel !== "all" && conversation.channel.kind !== channel) return false;
      return !needle || normalize([conversation.title, conversation.preview, conversation.channel.label, conversation.status?.label, conversation.priority?.label, ...conversation.participants.filter((participant) => participant.authorized && participant.clientId === clientId).map((participant) => participant.name)].filter(Boolean).join(" ")).includes(needle);
    }).sort((a, b) => (parseDate(b.lastMessageAt)?.getTime() ?? 0) - (parseDate(a.lastMessageAt)?.getTime() ?? 0));
  }, [channel, clientId, query, scopedConversations]);
  const pageCount = Math.max(1, Math.ceil(filteredConversations.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleConversations = filteredConversations.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedConversation = scopedConversations.find((conversation) => conversation.id === selectedConversationId) ?? null;
  const channels = useMemo(() => Array.from(new Map(scopedConversations.map((conversation) => [conversation.channel.kind, conversation.channel.label])).entries()), [scopedConversations]);
  const actionLinks = [
    { href: safeHref(newMessageHref), label: "Nuevo mensaje", icon: MessageCircle, primary: true },
    { href: safeHref(scheduleCallHref), label: "Programar llamada", icon: Phone, primary: false },
    { href: safeHref(createNoteHref), label: "Crear nota", icon: NotebookPen, primary: false },
  ].filter((action): action is { href: string; label: string; icon: typeof MessageCircle; primary: boolean } => Boolean(action.href));
  const updateQuery = (value: string) => { setQuery(value); setPage(1); };
  const updateChannel = (value: ClientConversationChannelKind | "all") => { setChannel(value); setPage(1); };

  return <section className={`grid min-w-0 gap-3 ${className}`} aria-labelledby={`${id}-title`}>
    <header className="sr-only"><h2 id={`${id}-title`}>Conversaciones del cliente</h2></header>

    <section className="grid grid-cols-2 gap-2 xl:grid-cols-4" aria-label="Indicadores de conversaciones">
      {metrics.filter((metric) => metric.authorized).map((metric) => <ConversationMetricCard key={metric.kind} metric={metric} />)}
      {metrics.every((metric) => !metric.authorized) ? <div className="col-span-full rounded-xl border border-dashed border-border bg-surface p-5 text-center text-xs text-content-secondary">No hay indicadores de conversaciones autorizados.</div> : null}
    </section>

    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 xl:flex-row xl:items-center xl:justify-between" aria-label="Filtros y acciones de conversaciones">
      <div className="flex min-w-0 flex-wrap gap-2"><button type="button" onClick={() => updateChannel("all")} aria-pressed={channel === "all"} className={`min-h-9 rounded-full border px-3 text-[9px] font-bold ${channel === "all" ? "border-brand bg-brand text-white" : "border-border text-content-secondary"}`}>Todas <span className="ml-1 opacity-75">{scopedConversations.length}</span></button>{channels.map(([value, label]) => <button key={value} type="button" onClick={() => updateChannel(value)} aria-pressed={channel === value} className={`min-h-9 rounded-full border px-3 text-[9px] font-bold ${channel === value ? "border-brand bg-brand text-white" : "border-border text-content-secondary"}`}>{label} <span className="ml-1 opacity-75">{scopedConversations.filter((conversation) => conversation.channel.kind === value).length}</span></button>)}</div>
      {actionLinks.length ? <div className="flex flex-wrap gap-2">{actionLinks.map(({ href, label, icon: Icon, primary }) => <Link key={label} href={href} className={`${primary ? "primary-button" : "secondary-button"} justify-center`}><Icon size={14} aria-hidden="true" />{label}</Link>)}</div> : null}
    </section>

    <div className="grid min-w-0 gap-3 xl:grid-cols-[21rem_minmax(0,1fr)]">
      <aside className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface" aria-label="Listado de conversaciones">
        <header className="border-b border-border p-3"><label htmlFor={`${id}-search`} className="flex min-h-10 items-center gap-2 rounded-lg border border-border px-3"><Search size={14} className="shrink-0 text-content-tertiary" aria-hidden="true" /><span className="sr-only">Buscar conversaciones</span><input id={`${id}-search`} value={query} onChange={(event) => updateQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[10px] text-content outline-none" placeholder="Buscar en conversaciones…" /></label></header>
        {visibleConversations.length ? <ul className="divide-y divide-border">{visibleConversations.map((conversation) => <ConversationListItem key={conversation.id} conversation={conversation} clientId={clientId} selected={conversation.id === selectedConversationId} />)}</ul> : <div className="grid min-h-52 place-content-center p-5 text-center"><MessageSquareText size={24} className="mx-auto text-content-tertiary" aria-hidden="true" /><strong className="mt-3 text-xs text-content">Sin conversaciones visibles</strong><p className="mt-1 max-w-xs text-[10px] leading-4 text-content-secondary">No hay conversaciones autorizadas que coincidan con los filtros.</p></div>}
        <footer className="grid gap-2 border-t border-border p-3"><div className="flex items-center justify-between gap-2"><p className="text-[8px] text-content-secondary" aria-live="polite">Mostrando {visibleConversations.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filteredConversations.length)} de {filteredConversations.length}</p><label className="flex items-center gap-1 text-[8px] text-content-secondary"><span>Por página</span><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="min-h-8 rounded-lg border border-border bg-surface px-2 text-content">{pageSizes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>{pageCount > 1 ? <nav className="flex justify-center gap-1" aria-label="Paginación de conversaciones">{Array.from({ length: pageCount }, (_, index) => index + 1).slice(Math.max(0, currentPage - 3), Math.max(0, currentPage - 3) + 5).map((value) => <button key={value} type="button" onClick={() => setPage(value)} aria-current={value === currentPage ? "page" : undefined} className={`h-8 min-w-8 rounded-lg border px-2 text-[9px] font-bold ${value === currentPage ? "border-brand bg-brand text-white" : "border-border text-content-secondary"}`}>{value}</button>)}</nav> : null}</footer>
      </aside>

      <ConversationDetail conversation={selectedConversation} clientId={clientId} />
    </div>
  </section>;
}

function ConversationMetricCard({ metric }: { metric: ClientConversationMetric }) {
  const presentation = metricPresentation[metric.kind];
  const Icon = presentation.icon;
  const tone = metric.tone ?? presentation.tone;
  return <article className="min-w-0 rounded-xl border border-border bg-surface p-3"><div className="flex items-start gap-3"><span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}><Icon size={17} aria-hidden="true" /></span><span className="min-w-0"><small className="block truncate text-[9px] font-semibold text-content-secondary">{presentation.label}</small><strong className="mt-1 block truncate text-xl font-black tabular-nums text-content">{metric.value == null ? "—" : typeof metric.value === "number" ? metric.value.toLocaleString("es-ES") : metric.value}</strong>{metric.detail ? <span className="mt-1 block truncate text-[8px] font-semibold text-content-secondary">{metric.detail}</span> : null}</span></div></article>;
}

function ConversationListItem({ conversation, clientId, selected }: { conversation: ClientConversationRecord; clientId: string; selected: boolean }) {
  const Icon = channelIcons[conversation.channel.kind];
  const date = parseDate(conversation.lastMessageAt);
  const href = safeHref(conversation.detailHref);
  const participants = conversation.participants.filter((participant) => participant.authorized && participant.clientId === clientId);
  const content = <div className={`grid min-h-20 grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-2 border-l-2 p-3 ${selected ? "border-l-brand bg-brand-soft/50" : "border-l-transparent hover:bg-subtle"}`}><span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${channelTones[conversation.channel.kind]}`}><Icon size={15} aria-hidden="true" /></span><span className="min-w-0"><span className="flex items-center gap-2"><strong className="truncate text-[10px] text-content">{conversation.title}</strong>{conversation.status ? <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[7px] font-bold ${toneClasses[conversation.status.tone ?? "neutral"]}`}>{conversation.status.label}</span> : null}</span>{conversation.preview ? <p className="mt-1 truncate text-[8px] text-content-secondary">{conversation.preview}</p> : null}{participants.length ? <span className="mt-1 flex items-center gap-1 text-[8px] text-content-tertiary"><UserRound size={10} aria-hidden="true" /><span className="truncate">{participants.map((participant) => participant.name).join(", ")}</span></span> : null}</span><span className="text-right">{date ? <time dateTime={conversation.lastMessageAt ?? undefined} className="block text-[8px] text-content-secondary">{timeFormatter.format(date)}</time> : null}{conversation.unreadCount != null && conversation.unreadCount > 0 ? <span className="mt-2 inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[8px] font-black text-white">{conversation.unreadCount}</span> : null}{conversation.priority ? <span className={`mt-1 block rounded-full px-1.5 py-0.5 text-[7px] font-bold ${toneClasses[conversation.priority.tone ?? "warning"]}`}>{conversation.priority.label}</span> : null}</span></div>;
  return <li>{href ? <Link href={href} aria-current={selected ? "page" : undefined} className="block">{content}</Link> : content}</li>;
}

function ConversationDetail({ conversation, clientId }: { conversation: ClientConversationRecord | null; clientId: string }) {
  if (!conversation) return <section className="grid min-h-[34rem] place-content-center rounded-xl border border-dashed border-border bg-surface p-6 text-center"><MessageSquareText size={28} className="mx-auto text-content-tertiary" aria-hidden="true" /><h3 className="mt-3 text-sm font-black text-content">Selecciona una conversación</h3><p className="mt-2 max-w-sm text-xs leading-5 text-content-secondary">El detalle sólo se muestra cuando la ruta proporciona una conversación autorizada del cliente.</p></section>;
  const participants = conversation.participants.filter((participant) => participant.authorized && participant.clientId === clientId);
  const messages = conversation.messages.filter((message) => message.authorized === true && message.clientId === clientId && message.conversationId === conversation.id && message.body.trim()).sort((a, b) => (parseDate(a.sentAt)?.getTime() ?? 0) - (parseDate(b.sentAt)?.getTime() ?? 0));
  const Icon = channelIcons[conversation.channel.kind];
  const replyHref = safeHref(conversation.replyHref);
  const moreHref = safeHref(conversation.moreHref);
  return <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface" aria-label={`Detalle de ${conversation.title}`}>
    <header className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${channelTones[conversation.channel.kind]}`}><Icon size={18} aria-hidden="true" /></span><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-black text-content">{conversation.title}</h3>{conversation.status ? <span className={`rounded-full px-2 py-1 text-[8px] font-bold ${toneClasses[conversation.status.tone ?? "neutral"]}`}>{conversation.status.label}</span> : null}</span><p className="mt-1 text-[9px] text-content-secondary">{conversation.channel.label}{conversation.lastMessageAt && parseDate(conversation.lastMessageAt) ? ` · ${dayFormatter.format(parseDate(conversation.lastMessageAt)!)} ${timeFormatter.format(parseDate(conversation.lastMessageAt)!)}` : ""}</p></span></div><div className="flex items-center gap-2">{participants.length ? <div className="flex -space-x-1" aria-label={`${participants.length} participantes`}>{participants.slice(0, 4).map((participant) => <ParticipantAvatar key={participant.id} participant={participant} />)}{participants.length > 4 ? <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-subtle text-[8px] font-bold text-content-secondary">+{participants.length - 4}</span> : null}</div> : null}{moreHref ? <Link href={moreHref} aria-label="Más opciones autorizadas" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-content-secondary hover:bg-subtle"><MoreVertical size={15} aria-hidden="true" /></Link> : null}</div></header>

    <div className="max-h-[40rem] min-h-[28rem] overflow-y-auto bg-subtle/30 p-4" aria-live="polite" aria-label="Mensajes de la conversación">{messages.length ? <ol className="grid gap-3">{messages.map((message) => <MessageBubble key={message.id} message={message} clientId={clientId} />)}</ol> : <div className="grid min-h-72 place-content-center text-center"><MessageCircle size={24} className="mx-auto text-content-tertiary" aria-hidden="true" /><strong className="mt-3 text-xs text-content">Sin mensajes autorizados</strong><p className="mt-1 max-w-sm text-[10px] leading-4 text-content-secondary">No se reconstruyen conversaciones ni se inventan mensajes ausentes.</p></div>}</div>

    <footer className="border-t border-border p-3">{replyHref ? <Link href={replyHref} className="primary-button w-full justify-center sm:ml-auto sm:w-auto"><MessageCircle size={15} aria-hidden="true" />Responder conversación</Link> : <p className="text-center text-[9px] text-content-secondary">No hay una acción de respuesta autorizada para esta conversación.</p>}</footer>
  </section>;
}

function MessageBubble({ message, clientId }: { message: ClientConversationMessage; clientId: string }) {
  const sentAt = parseDate(message.sentAt);
  const author = message.author?.authorized && message.author.clientId === clientId ? message.author : null;
  const inbound = message.direction === "inbound";
  const internal = message.direction === "internal";
  const attachments = (message.attachments ?? []).filter((attachment) => attachment.authorized);
  return <li className={`flex gap-2 ${inbound || internal ? "justify-start" : "justify-end"}`}>{inbound && author ? <ParticipantAvatar participant={author} /> : null}<article className={`max-w-[88%] rounded-xl border p-3 sm:max-w-[72%] ${internal ? "border-amber-200 bg-amber-50" : inbound ? "border-border bg-surface" : "border-emerald-200 bg-emerald-50"}`}>{author ? <strong className="block text-[9px] text-content">{author.name}{author.role ? <span className="font-medium text-content-secondary"> · {author.role}</span> : null}</strong> : null}<p className={`whitespace-pre-wrap text-[10px] leading-5 ${internal ? "text-amber-900" : "text-content"}`}>{message.body}</p>{attachments.length ? <ul className="mt-2 grid gap-2">{attachments.map((attachment) => { const href = safeHref(attachment.href); const content = <><FileText size={15} className="shrink-0 text-red-600" aria-hidden="true" /><span className="min-w-0"><strong className="block truncate text-[9px] text-content">{attachment.name}</strong><small className="mt-0.5 block text-[8px] text-content-secondary">{[formatBytes(attachment.sizeBytes), attachment.mimeType].filter(Boolean).join(" · ") || "Archivo autorizado"}</small></span></>; return <li key={attachment.id}>{href ? <Link href={href} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center gap-2 rounded-lg border border-border bg-white/70 p-2 hover:bg-white">{content}</Link> : <div className="flex min-h-12 items-center gap-2 rounded-lg border border-border bg-white/70 p-2">{content}</div>}</li>; })}</ul> : null}{sentAt || message.read != null ? <footer className="mt-2 flex items-center justify-end gap-1 text-[8px] text-content-tertiary">{sentAt ? <time dateTime={message.sentAt ?? undefined}>{timeFormatter.format(sentAt)}</time> : null}{message.read != null && message.direction === "outbound" ? message.read ? <CheckCheck size={12} className="text-blue-600" aria-label="Leído" /> : <Check size={12} aria-label="No leído" /> : null}</footer> : null}</article>{message.direction === "outbound" && author ? <ParticipantAvatar participant={author} /> : null}</li>;
}

function ParticipantAvatar({ participant }: { participant: ClientConversationParticipant }) {
  const avatar = safeImageUrl(participant.avatarUrl);
  return <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface text-content-secondary" title={participant.name}>{avatar ? <Image src={avatar} alt="" width={28} height={28} unoptimized className="h-full w-full object-cover" /> : <UserRound size={13} aria-hidden="true" />}<span className="sr-only">{participant.name}</span></span>;
}
