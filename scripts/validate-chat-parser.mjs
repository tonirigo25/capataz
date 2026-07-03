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

const { parseBudgetFollowUp, parseChatCommand } = sandbox.exports;

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
  },
  {
    text: "haz presupuesto para Juan baño 6500 material incluido",
    expected: {
      intent: "crear_presupuesto",
      clientName: "Juan",
      workTitle: "Baño",
      amount: 6500,
      materialIncluded: true
    }
  },
  {
    text: "he tenido una visita con Laura referente a la obra completa, hemos revisado los materiales y me tiene que confirmar, la visita ha sido a las 17H",
    expected: {
      intent: "registrar_visita",
      clientName: "Laura",
      workTitle: "Obra completa",
      eventTime: "17:00",
      materialsReviewed: true,
      pendingConfirmation: true,
      amount: undefined
    }
  }
];

const followUpCases = [
  {
    text: "iva incluido, es en mallorca la obra. Telefono de juana es 65898784",
    expected: {
      useful: true,
      ivaMode: "included",
      workAddress: "Mallorca",
      phone: "65898784"
    }
  },
  {
    text: "más iva y en calle mayor 12",
    expected: {
      useful: true,
      ivaMode: "plus",
      workAddress: "Calle Mayor 12"
    }
  }
];

const extraCases = [
  {
    text: "haz factura a Laura por la cocina, 4200 con iva incluido",
    expected: {
      intent: "crear_factura",
      clientName: "Laura",
      workTitle: "Cocina",
      amount: 4200,
      ivaMode: "included"
    }
  },
  {
    text: "factura a Juana la reforma del baño por 6500",
    expected: {
      intent: "crear_factura",
      clientName: "Juana",
      workTitle: "Reforma del baño",
      amount: 6500
    }
  },
  {
    text: "convierte el presupuesto aceptado de Juana en factura",
    expected: {
      intent: "convertir_presupuesto_en_factura",
      clientName: "Juana"
    }
  },
  {
    text: "genera el pdf",
    expected: {
      intent: "generar_pdf"
    }
  },
  {
    text: "sácame el PDF de la factura de Juana",
    expected: {
      intent: "generar_pdf",
      documentKind: "invoice",
      clientName: "Juana"
    }
  },
  {
    text: "Apunta 86 euros de material para la obra de Juan.",
    expected: {
      intent: "registrar_gasto"
    }
  },
  {
    text: "Mándale un toque a Marta por el presupuesto mañana a las 10.",
    expected: {
      intent: "crear_seguimiento",
      clientName: "Marta",
      reminderDateHint: "tomorrow",
      reminderTime: "10:00"
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

for (const item of followUpCases) {
  const result = parseBudgetFollowUp(item.text);
  const failed = Object.entries(item.expected).filter(([key, value]) => result?.[key] !== value);
  if (failed.length) {
    failures += 1;
    console.error("[chat-parser] FAIL follow-up", item.text);
    console.error("expected subset:", item.expected);
    console.error("actual:", result);
  } else {
    console.log("[chat-parser] OK follow-up", item.text);
  }
}

for (const item of extraCases) {
  const result = parseChatCommand(item.text);
  const failed = Object.entries(item.expected).filter(([key, value]) => result?.[key] !== value);
  if (failed.length) {
    failures += 1;
    console.error("[chat-parser] FAIL extra", item.text);
    console.error("expected subset:", item.expected);
    console.error("actual:", result);
  } else {
    console.log("[chat-parser] OK extra", item.text);
  }
}

if (failures) process.exit(1);
