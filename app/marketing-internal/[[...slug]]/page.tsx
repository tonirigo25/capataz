import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  FileCheck2,
  HardHat,
  ReceiptText,
  Sparkles,
  UsersRound,
  Wrench,
} from "lucide-react";
import { LaunchContactForm } from "@/components/marketing/launch-contact-form";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { PublicCTA, PublicFeatureGrid, PublicPageHero, PublicProductPreview, PublicSection } from "@/components/marketing/public-ui";
import { getLegalConfiguration } from "@/lib/marketing/legal";
import { HeroDemo } from "@/app/marketing-v2/_components/hero-demo";
import { LandingSections, MarketingFooter as FieldOsMarketingFooter } from "@/app/marketing-v2/_components/landing-sections";
import { MarketingHeader as FieldOsMarketingHeader } from "@/app/marketing-v2/_components/marketing-header";
import fieldOsStyles from "@/app/marketing-v2/page.module.css";

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
    <div className={fieldOsStyles.page} id="top">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": structuredData }) }} />
      <a className={fieldOsStyles.skipLink} href="#main-content">Saltar al contenido</a>
      <FieldOsMarketingHeader />
      <main id="main-content" className={fieldOsStyles.mainContent} tabIndex={-1}>
        <HeroDemo />
        <LandingSections />
      </main>
      <FieldOsMarketingFooter />
    </div>
  );
}

function ProductPage() {
  return (
    <MarketingPage>
      <PublicPageHero eyebrow="Producto" title="Capataz mantiene cada decisión cerca de su origen." description="Clientes, ejecución, documentos y control económico comparten el mismo contexto, sin reconstruir lo que pasó." actions={<><a href="/demo">Explorar la demo <ArrowRight size={16} /></a><a href="/contacto?motivo=demo">Solicitar acceso</a></>} visual={<PublicProductPreview title="Hoy · Control operativo" state="Actualizado" metrics={[["Ingresos", "48.200 €"], ["Margen", "28,4 %"], ["Pendientes", "7"]]} />} />
      <PublicSection eyebrow="Un recorrido conectado" title="Cuatro pasos. Un único hilo." description="La información entra una vez y reaparece donde ayuda a avanzar.">
        <div className="launch-story-grid">
          <Story number="01" title="Captura" text="Registra información desde formularios, documentos y actividad del equipo." />
          <Story number="02" title="Relaciona" text="Cada elemento queda vinculado a la empresa, cliente, trabajo y responsable correctos." />
          <Story number="03" title="Decide" text="Los estados y fuentes ayudan a revisar; el usuario conserva la confirmación final." />
          <Story number="04" title="Continúa" text="Agenda, tareas, documentos y dinero mantienen el hilo de trabajo." />
        </div>
      </PublicSection>
      <PublicCTA />
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
      <PublicPageHero eyebrow="Funcionalidades" title="Capacidades conectadas, con límites explícitos." description="Capataz no inventa saldos, progreso ni previsiones. Cada cifra y estado parte de información registrada." />
      <PublicSection eyebrow="Áreas del producto" title="La misma verdad operativa, en cada función.">
        <PublicFeatureGrid items={items.map(([title, text, icon]) => ({ title, text, icon }))} />
      </PublicSection>
      <PublicCTA />
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
      <PublicPageHero
        eyebrow={selfEmployed ? "Para autónomos" : "Para empresas"}
        title={selfEmployed ? "Menos tiempo reconstruyendo qué pasó." : "Cada persona ve lo necesario para hacer avanzar el trabajo."}
        description={selfEmployed ? "Capataz reúne operación y contexto para que puedas continuar sin depender de notas dispersas." : "Dirección, comercial, compras, finanzas y ejecución trabajan sobre relaciones comunes con accesos diferenciados."}
      />
      <PublicSection eyebrow="Una experiencia enfocada" title={selfEmployed ? "Lo necesario para avanzar cada día." : "Coordinación sin perder responsabilidad."}>
        <div className="launch-audience-card">
          <div><Wrench /><h2>{selfEmployed ? "Operación clara" : "Coordinación responsable"}</h2></div>
          <ul>{points.map((point) => <li key={point}><Check size={17} />{point}</li>)}</ul>
        </div>
      </PublicSection>
      <PublicCTA />
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
      <PublicPageHero eyebrow="Planes" title="Preparados para elegir por capacidad, sin activar cobros." description="La contratación online permanece desactivada. Puedes comparar el encaje y solicitar una demo controlada." />
      <PublicSection eyebrow="Acceso controlado" title="Tres niveles para tres ritmos de operación.">
        <div className="launch-pricing-grid" data-billing-enabled={String(billingEnabled)}>
          {plans.map(([key, name, description]) => (
            <article key={key}>
              <p className="marketing-eyebrow">{key}</p>
              <h2>{name}</h2>
              <p>{description}</p>
              <strong>{billingEnabled ? "Configuración disponible en la aplicación" : "Acceso anticipado"}</strong>
              {billingEnabled ? <a href={`${APP_URL}/billing`}>Continuar en Capataz</a> : <a href="/contacto?motivo=planes">Consultar disponibilidad</a>}
            </article>
          ))}
        </div>
        <p className="launch-pricing-note">No se muestran importes porque todavía no existe una configuración comercial aprobada. Stripe y la factura fiscal son procesos separados.</p>
      </PublicSection>
    </MarketingPage>
  );
}

function ContactPage() {
  return (
    <MarketingPage>
      <PublicPageHero eyebrow="Contacto" title="Cuéntanos qué necesitas ordenar." description="Responderemos personalmente. No incluyas contraseñas, tokens ni datos especialmente sensibles." />
      <PublicSection eyebrow="Solicitud privada" title="Prepara tu demo o consulta.">
      <div className="launch-contact-layout">
        <div>
          <p>El formulario envía la solicitud al equipo de Orqena. Usaremos los datos únicamente para responder y preparar el siguiente paso.</p>
          <a href="mailto:hola@orqenatech.com">hola@orqenatech.com</a>
        </div>
        <LaunchContactForm />
      </div>
      </PublicSection>
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
      <PublicPageHero eyebrow="Estado" title="La web y Capataz responden." description="Disponibilidad básica confirmada. El control técnico se publica por separado y no expone datos de clientes." visual={<PublicProductPreview title="Servicios de Orqena" state="Operativo" metrics={[["Web", "OK"], ["Aplicación", "OK"], ["Datos", "Protegidos"]]}><a href={`${APP_URL}/api/health`}>Ver healthcheck técnico</a></PublicProductPreview>} />
    </MarketingPage>
  );
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
