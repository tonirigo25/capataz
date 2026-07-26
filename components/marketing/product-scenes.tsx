"use client";

import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FileText,
  MessageSquareText,
  ReceiptText,
  Smartphone,
  Sparkles,
  UserRound,
  UsersRound,
  WalletCards,
  Wrench,
} from "lucide-react";
import {
  DemoController,
  PlaybackControls,
  ProductScene,
  SceneProgress,
  type ProductSceneStage,
} from "@/components/marketing/motion-system";
import { brand } from "@/lib/brand";

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
  stage("request", "Petición", "Conversación", "Expresa el resultado que buscas", `${brand.productName} parte de la empresa y la página activas.`, "Recibida", brand.productName),
  stage("analysis", "Análisis", "Contexto", "Reúne solo lo necesario", "Relaciona permisos, fuentes y datos de la empresa activa.", "En contexto", brand.productName),
  stage("sources", "Fuentes", "Trazabilidad", "Muestra de dónde sale la respuesta", "Cada referencia útil puede revisarse antes de actuar.", "3 fuentes", brand.productName),
  stage("proposal", "Propuesta", "Borrador", "Prepara un siguiente paso", "La propuesta no cambia ningún registro por sí sola.", "Editable", brand.productName),
  stage("edit", "Editar", "Control", "Ajusta antes de decidir", "El usuario conserva el criterio y puede cancelar.", "Sin ejecutar", brand.productName),
  stage("confirm", "Confirmar o cancelar", "Decisión humana", "Nada sensible ocurre sin confirmación", "La decisión final queda clara, explícita y trazable.", "Esperando", brand.productName),
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
  return <ProductScene id="hero-product-orchestra" title="Tu negocio se mueve como un solo sistema" stages={heroStages} autoplay />;
}

export function RolePortalStudio() {
  return <ProductScene id="role-portal-studio" title="Cada persona entra en un portal distinto" stages={roleStages} accent="blue" autoplay composition="mosaic" device={false} render={(stage, index) => <RoleRows stage={stage} index={index} />} />;
}

export function Client360Demo() {
  return <ProductScene id="client-360-demo" title="La relación completa, sin página interminable" stages={clientStages} autoplay composition="timeline" render={(stage, index) => <ClientRows stage={stage} index={index} />} />;
}

export function Work360Demo() {
  return <ProductScene id="work-360-demo" title="El trabajo evoluciona a la vista del equipo" stages={workStages} accent="sand" composition="timeline" device={false} render={(stage, index) => <WorkRows stage={stage} index={index} />} />;
}

export function OrqenaActionDemo() {
  return <ProductScene id="orqena-action-demo" title="Orqena propone. Tú decides." stages={actionStages} accent="blue" composition="mosaic" device={false} render={(stage, index) => <ActionRows stage={stage} index={index} />} />;
}

export function MobileWorkDemo() {
  return <ProductScene id="mobile-work-demo" title="Del móvil al escritorio, sin perder contexto" stages={mobileStages} composition="mosaic" render={(stage, index) => <MobileSyncRows stage={stage} index={index} />} />;
}

export function SalesQuoteStudioDemo() {
  return <ProductScene id="sales-quote-studio" title="Una propuesta que se entiende y se gobierna" stages={quoteStages} accent="blue" composition="timeline" device={false} render={(stage, index) => <QuoteRows stage={stage} index={index} />} />;
}

export function TreasuryFlowDemo() {
  return <ProductScene id="treasury-flow-demo" title="Cada movimiento conserva su origen" stages={treasuryStages} accent="sand" composition="ledger" device={false} render={(stage, index) => <TreasuryRows stage={stage} index={index} />} />;
}

export function ContextualAgendaDemo() {
  return <ProductScene id="contextual-agenda-demo" title="Una agenda que entiende las relaciones" stages={agendaStages} composition="mosaic" device={false} render={(stage, index) => <AgendaRows stage={stage} index={index} />} />;
}

