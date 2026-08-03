import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const profiles = read("lib/commercial/functional-profiles.ts");
const manifest = read("lib/commercial/portal-manifest.ts");
const shell = read("components/app-shell.tsx");
const chrome = read("components/app-chrome.tsx");
const today = read("app/(app)/hoy/page.tsx");
const todayOverview = read("lib/portal/today-overview.ts");
const search = read("lib/search.ts");
const notifications = read("lib/notifications.ts");

const expectedProfiles = [
  "OWNER",
  "GENERAL_MANAGER",
  "SALES_MANAGER",
  "SALES",
  "ADMINISTRATIVE",
  "FINANCE",
  "PROCUREMENT_MANAGER",
  "PROJECT_MANAGER",
  "TEAM_SUPERVISOR",
  "WORKER",
  "EXTERNAL_COLLABORATOR",
  "ADVISOR_AUDITOR",
];
for (const profile of expectedProfiles) {
  assert.ok(profiles.includes(`"${profile}"`), `missing profile ${profile}`);
  assert.ok(manifest.includes(`${profile}: [`), `missing home widgets for ${profile}`);
}
assert.match(manifest, /export async function buildPortalManifest/);
assert.match(manifest, /readOnly: membership\.accessMode === "READ_ONLY"/);
assert.match(manifest, /fieldVisibility/);
assert.match(shell, /buildPortalManifest\(context\)/);
assert.match(chrome, /portalManifest\.mobileNavigation/);
assert.match(chrome, /portalManifest\.quickActions/);
assert.match(today, /getTodayOverview\(auth\)/);
assert.match(todayOverview, /resolveAuthorization\(context/);
assert.match(todayOverview, /resolveScopedEntityIds\(context/);
assert.match(search, /buildPortalManifest\(context\)/);
assert.match(notifications, /buildPortalManifest\(context\)/);

console.log(JSON.stringify({
  ok: true,
  suite: "portal-manifest-contract",
  profiles: expectedProfiles.length,
  consumers: ["shell", "navigation", "today", "search", "notifications"],
  readOnly: true,
  fieldVisibility: true,
}));
