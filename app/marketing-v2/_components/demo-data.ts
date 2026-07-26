export type DemoId = "audio" | "foto" | "factura" | "mensaje";

export type DemoDetail = {
  label: string;
  value: string;
  emphasis?: "warning" | "positive";
};

export type DemoScenario = {
  id: DemoId;
  label: string;
  inputLabel: string;
  input: string;
  details: readonly DemoDetail[];
  primaryAction: string;
  fictitiousVisual?: boolean;
};

export const demoScenarios: readonly DemoScenario[] = [
  {
    id: "audio",
    label: "Audio",
    inputLabel: "Audio transcrito",
    input: "Prepara un presupuesto para reformar un baño de ocho metros: demolición, fontanería, alicatado, sanitarios y pintura.",
    details: [
      { label: "Tipo", value: "Presupuesto" },
      { label: "Obra", value: "Reforma baño · Calle Luna 18" },
      { label: "Cliente", value: "Pendiente de confirmar", emphasis: "warning" },
      { label: "Partidas propuestas", value: "12" },
      { label: "Importe orientativo", value: "18.450 €" },
      { label: "Aviso", value: "Retirada de escombros no confirmada", emphasis: "warning" },
    ],
    primaryAction: "Revisar presupuesto",
  },
  {
    id: "foto",
    label: "Foto",
    inputLabel: "Representación ficticia",
    input: "Ticket de material de Ferretería Norte",
    details: [
      { label: "Tipo", value: "Gasto" },
      { label: "Importe", value: "184,32 €" },
      { label: "Categoría", value: "Material de fontanería" },
      { label: "Obra propuesta", value: "Reforma baño · Calle Luna 18" },
      { label: "Margen previsto", value: "de 24,1 % a 23,5 %", emphasis: "warning" },
    ],
    primaryAction: "Revisar gasto",
    fictitiousVisual: true,
  },
  {
    id: "factura",
    label: "Factura",
    inputLabel: "Documento de ejemplo",
    input: "Factura de proveedor FV-2841",
    details: [
      { label: "Proveedor", value: "Cerámicas Levante" },
      { label: "Importe", value: "2.480,00 €" },
      { label: "Vencimiento", value: "15 días" },
      { label: "Obra propuesta", value: "Reforma baño · Calle Luna 18" },
      { label: "Duda", value: "Confirmar si el transporte está incluido", emphasis: "warning" },
    ],
    primaryAction: "Revisar factura",
  },
  {
    id: "mensaje",
    label: "Mensaje",
    inputLabel: "Mensaje recibido",
    input: "El cliente acepta cambiar el mueble por el modelo roble. Son 650 euros más y dos días de plazo.",
    details: [
      { label: "Tipo", value: "Cambio de alcance" },
      { label: "Importe adicional", value: "650 €" },
      { label: "Plazo adicional", value: "2 días" },
      { label: "Obra", value: "Reforma baño · Calle Luna 18" },
    ],
    primaryAction: "Revisar cambio",
  },
] as const;