export function BusinessWorkflow() {
  const labels = heroStages.map((item) => item.label);
  return (
    <DemoController labels={labels} autoplay interval={3000}>
      {({ activeIndex, playing, reducedMotion, select, toggle, previous, next, restart }) => {
        const index = reducedMotion ? heroStages.length - 1 : activeIndex;
        const current = heroStages[index];
        const icons = [UserRound, FileText, Wrench, ReceiptText, WalletCards];
        const Icon = icons[index];
        return (
          <section className="business-workflow" aria-labelledby="business-workflow-title" data-autoplay="true">
            <header>
              <div>
                <p className="marketing-eyebrow">Workflow empresarial</p>
                <h2 id="business-workflow-title">Cada etapa sabe de dónde viene y qué debe ocurrir después.</h2>
              </div>
              <PlaybackControls playing={playing} onToggle={toggle} onPrevious={previous} onNext={next} onRestart={restart} />
            </header>
            <SceneProgress labels={labels} activeIndex={index} onSelect={select} />
            <div className="business-workflow__body" aria-live="polite">
              <ol>
                {heroStages.map((stage, stageIndex) => (
                  <li key={stage.id} className={stageIndex === index ? "is-active" : stageIndex < index ? "is-done" : ""}>
                    <button type="button" onClick={() => select(stageIndex)}>
                      <span>{String(stageIndex + 1).padStart(2, "0")}</span>
                      <strong>{stage.label}</strong>
                    </button>
                  </li>
                ))}
              </ol>
              <article>
                <div className="business-workflow__record">
                  <span><Icon size={22} /> Registro relacionado</span>
                  <h3>{current.title}</h3>
                  <p>{current.description}</p>
                  <dl>
                    <div><dt>Actor</dt><dd>{index < 2 ? "Comercial" : index === 2 ? "Responsable" : "Finanzas"}</dd></div>
                    <div><dt>Estado</dt><dd>{current.metric}</dd></div>
                    <div><dt>Fecha</dt><dd>{index < 3 ? "Hoy" : "Próximo vencimiento"}</dd></div>
                  </dl>
                </div>
                <aside>
                  <small>Relación anterior</small>
                  <strong>{index === 0 ? "Primer contacto" : heroStages[index - 1].label}</strong>
                  <ArrowRight size={18} />
                  <small>Siguiente acción</small>
                  <strong>{index === heroStages.length - 1 ? "Revisar continuidad" : `Preparar ${heroStages[index + 1].label.toLocaleLowerCase("es")}`}</strong>
                </aside>
              </article>
            </div>
          </section>
        );
      }}
    </DemoController>
  );
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

function AgendaRows({ stage, index }: { stage: ProductSceneStage; index: number }) {
  return (
    <div className="scene-agenda">
      <div className="scene-agenda__day">
        <span><Clock3 size={14} /> 09:00</span>
        <strong>{stage.title}</strong>
        <small>{index < 3 ? "Cliente y trabajo relacionados" : "Contexto protegido"}</small>
      </div>
      <div className="scene-agenda__week" aria-label="Semana sintética">
        {["L", "M", "X", "J", "V"].map((day, dayIndex) => <span key={day} className={dayIndex === Math.min(index, 4) ? "is-active" : ""}>{day}<i>{dayIndex + 12}</i></span>)}
      </div>
    </div>
  );
}

function QuoteRows({ stage, index }: { stage: ProductSceneStage; index: number }) {
  return (
    <div className="scene-quote">
      <div>
        <small>Propuesta Q-024</small>
        <strong>{stage.title}</strong>
        {["Servicio principal", "Preparación", "Entrega"].map((line, lineIndex) => <span key={line}>{line}<i>{lineIndex + 1}</i></span>)}
      </div>
      <aside><small>Aprobación</small><strong>{index < 4 ? "En preparación" : index === 4 ? "Esperando decisión" : "Lista para enviar"}</strong><CheckCircle2 size={20} /></aside>
    </div>
  );
}

function TreasuryRows({ stage, index }: { stage: ProductSceneStage; index: number }) {
  return (
    <div className="scene-ledger">
      {treasuryStages.slice(Math.max(0, index - 1), Math.min(treasuryStages.length, index + 2)).map((item) => (
        <article key={item.id} className={item.id === stage.id ? "is-active" : ""}>
          <span>{item.label.includes("Factura") ? <ReceiptText size={16} /> : <WalletCards size={16} />}</span>
          <div><strong>{item.label}</strong><small>{item.meta} · origen visible</small></div>
          <i>{item.metric}</i>
        </article>
      ))}
      <footer><span>Posición explicada</span><strong>Entradas y salidas conservan documento y fecha</strong></footer>
    </div>
  );
}

function ClientRows({ stage, index }: { stage: ProductSceneStage; index: number }) {
  return (
    <div className="scene-360">
      <div className="scene-360__summary">
        <span>Relación</span><strong>Cliente demo</strong><small>Responsable · Equipo comercial</small>
      </div>
      <div className="scene-360__timeline">
        {clientStages.slice(0, index + 1).slice(-3).map((item) => <span key={item.id}><i /><strong>{item.label}</strong><small>{item.metric}</small></span>)}
      </div>
      <aside><small>Próxima acción</small><strong>{stage.title}</strong><button type="button" tabIndex={-1}>Abrir registro</button></aside>
    </div>
  );
}

function WorkRows({ stage, index }: { stage: ProductSceneStage; index: number }) {
  return (
    <div className="scene-work">
      <div className="scene-work__progress"><span style={{ width: `${((index + 1) / workStages.length) * 100}%` }} /></div>
      <div className="scene-work__board">
        {["Hito", "Equipo", "Documento"].map((label, itemIndex) => <article key={label}><small>{label}</small><strong>{itemIndex === 0 ? stage.title : itemIndex === 1 ? "Responsable + equipo" : "Entrega vinculada"}</strong><CheckCircle2 size={16} /></article>)}
      </div>
    </div>
  );
}

function MobileSyncRows({ stage, index }: { stage: ProductSceneStage; index: number }) {
  return (
    <div className="scene-mobile-sync">
      <div><Smartphone size={18} /><span><small>Móvil</small><strong>{stage.label}</strong></span></div>
      <ArrowRight size={18} />
      <div><UsersRound size={18} /><span><small>Escritorio</small><strong>{index < 5 ? "Esperando actualización" : "Actividad sincronizada"}</strong></span></div>
      <p>{stage.description}</p>
    </div>
  );
}

export const marketingSceneCatalog = {
  hero: { component: "HeroProductOrchestra", stages: heroStages.map((item) => item.label) },
  workflow: { component: "BusinessWorkflow", stages: heroStages.map((item) => item.label) },
  portals: { component: "RolePortalStudio", stages: roleStages.map((item) => item.label) },
  client: { component: "Client360Demo", stages: clientStages.map((item) => item.label) },
  work: { component: "Work360Demo", stages: workStages.map((item) => item.label) },
  orqena: { component: "OrqenaActionDemo", stages: actionStages.map((item) => item.label) },
  mobile: { component: "MobileWorkDemo", stages: mobileStages.map((item) => item.label) },
  quote: { component: "SalesQuoteStudioDemo", stages: quoteStages.map((item) => item.label) },
  treasury: { component: "TreasuryFlowDemo", stages: treasuryStages.map((item) => item.label) },
  agenda: { component: "ContextualAgendaDemo", stages: agendaStages.map((item) => item.label) },
} as const;
