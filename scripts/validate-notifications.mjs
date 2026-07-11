import fs from "node:fs";

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const notifications = fs.readFileSync("lib/notifications.ts", "utf8");
const page = fs.readFileSync("app/(app)/notificaciones/page.tsx", "utf8");
const actions = fs.readFileSync("app/(app)/notificaciones/actions.ts", "utf8");
const shell = fs.readFileSync("components/app-shell.tsx", "utf8");
const chrome = fs.readFileSync("components/app-chrome.tsx", "utf8");
const chatQuery = fs.readFileSync("lib/capataz-chat-query.ts", "utf8");

function expect(condition, message) {
  if (!condition) {
    console.error("[notifications] FAIL", message);
    process.exit(1);
  }
}

expect(schema.includes("model Notification") && schema.includes("sourceKey") && schema.includes("@unique"), "Notification model must have a unique sourceKey");
expect(schema.includes("enum NotificationPriority"), "missing NotificationPriority enum");
expect(notifications.includes("deriveNotifications") && notifications.includes("upsert"), "notifications must be derived idempotently with persisted read state");
for (const token of ["invoice-overdue", "reminder-", "agenda-", "budget-expiry", "work-start", "client-incomplete", "document-pending"]) {
  expect(notifications.includes(token), `missing notification source ${token}`);
}
expect(page.includes("Marcar todas") && page.includes("No leídas"), "notifications page lacks read controls/counts");
expect(actions.includes("markNotificationReadAction") && actions.includes("markAllNotificationsReadAction"), "missing notification server actions");
expect(shell.includes("getUnreadNotificationCount") && chrome.includes("unreadNotifications"), "app shell does not expose unread count");
expect(chatQuery.includes('"pending_notifications"'), "chat intent does not support pending_notifications");

console.log("[notifications] OK idempotent derived notifications, read state, badge and chat query");
