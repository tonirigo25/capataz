import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = fs.readFileSync("lib/capataz-chat-parser.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
}).outputText;

const sandbox = { exports: {}, require, console };
vm.runInNewContext(compiled, sandbox);

const { parseChatCommand } = sandbox.exports;

const cases = [
  {
    text: "créame para el cliente Juana un presupuesto de la reforma integral, cocina + baño de 14000 euros, con material incluido",
    expected: {
      intent: "crear_presupuesto",
      clientName: "Juana",
      jobType: "reforma integral",
      scope: "cocina + baño",
      amount: 14000,
      currency: "EUR",
      materialIncluded: true
    }
  },
  {
    text: "creame para Juana presupuesto de reforma integral cocina y baño por 14.000€ material incluido",
    expected: {
      intent: "crear_presupuesto",
      clientName: "Juana",
      amount: 14000,
      materialIncluded: true
    }
  },
  {
    text: "hazme un presupuesto para Juan de cambiar el baño por 6.500",
    expected: {
      intent: "crear_presupuesto",
      clientName: "Juan",
      amount: 6500
    }
  },
  {
    text: "presupuesto para Pedro de pintar piso completo por 2300 más IVA",
    expected: {
      intent: "crear_presupuesto",
      clientName: "Pedro",
      amount: 2300,
      ivaMode: "plus"
    }
  }
];

let failures = 0;

for (const item of cases) {
  const result = parseChatCommand(item.text);
  const failed = Object.entries(item.expected).filter(([key, value]) => result?.[key] !== value);
  if (failed.length) {
    failures += 1;
    console.error("[chat-parser] FAIL", item.text);
    console.error("expected subset:", item.expected);
    console.error("actual:", result);
  } else {
    console.log("[chat-parser] OK", item.text);
  }
}

if (failures) process.exit(1);
