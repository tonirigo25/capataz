import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const rules = [
  ["OPENAI_KEY", /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/g],
  ["GITHUB_TOKEN", /\bgh[oprs]_[A-Za-z0-9]{30,}\b/g],
  ["AWS_ACCESS_KEY", /\bAKIA[0-9A-Z]{16}\b/g],
  ["STRIPE_LIVE_SECRET", /\bsk_live_[A-Za-z0-9]{20,}\b/g],
  ["SLACK_TOKEN", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ["PRIVATE_KEY_BLOCK", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
];

const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root });
const relativePaths = output.toString("utf8").split("\0").filter(Boolean);
const findings = [];
let scanned = 0;
for (const relative of relativePaths) {
  const full = path.join(root, relative);
  const info = await stat(full).catch(() => null);
  if (!info?.isFile() || info.size > 2_000_000) continue;
  const bytes = await readFile(full);
  if (bytes.includes(0)) continue;
  const content = bytes.toString("utf8");
  scanned += 1;
  for (const [rule, pattern] of rules) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) findings.push({ path: relative.replaceAll("\\", "/"), rule });
  }
}

if (findings.length) {
  console.error(JSON.stringify({ ok: false, findings }));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, filesScanned: scanned, rules: rules.map(([rule]) => rule) }));
}
