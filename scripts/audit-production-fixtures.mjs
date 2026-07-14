import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  EXCLUDED_REAL_TASK_ID,
  EXPECTED_FIXTURE_TOTAL,
  assertCleanupExecution,
  assertProductionTarget,
} from "./production-fixture-cleanup-guards.mjs";

const CONTRACT_SUFFIX = "7a3b51a7";
const TRANSACTION_SUFFIX = "4a33f773";
const KNOWN_CONTRACT_AUTOMATION_IDS = [
  "cmrjjjpid0053vdz0039mb3ug",
  "cmrjjkb0v006rvdz0lv1i706s",
];
const KNOWN_TRANSACTION_ENTITY_IDS = {
  client: "cmrjjgvgb0000vdj0ld4qby02",
  work: "cmrjjgvr90002vdj0xz2fq0sb",
  invoice: "cmrjjgwd50006vdj093l9wqpo",
};
const EXPECTED_MANIFEST_SHA256 = "2e245d34ca11f4fc23ee665594ca4178bdc048edae496fa4e0973325ac5eb881";
const includeRecords = !process.argv.includes("--summary");
const includeIds = !process.argv.includes("--counts-only");
const executeRequested = process.argv.includes("--execute");
const EXPECTED_CLEANUP_COUNTS = {
  AutomationAction: 4,
  AutomationCondition: 2,
  AutomationDefinition: 3,
  AutomationRun: 4,
  AutomationStepRun: 2,
  AutomationTrigger: 4,
  AutomationVersion: 4,
  Budget: 1,
  BusinessEvent: 1,
  ChatActionLog: 102,
  ChatConversation: 30,
  ChatMessage: 59,
  Client: 1,
  FollowUp: 2,
  FollowUpAttempt: 2,
  FollowUpOutcome: 1,
  Invoice: 1,
  Task: 22,
  TaskChecklistItem: 2,
  TaskDependency: 2,
  TaskRecurrence: 1,
  TaskStatusHistory: 1,
  Work: 1,
};

function productionAuditUrl() {
  const raw = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL_MISSING");
  const url = new URL(raw);
  const railwayLike = /(?:railway|rlwy)/i.test(url.hostname);
  if (!railwayLike) throw new Error("AUDIT_REQUIRES_RAILWAY_DATABASE");
  assertProductionTarget(process.env);
  return raw;
}

function compact(row, fields) {
  return Object.fromEntries(
    fields.filter((field) => row[field] != null).map((field) => [field, row[field]]),
  );
}

function ids(rows) {
  return [...new Set(rows.map((row) => row.id))];
}

function jsonContains(value, needles) {
  if (value == null) return false;
  const text = JSON.stringify(value);
  return needles.some((needle) => text.includes(needle));
}

function collectStrings(value, output = new Set()) {
  if (typeof value === "string") output.add(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, output));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectStrings(item, output));
  return output;
}

const databaseUrl = productionAuditUrl();
const prisma = new PrismaClient({ log: [], datasources: { db: { url: databaseUrl } } });

async function findFingerprintIds(table, fingerprints) {
  const predicates = fingerprints.map((_, index) => `row_to_json(candidate)::text ILIKE $${index + 1}`).join(" OR ");
  return prisma.$queryRawUnsafe(
    `SELECT id FROM "${table}" candidate WHERE ${predicates}`,
    ...fingerprints.map((fingerprint) => `%${fingerprint}%`),
  );
}

