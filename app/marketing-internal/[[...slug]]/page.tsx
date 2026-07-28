import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  FileCheck2,
  HardHat,
  LockKeyhole,
  MessageSquareText,
  ReceiptText,
  Route,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wrench,
} from "lucide-react";
import { LaunchContactForm } from "@/components/marketing/launch-contact-form";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { getLegalConfiguration } from "@/lib/marketing/legal";

const MARKETING_URL = "https://orqenatech.com";
const APP_URL = "https://app.orqenatech.com";

type PageParams = { slug?: string[] };
type PageDefinition = { title: string; description: string };

const pages: Record<string, PageDefinition> = {
  "/": {
    title: "Orqena Tech — Capataz para organizar el trabajo real",
    description: "Capataz conecta clientes, trabajo, documentos y control económico con confirmación humana.",
  },
  "/capataz": {
    title: "Capataz",
    description: "El producto de Orqena Tech para mantener clientes, trabajos, documentos y dinero en contexto.",
  },
  "/funcionalidades": {
    title: "Funcionalidades",
    description: "Las capacidades actuales de Capataz explicadas sin promesas ni cifras inventadas.",
  },
  "/para-autonomos": {
    title: "Capataz para autónomos",
    description: "Una forma práctica de conservar contexto, documentos y próximos pasos sin duplicar trabajo.",
  },
  "/para-empresas": {
    title: "Capataz para empresas",
    description: "Coordinación por responsabilidades, permisos y empresa activa.",
  },
  "/precios": {
    title: "Planes y precios",
    description: "Planes preparados para la futura activación de billing, sin importes ni cobros inventados.",
  },
  "/contacto": {
    title: "Contacto",
    description: "Contacta con Orqena Tech para información, acceso anticipado, soporte o privacidad.",
  },
  "/legal/aviso-legal": { title: "Aviso legal", description: "Información legal disponible de Orqena Tech." },
  "/legal/privacidad": { title: "Privacidad", description: "Información sobre el tratamiento de datos en Orqena Tech y Capataz." },
  "/legal/cookies": { title: "Cookies", description: "Información sobre cookies y almacenamiento técnico." },
  "/legal/terminos": { title: "Términos", description: "Condiciones de uso disponibles para Capataz." },
  "/estado": { title: "Estado del servicio", description: "Estado básico de disponibilidad de Capataz." },
};

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const pathname = pathFromSlug((await params).slug);
  const page = pages[pathname];
  if (!page) return {};
  const canonical = `${MARKETING_URL}${pathname === "/" ? "" : pathname}`;
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "Orqena Tech",
      title: page.title,
      description: page.description,
      images: [{ url: `${MARKETING_URL}/brand/social-card.svg`, width: 1200, height: 630, alt: "Orqena Tech y Capataz" }],
    },
  };
}

export default async function LaunchMarketingRoute({ params }: { params: Promise<PageParams> }) {
  const pathname = pathFromSlug((await params).slug);
  if (!pages[pathname]) notFound();

  if (pathname === "/") return <HomePage />;
  if (pathname === "/capataz") return <ProductPage />;
  if (pathname === "/funcionalidades") return <FeaturesPage />;
  if (pathname === "/para-autonomos") return <AudiencePage kind="self-employed" />;
  if (pathname === "/para-empresas") return <AudiencePage kind="company" />;
  if (pathname === "/precios") return <PricingPage />;
  if (pathname === "/contacto") return <ContactPage />;
  if (pathname === "/estado") return <StatusPage />;
  if (pathname.startsWith("/legal/")) return <LegalPage kind={pathname.slice("/legal/".length)} />;
  notFound();
}

