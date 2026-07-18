import fs from "node:fs";import assert from "node:assert/strict";const mode=process.argv[2]??"integrations",read=p=>fs.readFileSync(p,"utf8"),has=(p,items)=>{const text=read(p);items.forEach(item=>assert.ok(text.includes(item),`${p}: falta ${item}`))};
if(mode==="integrations"){has("app/(app)/hoy/page.tsx",["buildTodayDashboard","dashboard.priorities.slice(0, 3)","getAgendaItems","getTreasuryOverview"]);for(const p of ["clientes","obras","dinero","presupuestos"])has(`app/(app)/${p}/[id]/page.tsx`,["EntityWorkflowSummary"])}
if(mode==="chat-routing"){has("lib/capataz-chat-query.ts",["tasks_today","followups_overdue","automations_active"]);has("app/(app)/capataz/actions.ts",["queryProfessionalTasks","runExplicitWorkflowMutation","noMutation: true"])}
if(mode==="retries-timed")has("lib/automations/automation-retries.ts",["fixed","linear","exponential","nextRetryAt","retryAutomationRun"]);
if(mode==="rrule")has("lib/tasks/task-recurrence.ts",["BYDAY","BYMONTHDAY","COUNT","UNTIL","INVALID_RRULE"]);
if(mode==="series-edit")has("lib/tasks/task-recurrence.ts",["this","following","all","completedAt"]);
if(mode==="confirmation-actor")has("lib/automations/automation-confirmations.ts",["actorType","actorId","origin","INVALID_CONFIRMATION_TARGET"]);
if(mode==="cycle-detection"){has("lib/tasks/task-engine.ts",["visiting","TASK_DEPENDENCY_CYCLE"]);has("lib/automations/automation-runner.ts",["MAX_AUTOMATION_CHAIN_DEPTH","AUTOMATION_CHAIN_DEPTH_EXCEEDED"])}
if(mode==="task-checklists")has("lib/tasks/task-engine.ts",["addChecklistItem","toggleChecklistItem"]);
if(mode==="task-subtasks")has("prisma/schema.prisma",["parentTaskId","TaskSubtasks"]);
if(mode==="task-actions")has("app/(app)/tareas/actions.ts",["updateTaskAction","archiveTaskAction","addChecklistAction"]);
if(mode==="followup-actions")has("lib/followups/followup-engine.ts",["addFollowUpAttempt","recordFollowUpOutcome"]);
if(mode==="cron-integration"){has("app/api/internal/proactive-evaluate/route.ts",["processAutomationMaintenance","automations"]);has("lib/automations/automation-scheduler.ts",["tasksGenerated","followupsActivated","retries"])}
console.log(`OK automation completion: ${mode}`);
