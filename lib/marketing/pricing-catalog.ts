export type BillingInterval = "monthly" | "annual";
export type PricingPlanKey = "starter" | "professional" | "business";

export type PricingPlan = {
  key: PricingPlanKey;
  name: string;
  monthly: number;
  annual: number;
  users: number;
  aiOperations: number;
  audience: string;
  outcome: string;
  badge?: string;
  featured?: boolean;
  capabilityLevel: string;
  operationalCoverage: readonly string[];
  features: readonly string[];
};

export const pricingPlans: readonly PricingPlan[] = [
  {
    key: "starter",
    name: "Starter",
    monthly: 39,
    annual: 390,
    users: 2,
    aiOperations: 0,
    audience: "Autónomos y equipos pequeños que quieren ordenar la operación sin añadir complejidad.",
    outcome: "Una base única para pasar de cliente a presupuesto, trabajo, factura y cobro.",
    capabilityLevel: "Operación esencial",
    operationalCoverage: ["Clientes", "Presupuestos", "Trabajo", "Dinero"],
    features: [
      "Clientes y presupuestos conectados",
      "Trabajo, agenda y facturación",
      "Documentos esenciales",
      "Acceso web y móvil",
      "Datos aislados por empresa",
    ],
  },
  {
    key: "professional",
    name: "Professional",
    monthly: 79,
    annual: 790,
    users: 5,
    aiOperations: 500,
    audience: "Equipos que coordinan varias obras, documentos, responsables y decisiones.",
    outcome: "Coordina el día a día y añade asistencia de IA con revisión humana.",
    badge: "RECOMENDADO",
    featured: true,
    capabilityLevel: "Operación coordinada",
    operationalCoverage: ["Todo Starter", "Documentos", "Automatizaciones", "Orqena IA"],
    features: [
      "Todo lo incluido en Starter",
      "Documentos y automatizaciones",
      "Orqena IA operativa",
      "Permisos y coordinación avanzada",
      "500 operaciones IA al mes",
    ],
  },
  {
    key: "business",
    name: "Business",
    monthly: 149,
    annual: 1490,
    users: 15,
    aiOperations: 5000,
    audience: "Empresas con mayor volumen, más responsables y necesidad de control transversal.",
    outcome: "Amplía capacidad, gobierno y automatización sin cambiar de arquitectura.",
    capabilityLevel: "Control avanzado",
    operationalCoverage: ["Todo Professional", "Gobierno", "Más capacidad", "IA avanzada"],
    features: [
      "Todo lo incluido en Professional",
      "Control y permisos avanzados",
      "Mayor capacidad operativa",
      "5.000 operaciones IA al mes",
      "Estructura preparada para escalar",
    ],
  },
] as const;

export const comparisonGroups = [
  {
    title: "Operación",
    rows: [
      ["Clientes, presupuestos y trabajo", "Incluido", "Incluido", "Incluido"],
      ["Facturación y cobros", "Incluido", "Incluido", "Incluido"],
      ["Documentos", "Esencial", "Completo", "Avanzado"],
      ["Automatizaciones", "Esenciales", "Coordinadas", "Avanzadas"],
    ],
  },
  {
    title: "Capacidad",
    rows: [
      ["Usuarios incluidos", "2", "5", "15"],
      ["Operaciones IA al mes", "No incluidas", "500", "5.000"],
      ["Permisos y control", "Esencial", "Avanzado", "Avanzado"],
      ["Web y móvil", "Incluido", "Incluido", "Incluido"],
    ],
  },
  {
    title: "Gobierno",
    rows: [
      ["Datos aislados por empresa", "Incluido", "Incluido", "Incluido"],
      ["Confirmación humana", "Incluido", "Incluido", "Incluido"],
      ["Trazabilidad de acciones", "Incluido", "Incluido", "Incluido"],
      ["Bloqueo al agotar IA", "No aplica", "Sin sobrecoste", "Sin sobrecoste"],
    ],
  },
] as const;

export const pricingFaq = [
  ["¿Qué cuenta como una operación de IA?", "Una preparación, análisis o acción asistida solicitada a Orqena IA. Consultar una pantalla o trabajar sin IA no consume operaciones de IA."],
  ["¿Puedo cambiar de plan?", "Sí. Antes de cualquier cambio se explica el alcance, la fecha y el efecto para que puedas decidir."],
  ["¿Los precios incluyen IVA?", "No. Los importes mostrados son netos y se añade el IVA que corresponda."],
  ["¿Qué ocurre al alcanzar el límite de IA?", "Orqena avisa al 80 %. Al alcanzar el 100 % se detienen nuevas operaciones de IA; la lectura y el resto del trabajo permitido continúan, sin cargos automáticos de sobreconsumo."],
  ["¿Solicitar acceso crea una compra?", "No. La solicitud abre una conversación para validar encaje y alcance. No crea una suscripción, una factura ni un cobro."],
] as const;

export function priceFor(plan: PricingPlan, interval: BillingInterval) {
  return interval === "monthly" ? plan.monthly : plan.annual;
}

export function recommendPlan(input: { teamSize: number; needsAi: boolean; workload: "standard" | "high" }): PricingPlanKey {
  if (input.teamSize > 5 || input.workload === "high") return "business";
  if (input.teamSize > 2 || input.needsAi) return "professional";
  return "starter";
}
