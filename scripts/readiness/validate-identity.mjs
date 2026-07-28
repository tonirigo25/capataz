import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
let passed = 0;
const check = (name, operation) => {
  operation();
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
};

const brand = read("lib/config/brand.ts");
const packageMetadata = JSON.parse(read("package.json"));
const lockMetadata = JSON.parse(read("package-lock.json"));

check("canonical-brand-defaults", () => {
  for (const expected of [
    '|| "Orqena"',
    '"soporte@orqena.invalid"',
    '|| "com.orqena.app"',
    '|| "orqena"',
  ]) assert.ok(brand.includes(expected), expected);
});

check("package-rc-metadata", () => {
  assert.equal(packageMetadata.name, "orqena");
  assert.match(packageMetadata.version, /^\d+\.\d+\.\d+-rc\.\d+$/u);
  assert.equal(lockMetadata.name, packageMetadata.name);
  assert.equal(lockMetadata.version, packageMetadata.version);
  assert.equal(lockMetadata.packages[""].name, packageMetadata.name);
  assert.equal(lockMetadata.packages[""].version, packageMetadata.version);
});

check("changelog-present", () => {
  assert.ok(existsSync(join(root, "CHANGELOG.md")));
  assert.ok(read("CHANGELOG.md").includes(`[${packageMetadata.version}]`));
});

const publicIdentityFiles = [
  "README.md",
  ".env.example",
  ".env.staging.example",
  ".env.production.example",
  "android/app/build.gradle",
  "android/app/src/main/res/values/strings.xml",
  "store-assets/store-listing.md",
  "store-assets/publishing-checklist.md",
  "store-assets/data-safety-notes.md",
  "store-assets/screenshots-checklist.md",
];

check("no-obsolete-public-identifiers", () => {
  const forbidden = [
    /com\.capataz\.app/iu,
    /https:\/\/(?:staging\.)?capataz\.app/iu,
    /soporte@capataz\.app/iu,
    /reviewer@capataz\.app/iu,
    /CapatazDemo\d+/u,
  ];
  for (const path of publicIdentityFiles) {
    const source = read(path);
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern, `${path}: ${pattern}`);
  }
});

check("native-identifiers-aligned", () => {
  assert.ok(read("android/app/build.gradle").includes('namespace = "com.orqena.app"'));
  assert.ok(read("android/app/build.gradle").includes('applicationId "com.orqena.app"'));
  assert.ok(read("android/app/src/main/java/com/orqena/app/MainActivity.java").includes("package com.orqena.app;"));
  assert.ok(read("ios/App/App.xcodeproj/project.pbxproj").includes("PRODUCT_BUNDLE_IDENTIFIER = com.orqena.app;"));
  assert.ok(read("ios/App/App/Info.plist").includes("<string>Orqena</string>"));
});

check("technical-aliases-explicit", () => {
  assert.ok(brand.includes('legacyAliases: ["Capataz", "Capataz IA", "/capataz", "CAPATAZ_*"]'));
  assert.ok(read("README.md").includes("aliases técnicos compatibles"));
});

process.stdout.write(`${JSON.stringify({ ok: true, checks: passed, product: "Orqena", packageVersion: packageMetadata.version })}\n`);
