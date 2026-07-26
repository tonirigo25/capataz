export type ScenarioId = "presupuesto" | "gasto" | "obra";

export type EditableField = "amount" | "work" | "deadline" | "category";

export type EditableValues = Record<EditableField, string>;

export type Scenario = {
  id: ScenarioId;
  label: string;
  shortLabel: string;
  description: string;
  input: string;
  interpretation: readonly { label: string; value: string }[];
  proposal: readonly { label: string; value: string }[];
  editableFields: readonly {
    id: EditableField;
    label: string;
    inputMode?: "decimal" | "text";
  }[];
  confirmation: (values: EditableValues) => string;
  result: string;
};

export const demoSteps = [
  "Entrada",
  "Interpretación",
  "Propuesta",
  "Revisión",
  "Confirmación",
  "Resultado",
] as const;

export const scenarios: readonly Scenario[] = [
  {
    id: "presupuesto",
    label: "Preparar un presupuesto",
    shortLabel: "Presupuesto",
    description: "De una petición hablada a un borrador revisable.",
    input:
      "Prepara un presupuesto para reformar un baño de ocho metros: demolición, fontanería, alicatado, sanitarios y pintura.",
    interpretation: [
      { label: "Tipo", value: "Presupuesto" },
      { label: "Obra", value: "Reforma baño · Calle Luna 18" },
      { label: "Cliente", value: "Pendiente de confirmar" },
      { label: "Partidas detectadas", value: "12" },
      { label: "Duda", value: "Retirada de escombros" },
    ],
    proposal: [
      { label: "Importe orientativo", value: "18.450 €" },
      { label: "Margen previsto", value: "24,1 %" },
      { label: "Plazo estimado", value: "18 días" },
    ],
    editableFields: [
      { id: "amount", label: "Importe orientativo", inputMode: "decimal" },
      { id: "work", label: "Obra" },
      { id: "deadline", label: "Plazo estimado" },
    ],
    confirmation: (values) =>
      `Al confirmar se crearían 12 partidas en el presupuesto PR-0048. No se enviaría nada al cliente. Importe orientativo: ${values.amount}; obra: ${values.work}; plazo estimado: ${values.deadline}.`,
    result: "Presupuesto preparado para revisión.",
  },
  {
    id: "gasto",
    label: "Registrar un gasto",
    shortLabel: "Gasto",
    description: "De un ticket a un coste relacionado con su obra.",
    input: "Ticket de Ferretería Norte por material de fontanería.",
    interpretation: [
      { label: "Tipo", value: "Gasto" },
      { label: "Importe", value: "184,32 €" },
      { label: "Categoría", value: "Material de fontanería" },
      { label: "Obra propuesta", value: "Reforma baño · Calle Luna 18" },
    ],
    proposal: [
      { label: "Acción", value: "Asociar a la obra" },
      { label: "Proveedor", value: "Registrar Ferretería Norte" },
      { label: "Coste", value: "Actualizar coste real" },
      { label: "Margen", value: "Recalcular del 24,1 % al 23,5 %" },
    ],
    editableFields: [
      { id: "amount", label: "Importe", inputMode: "decimal" },
      { id: "work", label: "Obra" },
      { id: "category", label: "Categoría" },
    ],
    confirmation: (values) =>
      `Al confirmar se registraría un gasto de ${values.amount} asociado a ${values.work}. No se enviaría información al proveedor. Categoría local: ${values.category}.`,
    result: "Gasto preparado y margen recalculado.",
  },
  {
    id: "obra",
    label: "Actualizar una obra",
    shortLabel: "Obra",
    description: "De un cambio acordado a una propuesta trazable.",
    input:
      "El cliente acepta cambiar el mueble por el modelo roble. Son 650 euros más y dos días de plazo.",
    interpretation: [
      { label: "Tipo", value: "Cambio de alcance" },
      { label: "Importe adicional", value: "650 €" },
      { label: "Plazo adicional", value: "2 días" },
      { label: "Obra", value: "Reforma baño · Calle Luna 18" },
    ],
    proposal: [
      { label: "Alcance", value: "Crear cambio de alcance" },
      { label: "Presupuesto", value: "Actualizar presupuesto" },
      { label: "Planificación", value: "Ampliar fecha prevista" },
      { label: "Cliente", value: "Preparar aprobación" },
    ],
    editableFields: [
      { id: "amount", label: "Importe adicional", inputMode: "decimal" },
      { id: "work", label: "Obra" },
      { id: "deadline", label: "Plazo adicional" },
    ],
    confirmation: (values) =>
      `Al confirmar se prepararía un cambio de alcance de ${values.amount} y ${values.deadline} adicionales para ${values.work}. No se enviaría todavía al cliente.`,
    result: "Cambio preparado para revisión.",
  },
] as const;

export function createInitialValues(): Record<ScenarioId, EditableValues> {
  return {
    presupuesto: {
      amount: "18.450 €",
      work: "Reforma baño · Calle Luna 18",
      deadline: "18 días",
      category: "",
    },
    gasto: {
      amount: "184,32 €",
      work: "Reforma baño · Calle Luna 18",
      deadline: "",
      category: "Material de fontanería",
    },
    obra: {
      amount: "650 €",
      work: "Reforma baño · Calle Luna 18",
      deadline: "2 días",
      category: "",
    },
  };
}
