import fs from "node:fs";
import assert from "node:assert/strict";
const mode=process.argv[2]??"integration";
const read=(p)=>fs.readFileSync(p,"utf8");
const schema=read("prisma/schema.prisma");
const validation=read("lib/automations/automation-validation.ts");
const runner=read("lib/automations/automation-runner.ts");
const conditions=read("lib/automations/automation-conditions.ts");
const actions=read("lib/automations/automation-actions.ts");
const scheduler=read("lib/automations/automation-scheduler.ts");
const tasks=read("lib/tasks/task-engine.ts");
const recurrence=read("lib/tasks/task-recurrence.ts");
const followups=read("lib/followups/followup-engine.ts");
const required=(text,values)=>values.forEach(value=>assert.ok(text.includes(value),`Falta ${value}`));
if(mode==="model")required(schema,["model AutomationDefinition","model AutomationVersion","model AutomationRun","model Task {","model FollowUp {","model BusinessEvent","idempotencyKey"]);
if(mode==="rules")required(validation,["EXTERNAL_ACTION_DISABLED","UNKNOWN_AUTOMATION_ACTION","INVALID_COMPARATOR"]);
if(mode==="triggers")required(read("lib/automations/automation-triggers.ts"),["dispatchBusinessEvent","entity_event"]);
if(mode==="conditions")required(conditions,["equals","days_overdue","changed_from","not_in","values.some(Boolean)"]);
if(mode==="actions")required(actions,["create_task","create_followup","create_reminder","EXTERNAL_ACTION_DISABLED"]);
if(["runner","idempotency","dry-run","retries"].includes(mode))required(runner,["idempotencyKey","waiting_confirmation","dryRun","onFailure"]);
if(mode==="scheduler")required(scheduler,["lockUntil","finally","schedule:"]);
if(mode==="tasks")required(tasks,["createTask","changeTaskStatus","taskStatusHistory"]);
if(mode==="task-recurrence")required(recurrence,["DAILY","WEEKLY","YEARLY"]);
if(mode==="task-dependencies")required(tasks,["TASK_DEPENDENCY_CYCLE","dependsOnTaskId"]);
if(["followups","followup-attempts"].includes(mode))required(followups,["createFollowUp","addFollowUpAttempt","recordFollowUpOutcome"]);
if(["automation-chat","tasks-chat","followups-chat"].includes(mode))required(read("lib/capataz-chat-query.ts"),["database_query"]);
if(mode==="integration"){
  const navigation=read("lib/product-navigation.ts");
  for(const route of ["/automatizaciones","/tareas","/seguimientos"]){
    assert.ok(fs.existsSync(`app/(app)${route}/page.tsx`),`Falta ruta ${route}`);
    assert.ok(!navigation.includes(`href: "${route}"`),`La navegación global no debe exponer ${route}`);
  }
}
console.log(`OK automation suite: ${mode}`);
