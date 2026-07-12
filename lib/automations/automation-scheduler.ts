import { prisma } from "@/lib/prisma";
import { runAutomation } from "./automation-runner";
import { claimDueRetries, retryAutomationRun } from "./automation-retries";
import { generateRecurringTasks } from "@/lib/tasks/task-recurrence";
export async function processDueAutomations(now = new Date()) {
  const schedules = await prisma.automationSchedule.findMany({
    where: {
      active: true,
      nextRunAt: { lte: now },
      OR: [{ lockUntil: null }, { lockUntil: { lt: now } }],
    },
    take: 25,
  });
  const results = [];
  for (const schedule of schedules) {
    const occurrence = schedule.nextRunAt ?? now;
    const claimed = await prisma.automationSchedule.updateMany({
      where: {
        id: schedule.id,
        OR: [{ lockUntil: null }, { lockUntil: { lt: now } }],
      },
      data: { lockUntil: new Date(now.getTime() + 300000) },
    });
    if (!claimed.count) continue;
    try {
      results.push(
        await runAutomation({
          definitionId: schedule.automationDefinitionId,
          idempotencyKey: `automation:${schedule.automationDefinitionId}:schedule:${occurrence.toISOString()}`,
          triggerType: "time_based",
          triggeredBy: "scheduler",
        }),
      );
      await prisma.automationSchedule.update({
        where: { id: schedule.id },
        data: { lastRunAt: now, nextRunAt: new Date(now.getTime() + 86400000) },
      });
    } finally {
      await prisma.automationSchedule.update({
        where: { id: schedule.id },
        data: { lockUntil: null },
      });
    }
  }
  return results;
}

export async function processAutomationMaintenance(now = new Date()) {
  const scheduled = await processDueAutomations(now);
  const dueRetries = await claimDueRetries(now);
  let retries = 0;
  for (const run of dueRetries) if (await retryAutomationRun(run.id)) retries++;
  const tasksGenerated = await generateRecurringTasks(now);
  const followupsActivated = (
    await prisma.followUp.updateMany({
      where: { status: "planned", nextActionAt: { lte: now } },
      data: { status: "due" },
    })
  ).count;
  return {
    schedules: scheduled.length,
    runs: scheduled.length,
    retries,
    tasksGenerated,
    followupsActivated,
  };
}
