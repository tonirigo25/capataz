import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const root = process.cwd();
const repository = "lib/orqena/conversation-repository.ts";
const criticalRoots = ["app/(app)/capataz", "lib/orqena", "lib/chat-workflow-contract.ts"];
const chatModels = new Set(["chatConversation", "chatMessage", "chatActionLog"]);

function filesBelow(path) {
  const absolute = join(root, path);
  if (!statSync(absolute).isDirectory()) return [path];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name).replaceAll("\\", "/");
    return entry.isDirectory() ? filesBelow(child) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [child] : [];
  });
}

function directPrismaChatAccesses(path) {
  const source = readFileSync(join(root, path), "utf8");
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const hits = [];
  function visit(node) {
    if (ts.isPropertyAccessExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const owner = node.expression.expression;
      const model = node.expression.name.text;
      if (ts.isIdentifier(owner) && owner.text === "prisma" && chatModels.has(model)) {
        const position = file.getLineAndCharacterOfPosition(node.getStart(file));
        hits.push(`${path}:${position.line + 1}:${model}.${node.name.text}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return hits;
}

assert.ok(statSync(join(root, repository)).isFile(), `${repository} must exist`);
const violations = criticalRoots.flatMap(filesBelow)
  .filter((path) => path !== repository)
  .flatMap(directPrismaChatAccesses);
assert.deepEqual(violations, [], `Direct Prisma chat access is forbidden outside ${repository}:\n${violations.join("\n")}`);

const repositorySource = readFileSync(join(root, repository), "utf8");
for (const operation of [
  "listConversationsForCompany", "getConversationForCompany", "createConversationForCompany",
  "appendMessageForCompany", "renameConversationForCompany", "archiveConversationForCompany",
  "deleteConversationForCompany", "completeMessageForCompany", "failMessageForCompany",
  "findLatestPendingTaskForCompany"
]) assert.match(repositorySource, new RegExp(`export\\s+(?:async\\s+)?function\\s+${operation}\\b|export\\s+const\\s+${operation}\\b`), `Missing tenant-safe repository operation: ${operation}`);

assert.match(repositorySource, /(?:type|interface)\s+\w*(?:Conversation|Tenant)\w*Context[\s\S]*?userId\s*:\s*string[\s\S]*?companyId\s*:\s*string[\s\S]*?membershipId\s*:\s*string/, "Repository context must carry userId, companyId and membershipId");
assert.match(repositorySource, /companyId/, "Repository must scope access with companyId");

console.log(JSON.stringify({ ok: true, repository, checkedFiles: criticalRoots.flatMap(filesBelow).length, forbiddenModels: [...chatModels] }));
