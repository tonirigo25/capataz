import { prisma } from "@/lib/prisma";
const DAYS: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};
type Rule = {
  FREQ: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  INTERVAL: number;
  BYDAY?: string[];
  BYMONTHDAY?: number[];
  BYMONTH?: number;
  COUNT?: number;
  UNTIL?: Date;
};
export function parseRRule(value: string): Rule {
  const raw = value.trim().replace(/^RRULE:/i, "");
  const parts = Object.fromEntries(
    raw.split(";").map((part) => part.split("=", 2)),
  ) as Record<string, string>;
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(parts.FREQ))
    throw new Error("INVALID_RRULE_FREQ");
  const interval = Number(parts.INTERVAL ?? 1);
  if (!Number.isInteger(interval) || interval < 1)
    throw new Error("INVALID_RRULE_INTERVAL");
  const rule: Rule = { FREQ: parts.FREQ as Rule["FREQ"], INTERVAL: interval };
  if (parts.BYDAY) {
    const days: string[] = parts.BYDAY.split(",");
    if (
      days.some((day: string) => !/^(-?\d)?(MO|TU|WE|TH|FR|SA|SU)$/.test(day))
    )
      throw new Error("INVALID_RRULE_BYDAY");
    rule.BYDAY = days;
  }
  if (parts.BYMONTHDAY)
    rule.BYMONTHDAY = parts.BYMONTHDAY.split(",").map(Number);
  if (parts.BYMONTH) rule.BYMONTH = Number(parts.BYMONTH);
  if (parts.COUNT) rule.COUNT = Number(parts.COUNT);
  if (parts.UNTIL) {
    const compact = parts.UNTIL.replace(
      /(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?Z?/,
      "$1-$2-$3T$4:$5:$6Z",
    );
    rule.UNTIL = new Date(compact);
    if (Number.isNaN(rule.UNTIL.getTime()))
      throw new Error("INVALID_RRULE_UNTIL");
  }
  return rule;
}
export function nextOccurrence(after: Date, rrule: string, dtstart = after) {
  const rule = parseRRule(rrule);
  let cursor = new Date(after.getTime() + 60000);
  cursor.setSeconds(0, 0);
  const limit = new Date(
    after.getFullYear() + 10,
    after.getMonth(),
    after.getDate(),
  );
  for (; cursor <= limit; cursor = new Date(cursor.getTime() + 60000)) {
    if (rule.UNTIL && cursor > rule.UNTIL) return null;
    if (matches(cursor, dtstart, rule)) return cursor;
  }
  return null;
}
function matches(date: Date, start: Date, rule: Rule) {
  if (
    date < start ||
    date.getHours() !== start.getHours() ||
    date.getMinutes() !== start.getMinutes()
  )
    return false;
  const days = Math.floor(
    (startOfDay(date).getTime() - startOfDay(start).getTime()) / 86400000,
  );
  if (rule.FREQ === "DAILY")
    return (
      days % rule.INTERVAL === 0 &&
      (!rule.BYDAY ||
        rule.BYDAY.some((d) => DAYS[d.slice(-2)] === date.getDay()))
    );
  if (rule.FREQ === "WEEKLY")
    return (
      Math.floor(days / 7) % rule.INTERVAL === 0 &&
      (
        rule.BYDAY ?? [
          Object.keys(DAYS).find((k) => DAYS[k] === start.getDay())!,
        ]
      ).some((d) => DAYS[d.slice(-2)] === date.getDay())
    );
  const months =
    (date.getFullYear() - start.getFullYear()) * 12 +
    date.getMonth() -
    start.getMonth();
  if (rule.FREQ === "MONTHLY")
    return months % rule.INTERVAL === 0 && matchMonth(date, start, rule);
  return (
    (date.getFullYear() - start.getFullYear()) % rule.INTERVAL === 0 &&
    (rule.BYMONTH ?? start.getMonth() + 1) === date.getMonth() + 1 &&
    matchMonth(date, start, rule)
  );
}
function matchMonth(date: Date, start: Date, rule: Rule) {
  if (rule.BYMONTHDAY) return rule.BYMONTHDAY.includes(date.getDate());
  if (rule.BYDAY)
    return rule.BYDAY.some((token) => {
      const day = DAYS[token.slice(-2)];
      if (date.getDay() !== day) return false;
      const ordinal = Number(token.slice(0, -2) || 0);
      if (!ordinal) return true;
      if (ordinal > 0) return Math.ceil(date.getDate() / 7) === ordinal;
      const last = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
      ).getDate();
      return Math.ceil((last - date.getDate() + 1) / 7) === Math.abs(ordinal);
    });
  return date.getDate() === start.getDate();
}
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
export async function generateRecurringTasks(now = new Date()) {
  const series = await prisma.taskRecurrence.findMany({
    where: {
      active: true,
      nextOccurrenceAt: { lte: new Date(now.getTime() + 45 * 86400000) },
    },
  });
  let generated = 0;
  for (const recurrence of series) {
    let next: Date | null = recurrence.nextOccurrenceAt ?? recurrence.startsAt;
    const windowEnd = new Date(
        now.getTime() + recurrence.generationWindowDays * 86400000,
      ),
      rule = parseRRule(recurrence.rrule);
    let seriesCount = await prisma.task.count({
      where: { recurrenceId: recurrence.id },
    });
    while (
      next &&
      next <= windowEnd &&
      (!recurrence.endsAt || next <= recurrence.endsAt) &&
      (!rule.COUNT || seriesCount < rule.COUNT)
    ) {
      const key = next.toISOString();
      const existing = await prisma.task.findUnique({
        where: {
          recurrenceId_occurrenceKey: {
            recurrenceId: recurrence.id,
            occurrenceKey: key,
          },
        },
        select: { id: true },
      });
      if (!existing) {
        await prisma.task.create({
          data: {
            title: `Tarea recurrente · ${recurrence.frequency}`,
            origin: "recurrence",
            status: "planned",
            recurrenceId: recurrence.id,
            occurrenceKey: key,
            dueAt: next,
          },
        });
        generated++;
        seriesCount++;
      }
      next = nextOccurrence(next, recurrence.rrule, recurrence.startsAt);
    }
    await prisma.taskRecurrence.update({
      where: { id: recurrence.id },
      data: {
        nextOccurrenceAt: rule.COUNT && seriesCount >= rule.COUNT ? null : next,
        active: !(rule.COUNT && seriesCount >= rule.COUNT),
      },
    });
  }
  return generated;
}
export async function editTaskSeries(
  taskId: string,
  scope: "this" | "following" | "all",
  data: { dueAt?: Date; title?: string },
) {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId }, include: { recurrence: true } });
  if (!task.recurrenceId || !task.recurrence) return prisma.task.update({ where: { id: taskId }, data });
  if (scope === "this") {
    const existing = Array.isArray(task.recurrence.exdates) ? task.recurrence.exdates.map(String) : [];
    const exception = task.occurrenceKey ?? task.dueAt?.toISOString();
    return prisma.$transaction(async (tx) => {
      if (exception) await tx.taskRecurrence.update({ where: { id: task.recurrenceId! }, data: { exdates: [...new Set([...existing, exception])] } });
      return tx.task.update({ where: { id: taskId }, data: { ...data, recurrenceId: null, occurrenceKey: null } });
    });
  }
  if (scope === "all") return prisma.task.updateMany({ where: { recurrenceId: task.recurrenceId, completedAt: null }, data });
  const splitAt = task.dueAt ?? new Date();
  return prisma.$transaction(async (tx) => {
    const nextSeries = await tx.taskRecurrence.create({ data: { frequency: task.recurrence!.frequency, rrule: task.recurrence!.rrule, timezone: task.recurrence!.timezone, startsAt: data.dueAt ?? splitAt, endsAt: task.recurrence!.endsAt, nextOccurrenceAt: data.dueAt ?? splitAt, generationWindowDays: task.recurrence!.generationWindowDays, active: task.recurrence!.active, exdates: task.recurrence!.exdates ?? undefined } });
    await tx.taskRecurrence.update({ where: { id: task.recurrenceId! }, data: { endsAt: new Date(splitAt.getTime() - 1) } });
    return tx.task.updateMany({ where: { recurrenceId: task.recurrenceId, completedAt: null, dueAt: { gte: splitAt } }, data: { ...data, recurrenceId: nextSeries.id } });
  });
}
