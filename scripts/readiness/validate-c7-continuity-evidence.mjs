import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const evidence = JSON.parse(readFileSync(join(
  process.cwd(),
  "docs/readiness/evidence/c7/remote-restore-drill.json",
), "utf8"));

assert.equal(evidence.schemaVersion, "orqena-c7-remote-restore-drill-v1");
assert.equal(evidence.status, "PASS_LOGICAL_SIBLING_RESTORE_WITH_NATIVE_BACKUP_PITR_READY_FOR_EXTERNAL_INPUT");
assert.equal(evidence.productionTouched, false);
assert.equal(evidence.stagingTouched, false);
assert.notEqual(evidence.source.serviceId, evidence.restoreTarget.serviceId);
assert.notEqual(evidence.source.volumeId, evidence.restoreTarget.volumeId);
assert.equal(evidence.source.databaseClass, "synthetic continuous review");

assert.equal(evidence.backup.verifiedWithPgRestoreList, true);
assert.match(evidence.backup.sha256, /^[A-F0-9]{64}$/u);
assert.ok(evidence.backup.bytes > 0);
assert.equal(evidence.backup.tableDataEntries, 155);
assert.equal(evidence.backup.committedToGit, false);

assert.equal(evidence.restoreTarget.newSiblingResource, true);
assert.equal(evidence.restoreTarget.sourceReplacedOrRepointed, false);
assert.equal(evidence.restoreTarget.singleTransaction, true);
assert.equal(evidence.restoreTarget.schemaFingerprintMatchesSource, true);
assert.equal(evidence.restoreTarget.migrationsApplied, 43);
assert.equal(evidence.restoreTarget.orphanClients, 0);
assert.equal(evidence.restoreTarget.invalidWorkTenantRelationships, 0);
assert.equal(evidence.restoreTarget.invalidInvoiceTenantRelationships, 0);
assert.equal(evidence.restoreTarget.teardown.requested, true);
assert.equal(evidence.restoreTarget.teardown.serviceAbsentFromReviewEnvironment, true);
assert.equal(evidence.restoreTarget.teardown.volumeAbsentFromReviewEnvironment, true);
assert.deepEqual(evidence.restoreTarget.teardown.remainingServiceIds.sort(), [
  "345992f1-c168-4221-a60d-b440d5a33e30",
  "d14f98ec-1a00-4cc5-88fc-2ac0c99c8f1b",
]);
assert.equal(evidence.continuity.laterSourceActivityAbsentFromSnapshotAsExpected, true);

assert.equal(evidence.nativeRailwayBackupAndPitr.status, "READY_FOR_EXTERNAL_INPUT");
assert.match(evidence.nativeRailwayBackupAndPitr.requiredNextInput, /Pro coverage/u);
assert.equal(evidence.credentialCleanup.personalEphemeralSshKeyRemovedFromRailway, true);
assert.equal(evidence.credentialCleanup.workspaceEphemeralSshKeyRemovedFromRailway, true);
assert.equal(evidence.credentialCleanup.localEphemeralPrivateAndPublicKeysRemoved, true);
assert.equal(evidence.credentialCleanup.logicalDumpRemovedAfterHashAndRestoreVerification, true);
assert.equal(evidence.credentialCleanup.temporaryPostgreSQLClientArchiveAndBinariesRemoved, true);

process.stdout.write(`${JSON.stringify({
  ok: true,
  control: "C7",
  logicalSiblingRestore: "PASS",
  nativeBackupAndPitr: "READY_FOR_EXTERNAL_INPUT",
  productionTouched: false,
  stagingTouched: false,
})}\n`);
