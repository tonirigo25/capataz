import {
  AlertTriangle,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardSignature,
  Clock3,
  FileText,
  HardHat,
  LockKeyhole,
  MessageSquareText,
  Mic,
  ReceiptText,
  ScanText,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  WalletCards,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { FaqAccordion } from "./faq-accordion";
import { HumanControlDemo } from "./human-control-demo";
import { entryFlows, type EntryId } from "./landing-data";
import { ImmersiveJourney } from "./immersive-journey";
import { ResponsibilityViews } from "./responsibility-views";
import { DemoRequestForm } from "@/components/marketing/demo-request-form";
import { RoiCalculator } from "./roi-calculator";
import styles from "../page.module.css";
import { brand } from "@/lib/brand";

const entryIcons: Record<EntryId, LucideIcon> = {
  audio: Mic,
  ticket: Camera,
  obra: MessageSquareText,
  documento: FileText,
};

const mobileActions: readonly [LucideIcon, string, string][] = [
  [Mic, "Grabar audio", "Representación sin activar el micrófono"],
  [Camera, "Fotografiar ticket", "Representación sin activar la cámara"],
  [TrendingUp, "Añadir avance", "Preparar una actualización de obra"],
  [AlertTriangle, "Crear incidencia", "Describir un bloqueo o imprevisto"],
  [Wrench, "Registrar material", "Relacionar una compra con el trabajo"],
  [ClipboardSignature, "Completar parte", "Dejar el trabajo listo para revisión"],
] as const;

const capabilityCards: ReadonlyArray<{
  id: string;
  title: string;
  text: string;
  icon: LucideIcon;
}> = [
  { id: "clientes-y-ventas", title: "Clientes y ventas", text: "Seguimientos, oportunidades y conversaciones en una historia común.", icon: Users },
  { id: "presupuestos", title: "Presupuestos", text: "Partidas, margen y condiciones listos para revisar y confirmar.", icon: ClipboardSignature },
  { id: "trabajo-y-obra", title: "Trabajo y obra", text: "Agenda, tareas, equipo y evidencias conectadas a cada trabajo.", icon: BriefcaseBusiness },
  { id: "costes-y-compras", title: "Costes y compras", text: "Gastos, proveedores y rentabilidad visibles antes de decidir.", icon: TrendingUp },
  { id: "facturas-y-cobros", title: "Facturas y cobros", text: "Vencimientos y caja sin perder el contexto comercial.", icon: WalletCards },
  { id: "documentos-y-ocr", title: "Documentos y OCR", text: "Facturas y tickets ordenados con extracción preparada para revisar.", icon: ScanText },
  { id: "equipo-y-agenda", title: "Equipo y agenda", text: "Responsables, prioridades y próximos pasos claramente asignados.", icon: CalendarDays },
  { id: "capataz-ia", title: "Capataz IA", text: "Propuestas útiles con trazabilidad y confirmación humana.", icon: Bot },
] as const;

export function LandingSections() {
  return (
    <>
      <CapabilityOverview />

      <section id="producto" className={`${styles.section} ${styles.anchorTarget}`}>
        <SectionHeading
          eyebrow="Entradas admitidas"
          title={`Tú lo mandas. ${brand.productName} lo deja preparado.`}
          text="Cuatro formas habituales de contar lo que ocurre. Cada una conserva su contexto y termina en una propuesta que puedes revisar."
        />

        <div className={styles.entryGrid}>
          {entryFlows.map((flow, index) => {
            const Icon = entryIcons[flow.id];
            return (
              <article key={flow.id} className={styles.entryCard} data-entry={flow.id}>
                <div className={styles.entryCardHeading}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <Icon aria-hidden="true" />
                    <p>{flow.eyebrow}</p>
                  </div>
                </div>
                <h3>{flow.title}</h3>
                <EntryVisual id={flow.id} />
                <ol className={styles.entryFlow} aria-label={`Recorrido de ${flow.eyebrow}`}>
                  <li>
                    <span>Entrada</span>
                    <p>{flow.input}</p>
                  </li>
                  <li>
                    <span>Interpretación</span>
                    <p>{flow.interpretation}</p>
                  </li>
                  <li>
                    <span>Propuesta</span>
                    <p>{flow.proposal}</p>
                  </li>
                </ol>
              </article>
            );
          })}
        </div>
      </section>

      <section id="resultados" className={`${styles.section} ${styles.anchorTarget} ${styles.resultsSection}`}>
        <SectionHeading
          eyebrow="Resultados conectados"
          title="Menos papeleo. Más control de cada obra."
          text="La información no termina en una bandeja: avanza hacia un resultado concreto y mantiene visible lo que todavía necesita decisión."
        />

        <div className={styles.commercialResults}>
          <article className={styles.resultStory}>
            <div>
              <span>01 · Presupuesto</span>
              <h3>Presupuesta antes de perder el trabajo</h3>
              <p>
                Convierte audios y notas en un borrador revisable con partidas,
                cantidades, margen y condiciones.
              </p>
            </div>
            <BudgetPreview />
          </article>

          <article className={styles.resultStory}>
            <div>
              <span>02 · Lectura económica</span>
              <h3>Sabe si la obra gana o pierde</h3>
              <p>
                Relaciona compras, tickets, horas, subcontratas y cambios con la
                obra correcta.
              </p>
            </div>
            <MarginPreview />
          </article>

          <article className={styles.resultStory}>
            <div>
              <span>03 · Facturación y cobro</span>
              <h3>Factura y cobra sin perseguir papeles</h3>
              <p>
                Prepara facturas, controla anticipos y vencimientos y señala los
                cobros que necesitan atención.
              </p>
            </div>
            <PaymentPreview />
          </article>
        </div>
      </section>

      <ImmersiveJourney />

      <section
        id="control"
        className={`${styles.section} ${styles.anchorTarget} ${styles.controlSection}`}
      >
        <SectionHeading
          eyebrow="Confirmación humana"
          title={`${brand.productName} prepara. Tú mandas.`}
          text={`Antes de crear, modificar, guardar o enviar algo importante, ${brand.productName} te enseña exactamente qué ha entendido y qué ocurrirá al confirmar.`}
        />
        <HumanControlDemo />
      </section>

      <section id="captura-movil" className={`${styles.section} ${styles.anchorTarget} ${styles.mobileSection}`}>
        <div className={styles.mobileIntro}>
          <SectionHeading
            eyebrow="Experiencia móvil"
            title="Hecho para utilizarse donde ocurre el trabajo."
            text={`No necesitas esperar a llegar a la oficina. Envía lo que acaba de ocurrir y ${brand.productName} lo deja preparado para revisar.`}
          />
          <p className={styles.mobileSafety}>
            <ShieldCheck aria-hidden="true" />
            Las acciones son representaciones locales. No solicitan cámara, micrófono ni archivos.
          </p>
        </div>

        <div className={styles.phoneMockup} aria-label={`Representación local de ${brand.productName} en un teléfono`}>
          <div className={styles.phoneTopbar}>
            <span>9:41</span>
            <strong>{brand.productName}</strong>
            <span>Local</span>
          </div>
          <div className={styles.phoneGreeting}>
            <span>Trabajo de hoy</span>
            <h3>¿Qué acaba de ocurrir?</h3>
            <p>Elige una acción de ejemplo para imaginar el siguiente paso.</p>
          </div>
          <ul className={styles.phoneActions}>
            {mobileActions.map(([Icon, label, detail]) => (
              <li key={label}>
                <Icon aria-hidden="true" />
                <span>
                  <strong>{label}</strong>
                  {detail}
                </span>
                <ArrowRight aria-hidden="true" />
              </li>
            ))}
          </ul>
          <p className={styles.phoneFooter}>
            <LockKeyhole aria-hidden="true" />
            Nada se activa desde esta representación.
          </p>
        </div>
      </section>

      <section
        id="para-quien"
        className={`${styles.section} ${styles.anchorTarget} ${styles.responsibilitySection}`}
      >
        <SectionHeading
          eyebrow="Responsabilidades"
          title="Cada persona ve lo necesario para hacer avanzar su parte."
          text="La navegación, las prioridades, los pendientes y el nivel de acceso cambian con la responsabilidad."
        />
        <ResponsibilityViews />
      </section>

      <section id="confianza" className={`${styles.section} ${styles.anchorTarget} ${styles.trustSection}`}>
        <SectionHeading
          eyebrow="Confianza y estado del producto"
          title="Una beta clara. Sin promesas ocultas."
          text="Solo mostramos capacidades presentes en el producto o recorridos identificados expresamente como demostración."
        />

        <div className={styles.statusGrid}>
          <article data-status="available">
            <div>
              <CheckCircle2 aria-hidden="true" />
              <span>Disponible</span>
            </div>
            <h3>Operación empresarial conectada</h3>
            <ul>
              <li>Clientes, presupuestos y obras.</li>
              <li>Tareas, documentos y gastos.</li>
              <li>Facturas, vencimientos y seguimiento económico.</li>
            </ul>
          </article>
          <article data-status="beta">
            <div>
              <Clock3 aria-hidden="true" />
              <span>Beta</span>
            </div>
            <h3>Preparación asistida y revisable</h3>
            <ul>
              <li>Recorridos guiados con datos de demostración.</li>
              <li>Acceso privado mediante incorporación acompañada.</li>
              <li>Confirmación humana antes de acciones importantes.</li>
            </ul>
          </article>
          <article data-status="development">
            <div>
              <HardHat aria-hidden="true" />
              <span>En desarrollo</span>
            </div>
            <h3>Lo que aún no se anuncia</h3>
            <p>
              Los nuevos recorridos se publicarán solo después de verificarse.
              Esta vista no promete integraciones ni activaciones automáticas.
            </p>
          </article>
        </div>
      </section>

      <section className={`${styles.section} ${styles.proofSection}`} aria-labelledby="proof-title">
        <div>
          <span>Prueba pendiente</span>
          <h2 id="proof-title">Casos, logos y testimonios sólo cuando exista permiso.</h2>
          <p>
            Este espacio queda reservado para evidencia de pilotos reales. No se
            publican marcas, citas, ahorros ni resultados sintéticos como si fueran clientes.
          </p>
        </div>
        <div className={styles.proofPlaceholders} aria-label="Evidencias todavía no publicadas">
          <span>Caso medido · pendiente</span>
          <span>Logo autorizado · pendiente</span>
          <span>Testimonio consentido · pendiente</span>
        </div>
      </section>

      <RoiCalculator />

      <section
        id="beta"
        className={`${styles.section} ${styles.anchorTarget} ${styles.betaSection}`}
      >
        <div className={styles.betaLead}>
          <span>Beta privada</span>
          <h2>Beta acompañada para empresas de construcción y reformas.</h2>
          <p>
            Estamos preparando la incorporación de autónomos y pequeños equipos
            que quieran ordenar presupuestos, obras, gastos y cobros en un único recorrido.
          </p>
          <a href="#solicitar-acceso">
            Contar mi caso
            <ArrowRight aria-hidden="true" />
          </a>
        </div>

        <div className={styles.betaDetails}>
          <BetaDetail
            icon={BriefcaseBusiness}
            title="Público recomendado"
            text="Autónomos y pequeños equipos de construcción y reformas."
          />
          <BetaDetail
            icon={CalendarDays}
            title="Incorporación"
            text="Conversación inicial, revisión de necesidades y siguiente paso acordado."
          />
          <BetaDetail
            icon={UserCheck}
            title="Acompañamiento"
            text="La configuración y el uso se revisan con el equipo, sin activación automática."
          />
          <BetaDetail
            icon={WalletCards}
            title="Datos de demostración"
            text="Esta portada utiliza ejemplos ficticios; no representa una empresa real."
          />
          <BetaDetail
            icon={ShieldCheck}
            title="Revisión humana"
            text="Las decisiones importantes permanecen bajo control de una persona."
          />
          <BetaDetail
            icon={LockKeyhole}
            title="Acceso"
            text="El formulario registra la solicitud; el acceso sólo se concede después de una revisión humana."
          />
        </div>
      </section>

      <section id="preguntas" className={`${styles.section} ${styles.anchorTarget} ${styles.faqSection}`}>
        <SectionHeading
          eyebrow="Preguntas frecuentes"
          title="Antes de empezar, conviene dejar esto claro."
          text="Respuestas prudentes sobre lo que muestra la beta y lo que requiere una revisión acompañada."
        />
        <FaqAccordion />
      </section>

      <section
        id="solicitar-acceso"
        className={`${styles.section} ${styles.anchorTarget} ${styles.formSection}`}
      >
        <div className={styles.formIntro}>
          <span>Solicitud persistente</span>
          <h2>Cuéntanos qué necesitas ordenar.</h2>
          <p>
            La solicitud se guarda con consentimiento, deduplicación, rate limit y
            atribución de campaña. No activa email live ni concede acceso.
          </p>
        </div>
        <DemoRequestForm kind="home" />
      </section>

      <section className={styles.finalCta}>
        <div>
          <span>Siguiente paso</span>
          <h2>Manda el primer audio. {brand.productName} hace el papeleo contigo.</h2>
        </div>
        <div>
          <a className={styles.finalPrimary} href="#solicitar-acceso">Solicitar acceso</a>
          <Link className={styles.finalSecondary} href="/demo#quick-demo">Ver demo</Link>
        </div>
      </section>
    </>
  );
}

function CapabilityOverview() {
  return (
    <section className={`${styles.capabilitySection} ${styles.anchorTarget}`} aria-labelledby="capability-title">
      <div className={styles.capabilityIntro}>
        <span>Un sistema. Todo el negocio.</span>
        <h2 id="capability-title">Todo lo que necesitas para llevar el control</h2>
        <p>Capataz conecta la actividad comercial, el trabajo diario y el dinero para que cada decisión parta de información clara.</p>
      </div>

      <div className={styles.capabilityGrid}>
        {capabilityCards.map(({ id, title, text, icon: Icon }) => (
          <article id={id} key={id} className={styles.capabilityCard}>
            <span><Icon aria-hidden="true" /></span>
            <h3>{title}</h3>
            <p>{text}</p>
            <a href={`#${id}`} aria-label={`Ver ${title}`}>Conocer el área <ArrowRight aria-hidden="true" /></a>
          </article>
        ))}
      </div>

      <div id="producto-por-dentro" className={styles.insideProduct}>
        <div className={styles.insideProductCopy}>
          <span>Producto real</span>
          <h2>Así funciona Capataz por dentro</h2>
          <p>Una vista clara para saber qué ocurre hoy, qué requiere atención y qué decisión viene después.</p>
          <Link href="/demo#quick-demo">Ver demo interactiva <ArrowRight aria-hidden="true" /></Link>
        </div>
        <div className={styles.insideProductScreen} aria-label="Vista de ejemplo del espacio de trabajo de Capataz">
          <aside aria-hidden="true">
            <strong>C</strong>
            <span /><span /><span /><span />
          </aside>
          <div>
            <header><span>Hoy</span><strong>Jueves, 30 de julio</strong></header>
            <section>
              <div><small>Prioridad</small><strong>Revisar presupuesto PR-104</strong><p>Margen previsto del 28 %</p></div>
              <div><small>Trabajo</small><strong>4 obras activas</strong><p>Sin bloqueos críticos</p></div>
              <div><small>Dinero</small><strong>8.750 € por cobrar</strong><p>4 facturas pendientes</p></div>
            </section>
            <footer><Bot aria-hidden="true" /><span><strong>Capataz IA</strong> Dos propuestas esperan tu confirmación.</span><em>Revisar</em></footer>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MarketingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <div>
          <a className={styles.footerBrand} href="#top">{brand.wordmark}</a>
          <p>Trabajo, documentos y decisiones preparados para revisar.</p>
          <span>{brand.productName === brand.legalName ? brand.legalName : `${brand.productName} es un producto de ${brand.legalName}.`}</span>
        </div>
        <nav aria-label={`Secciones de ${brand.productName}`}>
          <strong>Portada</strong>
          <a href="#producto">Producto</a>
          <Link href="/producto">Producto</Link>
          <Link href="/soluciones">Soluciones</Link>
          <Link href="/sectores">Sectores</Link>
          <Link href="/seguridad">Seguridad</Link>
          <Link href="/demo">Demo rápida</Link>
        </nav>
        <nav aria-label="Acceso y ayuda">
          <strong>Acceso</strong>
          <Link href="/login">Entrar</Link>
          <Link href="/soporte">Soporte</Link>
          <Link href="/estado">Estado</Link>
          <Link href="/contacto">Solicitar demo</Link>
        </nav>
        <nav aria-label="Información legal">
          <strong>Legal</strong>
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/terminos">Términos</Link>
          <Link href="/cookies">Cookies</Link>
        </nav>
      </div>
      <div className={styles.footerBottom}>
        <span>Beta privada · Datos de ejemplo</span>
        <a href="#top">Volver arriba</a>
      </div>
    </footer>
  );
}

function SectionHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function EntryVisual({ id }: { id: EntryId }) {
  if (id === "audio") {
    return (
      <div className={styles.audioEntryVisual} aria-label="Representación ficticia de una onda de audio">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <p>00:24 · ejemplo local</p>
      </div>
    );
  }

  if (id === "ticket") {
    return (
      <div className={styles.ticketEntryVisual} aria-label="Representación ficticia de un ticket">
        <strong>Ferretería Norte</strong>
        <span />
        <span />
        <span />
        <small>Ticket de ejemplo</small>
      </div>
    );
  }

  if (id === "obra") {
    return (
      <div className={styles.siteEntryVisual} aria-label="Representación ficticia de una actualización de obra">
        <div><HardHat aria-hidden="true" /></div>
        <span>Avance recibido</span>
        <p>Zona húmeda preparada</p>
        <small>1 duda señalada</small>
      </div>
    );
  }

  return (
    <div className={styles.documentEntryVisual} aria-label="Representación ficticia de un documento">
      <FileText aria-hidden="true" />
      <span>FV-2841</span>
      <strong>Datos extraídos</strong>
      <small>Revisión pendiente</small>
    </div>
  );
}

function BudgetPreview() {
  return (
    <div className={styles.budgetPreview} aria-label="Visualización ficticia de un presupuesto">
      <div>
        <span>PR-0048 · Borrador</span>
        <strong>12 partidas propuestas</strong>
      </div>
      <ul>
        <li><span>01</span>Demolición y retirada</li>
        <li><span>02</span>Fontanería</li>
        <li><span>03</span>Alicatado</li>
        <li><span>…</span>Revisar antes de confirmar</li>
      </ul>
      <p><ShieldCheck aria-hidden="true" /> No enviado al cliente</p>
    </div>
  );
}

function MarginPreview() {
  return (
    <div className={styles.marginPreview} aria-label="Visualización ficticia de evolución de margen">
      <div className={styles.marginLegend}>
        <span>Ejemplo local</span>
        <strong>Margen por revisar</strong>
      </div>
      <div className={styles.marginChart} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <i />
      </div>
      <ul>
        <li><span />Compras relacionadas</li>
        <li><span />Horas y partes</li>
        <li><span />Cambios de alcance</li>
      </ul>
      <p>El cambio se señala; la decisión sigue pendiente.</p>
    </div>
  );
}

function PaymentPreview() {
  return (
    <div className={styles.paymentPreview} aria-label="Visualización ficticia de vencimientos y cobros">
      <div>
        <ReceiptText aria-hidden="true" />
        <span>
          <strong>Factura preparada</strong>
          Borrador no enviado
        </span>
        <em>Revisar</em>
      </div>
      <div>
        <CalendarDays aria-hidden="true" />
        <span>
          <strong>Vencimiento</strong>
          Fecha por confirmar
        </span>
        <em>Pendiente</em>
      </div>
      <div>
        <WalletCards aria-hidden="true" />
        <span>
          <strong>Cobro</strong>
          Necesita atención
        </span>
        <em>Decidir</em>
      </div>
    </div>
  );
}

function BetaDetail({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: ReactNode;
}) {
  return (
    <article>
      <Icon aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </article>
  );
}
