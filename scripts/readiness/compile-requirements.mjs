import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "docs", "readiness", "MASTER_PROGRAM_PROMPT.md");
const outputPath = path.join(root, "docs", "readiness", "requirements.yaml");
const overridesPath = path.join(root, "docs", "readiness", "requirement-overrides.json");
const source = (await readFile(sourcePath, "utf8")).replace(/\r\n/g, "\n");
const overrides = JSON.parse(await readFile(overridesPath, "utf8").catch(() => "{}"));
const validStatuses = new Set(["PENDING", "PASS", "BLOCKED", "READY_FOR_EXTERNAL_INPUT", "WAIVED"]);

const requirementPattern =
  /^- \[ \] \*\*([A-Z]+-\d{3}) · (F\d+)\*\* — (.+?)\s*$\n\s*\*\*Evidencia:\*\* (.+?)\s*$/gm;
const requirements = [];

for (const match of source.matchAll(requirementPattern)) {
  const [, id, phase, requirement, acceptance] = match;
  requirements.push({
    id,
    area: id.split("-")[0],
    phase,
    status: "PENDING",
    requirement: requirement.trim(),
    acceptance: acceptance.trim(),
  });
}

if (requirements.length !== 233) {
  throw new Error(`Expected 233 requirements, found ${requirements.length}`);
}

const ids = new Set(requirements.map(({ id }) => id));
if (ids.size !== requirements.length) {
  throw new Error("Requirement IDs must be unique");
}
for (const [id, override] of Object.entries(overrides)) {
  if (!ids.has(id)) throw new Error(`Unknown requirement override: ${id}`);
  if (!validStatuses.has(override.status)) throw new Error(`Invalid status for ${id}: ${override.status}`);
}

const quote = (value) => JSON.stringify(value);
const lines = [
  "version: 1",
  'source: "docs/readiness/MASTER_PROGRAM_PROMPT.md"',
  'source_sha256: "AB5BAD912067733EF514EE834C816B7AB5BB69BCCDF050370609E12CEEB892C2"',
  'status_contract: ["PENDING", "PASS", "BLOCKED", "READY_FOR_EXTERNAL_INPUT", "WAIVED"]',
  `total: ${requirements.length}`,
  "requirements:",
];

for (const item of requirements) {
  const override = overrides[item.id] ?? {};
  const evidence = override.evidence ?? [];
  const notes = override.notes ?? [];
  lines.push(
    `  - id: ${quote(item.id)}`,
    `    area: ${quote(item.area)}`,
    `    phase: ${quote(item.phase)}`,
    `    status: ${quote(override.status ?? item.status)}`,
    `    requirement: ${quote(item.requirement)}`,
    `    acceptance: ${quote(item.acceptance)}`,
    `    evidence: [${evidence.map(quote).join(", ")}]`,
    `    notes: [${notes.map(quote).join(", ")}]`,
  );
}

await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ ok: true, count: requirements.length, outputPath })}\n`);
