"use client";

import { useEffect } from "react";

export type FollowUpsRailItem = {
  id: string;
  title: string;
  href: string;
  status: string | null;
  priority: string | null;
  nextAction: string | null;
  promise: string | null;
  lastAttempt: string | null;
  channel: string | null;
  result: string | null;
};

export type FollowUpsRailReminder = {
  id: string;
  title: string;
  description: string;
  href: string;
};

export type FollowUpsRailContextValue = {
  totalVisible: number;
  overdueVisible: number;
  withoutDate: number;
  withoutAttempt: number;
  withoutResult: number;
  top: FollowUpsRailItem | null;
  reminders: FollowUpsRailReminder[];
};

const EVENT_NAME = "orqena:followups-context";

export function FollowUpsRailContextBridge() {
  useEffect(() => {
    let frame = 0;
    const publish = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent<FollowUpsRailContextValue>(EVENT_NAME, { detail: readVisibleFollowUps() }));
      });
    };
    const observer = new MutationObserver(publish);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    publish();
    const hydrationPublish = window.setTimeout(publish, 250);
    const settledPublish = window.setTimeout(publish, 1_000);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(hydrationPublish);
      window.clearTimeout(settledPublish);
      observer.disconnect();
      window.dispatchEvent(new CustomEvent<null>(EVENT_NAME, { detail: null }));
    };
  }, []);

  return null;
}

function readVisibleFollowUps(): FollowUpsRailContextValue {
  const items = Array.from(document.querySelectorAll<HTMLElement>("[data-follow-up-queue-item]"))
    .map(readItem)
    .filter((item): item is FollowUpsRailItem => item != null);
  const now = Date.now();
  const overdueVisible = items.filter((item) => {
    const timestamp = parseSpanishDate(item.nextAction);
    return timestamp != null && timestamp < now;
  }).length;
  const withoutDate = items.filter((item) => !item.nextAction || item.nextAction === "Sin fecha").length;
  const withoutAttempt = items.filter((item) => !item.lastAttempt || item.lastAttempt === "Sin intentos").length;
  const withoutResult = items.filter((item) => !item.result || item.result === "Sin resultado").length;
  const reminders: FollowUpsRailReminder[] = [];
  const overdueItem = items.find((item) => {
    const timestamp = parseSpanishDate(item.nextAction);
    return timestamp != null && timestamp < now;
  });
  const withoutDateItem = items.find((item) => !item.nextAction || item.nextAction === "Sin fecha");
  const withoutAttemptItem = items.find((item) => !item.lastAttempt || item.lastAttempt === "Sin intentos");
  const withoutResultItem = items.find((item) => !item.result || item.result === "Sin resultado");

  if (overdueItem) reminders.push({ id: "overdue", title: `${overdueVisible} ${overdueVisible === 1 ? "seguimiento vencido" : "seguimientos vencidos"}`, description: "Revisa la siguiente acción y registra una decisión.", href: overdueItem.href });
  if (withoutDateItem) reminders.push({ id: "without-date", title: `${withoutDate} ${withoutDate === 1 ? "seguimiento sin fecha" : "seguimientos sin fecha"}`, description: "Define cuándo debe producirse la siguiente acción.", href: withoutDateItem.href });
  if (withoutAttemptItem) reminders.push({ id: "without-attempt", title: `${withoutAttempt} ${withoutAttempt === 1 ? "sin intento registrado" : "sin intentos registrados"}`, description: "Registra el canal y el intento cuando se haya realizado.", href: withoutAttemptItem.href });
  if (withoutResultItem) reminders.push({ id: "without-result", title: `${withoutResult} ${withoutResult === 1 ? "sin resultado" : "sin resultados"}`, description: "Completa el resultado después de revisar el contacto.", href: withoutResultItem.href });

  return {
    totalVisible: items.length,
    overdueVisible,
    withoutDate,
    withoutAttempt,
    withoutResult,
    top: items[0] ?? null,
    reminders: reminders.slice(0, 3),
  };
}

function readItem(node: HTMLElement): FollowUpsRailItem | null {
  const link = node.querySelector<HTMLAnchorElement>('a[href^="/seguimientos/"]');
  const href = safeInternalHref(link?.getAttribute("href"));
  const title = link?.textContent?.trim();
  if (!href || !title) return null;
  const id = href.slice("/seguimientos/".length).split(/[?#/]/)[0] ?? "";
  if (!id) return null;
  const metadata = link?.parentElement?.querySelector("p")?.textContent?.trim() ?? "";
  const parts = metadata.split("·").map((part) => part.trim()).filter(Boolean);
  const fields = new Map<string, string>();
  node.querySelectorAll("dl > div").forEach((field) => {
    const label = field.querySelector("dt")?.textContent?.trim();
    const value = field.querySelector("dd")?.textContent?.trim();
    if (label && value) fields.set(label, value);
  });
  return {
    id,
    title,
    href,
    status: parts[1] ?? null,
    priority: parts.find((part) => part.toLocaleLowerCase("es-ES").startsWith("prioridad "))?.replace(/^prioridad\s+/i, "") ?? null,
    nextAction: fields.get("Fecha") ?? null,
    promise: fields.get("Promesa") ?? null,
    lastAttempt: fields.get("Último intento") ?? null,
    channel: fields.get("Canal") ?? null,
    result: fields.get("Resultado") ?? null,
  };
}

function safeInternalHref(value: string | null | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : null;
}

function parseSpanishDate(value: string | null) {
  if (!value || value === "Sin fecha") return null;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4}),?\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, day, month, rawYear, hour, minute] = match;
  const yearNumber = Number(rawYear);
  const year = rawYear.length === 2 ? 2000 + yearNumber : yearNumber;
  const timestamp = new Date(year, Number(month) - 1, Number(day), Number(hour), Number(minute)).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}
