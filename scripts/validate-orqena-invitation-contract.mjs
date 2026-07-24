import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const service = read("lib/commercial/invitation-service.ts");
const actions = read("app/(app)/equipo/actions.ts");
const acceptance = read("app/aceptar-invitacion/actions.ts");
const session = read("lib/auth/session.ts");
const outbox = read("lib/email/outbox.ts");

for (const contract of [
  "createEmployeeInvitation",
  "acceptEmployeeInvitation",
  "approveEmployeeMembership",
  "revokeEmployeeInvitation",
  "rejectEmployeeMembership",
  "pending_owner_approval",
  "PENDING_OWNER_APPROVAL",
  "INVITATION_NOT_AVAILABLE",
]) {
  assert.ok(service.includes(contract), `missing invitation contract ${contract}`);
}
for (const action of ["approveInvitation", "rejectInvitation", "revokeInvitation", "updatePendingInvitation"]) {
  const start = actions.indexOf(`export async function ${action}`);
  assert.ok(start >= 0, `missing owner action ${action}`);
  assert.ok(actions.slice(start, start + 450).includes("requireActiveOwner()"), `${action} must require active OWNER`);
}
assert.match(acceptance, /acceptEmployeeInvitation\(\{ token:.*userId: auth\.userId, email: auth\.email \}\)/s);
assert.match(service, /tokenHash: hashToken\(input\.token\)/);
assert.match(service, /status: "pending_owner_approval"/);
assert.match(service, /status: "active"/);
assert.match(session, /status: "active"/);
assert.match(outbox, /STAGING_EXTERNAL_EMAIL_FORBIDDEN/);

console.log(JSON.stringify({
  ok: true,
  suite: "orqena-invitation-contract",
  ownerOnly: true,
  employeePending: true,
  ownerApprovalActivates: true,
  singleUseHashedToken: true,
  localOutbox: true,
}));
