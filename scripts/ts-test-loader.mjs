import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);

const defaultAliases = {
  "@/lib/business-periods": "lib/business-periods.ts",
  "@/lib/business-metrics": "lib/business-metrics.ts",
  "@/lib/business-intelligence": "lib/business-intelligence.ts"
};

export function loadTsModule(file, options = {}) {
  const mocks = options.mocks ?? {};
  const aliases = { ...defaultAliases, ...(options.aliases ?? {}) };
  const cache = options.cache ?? new Map();
  const key = `${file}:${Object.keys(mocks).sort().join("|")}`;
  if (cache.has(key)) return cache.get(key);

  const source = fs.readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;

  const module = { exports: {} };
  const localRequire = (id) => {
    if (Object.prototype.hasOwnProperty.call(mocks, id)) return mocks[id];
    if (aliases[id]) return loadTsModule(aliases[id], { mocks, aliases, cache });
    return nodeRequire(id);
  };

  const sandbox = {
    exports: module.exports,
    module,
    require: localRequire,
    console,
    Intl,
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    JSON,
    Request,
    Response,
    Headers,
    FormData,
    URL,
    URLSearchParams
  };

  vm.runInNewContext(compiled, sandbox, { filename: file });
  cache.set(key, module.exports);
  return module.exports;
}

export function expect(condition, message, details) {
  if (!condition) {
    console.error(message);
    if (details !== undefined) console.error(details);
    process.exit(1);
  }
}
