import type { BudgetLine } from "@/lib/budget-lines";

export type BudgetTemplate = {
  id: string;
  group: string;
  name: string;
  description: string;
  lines: BudgetLine[];
};

const groups: Array<[string, string[]]> = [
  ["Reformas", ["Reforma baño", "Reforma cocina", "Cambio bañera por plato de ducha", "Reforma integral", "Pintura interior", "Pintura exterior", "Pladur", "Alicatado", "Solado"]],
  ["Construcción / Albañilería", ["Demolición/desescombro", "Levantamiento tabique", "Enlucido", "Solera", "Reparación terraza", "Impermeabilización", "Fachada"]],
  ["Fontanería", ["Reparación fuga", "Instalación baño", "Instalación cocina", "Cambio termo", "Cambio tuberías", "Instalación plato ducha"]],
  ["Electricidad", ["Reforma eléctrica", "Cuadro eléctrico", "Puntos de luz", "Enchufes", "Iluminación LED", "Cableado"]],
  ["Climatización", ["Instalación split", "Instalación conductos", "Mantenimiento climatización", "Sustitución equipo"]],
  ["Carpintería", ["Puertas interiores", "Armarios", "Tarima/parquet", "Rodapié"]],
  ["Ventanas/Cerramientos", ["Cambio ventanas", "Cerramiento aluminio", "Persianas", "Mosquiteras"]],
  ["Mantenimiento", ["Parte de trabajo", "Reparaciones varias", "Servicio urgente", "Mantenimiento comunidad"]]
];

export const budgetTemplates: BudgetTemplate[] = groups.flatMap(([group, names]) =>
  names.map((name) => ({
    id: slug(`${group}-${name}`),
    group,
    name,
    description: `Plantilla editable para ${name.toLowerCase()}. Precios demo a revisar antes de enviar.`,
    lines: templateLines(name)
  }))
);

export function findBudgetTemplate(id: string) {
  return budgetTemplates.find((template) => template.id === id);
}

function templateLines(name: string): BudgetLine[] {
  const base = [
    line("Visita, medición y replanteo", 1, "servicio", 0, "Preparación"),
    line("Materiales principales", 1, "lote", 0, "Materiales"),
    line("Mano de obra", 1, "servicio", 0, "Mano de obra"),
    line("Remates y limpieza final", 1, "servicio", 0, "Remates")
  ];

  if (name.toLowerCase().includes("bañera") || name.toLowerCase().includes("ducha")) {
    return [
      line("Retirada de bañera y desescombro", 1, "servicio", 0, "Demolición"),
      line("Adaptación de fontanería y desagües", 1, "servicio", 0, "Fontanería"),
      line("Plato de ducha y colocación", 1, "ud", 0, "Materiales"),
      line("Alicatado zona ducha", 1, "servicio", 0, "Revestimiento"),
      line("Mampara y remates", 1, "ud", 0, "Remates")
    ];
  }

  if (name.toLowerCase().includes("pintura")) {
    return [
      line("Protección y preparación de superficies", 1, "servicio", 0, "Preparación"),
      line("Pintura paredes y techos", 1, "servicio", 0, "Pintura"),
      line("Repasos, remates y limpieza", 1, "servicio", 0, "Remates")
    ];
  }

  if (name.toLowerCase().includes("factura") || name.toLowerCase().includes("parte")) return base.slice(0, 3);
  return base;
}

function line(descripcion: string, cantidad: number, unidad: string, precioUnitario: number, categoria: string): BudgetLine {
  return { descripcion, cantidad, unidad, precioUnitario, total: cantidad * precioUnitario, categoria };
}

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
