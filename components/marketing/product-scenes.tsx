"use client";

import {
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  MessageSquareText,
  Smartphone,
  Sparkles,
  UserRound,
  UsersRound,
  Wrench,
} from "lucide-react";
import { ProductScene, type ProductSceneStage } from "@/components/marketing/motion-system";

const heroStages = [
  stage("cliente", "Cliente", "Relación abierta", "El contexto empieza unido", "Contacto, responsable y siguiente paso quedan en la misma vista.", "1 siguiente paso", "Relación"),
  stage("presupuesto", "Presupuesto", "Propuesta preparada", "La oportunidad toma forma", "Partidas, condiciones y aprobación avanzan sin perder el origen.", "Lista para revisar", "Venta"),
  stage("trabajo", "Trabajo", "Ejecución coordinada", "El equipo sabe qué ocurre", "Hitos, agenda, documentos y actividad comparten el mismo contexto.", "En curso", "Operación"),
  stage("factura", "Factura", "Documento trazable", "La entrega continúa en finanzas", "El documento conserva su relación con cliente, trabajo y vencimiento.", "Emitida", "Finanzas"),
  stage("cobro", "Cobro", "Ciclo completado", "El resultado vuelve al negocio", "El cobro actualiza tesorería y deja una historia completa para decidir.", "Conciliado", "Tesorería"),
] as const;

const roleStages = [
  stage("owner", "Propietario", "Visión completa", "Decidir con el negocio conectado", "Prioridades, riesgos y acciones bajo confirmación.", "5 áreas", "Gobierno"),
  stage("direction", "Dirección", "Coordinación", "Ver el avance entre equipos", "Operación, ventas y previsión en una vista ejecutiva.", "3 prioridades", "Dirección"),
  stage("sales", "Comercial", "Relaciones", "Convertir oportunidades en trabajo", "Clientes, propuestas, agenda y próximas acciones.", "Hoy", "Comercial"),
  stage("finance", "Finanzas", "Control económico", "Seguir documentos y vencimientos", "Facturas, cobros, pagos y previsión con trazabilidad.", "6 semanas", "Finanzas"),
  stage("purchases", "Compras", "Suministro", "Coordinar solicitud y recepción", "Comparativas, pedidos y facturas recibidas conectadas.", "2 entregas", "Compras"),
  stage("manager", "Responsable", "Ejecución", "Organizar el trabajo del equipo", "Hitos, tareas, incidencias, agenda y documentos.", "4 personas", "Responsable"),
  stage("employee", "Empleado", "Foco diario", "Saber qué toca y registrar avance", "Tareas e instrucciones claras, también desde móvil.", "3 tareas", "Empleado"),
] as const;

const clientStages = [
  stage("contact", "Contacto", "Inicio", "Una relación con contexto", "Origen, personas y siguiente acción accesibles.", "Nuevo", "Cliente 360"),
  stage("opportunity", "Oportunidad", "Interés", "Una necesidad concreta", "La conversación se convierte en una oportunidad trazable.", "En estudio", "Cliente 360"),
  stage("quote", "Presupuesto", "Propuesta", "Una decisión preparada", "La propuesta y su actividad quedan vinculadas.", "Revisión", "Cliente 360"),
  stage("work", "Trabajo", "Entrega", "La relación pasa a operación", "Equipo, agenda y documentos mantienen continuidad.", "En curso", "Cliente 360"),
  stage("invoice", "Factura", "Documento", "La entrega se formaliza", "Vencimiento y origen quedan visibles sin duplicar datos.", "Emitida", "Cliente 360"),
  stage("payment", "Cobro", "Resultado", "La historia se completa", "El ciclo comercial y operativo queda listo para la siguiente relación.", "Cerrado", "Cliente 360"),
] as const;

const workStages = [
  stage("plan", "Planificación", "Alcance", "Alinear antes de empezar", "Objetivos, responsables y fechas forman una base común.", "Definida", "Trabajo 360"),
  stage("prepare", "Preparación", "Recursos", "Dejar listo el comienzo", "Equipo, documentos y agenda anticipan bloqueos.", "Lista", "Trabajo 360"),
  stage("execute", "Ejecución", "Avance", "Hacer visible el movimiento", "Tareas, hitos e incidencias muestran el estado real.", "En curso", "Trabajo 360"),
  stage("review", "Revisión", "Calidad", "Comprobar antes de entregar", "Pendientes y evidencias se revisan en contexto.", "2 revisiones", "Trabajo 360"),
  stage("delivery", "Entrega", "Resultado", "Compartir una entrega clara", "Documentos y conformidad cierran el trabajo operativo.", "Preparada", "Trabajo 360"),
  stage("close", "Cierre", "Continuidad", "Conservar lo aprendido", "Actividad, documentos y próximos pasos permanecen accesibles.", "Completado", "Trabajo 360"),
] as const;