function HomePage() {
  const legal = getLegalConfiguration();
  const structuredData = [
    legal.entityName ? { "@type": "Organization", name: legal.entityName, url: MARKETING_URL } : null,
    { "@type": "SoftwareApplication", name: "Capataz", applicationCategory: "BusinessApplication", operatingSystem: "Web", url: `${MARKETING_URL}/capataz` },
  ].filter(Boolean);
  return (
    <MarketingPage>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": structuredData }) }} />
      <section className="launch-hero">
        <div className="marketing-container launch-hero-grid">
          <div>
            <p className="marketing-eyebrow">Capataz, by Orqena</p>
            <h1>El trabajo real, conectado de principio a fin.</h1>
            <p className="launch-lede">Clientes, trabajos, documentos, agenda y control económico comparten contexto. Capataz prepara; tú revisas y confirmas.</p>
            <div className="launch-actions">
              <a className="marketing-button" href={`${APP_URL}/login`}>Acceder a Capataz <ArrowRight size={18} /></a>
              <a className="marketing-outline-button" href={`${APP_URL}/registro`}>Solicitar alta</a>
            </div>
            <small>Acceso por invitación o disponibilidad configurada en la aplicación.</small>
          </div>
          <div className="launch-hero-panel" aria-label="Flujo conectado de Capataz">
            <div><UsersRound /><span><strong>Cliente</strong><small>Historia y siguiente paso</small></span></div>
            <div><HardHat /><span><strong>Trabajo</strong><small>Equipo, agenda y avance</small></span></div>
            <div><FileCheck2 /><span><strong>Documento</strong><small>Origen y relación visibles</small></span></div>
            <div><ReceiptText /><span><strong>Control económico</strong><small>Importes registrados, no inventados</small></span></div>
          </div>
        </div>
      </section>
      <Principles />
      <section className="marketing-container launch-section">
        <SectionHeading eyebrow="Capataz" title="Una sola operación, sin reconstruir el contexto en cada pantalla." description="La información se relaciona por empresa, responsabilidad y permiso. Las acciones sensibles siguen bajo confirmación humana." />
        <div className="launch-feature-grid">
          <Feature icon={Route} title="Recorrido conectado" text="Cliente, oportunidad, trabajo, documento y cobro conservan sus relaciones." />
          <Feature icon={ShieldCheck} title="Empresa aislada" text="El contexto activo y los permisos se comprueban en el servidor." />
          <Feature icon={Sparkles} title="Asistencia controlada" text="Capataz propone y explica fuentes antes de una acción sensible." />
        </div>
      </section>
      <AudienceBand />
      <FinalCta />
    </MarketingPage>
  );
}

function ProductPage() {
  return (
    <MarketingPage>
      <PageHero eyebrow="Producto" title="Capataz mantiene cada decisión cerca de su origen." description="Un sistema de trabajo para organizar relaciones, ejecución, documentos y control económico sin perder trazabilidad." />
      <section className="marketing-container launch-section">
        <div className="launch-story-grid">
          <Story number="01" title="Captura" text="Registra información desde formularios, documentos y actividad del equipo." />
          <Story number="02" title="Relaciona" text="Cada elemento queda vinculado a la empresa, cliente, trabajo y responsable correctos." />
          <Story number="03" title="Decide" text="Los estados y fuentes ayudan a revisar; el usuario conserva la confirmación final." />
          <Story number="04" title="Continúa" text="Agenda, tareas, documentos y dinero mantienen el hilo de trabajo." />
        </div>
      </section>
      <FinalCta />
    </MarketingPage>
  );
}

function FeaturesPage() {
  const items = [
    ["Clientes y relaciones", "Actividad, contactos, oportunidades y próximos pasos en contexto.", UsersRound],
    ["Trabajo y agenda", "Hitos, responsables, tareas, incidencias y calendario relacionados.", HardHat],
    ["Documentos", "Archivos privados vinculados a su empresa y origen operativo.", FileCheck2],
    ["Ventas y compras", "Presupuestos, facturas emitidas y recibidas con trazabilidad.", ReceiptText],
    ["Tesorería", "Cobros, pagos y previsión derivados de documentos registrados.", Building2],
    ["Capataz", "Consulta y propuesta asistida con confirmación para acciones sensibles.", Sparkles],
  ] as const;
  return (
    <MarketingPage>
      <PageHero eyebrow="Funcionalidades" title="Capacidades conectadas, con límites explícitos." description="Capataz no inventa saldos, progreso ni previsiones. Cada cifra y estado parte de información registrada." />
      <section className="marketing-container launch-section">
        <div className="launch-feature-grid launch-feature-grid--wide">
          {items.map(([title, text, Icon]) => <Feature key={title} icon={Icon} title={title} text={text} />)}
        </div>
      </section>
      <FinalCta />
    </MarketingPage>
  );
}

