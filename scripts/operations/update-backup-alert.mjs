import { execFileSync } from "node:child_process";

const [status, kind = "production-backup"] = process.argv.slice(2);
if (!["success", "failure"].includes(status)) {
  throw new Error("Usage: update-backup-alert.mjs <success|failure> [kind]");
}

const title = `Operational alert — ${kind} failed`;
const marker = "<!-- orqena-backup-alert -->";

function gh(args, options = {}) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
}

const existingJson = gh([
  "issue",
  "list",
  "--state",
  "open",
  "--search",
  `${title} in:title`,
  "--json",
  "number,title,body",
  "--limit",
  "20",
]);
const existing = JSON.parse(existingJson).find((issue) => issue.title === title && issue.body?.includes(marker));

if (status === "failure") {
  const body = [
    marker,
    `# ${title}`,
    "",
    "The automated operational control failed. Review the linked GitHub Actions run.",
    "",
    "- No database URL, credential, customer data, document key, or message content is included here.",
    "- The control remains fail-closed until a later successful run.",
    "- success-streak: 0",
  ].join("\n");
  if (existing) {
    gh(["issue", "edit", String(existing.number), "--body", body]);
  } else {
    gh(["issue", "create", "--title", title, "--body", body]);
  }
  process.stdout.write("Operational backup alert is open.\n");
  process.exit(0);
}

if (!existing) {
  process.stdout.write("No open operational backup alert.\n");
  process.exit(0);
}

const match = existing.body.match(/success-streak:\s*(\d+)/u);
const streak = Number(match?.[1] ?? 0) + 1;
const body = existing.body.replace(/success-streak:\s*\d+/u, `success-streak: ${streak}`);
gh(["issue", "edit", String(existing.number), "--body", body]);
if (streak >= 2) {
  gh(["issue", "close", String(existing.number), "--comment", "Closed automatically after two consecutive successful executions."]);
}
process.stdout.write(`Operational backup success streak: ${streak}.\n`);