try {
  const transactionDefinitions = (
    await prisma.automationDefinition.findMany({
      where: { name: `QA automation ${TRANSACTION_SUFFIX}` },
      include: { versions: { select: { definitionHash: true } } },
    })
  ).filter((row) => {
    const suffix = row.name.slice("QA automation ".length);
    return /^[0-9a-f]{8}$/.test(suffix);
  });

  if (transactionDefinitions.length > 1) {
    throw new Error(`TRANSACTION_ROOT_COUNT_MISMATCH:${transactionDefinitions.length}`);
  }
  const transactionSuffix = TRANSACTION_SUFFIX;
  if (transactionDefinitions[0] && transactionDefinitions[0].name !== `QA automation ${transactionSuffix}`) {
    throw new Error("TRANSACTION_FINGERPRINT_MISMATCH");
  }
  const fingerprints = [transactionSuffix, CONTRACT_SUFFIX];

  const seedMessages = await prisma.chatMessage.findMany({
    where: {
      OR: [
        { idempotencyKey: { startsWith: `contract-${CONTRACT_SUFFIX}-` } },
        { idempotencyKey: { startsWith: `qa-chat-query-${transactionSuffix}` } },
        { idempotencyKey: { startsWith: `qa-chat-create-${transactionSuffix}` } },
      ],
    },
  });
  const conversationIds = [...new Set(seedMessages.map((row) => row.conversationId))];
  const chatMessages = await prisma.chatMessage.findMany({ where: { conversationId: { in: conversationIds } } });
  const messageIds = ids(chatMessages);
  const chatActionLogs = await prisma.chatActionLog.findMany({
    where: {
      OR: [
        { conversationId: { in: conversationIds } },
        { messageId: { in: messageIds } },
        { idempotencyKey: { startsWith: `contract-${CONTRACT_SUFFIX}-` } },
        { idempotencyKey: { startsWith: `qa-chat-query-${transactionSuffix}` } },
        { idempotencyKey: { startsWith: `qa-chat-create-${transactionSuffix}` } },
      ],
    },
  });
  const chatConversations = await prisma.chatConversation.findMany({ where: { id: { in: conversationIds } } });

  const logStrings = new Set();
  for (const row of chatActionLogs) {
    collectStrings(row.payload, logStrings);
    collectStrings(row.result, logStrings);
    collectStrings(row.metadata, logStrings);
  }

  const automationDefinitions = await prisma.automationDefinition.findMany({
    where: {
      OR: [
        { id: { in: [transactionDefinitions[0]?.id, ...KNOWN_CONTRACT_AUTOMATION_IDS].filter(Boolean) } },
        { name: `Publicada ${CONTRACT_SUFFIX}` },
      ],
    },
  });
  const definitionIds = ids(automationDefinitions);
  const automationVersions = await prisma.automationVersion.findMany({
    where: { automationDefinitionId: { in: definitionIds } },
  });
  const versionIds = ids(automationVersions);
  const automationTriggers = await prisma.automationTrigger.findMany({ where: { automationVersionId: { in: versionIds } } });
  const automationConditions = await prisma.automationCondition.findMany({ where: { automationVersionId: { in: versionIds } } });
  const automationActions = await prisma.automationAction.findMany({ where: { automationVersionId: { in: versionIds } } });
  const automationSchedules = await prisma.automationSchedule.findMany({ where: { automationDefinitionId: { in: definitionIds } } });
  const automationRuns = await prisma.automationRun.findMany({
    where: {
      OR: [
        { automationDefinitionId: { in: definitionIds } },
        { idempotencyKey: { startsWith: `qa:` } },
        { correlationId: { in: fingerprints } },
      ],
    },
  });
  const runIds = ids(automationRuns);
  const automationStepRuns = await prisma.automationStepRun.findMany({ where: { automationRunId: { in: runIds } } });
  const automationConfirmations = await prisma.automationConfirmation.findMany({ where: { automationRunId: { in: runIds } } });

  const transactionClient = await prisma.client.findMany({
    where: {
      nombre: `QA ${transactionSuffix}`,
      telefono: "000000000",
      direccion: "QA",
      tipo: "particular",
      origen: "test",
    },
  });
  if (transactionClient.length > 1) throw new Error(`TRANSACTION_CLIENT_COUNT_MISMATCH:${transactionClient.length}`);
  const clientIds = ids(transactionClient);
  const works = await prisma.work.findMany({
    where: { clienteId: { in: clientIds }, titulo: `Obra QA ${transactionSuffix}`, tipoTrabajo: "test" },
  });
  const workIds = ids(works);
  const budgets = await prisma.budget.findMany({
    where: { clienteId: { in: clientIds }, numero: `Q-${transactionSuffix}`, titulo: "Presupuesto QA" },
  });
  const budgetIds = ids(budgets);
  const invoices = await prisma.invoice.findMany({
    where: { clienteId: { in: clientIds }, numero: `F-${transactionSuffix}`, concepto: "Factura QA" },
  });
  const invoiceIds = ids(invoices);

  const payments = await prisma.payment.findMany({ where: { OR: [{ clienteId: { in: clientIds } }, { facturaId: { in: invoiceIds } }] } });
  const paymentIds = ids(payments);
  const cashMovements = await prisma.cashMovement.findMany({
    where: {
      OR: [
        { clientId: { in: clientIds } },
        { workId: { in: workIds } },
        { invoiceId: { in: invoiceIds } },
        { paymentId: { in: paymentIds } },
      ],
    },
  });
  const documents = await prisma.document.findMany({
    where: { OR: [{ clientId: { in: clientIds } }, { workId: { in: workIds } }, { budgetId: { in: budgetIds } }, { invoiceId: { in: invoiceIds } }] },
  });

  const taskSeeds = await prisma.task.findMany({
    where: {
      AND: [
        { id: { not: EXCLUDED_REAL_TASK_ID } },
        { OR: [
          { automationRunId: { in: runIds } },
          { title: { contains: transactionSuffix } },
          { title: { contains: CONTRACT_SUFFIX } },
          { title: { startsWith: "Task QA " } },
          { title: { startsWith: "Subtarea QA" } },
          { title: "Dependencia QA" },
          { title: "revisar QA mañana" },
        ] },
      ],
    },
  });
  const taskIdSet = new Set(ids(taskSeeds));
  let changed = true;
  while (changed) {
    const before = taskIdSet.size;
    const related = await prisma.task.findMany({
      where: {
        AND: [
          { id: { not: EXCLUDED_REAL_TASK_ID } },
          { OR: [{ id: { in: [...taskIdSet] } }, { parentTaskId: { in: [...taskIdSet] } }] },
        ],
      },
      select: { id: true, parentTaskId: true },
    });
    for (const row of related) {
      taskIdSet.add(row.id);
      if (row.parentTaskId) taskIdSet.add(row.parentTaskId);
    }
    changed = taskIdSet.size !== before;
  }
  const tasks = await prisma.task.findMany({ where: { id: { in: [...taskIdSet] } } });
  const taskIds = ids(tasks);
  const taskAssignments = await prisma.taskAssignment.findMany({ where: { taskId: { in: taskIds } } });
  const taskDependencies = await prisma.taskDependency.findMany({
    where: { OR: [{ taskId: { in: taskIds } }, { dependsOnTaskId: { in: taskIds } }] },
  });
  const taskStatusHistory = await prisma.taskStatusHistory.findMany({ where: { taskId: { in: taskIds } } });
  const taskComments = await prisma.taskComment.findMany({ where: { taskId: { in: taskIds } } });
  const taskEntityLinks = await prisma.taskEntityLink.findMany({ where: { taskId: { in: taskIds } } });
  const taskChecklistItems = await prisma.taskChecklistItem.findMany({ where: { taskId: { in: taskIds } } });
  const recurrenceIds = [...new Set(tasks.map((row) => row.recurrenceId).filter(Boolean))];
  const taskRecurrences = await prisma.taskRecurrence.findMany({
    where: {
      OR: [
        { id: { in: recurrenceIds } },
        { rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;COUNT=4" },
      ],
    },
  });

  const referencedTaskIds = [...logStrings].filter((value) => /^cm[a-z0-9]{20,}$/.test(value));
  const externalReferencedTasks = await prisma.task.findMany({
    where: { id: { in: referencedTaskIds.filter((id) => !taskIds.includes(id)) } },
    select: { id: true, companyId: true, title: true, createdAt: true, updatedAt: true },
  });
  const excludedTask = await prisma.task.findUnique({
    where: { id: EXCLUDED_REAL_TASK_ID },
    select: { id: true, companyId: true, title: true, createdAt: true, updatedAt: true },
  });

  const followUps = await prisma.followUp.findMany({
    where: {
      OR: [
        { automationRunId: { in: runIds } },
        { title: { contains: transactionSuffix } },
        { title: { contains: CONTRACT_SUFFIX } },
        { title: { startsWith: "FollowUp QA " } },
      ],
    },
  });
  const followUpIds = ids(followUps);
  const followUpAttempts = await prisma.followUpAttempt.findMany({ where: { followUpId: { in: followUpIds } } });
  const followUpOutcomes = await prisma.followUpOutcome.findMany({ where: { followUpId: { in: followUpIds } } });

  const businessEvents = await prisma.businessEvent.findMany({ where: { correlationId: { in: fingerprints } } });
  const businessSignalStates = await prisma.businessSignalState.findMany({
    where: {
      OR: [
        { entityId: { in: Object.values(KNOWN_TRANSACTION_ENTITY_IDS) } },
        { clientId: KNOWN_TRANSACTION_ENTITY_IDS.client },
        { workId: KNOWN_TRANSACTION_ENTITY_IDS.work },
        { invoiceId: KNOWN_TRANSACTION_ENTITY_IDS.invoice },
      ],
    },
  });
  const signalFingerprints = [...new Set(businessSignalStates.map((row) => row.fingerprint))];
  const businessRecommendations = await prisma.businessRecommendation.findMany({
    where: {
      OR: [
        { signalFingerprint: { in: signalFingerprints } },
        { entityId: { in: Object.values(KNOWN_TRANSACTION_ENTITY_IDS) } },
        { clientId: KNOWN_TRANSACTION_ENTITY_IDS.client },
        { workId: KNOWN_TRANSACTION_ENTITY_IDS.work },
        { invoiceId: KNOWN_TRANSACTION_ENTITY_IDS.invoice },
      ],
    },
  });
  const proactiveAuditEvents = await prisma.proactiveAuditEvent.findMany({
    where: {
      OR: [
        { signalFingerprint: { in: signalFingerprints } },
        { recommendationFingerprint: { in: businessRecommendations.map((row) => row.fingerprint) } },
        { entityId: { in: Object.values(KNOWN_TRANSACTION_ENTITY_IDS) } },
      ],
    },
  });
  const securityAuditEvents = (
    await prisma.securityAuditEvent.findMany({
      where: { OR: [{ requestId: { in: fingerprints } }, { requestId: { startsWith: `contract-${CONTRACT_SUFFIX}-` } }] },
    })
  ).filter((row) => jsonContains(row.metadata, [...fingerprints, ...definitionIds, ...taskIds]) || fingerprints.includes(row.requestId));

  const knownTestEmails = ["owner@empresa-a.test", "member@empresa-a.test", "visual@capataz.test"];
  const users = await prisma.user.findMany({ where: { emailNormalized: { in: knownTestEmails } } });
  const userIds = ids(users);
  const memberships = await prisma.companyMembership.findMany({ where: { userId: { in: userIds } } });
  const sessions = await prisma.session.findMany({ where: { userId: { in: userIds } } });
  const emailVerificationTokens = await prisma.emailVerificationToken.findMany({ where: { userId: { in: userIds } } });
  const passwordResetTokens = await prisma.passwordResetToken.findMany({ where: { userId: { in: userIds } } });
  const companies = await prisma.company.findMany({
    where: {
      OR: [
        { slug: { contains: transactionSuffix } },
        { slug: { contains: CONTRACT_SUFFIX } },
        { nombreComercial: { contains: transactionSuffix } },
        { nombreComercial: { contains: CONTRACT_SUFFIX } },
        { email: { in: knownTestEmails } },
      ],
    },
  });

  const inventory = {
    AutomationAction: automationActions,
    AutomationCondition: automationConditions,
    AutomationConfirmation: automationConfirmations,
    AutomationDefinition: automationDefinitions,
    AutomationRun: automationRuns,
    AutomationSchedule: automationSchedules,
    AutomationStepRun: automationStepRuns,
    AutomationTrigger: automationTriggers,
    AutomationVersion: automationVersions,
    Budget: budgets,
    BusinessEvent: businessEvents,
    BusinessRecommendation: businessRecommendations,
    BusinessSignalState: businessSignalStates,
    CashMovement: cashMovements,
    ChatActionLog: chatActionLogs,
    ChatConversation: chatConversations,
    ChatMessage: chatMessages,
    Client: transactionClient,
    Company: companies,
    CompanyMembership: memberships,
    Document: documents,
    EmailVerificationToken: emailVerificationTokens,
    FollowUp: followUps,
    FollowUpAttempt: followUpAttempts,
    FollowUpOutcome: followUpOutcomes,
    Invoice: invoices,
    Payment: payments,
    PasswordResetToken: passwordResetTokens,
    ProactiveAuditEvent: proactiveAuditEvents,
    SecurityAuditEvent: securityAuditEvents,
    Session: sessions,
    Task: tasks,
    TaskAssignment: taskAssignments,
    TaskChecklistItem: taskChecklistItems,
    TaskComment: taskComments,
    TaskDependency: taskDependencies,
    TaskEntityLink: taskEntityLinks,
    TaskRecurrence: taskRecurrences,
    TaskStatusHistory: taskStatusHistory,
    User: users,
    Work: works,
  };

  const counts = Object.fromEntries(Object.entries(inventory).map(([table, rows]) => [table, rows.length]));
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const companyIds = [...new Set(Object.values(inventory).flat().map((row) => row.companyId).filter(Boolean))];
  const alreadyClean = total === 0;
  const cleanupManifestMatches = alreadyClean || Object.entries(counts).every(
    ([table, count]) => count === (EXPECTED_CLEANUP_COUNTS[table] ?? 0),
  );
  const companyAwareTables = [
    "AutomationDefinition", "AutomationRun", "Budget", "BusinessRecommendation", "BusinessSignalState", "ChatConversation", "Client", "FollowUp", "Invoice", "Task", "Work",
  ];
  const companyValidationPassed = companyAwareTables.every((table) =>
    inventory[table].every((row) => row.companyId == null),
  ) && companies.length === 0;
  const records = Object.fromEntries(
    Object.entries(inventory).map(([table, rows]) => [
      table,
      rows.map((row) => compact(row, [
        "id", "companyId", "createdAt", "updatedAt", "fechaCreacion", "recordedAt", "attemptedAt",
        "automationDefinitionId", "automationVersionId", "automationRunId", "automationActionId",
        "conversationId", "messageId", "taskId", "dependsOnTaskId", "parentTaskId", "followUpId",
        "clientId", "clienteId", "workId", "obraId", "budgetId", "invoiceId", "facturaId", "userId",
        "name", "title", "numero", "numeroInterno", "codigo", "idempotencyKey", "correlationId", "emailNormalized",
      ])),
    ]),
  );
  const recordIds = Object.fromEntries(
    Object.entries(inventory).filter(([, rows]) => rows.length).map(([table, rows]) => [table, ids(rows)]),
  );
  const manifestLines = Object.entries(recordIds)
    .flatMap(([table, tableIds]) => tableIds.map((id) => `${table}:${id}`))
    .sort();
  const manifestSha256 = createHash("sha256").update(manifestLines.join("\n")).digest("hex");
  const manifestHashMatches = alreadyClean || manifestSha256 === EXPECTED_MANIFEST_SHA256;
  const fingerprintScanTables = Object.keys(inventory);
  const fingerprintHits = Object.fromEntries(await Promise.all(fingerprintScanTables.map(async (table) => [
    table,
    ids(await findFingerprintIds(table, fingerprints)),
  ])));
  const fingerprintExtras = Object.fromEntries(Object.entries(fingerprintHits)
    .map(([table, tableIds]) => [table, tableIds.filter((id) => !(recordIds[table] ?? []).includes(id))])
    .filter(([, tableIds]) => tableIds.length));
  const fingerprintExtrasCount = Object.values(fingerprintExtras).reduce((sum, tableIds) => sum + tableIds.length, 0);
  const excludedTaskPreserved = Boolean(excludedTask) && !taskIds.includes(EXCLUDED_REAL_TASK_ID);

  let execution = { requested: false, performed: false, deleted: 0 };
  if (executeRequested) {
    execution = { requested: true, performed: false, deleted: 0 };
    assertCleanupExecution({
      approval: process.env.CAPATAZ_FIXTURE_CLEANUP_APPROVAL,
      alreadyClean,
      total,
      cleanupManifestMatches,
      manifestHashMatches,
      fingerprintExtrasCount,
      excludedTaskPreserved,
      companyValidationPassed,
      companyIds,
    });

    const deletionOrder = [
      ["chatActionLog", "ChatActionLog"],
      ["chatMessage", "ChatMessage"],
      ["chatConversation", "ChatConversation"],
      ["taskChecklistItem", "TaskChecklistItem"],
      ["taskDependency", "TaskDependency"],
      ["taskStatusHistory", "TaskStatusHistory"],
      ["taskAssignment", "TaskAssignment"],
      ["taskComment", "TaskComment"],
      ["taskEntityLink", "TaskEntityLink"],
      ["followUpAttempt", "FollowUpAttempt"],
      ["followUpOutcome", "FollowUpOutcome"],
      ["followUp", "FollowUp"],
      ["task", "Task"],
      ["taskRecurrence", "TaskRecurrence"],
      ["automationConfirmation", "AutomationConfirmation"],
      ["automationStepRun", "AutomationStepRun"],
      ["automationRun", "AutomationRun"],
      ["automationSchedule", "AutomationSchedule"],
      ["automationCondition", "AutomationCondition"],
      ["automationTrigger", "AutomationTrigger"],
      ["automationAction", "AutomationAction"],
      ["automationVersion", "AutomationVersion"],
      ["automationDefinition", "AutomationDefinition"],
      ["businessEvent", "BusinessEvent"],
      ["cashMovement", "CashMovement"],
      ["payment", "Payment"],
      ["document", "Document"],
      ["invoice", "Invoice"],
      ["budget", "Budget"],
      ["work", "Work"],
      ["client", "Client"],
      ["securityAuditEvent", "SecurityAuditEvent"],
      ["session", "Session"],
      ["emailVerificationToken", "EmailVerificationToken"],
      ["passwordResetToken", "PasswordResetToken"],
      ["companyMembership", "CompanyMembership"],
      ["user", "User"],
    ];

    const deleted = alreadyClean ? 0 : await prisma.$transaction(async (tx) => {
      let deletedTotal = 0;
      for (const [delegateName, table] of deletionOrder) {
        const expectedRows = inventory[table];
        if (!expectedRows.length) continue;
        const exactIds = ids(expectedRows);
        const before = await tx[delegateName].count({ where: { id: { in: exactIds } } });
        if (before !== exactIds.length) throw new Error(`CLEANUP_PREDELETE_COUNT_MISMATCH:${table}:${before}:${exactIds.length}`);
        const result = await tx[delegateName].deleteMany({ where: { id: { in: exactIds } } });
        if (result.count !== exactIds.length) throw new Error(`CLEANUP_DELETE_COUNT_MISMATCH:${table}:${result.count}:${exactIds.length}`);
        deletedTotal += result.count;
      }
      if (deletedTotal !== EXPECTED_FIXTURE_TOTAL) throw new Error(`CLEANUP_TOTAL_MISMATCH:${deletedTotal}`);
      return deletedTotal;
    }, { isolationLevel: "Serializable", timeout: 120_000 });
    execution = { requested: true, performed: true, deleted };
  }

  console.log(JSON.stringify({
    mode: "read-only-audit",
    target: "railway-production",
    fingerprints: {
      transactionSuffix,
      contractSuffix: CONTRACT_SUFFIX,
      transaction: "exact QA names + structural children + qa:* idempotency",
      contract: "captured suffix + contract:* idempotency + captured automation IDs",
      dateRangeUsedAsSelector: false,
    },
    counts,
    total,
    expectedTotal: EXPECTED_FIXTURE_TOTAL,
    difference: total - EXPECTED_FIXTURE_TOTAL,
    exactExpectedMatch: total === EXPECTED_FIXTURE_TOTAL,
    alreadyClean,
    cleanupManifestMatches,
    companyValidationPassed,
    companyIds,
    manifestSha256,
    expectedManifestSha256: EXPECTED_MANIFEST_SHA256,
    manifestHashMatches,
    fingerprintExtras,
    fingerprintExtrasCount,
    excludedTaskPreserved,
    excludedExternalReferences: {
      Task: externalReferencedTasks,
      guardedTask: excludedTask,
      reason: "Referenced by fixture chat context/logs but not created by either fixture fingerprint; never cleanup candidates.",
    },
    ...(includeIds ? { recordIds } : {}),
    ...(includeRecords ? { records } : {}),
    execution,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