function AudiencePage({ kind }: { kind: "self-employed" | "company" }) {
  const selfEmployed = kind === "self-employed";
  const points = selfEmployed
    ? ["Un lugar para clientes, trabajos y documentos", "Próximos pasos visibles", "Control económico basado en registros", "Acceso web y experiencia móvil"]
    : ["Portales según responsabilidad", "Permisos y alcances por empresa", "Actividad y auditoría", "Clientes, trabajos y finanzas conectados"];
  return (
    <MarketingPage>
      <PageHero
        eyebrow={selfEmployed ? "Para autónomos" : "Para empresas"}
        title={selfEmployed ? "Menos tiempo reconstruyendo qué pasó." : "Cada persona ve lo necesario para hacer avanzar el trabajo."}
        description={selfEmployed ? "Capataz reúne operación y contexto para que puedas continuar sin depender de notas dispersas." : "Dirección, comercial, compras, finanzas y ejecución trabajan sobre relaciones comunes con accesos diferenciados."}
      />
      <section className="marketing-container launch-section">
        <div className="launch-audience-card">
          <div><Wrench /><h2>{selfEmployed ? "Operación clara" : "Coordinación responsable"}</h2></div>
          <ul>{points.map((point) => <li key={point}><Check size={17} />{point}</li>)}</ul>
        </div>
      </section>
      <FinalCta />
    </MarketingPage>
  );
}

function PricingPage() {
  const billingEnabled = process.env.BILLING_ENABLED === "true";
  const plans = [
    ["STARTER", "Starter", "Para empezar con la operación diaria."],
    ["PROFESSIONAL", "Professional", "Para equipos que coordinan toda la actividad."],
    ["BUSINESS", "Business", "Para empresas con necesidades de control avanzado."],
  ] as const;
  return (
    <MarketingPage>
      <PageHero eyebrow="Planes" title="Preparados para elegir por capacidad, no por cifras inventadas." description="La contratación online permanece desactivada hasta que precios, impuestos y configuración Stripe estén aprobados." />
      <section className="marketing-container launch-section">
        <div className="launch-pricing-grid" data-billing-enabled={String(billingEnabled)}>
          {plans.map(([key, name, description]) => (
            <article key={key}>
              <p className="marketing-eyebrow">{key}</p>
              <h2>{name}</h2>
              <p>{description}</p>
              <strong>{billingEnabled ? "Configuración disponible en la aplicación" : "Acceso anticipado"}</strong>
              <button type="button" disabled={!billingEnabled}>{billingEnabled ? "Continuar en Capataz" : "Cobro no disponible"}</button>
            </article>
          ))}
        </div>
        <p className="launch-pricing-note">No se muestran importes porque todavía no existe una configuración comercial aprobada. Stripe y la factura fiscal son procesos separados.</p>
      </section>
    </MarketingPage>
  );
}

function ContactPage() {
  return (
    <MarketingPage>
      <section className="marketing-container launch-contact-layout">
        <div>
          <p className="marketing-eyebrow">Contacto</p>
          <h1>Cuéntanos qué necesitas ordenar.</h1>
          <p>El formulario envía la solicitud a hola@orqenatech.com cuando Resend está configurado. No incluyas contraseñas, tokens ni datos especialmente sensibles.</p>
          <a href="mailto:hola@orqenatech.com">hola@orqenatech.com</a>
        </div>
        <LaunchContactForm />
      </section>
    </MarketingPage>
  );
}

function LegalPage({ kind }: { kind: string }) {
  const legal = getLegalConfiguration();
  const content = legalContent(kind, legal);
  if (!content) notFound();
  return (
    <MarketingPage>
      <section className="marketing-container launch-legal">
        <p className="marketing-eyebrow">Información legal</p>
        <h1>{content.title}</h1>
        {legal.missing.length ? <div className="launch-config-notice">Parte de la información jurídica está pendiente de configuración. No se muestran datos ficticios.</div> : null}
        <div className="launch-legal-card">
          {content.blocks.map((block) => <section key={block.title}><h2>{block.title}</h2><p>{block.text}</p></section>)}
        </div>
      </section>
    </MarketingPage>
  );
}

function StatusPage() {
  return (
    <MarketingPage>
      <section className="marketing-container launch-status">
        <BadgeCheck size={42} />
        <p className="marketing-eyebrow">Estado</p>
        <h1>La web y el proceso de Capataz responden.</h1>
        <p>Este control confirma disponibilidad básica del proceso. No consulta proveedores externos en cada petición.</p>
        <a href={`${APP_URL}/api/health`}>Ver healthcheck técnico</a>
      </section>
    </MarketingPage>
  );
}