const actionStages = [
  stage("request", "Petición", "Conversación", "Expresa el resultado que buscas", "Orqena parte de la empresa y la página activas.", "Recibida", "Orqena"),
  stage("analysis", "Análisis", "Contexto", "Reúne solo lo necesario", "Relaciona permisos, fuentes y datos de la empresa activa.", "En contexto", "Orqena"),
  stage("sources", "Fuentes", "Trazabilidad", "Muestra de dónde sale la respuesta", "Cada referencia útil puede revisarse antes de actuar.", "3 fuentes", "Orqena"),
  stage("proposal", "Propuesta", "Borrador", "Prepara un siguiente paso", "La propuesta no cambia ningún registro por sí sola.", "Editable", "Orqena"),
  stage("edit", "Editar", "Control", "Ajusta antes de decidir", "El usuario conserva el criterio y puede cancelar.", "Sin ejecutar", "Orqena"),
  stage("confirm", "Confirmar o cancelar", "Decisión humana", "Nada sensible ocurre sin confirmación", "La decisión final queda clara, explícita y trazable.", "Esperando", "Orqena"),
] as const;

const mobileStages = [
  stage("open", "Abrir tarea", "Hoy", "El contexto cabe en la mano", "Cliente, trabajo, hora y prioridad aparecen juntos.", "Prioridad media", "Móvil"),
  stage("instructions", "Instrucciones", "Detalle", "Saber qué resultado se espera", "Notas y documentos relevantes, sin ruido adicional.", "2 pasos", "Móvil"),
  stage("progress", "Registrar avance", "Actualización", "Contar lo que ya está hecho", "Un cambio reversible actualiza el trabajo al instante.", "60 %", "Móvil"),
  stage("image", "Añadir imagen", "Evidencia sintética", "Aportar contexto visual", "La imagen demo queda relacionada con la tarea.", "1 imagen", "Móvil"),
  stage("complete", "Completar", "Cierre", "Terminar con una acción clara", "El estado espera una confirmación simple.", "Listo", "Móvil"),
  stage("sync", "Reflejar cambio", "Escritorio", "El equipo ve el mismo estado", "La actividad aparece en la vista compartida.", "Sincronizado", "Móvil"),
] as const;

const quoteStages = [
  stage("client", "Cliente", "Contexto", "Elegir la relación correcta", "La propuesta nace vinculada al cliente y a su oportunidad.", "Seleccionado", "Ventas"),
  stage("lines", "Partidas", "Alcance", "Explicar qué se entrega", "Conceptos, cantidades y notas forman una propuesta comprensible.", "3 partidas", "Ventas"),
  stage("price", "Precio de venta", "Oferta", "Presentar un importe claro", "El precio visible no revela información económica restringida.", "Calculado", "Ventas"),
  stage("discount", "Descuento", "Condición", "Ajustar con intención", "Las condiciones quedan visibles para revisión.", "Aplicado", "Ventas"),
  stage("approval", "Aprobación", "Gobierno", "Revisar antes de comprometer", "La persona autorizada decide si la propuesta avanza.", "Pendiente", "Ventas"),
  stage("send", "Envío", "Salida", "Dejar una propuesta trazable", "La actividad conserva versión, estado y siguiente paso.", "Preparado", "Ventas"),
] as const;

const treasuryStages = [
  stage("issued", "Factura emitida", "Entrada prevista", "Registrar el origen", "Documento, cliente y trabajo explican la previsión.", "Prevista", "Tesorería"),
  stage("due", "Vencimiento", "Calendario", "Ver cuándo se mueve el dinero", "La fecha se integra con alertas y agenda.", "Próximo", "Tesorería"),
  stage("collected", "Cobro", "Entrada real", "Confirmar lo recibido", "El movimiento queda conciliado con su documento.", "Recibido", "Tesorería"),
  stage("received", "Factura recibida", "Salida prevista", "Conocer los compromisos", "Proveedor, documento y fecha explican la salida.", "Registrada", "Tesorería"),
  stage("paid", "Pago", "Salida real", "Cerrar la obligación", "El pago conserva su trazabilidad documental.", "Pagado", "Tesorería"),
  stage("forecast", "Posición prevista", "Decisión", "Mirar las próximas semanas", "Entradas y salidas muestran su origen, no una cifra inventada.", "6 semanas", "Tesorería"),
] as const;

const agendaStages = [
  stage("client", "Elegir cliente", "Relación", "Empezar por el contexto", "La actividad se vincula a una relación existente.", "Demo sintética", "Agenda"),
  stage("work", "Limitar trabajos", "Selección", "Mostrar solo lo relacionado", "La lista evita trabajos de otros clientes.", "2 opciones", "Agenda"),
  stage("choose", "Elegir trabajo", "Contexto", "Fijar el lugar correcto", "El trabajo seleccionado hereda cliente y responsables.", "Seleccionado", "Agenda"),
  stage("lock", "Fijar cliente", "Coherencia", "Evitar relaciones imposibles", "El cliente queda bloqueado mientras exista el trabajo.", "Protegido", "Agenda"),
  stage("relations", "Limitar relaciones", "Precisión", "Contactos y documentos válidos", "Solo aparecen elementos del mismo contexto.", "Filtrado", "Agenda"),
  stage("save", "Guardar actividad", "Continuidad", "Volver al trabajo sin perder filtros", "La agenda conserva vista, selección y desplazamiento.", "Guardada", "Agenda"),
] as const;

