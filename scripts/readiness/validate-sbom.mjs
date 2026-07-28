import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "artifacts/sbom.cdx.json";
const bom = JSON.parse(readFileSync(path, "utf8"));
assert.equal(bom.bomFormat, "CycloneDX");
assert.match(String(bom.specVersion), /^1\.[6-9]$/u);
assert.equal(bom.version, 1);
assert.ok(bom.metadata?.component?.["bom-ref"]);
assert.ok(Array.isArray(bom.components) && bom.components.length > 0);
assert.ok(Array.isArray(bom.dependencies) && bom.dependencies.length > 0);
const refs = new Set([bom.metadata.component["bom-ref"]]);
for (const component of bom.components) {
  assert.ok(component["bom-ref"] && component.name && component.version);
  assert.equal(refs.has(component["bom-ref"]), false, `duplicate bom-ref ${component["bom-ref"]}`);
  refs.add(component["bom-ref"]);
}
const dependencyRefs = new Set();
const dangling = new Set();
for (const dependency of bom.dependencies) {
  assert.equal(typeof dependency.ref, "string");
  assert.equal(dependencyRefs.has(dependency.ref), false, `duplicate dependency ref ${dependency.ref}`);
  dependencyRefs.add(dependency.ref);
  if (!refs.has(dependency.ref)) dangling.add(dependency.ref);
  if (dependency.dependsOn !== undefined) assert.ok(Array.isArray(dependency.dependsOn));
  for (const child of dependency.dependsOn ?? []) {
    assert.equal(typeof child, "string");
    if (!refs.has(child)) dangling.add(child);
  }
}
process.stdout.write(`${JSON.stringify({ ok: true, path, specVersion: bom.specVersion, components: bom.components.length, dependencies: bom.dependencies.length, unresolvedGraphReferences: dangling.size })}\n`);
