import { execFileSync } from "node:child_process";

const operation = process.env.PREVIEW_OPERATION;
const pr = process.env.PREVIEW_PR_NUMBER;
const requestedSha = process.env.PREVIEW_EXPECTED_SHA;
const actualSha = process.env.PREVIEW_ACTUAL_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const approved = process.env.PREVIEW_ISOLATION_APPROVED === "true";

if (!new Set(["verify", "provision", "teardown"]).has(operation)) throw new Error("PREVIEW_OPERATION_INVALID");
if (!/^\d+$/u.test(pr ?? "")) throw new Error("PREVIEW_PR_NUMBER_INVALID");
if (!/^[a-f0-9]{40}$/u.test(requestedSha ?? "") || requestedSha !== actualSha) throw new Error("PREVIEW_SHA_MISMATCH");
if (!approved) throw new Error("PREVIEW_ISOLATION_NOT_APPROVED");

process.stdout.write(`${JSON.stringify({ ok: true, operation, pullRequest: Number(pr), shaVerified: true, mutationPerformed: false })}\n`);