export function HeroProductOrchestra() {
  return <ProductScene id="hero-product-orchestra" title="Tu negocio se mueve como un solo sistema" stages={heroStages} />;
}

export function RolePortalStudio() {
  return <ProductScene id="role-portal-studio" title="Cada persona entra en un portal distinto" stages={roleStages} accent="blue" render={(stage, index) => <RoleRows stage={stage} index={index} />} />;
}

export function Client360Demo() {
  return <ProductScene id="client-360-demo" title="La relación completa, sin página interminable" stages={clientStages} />;
}

export function Work360Demo() {
  return <ProductScene id="work-360-demo" title="El trabajo evoluciona a la vista del equipo" stages={workStages} accent="sand" />;
}

export function OrqenaActionDemo() {
  return <ProductScene id="orqena-action-demo" title="Orqena propone. Tú decides." stages={actionStages} accent="blue" render={(stage, index) => <ActionRows stage={stage} index={index} />} />;
}

export function MobileWorkDemo() {
  return <ProductScene id="mobile-work-demo" title="Del móvil al escritorio, sin perder contexto" stages={mobileStages} />;
}

export function SalesQuoteStudioDemo() {
  return <ProductScene id="sales-quote-studio" title="Una propuesta que se entiende y se gobierna" stages={quoteStages} accent="blue" />;
}

export function TreasuryFlowDemo() {
  return <ProductScene id="treasury-flow-demo" title="Cada movimiento conserva su origen" stages={treasuryStages} accent="sand" />;
}

export function ContextualAgendaDemo() {
  return <ProductScene id="contextual-agenda-demo" title="Una agenda que entiende las relaciones" stages={agendaStages} />;
}

function stage(
  id: string,
  label: string,
  eyebrow: string,
  title: string,
  description: string,
  metric: string,
  meta: string,
): ProductSceneStage {
  return { id, label, eyebrow, title, description, metric, meta };
}

function RoleRows({ stage, index }: { stage: ProductSceneStage; index: number }) {
  const icons = [UsersRound, Sparkles, UserRound, CircleDollarSign, FileCheck2, Wrench, Smartphone];
  const Icon = icons[index] || UsersRound;
  return (
    <div className="scene-role-layout">
      <div className="scene-role-nav">
        <Icon size={20} />
        <strong>{stage.label}</strong>
        {["Hoy", "Clientes", index === 3 ? "Tesorería" : "Trabajo", "Documentos"].map((item, itemIndex) => (
          <span className={itemIndex === 0 ? "is-active" : ""} key={item}>{item}</span>
        ))}
      </div>
      <div className="scene-role-cards">
        <article><small>Prioridad</small><strong>{stage.title}</strong></article>
        <article><small>Acceso visible</small><strong>{stage.metric}</strong></article>
        <article><small>Acción principal</small><strong>{index === 6 ? "Registrar avance" : "Revisar actividad"}</strong></article>
      </div>
    </div>
  );
}

function ActionRows({ stage, index }: { stage: ProductSceneStage; index: number }) {
  const Icon = index < 2 ? MessageSquareText : index < 4 ? Sparkles : CheckCircle2;
  return (
    <div className="scene-action-card">
      <Icon size={22} />
      <div>
        <small>Demostración determinista · no llama a servicios externos</small>
        <strong>{stage.title}</strong>
        <p>{stage.description}</p>
      </div>
      <div className="scene-action-buttons">
        <button type="button" tabIndex={-1}>{index >= 3 ? "Editar" : "Ver fuentes"}</button>
        <button type="button" tabIndex={-1}>{index === 5 ? "Confirmar" : "Continuar"}</button>
      </div>
    </div>
  );
}

export const marketingSceneCatalog = {
  hero: { component: "HeroProductOrchestra", stages: heroStages.map((item) => item.label) },
  portals: { component: "RolePortalStudio", stages: roleStages.map((item) => item.label) },
  client: { component: "Client360Demo", stages: clientStages.map((item) => item.label) },
  work: { component: "Work360Demo", stages: workStages.map((item) => item.label) },
  orqena: { component: "OrqenaActionDemo", stages: actionStages.map((item) => item.label) },
  mobile: { component: "MobileWorkDemo", stages: mobileStages.map((item) => item.label) },
  quote: { component: "SalesQuoteStudioDemo", stages: quoteStages.map((item) => item.label) },
  treasury: { component: "TreasuryFlowDemo", stages: treasuryStages.map((item) => item.label) },
  agenda: { component: "ContextualAgendaDemo", stages: agendaStages.map((item) => item.label) },
} as const;
