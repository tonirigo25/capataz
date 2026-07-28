import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((file) => !file.endsWith("scripts/scan-committed-secrets.mjs"))
  .filter((file) => !/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|zip|gz|lock)$/i.test(file));

const signatures = [
  ["private_key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["stripe_live", /\bsk_live_[A-Za-z0-9]{16,}\b/],
  ["resend_key", /\bre_[A-Za-z0-9_-]{24,}\b/],
  ["aws_access_key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["github_token", /\bgh[oprsu]_[A-Za-z0-9]{30,}\b/],
  ["slack_token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
];

const findings = [];
for (const file of files) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const [kind, pattern] of signatures) {
    if (pattern.test(source)) findings.push({ file, kind });
  }
}

if (findings.length) {
  console.error(JSON.stringify({ ok: false, findings }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, filesScanned: files.length }));
