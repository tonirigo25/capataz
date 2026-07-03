import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);

function compileModule(path) {
  const source = fs.readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const sandbox = {
    exports: {},
    require: nativeRequire,
    console,
    process,
    fetch,
    URL,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(compiled, sandbox, { filename: path });
  return sandbox.exports;
}

const aiModule = compileModule("lib/ai/capataz-ai.ts");
const { interpretCapatazMessageWithAI, validateCapatazAIResult } = aiModule;

const cases = [
  {
    name: "Alberto empresa fiscal y presupuesto",
    text: "Tengo un nuevo cliente, se llama Alberto Ruiz, la obra es en Menorca, un pequeño hotel. La factura tendrá que ser al nombre de empresa MURHOTEL SL. Quiere que renovemos los baños, son 25 en total. Hemos acordado un precio cerrado con material incluido de 60mil euros, el trabajo durara 2 semanas",
    fixture: {
      intent: "crear_presupuesto",
      confidence: 0.93,
      entities: {
        contacto_nombre: "Alberto Ruiz",
        contacto_telefono: null,
        contacto_email: null,
        empresa_facturacion: "MURHOTEL SL",
        cliente_nombre: "MURHOTEL SL",
        cliente_tipo: "empresa",
        cliente_nif: null,
        direccion_fiscal: null,
        obra_nombre: "Renovación de baños hotel",
        obra_tipo: "pequeño hotel",
        obra_localidad: "Menorca",
        obra_direccion: null,
        descripcion_trabajo: "renovación de 25 baños",
        alcance: "baños",
        cantidad: 25,
        unidad_cantidad: "baños",
        duracion_estimada: "2 semanas",
        partidas: [
          {
            descripcion: "Renovación de 25 baños con material incluido",
            cantidad: 25,
            unidad: "baños",
            precioUnitario: 2400,
            total: 60000,
            categoria: "Material incluido"
          }
        ],
        importe: 60000,
        moneda: "EUR",
        iva_porcentaje: null,
        iva_incluido: null,
        material_incluido: true,
        fecha: null,
        hora: null,
        fecha_fin: null,
        tipo_actividad: null,
        canal: null,
        mensaje: null,
        documento_tipo: "presupuesto",
        documento_numero: null,
        estado: "borrador",
        metodo_pago: null,
        notas: "Precio cerrado con material incluido.",
        datos_pendientes: ["CIF", "dirección fiscal", "dirección de obra", "IVA", "teléfono o email de contacto"],
        referencias_contexto: []
      },
      actionPlan: [
        { action: "buscarDuplicados", reason: "Evitar duplicar cliente u obra", target: null },
        { action: "crearClienteProvisional", reason: "Crear empresa fiscal provisional", target: "MURHOTEL SL" },
        { action: "crearContacto", reason: "Guardar contacto operativo", target: "Alberto Ruiz" },
        { action: "crearObra", reason: "Crear obra provisional", target: "Renovación de baños hotel" },
        { action: "crearPresupuestoBorrador", reason: "Crear presupuesto editable", target: null }
      ],
      shouldExecute: true,
      requiresConfirmation: false,
      clarificationQuestions: ["¿Cuál es el CIF y la dirección fiscal de MURHOTEL SL?", "¿Cuál es la dirección exacta de la obra?", "¿El importe de 60.000 € incluye IVA o hay que añadirlo aparte?"],
      userResponse: "He entendido que Alberto Ruiz es el contacto y que la facturación irá a MURHOTEL SL. Prepararé un presupuesto en borrador para renovar 25 baños en un pequeño hotel de Menorca."
    },
    expected: {
      intent: "crear_presupuesto",
      contacto_nombre: "Alberto Ruiz",
      empresa_facturacion: "MURHOTEL SL",
      cliente_tipo: "empresa",
      obra_localidad: "Menorca",
      obra_tipo: "pequeño hotel",
      cantidad: 25,
      importe: 60000,
      material_incluido: true
    }
  },
  {
    name: "Laura visita a las 17",
    text: "he tenido una visita con Laura referente a la obra completa, hemos revisado los materiales y me tiene que confirmar, la visita ha sido a las 17H",
    fixture: {
      intent: "registrar_visita",
      confidence: 0.9,
      entities: {
        contacto_nombre: "Laura",
        contacto_telefono: null,
        contacto_email: null,
        empresa_facturacion: null,
        cliente_nombre: "Laura",
        cliente_tipo: "particular",
        cliente_nif: null,
        direccion_fiscal: null,
        obra_nombre: "Obra completa",
        obra_tipo: null,
        obra_localidad: null,
        obra_direccion: null,
        descripcion_trabajo: "obra completa",
        alcance: "materiales revisados",
        cantidad: null,
        unidad_cantidad: null,
        duracion_estimada: null,
        partidas: [],
        importe: null,
        moneda: null,
        iva_porcentaje: null,
        iva_incluido: null,
        material_incluido: null,
        fecha: null,
        hora: "17:00",
        fecha_fin: null,
        tipo_actividad: "visita",
        canal: null,
        mensaje: null,
        documento_tipo: null,
        documento_numero: null,
        estado: "realizado",
        metodo_pago: null,
        notas: "Visita realizada sobre la obra completa; se revisaron materiales y Laura debe confirmar.",
        datos_pendientes: ["qué debe confirmar", "fecha de seguimiento"],
        referencias_contexto: []
      },
      actionPlan: [{ action: "registrarVisita", reason: "Guardar actividad interna", target: "Laura" }],
      shouldExecute: true,
      requiresConfirmation: false,
      clarificationQuestions: ["¿Qué tiene que confirmar Laura exactamente?", "¿Cuándo quieres que te recuerde hacer seguimiento?"],
      userResponse: "He entendido una visita con Laura a las 17:00 sobre la obra completa. No hay importe ni gasto."
    },
    expected: {
      intent: "registrar_visita",
      cliente_nombre: "Laura",
      hora: "17:00",
      importe: undefined
    }
  },
  {
    name: "Juana presupuesto",
    text: "créame para el cliente Juana un presupuesto de la reforma integral, cocina + baño de 14000 euros, con material incluido",
    fixture: {
      intent: "crear_presupuesto",
      confidence: 0.92,
      entities: {
        contacto_nombre: "Juana",
        contacto_telefono: null,
        contacto_email: null,
        empresa_facturacion: null,
        cliente_nombre: "Juana",
        cliente_tipo: "particular",
        cliente_nif: null,
        direccion_fiscal: null,
        obra_nombre: "Reforma integral cocina + baño",
        obra_tipo: null,
        obra_localidad: null,
        obra_direccion: null,
        descripcion_trabajo: "reforma integral",
        alcance: "cocina + baño",
        cantidad: null,
        unidad_cantidad: null,
        duracion_estimada: null,
        partidas: [{ descripcion: "Reforma integral cocina + baño con material incluido", cantidad: 1, unidad: "servicio", precioUnitario: 14000, total: 14000, categoria: "Material incluido" }],
        importe: 14000,
        moneda: "EUR",
        iva_porcentaje: null,
        iva_incluido: null,
        material_incluido: true,
        fecha: null,
        hora: null,
        fecha_fin: null,
        tipo_actividad: null,
        canal: null,
        mensaje: null,
        documento_tipo: "presupuesto",
        documento_numero: null,
        estado: "borrador",
        metodo_pago: null,
        notas: null,
        datos_pendientes: ["IVA", "dirección de obra", "datos fiscales o contacto"],
        referencias_contexto: []
      },
      actionPlan: [{ action: "crearPresupuestoBorrador", reason: "Crear presupuesto editable", target: null }],
      shouldExecute: true,
      requiresConfirmation: false,
      clarificationQuestions: ["¿El importe incluye IVA o hay que añadirlo aparte?", "¿Cuál es la dirección de la obra?"],
      userResponse: "He entendido un presupuesto para Juana de reforma integral de cocina y baño por 14.000 € con material incluido."
    },
    expected: {
      intent: "crear_presupuesto",
      cliente_nombre: "Juana",
      descripcion_trabajo: "reforma integral",
      alcance: "cocina + baño",
      importe: 14000,
      material_incluido: true
    }
  }
];

let failures = 0;

for (const item of cases) {
  const result = validateCapatazAIResult(item.fixture);
  const failed = checkExpected(result, item.expected);
  if (failed.length) {
    failures += 1;
    console.error("[capataz-ai] FAIL fixture", item.name);
    console.error("expected subset:", item.expected);
    console.error("actual:", summarize(result));
  } else {
    console.log("[capataz-ai] OK fixture", item.name);
  }
}

if (process.env.CAPATAZ_RUN_LIVE_AI_TESTS === "true") {
  if (!process.env.OPENAI_API_KEY) {
    console.error("[capataz-ai] CAPATAZ_RUN_LIVE_AI_TESTS=true pero falta OPENAI_API_KEY");
    process.exit(1);
  }

  for (const item of cases) {
    const result = await interpretCapatazMessageWithAI({ message: item.text, data: { currentDate: new Date().toISOString() } });
    const failed = checkExpected(result, item.expected);
    if (failed.length) {
      failures += 1;
      console.error("[capataz-ai] FAIL live", item.name);
      console.error("expected subset:", item.expected);
      console.error("actual:", summarize(result));
    } else {
      console.log("[capataz-ai] OK live", item.name);
    }
  }
} else {
  console.log("[capataz-ai] Live OpenAI validation skipped. Set CAPATAZ_RUN_LIVE_AI_TESTS=true with OPENAI_API_KEY to run it.");
}

if (failures) process.exit(1);

function summarize(result) {
  return {
    intent: result.intent,
    ...result.entities
  };
}

function checkExpected(result, expected) {
  const summary = summarize(result);
  return Object.entries(expected).filter(([key, value]) => {
    const actual = summary[key];
    if (value === undefined) return actual !== undefined;
    if (typeof value === "string") return String(actual ?? "").toLowerCase() !== value.toLowerCase();
    return actual !== value;
  });
}
