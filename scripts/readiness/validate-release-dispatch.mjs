import { execFileSync } from "node:child_process";

const requestedSha = process.env.RELEASE_REQUESTED_SHA;
const actualSha = process.env.RELEASE_ACTUAL_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const target = process.env.RELEASE_TARGET_ENVIRONMENT;
const approval = process.env.RELEASE_APPROVAL_REFERENCE;
const noDeploy = process.env.RELEASE_CONFIRM_NO_DEPLOY === "true";

if (!/^[a-f0-9]{40}$/u.test(requestedSha ?? "") || requestedSha !== actualSha) throw new Error("RELEASE_SHA_MISMATCH");
if (!new Set(["staging", "production"]).has(target)) throw new Error("RELEASE_TARGET_INVALID");
if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{2,79}$/u.test(approval ?? "")) throw new Error("RELEASE_APPROVAL_REFERENCE_INVALID");
if (!noDeploy) throw new Error("RELEASE_EVIDENCE_ONLY_CONFIRMATION_REQUIRED");

process.stdout.write(`${JSON.stringify({ ok: true, target, shaVerified: true, approvalReferencePresent: true, deployed: false })}\n`);
