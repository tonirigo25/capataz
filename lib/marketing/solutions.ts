export type MarketingSolution = {
  slug: string;
  title: string;
  eyebrow: string;
  problem: string;
  outcome: string;
  proof: string;
  steps: readonly string[];
  roles: readonly string[];
  metrics: readonly (readonly [string, string])[];
  activity: readonly string[];
  faq: readonly (readonly [string, string])[];
  related: readonly string[];
};

export const marketingSolutions: readonly MarketingSolution[] = [
  {
    slug: "clientes-y-presupuestos",
    title: "Clientes y presupuestos",
    eyebrow: "Del contacto a una propuesta clara",
    problem: "Notas, llamadas y mediciones se separan justo cuando toca convertir una oportunidad en presupuesto.",
    outcome: "Cada contacto conserva su contexto y avanza hacia un presupuesto revisable, con partidas, seguimiento y próximo paso.",
    proof: "La interfaz muestra el origen de cada dato, las dudas abiertas y el estado de la propuesta antes de compartirla.",
    steps: ["Registrar contacto", "Preparar visita", "Construir partidas", "Revisar alcance", "Enviar y seguir"],
    roles: ["Dirección", "Responsable comercial", "Administración"],
    metrics: [["Oportunidades", "12"], ["Por revisar", "4"], ["Seguimientos", "7"]],
    activity: ["Presupuesto Reforma Oficina Centro listo para revisión", "Visita de Grupo Norte Demo confirmada", "Seguimiento programado para mañana"],
    faq: [["¿El presupuesto se envía automáticamente?", "No. Orqena prepara la propuesta y una persona autorizada revisa y confirma el envío."], ["¿Puedo mantener varias versiones?", "Sí. El recorrido conserva cambios, estado y relación con el cliente."], ["¿Puedo empezar desde una visita?", "Sí. Notas, documentos y medidas pueden alimentar un borrador sin perder la revisión humana."]],
    related: ["obras-y-trabajo", "control-costes-y-margen", "ia-operativa"],
  },
  {
    slug: "obras-y-trabajo",
    title: "Obras y trabajo",
    eyebrow: "Ejecución con contexto",
    problem: "El avance real, las incidencias y la agenda suelen vivir en conversaciones distintas del plan de trabajo.",
    outcome: "Hitos, tareas, responsables e incidencias se actualizan dentro del trabajo correcto y dejan un siguiente paso visible.",
    proof: "Cada cambio muestra responsable, momento, relación con el trabajo y efecto previsto antes de confirmarse.",
    steps: ["Definir alcance", "Planificar hitos", "Asignar equipo", "Registrar avance", "Cerrar y entregar"],
    roles: ["Dirección", "Responsable de obra", "Equipo de campo"],
    metrics: [["Avance", "68 %"], ["Hitos", "3 de 5"], ["Incidencias", "2"]],
    activity: ["Instalación eléctrica completada", "Incidencia de material pendiente", "Próximo hito: revisión de acabados"],
    faq: [["¿Sustituye la supervisión en obra?", "No. Ordena información y responsabilidades; la validación técnica sigue en manos del equipo."], ["¿Funciona desde móvil?", "Sí. Las vistas priorizan agenda, avance, incidencias y acciones necesarias en campo."], ["¿Puedo relacionar costes?", "Sí. Compras, horas y documentos pueden vincularse al mismo trabajo."]],
    related: ["equipo-y-agenda", "control-costes-y-margen", "documentos-y-ocr"],
  },
  {
    slug: "control-costes-y-margen",
    title: "Control de costes y margen",
    eyebrow: "Rentabilidad explicable",
    problem: "Compras, horas y cambios de alcance llegan tarde al cálculo y ocultan la desviación hasta el cierre.",
    outcome: "Presupuesto, coste comprometido, coste real y margen comparten una lectura actualizada y trazable.",
    proof: "Las cifras parten de registros relacionados y distinguen importes confirmados de estimaciones todavía abiertas.",
    steps: ["Fijar presupuesto", "Relacionar compras", "Incorporar horas", "Revisar desviación", "Decidir el siguiente ajuste"],
    roles: ["Dirección", "Responsable de obra", "Administración"],
    metrics: [["Presupuesto", "32.400 €"], ["Coste real", "21.260 €"], ["Margen", "27,6 %"]],
    activity: ["Materiales Levante Demo asociados a la obra", "Desviación de mano de obra revisada", "Margen actualizado con datos confirmados"],
    faq: [["¿Las cifras son una previsión?", "No. Orqena separa lo registrado de lo estimado y explica qué entra en cada cálculo."], ["¿Incluye costes de personal?", "Puede incorporar horas y costes internos aprobados según la configuración de la empresa."], ["¿Puedo detectar una desviación pronto?", "Sí. El seguimiento compara presupuesto y registros relacionados durante la ejecución."]],
    related: ["obras-y-trabajo", "proveedores-y-subcontratas", "facturacion-y-cobros"],
  },
  {
    slug: "facturacion-y-cobros",
    title: "Facturación y cobros",
    eyebrow: "De lo ejecutado a la caja",
    problem: "Cuando trabajo, facturación y seguimiento de cobro están separados, cada vencimiento exige reconstruir el contexto.",
    outcome: "Borradores, facturas, vencimientos, pagos parciales y recordatorios continúan desde el trabajo realizado.",
    proof: "Los importes y estados visibles conservan su documento de origen y esperan confirmación en las acciones sensibles.",
    steps: ["Revisar ejecución", "Preparar borrador", "Confirmar factura", "Registrar cobro", "Atender vencimientos"],
    roles: ["Dirección", "Administración", "Responsable financiero"],
    metrics: [["Facturado", "18.900 €"], ["Cobrado", "14.250 €"], ["Pendiente", "4.650 €"]],
    activity: ["Factura de Reforma Oficina Centro preparada", "Cobro parcial conciliado", "Vencimiento próximo en 4 días"],
    faq: [["¿Orqena emite sin que yo revise?", "No. La preparación y la emisión son estados distintos; una persona con permiso confirma."], ["¿Admite cobros parciales?", "Sí. El saldo pendiente se mantiene relacionado con la factura."], ["¿Sustituye el asesoramiento fiscal?", "No. La configuración fiscal y las obligaciones requieren revisión profesional."]],
    related: ["control-costes-y-margen", "documentos-y-ocr", "clientes-y-presupuestos"],
  },
  {
    slug: "proveedores-y-subcontratas",
    title: "Proveedores y subcontratas",
    eyebrow: "Compras y colaboración bajo control",
    problem: "Pedidos, entregas, documentos y vencimientos de proveedor se dispersan entre correo, carpetas y mensajes.",
    outcome: "Proveedor, compra, documento, trabajo y pago quedan relacionados con estado y responsable visibles.",
    proof: "Las validaciones pendientes y la documentación disponible aparecen antes de registrar o confirmar un pago.",
    steps: ["Seleccionar proveedor", "Registrar pedido", "Relacionar entrega", "Revisar factura", "Confirmar pago"],
    roles: ["Compras", "Responsable de obra", "Administración"],
    metrics: [["Proveedores", "18"], ["Pedidos abiertos", "6"], ["Por validar", "3"]],
    activity: ["Pedido de Materiales Levante Demo recibido", "Documento pendiente de Grupo Norte Demo", "Factura asociada a Reforma Oficina Centro"],
    faq: [["¿Puedo ver qué falta antes de pagar?", "Sí. El recorrido muestra documentos, relación con el trabajo y comprobaciones pendientes."], ["¿Gestiona subcontratas?", "Permite relacionar empresa, trabajo, documentación y estados operativos sin sustituir validaciones legales."], ["¿Borra documentos antiguos?", "No. La conservación sigue las políticas y permisos definidos por la empresa."]],
    related: ["documentos-y-ocr", "obras-y-trabajo", "control-costes-y-margen"],
  },
  {
    slug: "documentos-y-ocr",
    title: "Documentos y OCR",
    eyebrow: "Del archivo al contexto",
    problem: "Una factura o albarán aislado obliga a transcribir, buscar la obra y comprobar el proveedor manualmente.",
    outcome: "Orqena extrae una propuesta de datos, señala dudas y espera revisión antes de crear o actualizar registros.",
    proof: "El documento original, los campos detectados y las correcciones humanas permanecen visibles durante la revisión.",
    steps: ["Recibir archivo", "Extraer propuesta", "Marcar dudas", "Revisar campos", "Confirmar relación"],
    roles: ["Administración", "Compras", "Responsable de obra"],
    metrics: [["Recibidos", "24"], ["Revisados", "19"], ["Con dudas", "5"]],
    activity: ["Factura de proveedor lista para revisar", "Albarán relacionado con compra", "Importe corregido antes de confirmar"],
    faq: [["¿El OCR registra datos por sí solo?", "No. Prepara una propuesta y señala incertidumbres para que una persona la confirme."], ["¿Qué archivos admite?", "La disponibilidad se comprueba en la demo según el tipo de documento y su legibilidad."], ["¿Conserva el original?", "Sí, cuando la política documental de la empresa lo permite, junto con su relación y trazabilidad."]],
    related: ["proveedores-y-subcontratas", "facturacion-y-cobros", "ia-operativa"],
  },
  {
    slug: "equipo-y-agenda",
    title: "Equipo y agenda",
    eyebrow: "Cada persona sabe qué sigue",
    problem: "Los cambios de prioridad no siempre llegan a la agenda correcta ni dejan claro quién debe actuar.",
    outcome: "Agenda, tareas, hitos y avisos se ordenan por responsabilidad, trabajo y urgencia.",
    proof: "La vista personal muestra sólo el contexto permitido y conserva quién asignó o actualizó cada elemento.",
    steps: ["Definir prioridad", "Asignar responsable", "Ajustar agenda", "Registrar avance", "Replanificar"],
    roles: ["Dirección", "Responsable de equipo", "Personal asignado"],
    metrics: [["Equipo activo", "5"], ["Hoy", "11 tareas"], ["Bloqueos", "2"]],
    activity: ["Visita asignada a Marta Ruiz", "Hito movido tras confirmar incidencia", "Prioridad compartida con el equipo"],
    faq: [["¿Todos ven toda la empresa?", "No. El acceso depende del rol, la empresa activa y el alcance asignado."], ["¿La agenda cambia sola?", "Las propuestas de ajuste requieren reglas claras y confirmación cuando afectan a otras personas."], ["¿Puedo trabajar desde el móvil?", "Sí. La composición móvil prioriza agenda, trabajo asignado y acciones rápidas."]],
    related: ["obras-y-trabajo", "clientes-y-presupuestos", "ia-operativa"],
  },
  {
    slug: "ia-operativa",
    title: "Orqena IA operativa",
    eyebrow: "Asistencia que explica y espera",
    problem: "Una respuesta genérica no sirve si desconoce el trabajo, no cita su contexto o actúa sin permiso.",
    outcome: "Orqena IA encuentra contexto permitido, prepara un borrador, explica dudas y deja la decisión final a la persona.",
    proof: "Fuentes, efecto previsto, edición y confirmación forman parte de la misma superficie antes de ejecutar una acción.",
    steps: ["Plantear objetivo", "Buscar contexto", "Explicar hallazgos", "Preparar borrador", "Revisar y confirmar"],
    roles: ["Dirección", "Responsables habilitados", "Equipo con acceso"],
    metrics: [["Sugerencias", "6"], ["Por revisar", "3"], ["Confirmadas", "2"]],
    activity: ["Borrador de seguimiento preparado", "Duda sobre vencimiento señalada", "Acción descartada sin cambiar datos"],
    faq: [["¿Orqena IA actúa sin permiso?", "No. Las acciones sensibles muestran su efecto y requieren confirmación humana."], ["¿Usa datos de otras empresas?", "No. El contexto se limita a la empresa activa y a los permisos de la persona."], ["¿Qué es una operación de IA?", "Una preparación, análisis o acción asistida contabilizada de forma visible según el plan."]],
    related: ["documentos-y-ocr", "clientes-y-presupuestos", "equipo-y-agenda"],
  },
] as const;

export function getMarketingSolution(slug: string) {
  return marketingSolutions.find((solution) => solution.slug === slug);
}
