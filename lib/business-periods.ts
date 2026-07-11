export type BusinessPeriodId =
  | "today"
  | "this_week"
  | "this_month"
  | "previous_month"
  | "this_quarter"
  | "previous_quarter"
  | "this_year"
  | "previous_year"
  | "last_30_days"
  | "last_90_days"
  | "custom";

export type BusinessPeriod = {
  id: BusinessPeriodId;
  label: string;
  start: Date;
  end: Date;
  previousStart: Date | null;
  previousEnd: Date | null;
  timezone: string;
  isComplete: boolean;
};

export const BUSINESS_PERIOD_OPTIONS: Array<{ id: BusinessPeriodId; label: string }> = [
  { id: "today", label: "Hoy" },
  { id: "this_week", label: "Esta semana" },
  { id: "this_month", label: "Este mes" },
  { id: "previous_month", label: "Mes anterior" },
  { id: "this_quarter", label: "Este trimestre" },
  { id: "previous_quarter", label: "Trimestre anterior" },
  { id: "this_year", label: "Este año" },
  { id: "previous_year", label: "Año anterior" },
  { id: "last_30_days", label: "Últimos 30 días" },
  { id: "last_90_days", label: "Últimos 90 días" }
];

export function resolveBusinessPeriod({
  id = "this_month",
  from,
  to,
  timezone = "Europe/Madrid",
  now = new Date()
}: {
  id?: BusinessPeriodId | string;
  from?: string | Date | null;
  to?: string | Date | null;
  timezone?: string | null;
  now?: Date;
} = {}): BusinessPeriod {
  const periodId = validPeriodId(id);
  const tz = timezone || "Europe/Madrid";
  const today = startOfDay(now);
  const currentQuarterStart = quarterStart(today);

  if (periodId === "custom") {
    const start = startOfDay(parseDate(from) ?? today);
    const inclusiveEnd = parseDate(to) ?? start;
    const end = addDays(startOfDay(inclusiveEnd), 1);
    const duration = end.getTime() - start.getTime();
    return {
      id: "custom",
      label: `${formatShortDate(start)} - ${formatShortDate(addDays(end, -1))}`,
      start,
      end,
      previousStart: new Date(start.getTime() - duration),
      previousEnd: start,
      timezone: tz,
      isComplete: end <= now
    };
  }

  if (periodId === "today") {
    const start = today;
    const end = addDays(start, 1);
    return withPrevious(periodId, "Hoy", start, end, tz, now);
  }

  if (periodId === "this_week") {
    const start = startOfWeek(today);
    return withPrevious(periodId, "Esta semana", start, addDays(start, 7), tz, now);
  }

  if (periodId === "this_month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return withPrevious(periodId, "Este mes", start, new Date(today.getFullYear(), today.getMonth() + 1, 1), tz, now, new Date(today.getFullYear(), today.getMonth() - 1, 1), start);
  }

  if (periodId === "previous_month") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return withPrevious(periodId, "Mes anterior", start, new Date(today.getFullYear(), today.getMonth(), 1), tz, now, new Date(today.getFullYear(), today.getMonth() - 2, 1), start);
  }

  if (periodId === "this_quarter") {
    return withPrevious(periodId, "Este trimestre", currentQuarterStart, addMonths(currentQuarterStart, 3), tz, now, addMonths(currentQuarterStart, -3), currentQuarterStart);
  }

  if (periodId === "previous_quarter") {
    const start = addMonths(currentQuarterStart, -3);
    return withPrevious(periodId, "Trimestre anterior", start, currentQuarterStart, tz, now, addMonths(start, -3), start);
  }

  if (periodId === "this_year") {
    const start = new Date(today.getFullYear(), 0, 1);
    return withPrevious(periodId, "Este año", start, new Date(today.getFullYear() + 1, 0, 1), tz, now, new Date(today.getFullYear() - 1, 0, 1), start);
  }

  if (periodId === "previous_year") {
    const start = new Date(today.getFullYear() - 1, 0, 1);
    return withPrevious(periodId, "Año anterior", start, new Date(today.getFullYear(), 0, 1), tz, now, new Date(today.getFullYear() - 2, 0, 1), start);
  }

  if (periodId === "last_90_days") {
    const end = addDays(today, 1);
    return withPrevious(periodId, "Últimos 90 días", addDays(end, -90), end, tz, now);
  }

  const end = addDays(today, 1);
  return withPrevious("last_30_days", "Últimos 30 días", addDays(end, -30), end, tz, now);
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfWeek(date: Date) {
  const start = startOfDay(date);
  const day = start.getDay() || 7;
  return addDays(start, 1 - day);
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

export function isInPeriod(date: Date | string | null | undefined, period: Pick<BusinessPeriod, "start" | "end">) {
  const value = parseDate(date);
  return Boolean(value && value >= period.start && value < period.end);
}

function withPrevious(id: BusinessPeriodId, label: string, start: Date, end: Date, timezone: string, now: Date, previousStart?: Date, previousEnd?: Date): BusinessPeriod {
  const duration = end.getTime() - start.getTime();
  return {
    id,
    label,
    start,
    end,
    previousStart: previousStart ?? new Date(start.getTime() - duration),
    previousEnd: previousEnd ?? start,
    timezone,
    isComplete: end <= now
  };
}

function quarterStart(date: Date) {
  const quarterMonth = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), quarterMonth, 1);
}

function validPeriodId(value: string | undefined): BusinessPeriodId {
  return [
    "today",
    "this_week",
    "this_month",
    "previous_month",
    "this_quarter",
    "previous_quarter",
    "this_year",
    "previous_year",
    "last_30_days",
    "last_90_days",
    "custom"
  ].includes(value ?? "") ? value as BusinessPeriodId : "this_month";
}

function parseDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