function Principles() {
  return (
    <section className="launch-principles" aria-label="Principios de Capataz">
      <div className="marketing-container">
        <span><LockKeyhole />Sesión host-only</span>
        <span><ShieldCheck />Aislamiento por empresa</span>
        <span><MessageSquareText />Confirmación humana</span>
        <span><FileCheck2 />Trazabilidad real</span>
      </div>
    </section>
  );
}

function AudienceBand() {
  return (
    <section className="launch-audience-band">
      <div className="marketing-container">
        <Link href="/para-autonomos"><span>Para autónomos</span><strong>Conservar el hilo sin añadir más herramientas.</strong><ArrowRight /></Link>
        <Link href="/para-empresas"><span>Para empresas</span><strong>Coordinar responsabilidades sin mezclar accesos.</strong><ArrowRight /></Link>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="marketing-container launch-final-cta">
      <div><p className="marketing-eyebrow">Capataz, by Orqena</p><h2>Accede a la aplicación en su dominio privado.</h2></div>
      <a className="marketing-button" href={`${APP_URL}/login`}>Acceder a Capataz <ArrowRight size={18} /></a>
    </section>
  );
}

function PageHero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <section className="launch-page-hero"><div className="marketing-container"><p className="marketing-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div></section>;
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="launch-section-heading"><p className="marketing-eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>;
}

function Feature({ icon: Icon, title, text }: { icon: typeof Route; title: string; text: string }) {
  return <article className="launch-feature"><Icon /><h3>{title}</h3><p>{text}</p></article>;
}

function Story({ number, title, text }: { number: string; title: string; text: string }) {
  return <article><span>{number}</span><h2>{title}</h2><p>{text}</p></article>;
}

function legalContent(kind: string, legal: ReturnType<typeof getLegalConfiguration>) {
  const entity = legal.entityName ?? "La entidad responsable (pendiente de configuración)";
  const contact = legal.contactEmail ?? "el correo legal pendiente de configuración";
  const privacy = legal.privacyEmail ?? "el correo de privacidad pendiente de configuración";
  const identification = [
    legal.entityName,
    legal.taxId ? `NIF/CIF: ${legal.taxId}` : null,
    legal.address,
    legal.registryDetails,
  ].filter(Boolean).join(" · ") || "Datos identificativos pendientes de configuración.";
  if (kind === "aviso-legal") return { title: "Aviso legal", blocks: [
    { title: "Titular", text: identification },
    { title: "Contacto", text: legal.contactEmail ?? "Correo legal pendiente de configuración." },
    { title: "Uso", text: "El acceso y uso de este sitio debe respetar la legislación aplicable y los derechos de terceros." },
  ] };
  if (kind === "privacidad") return { title: "Política de privacidad", blocks: [
    { title: "Responsable", text: `${entity}. Contacto: ${privacy}.` },
    { title: "Finalidad", text: "Los datos enviados mediante el formulario se usan para responder a la solicitud y conservar trazabilidad de la comunicación." },
    { title: "Derechos", text: `Puedes solicitar acceso, rectificación o supresión mediante ${privacy}.` },
    { title: "Proveedores", text: "El servicio puede usar proveedores necesarios para alojamiento, almacenamiento y correo transaccional cuando estén configurados." },
  ] };
  if (kind === "cookies") return { title: "Política de cookies", blocks: [
    { title: "Sitio público", text: "La web pública no activa cookies publicitarias ni seguimiento de aperturas o clics." },
    { title: "Aplicación", text: "Capataz usa una cookie técnica host-only para mantener la sesión en app.orqenatech.com." },
    { title: "Control", text: "Puedes borrar el almacenamiento técnico desde los ajustes del navegador; algunas funciones requerirán iniciar sesión de nuevo." },
  ] };
  if (kind === "terminos") return { title: "Términos de uso", blocks: [
    { title: "Servicio", text: "Capataz es una herramienta de gestión y asistencia. La persona usuaria debe revisar los datos y confirmar las acciones sensibles." },
    { title: "Documentos y cifras", text: "Los documentos y cálculos dependen de la información registrada. Capataz no sustituye asesoramiento fiscal, jurídico o profesional." },
    { title: "Contacto", text: `Las consultas sobre estas condiciones se atienden mediante ${contact}.` },
  ] };
  return null;
}

function pathFromSlug(slug?: string[]) {
  return slug?.length ? `/${slug.join("/")}` : "/";
}
