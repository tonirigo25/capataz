export type MarketingSolution = {
  slug: string;
  title: string;
  eyebrow: string;
  problem: string;
  outcome: string;
  steps: readonly string[];
  proofBoundary: string;
};

export const marketingSolutions: readonly MarketingSolution[] = [
  {
    slug: "presupuestos-de-obra",
    title: "Presupuestos de obra",
    eyebrow: "De la visita al borrador",
    problem: "Medidas, audios y condiciones suelen separarse antes de preparar la propuesta.",
    outcome: "Alcance, partidas, costes, margen y dudas quedan en un borrador revisable.",
    steps: ["Recoger la visita", "Separar datos y dudas", "Preparar partidas", "Revisar margen", "Confirmar antes de compartir"],
    proofBoundary: "No se afirma una tasa de aceptación ni una velocidad real sin medición de pilotos.",
  },
  {
    slug: "control-costes-margen",
    title: "Control de costes y margen",
    eyebrow: "Lectura económica de la obra",
    problem: "Compras, horas, subcontratas y cambios pierden su relación con el presupuesto.",
    outcome: "El coste real y la desviación se explican desde los registros relacionados.",
    steps: ["Partir del presupuesto", "Relacionar costes", "Registrar cambios", "Recalcular", "Revisar la desviación"],
    proofBoundary: "Las cifras de la demo son sintéticas y no representan ahorro ni margen de un cliente.",
  },
  {
    slug: "proveedores-subcontratas",
    title: "Proveedores y subcontratas",
    eyebrow: "Compras con trazabilidad",
    problem: "Facturas recibidas, vencimientos y documentación se reparten entre carpetas y mensajes.",
    outcome: "Proveedor, documento, obra, pago y estado documental comparten contexto.",
    steps: ["Recibir documento", "Validar proveedor", "Relacionar obra", "Revisar vencimiento", "Registrar el pago"],
    proofBoundary: "La conformidad fiscal o documental requiere revisión profesional y evidencia externa.",
  },
  {
    slug: "partes-avance-agenda",
    title: "Partes, avance y agenda",
    eyebrow: "Del campo a la planificación",
    problem: "El avance comunicado no siempre actualiza tareas, próximos hitos o decisiones.",
    outcome: "Partes, incidencias, agenda y responsables continúan dentro del mismo trabajo.",
    steps: ["Comunicar avance", "Relacionar trabajo", "Señalar incidencia", "Actualizar agenda", "Acordar siguiente paso"],
    proofBoundary: "Cámara, micrófono y automatizaciones live permanecen sujetos a permisos y gates separados.",
  },
  {
    slug: "facturacion-cobros",
    title: "Facturación y cobros",
    eyebrow: "De lo ejecutado al vencimiento",
    problem: "Facturar sin el contexto de obra y cobro obliga a reconstruir importes y acuerdos.",
    outcome: "Borrador, vencimiento, pagos parciales y seguimiento mantienen su origen.",
    steps: ["Revisar lo ejecutado", "Preparar borrador", "Confirmar emisión", "Registrar pagos", "Atender vencidos"],
    proofBoundary: "No se anuncia conformidad Verifactu, Facturae ni transmisión fiscal sin revisión firmada.",
  },
  {
    slug: "ia-revisable",
    title: "IA revisable",
    eyebrow: "Asistencia bajo control",
    problem: "Una sugerencia sin fuentes ni efecto visible no permite decidir con seguridad.",
    outcome: "Orqena muestra interpretación, dudas, propuesta y cambio previsto antes de confirmar.",
    steps: ["Pedir en lenguaje natural", "Ver fuentes", "Revisar dudas", "Editar propuesta", "Confirmar o cancelar"],
    proofBoundary: "Los providers live están apagados por defecto; la demo pública es determinista y sintética.",
  },
] as const;

export function getMarketingSolution(slug: string) {
  return marketingSolutions.find((solution) => solution.slug === slug);
}
