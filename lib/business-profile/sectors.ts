import type { SectorKey, SectorProfile, SectorTerminology } from "./types";

const base: SectorTerminology = { workSingular: "Trabajo", workPlural: "Trabajos", owner: "Responsable", progress: "Estado", clientSingular: "Cliente", clientPlural: "Clientes" };
const profile = (key: SectorKey, name: string, description: string, terminology: Partial<SectorTerminology>, icon: string, examples: string[]): SectorProfile => ({
  key, name, description, icon, terminology: { ...base, ...terminology }, examples,
  quickActions: ["Crear cliente", "Preparar presupuesto", "Organizar agenda"],
  suggestedWorkTypes: examples, recommendedFields: ["responsable", "fecha prevista", "estado"],
  kpis: ["ventas", "cobros", "trabajo activo"], documentCategories: ["comercial", "operativo", "administrativo"],
  agendaTemplates: ["Reunión", "Seguimiento", "Entrega"], assistantSuggestions: ["¿Qué necesita atención hoy?", "Prepara un presupuesto", "Resume los cobros pendientes"],
});

export const sectorProfiles: Record<SectorKey, SectorProfile> = {
  general_services: profile("general_services", "Servicios generales", "Servicios profesionales y operativos.", {}, "briefcase", ["Servicio", "Encargo"]),
  construction: profile("construction", "Construcción", "Obras, reformas y ejecución.", { workSingular: "Obra", workPlural: "Obras", owner: "Jefe de obra", progress: "Avance" }, "hard-hat", ["Reforma", "Obra nueva"]),
  installations: profile("installations", "Instalaciones", "Instalación y mantenimiento técnico.", { workSingular: "Instalación", workPlural: "Instalaciones", owner: "Técnico responsable", progress: "Ejecución" }, "wrench", ["Instalación", "Mantenimiento"]),
  professional_services: profile("professional_services", "Servicios profesionales", "Proyectos y encargos profesionales.", { workSingular: "Proyecto", workPlural: "Proyectos" }, "briefcase-business", ["Proyecto", "Asesoramiento"]),
  consulting: profile("consulting", "Consultoría", "Proyectos de análisis y acompañamiento.", { workSingular: "Proyecto", workPlural: "Proyectos", owner: "Consultor responsable" }, "messages", ["Diagnóstico", "Plan de acción"]),
  agency: profile("agency", "Agencia", "Campañas, cuentas y entregables.", { workSingular: "Proyecto", workPlural: "Proyectos", owner: "Responsable de cuenta" }, "sparkles", ["Campaña", "Contenido"]),
  repair_workshop: profile("repair_workshop", "Taller de reparación", "Órdenes de diagnóstico y reparación.", { workSingular: "Orden de trabajo", workPlural: "Órdenes de trabajo", owner: "Técnico", progress: "Reparación" }, "wrench", ["Diagnóstico", "Reparación"]),
  healthcare: profile("healthcare", "Servicios de salud", "Gestión administrativa de servicios; no incluye historia clínica.", { workSingular: "Caso", workPlural: "Casos" }, "heart", ["Caso administrativo", "Servicio"]),
  education: profile("education", "Educación", "Cursos, grupos y servicios formativos.", { workSingular: "Programa", workPlural: "Programas", owner: "Docente responsable" }, "graduation-cap", ["Curso", "Tutoría"]),
  retail: profile("retail", "Comercio", "Pedidos, ventas y operaciones comerciales.", { workSingular: "Pedido", workPlural: "Pedidos" }, "store", ["Pedido", "Campaña"]),
  hospitality: profile("hospitality", "Hostelería", "Servicios, eventos y operaciones.", { workSingular: "Servicio", workPlural: "Servicios" }, "utensils", ["Servicio", "Evento"]),
  real_estate: profile("real_estate", "Inmobiliario", "Operaciones y encargos sobre inmuebles.", { workSingular: "Operación", workPlural: "Operaciones", owner: "Agente responsable" }, "building", ["Captación", "Operación"]),
  other: profile("other", "Otro sector", "Perfil flexible para cualquier actividad.", {}, "shapes", ["Trabajo", "Encargo"]),
};
