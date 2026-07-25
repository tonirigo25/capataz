import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  ChevronDown,
  FileLock2,
  Globe2,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import {
  BusinessWorkflow,
  Client360Demo,
  ContextualAgendaDemo,
  HeroProductOrchestra,
  MobileWorkDemo,
  RolePortalStudio,
  SalesQuoteStudioDemo,
  TreasuryFlowDemo,
} from "@/components/marketing/product-scenes";
import { brand } from "@/lib/brand";
import { marketingSectorCatalog } from "@/lib/marketing/catalog";

export const metadata: Metadata = {
  title: "Orqena — Tu negocio, en orden.",
  description: "Clientes, trabajo, ventas, compras, agenda y finanzas conectados para cada persona de tu equipo.",
  keywords: ["gestión multisector", "clientes", "trabajo", "agenda", "operaciones"],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Orqena — Tu negocio, en orden.",
    description: "Una plataforma multisector que conecta el recorrido completo del negocio.",
    images: [{ url: brand.socialImage, width: 1200, height: 630, alt: "Orqena, tu negocio en orden" }],
  },
};

const values = [
  [Globe2, "Adaptado a tu sector", "El vocabulario encaja en tu actividad."],
  [UsersRound, "Un portal por persona", "Cada responsabilidad recibe foco propio."],
  [ShieldCheck, "Bajo confirmación", "Las decisiones sensibles esperan revisión."],
  [FileLock2, "Chats privados", "Cada conversación conserva su acceso."],
  [Smartphone, "Web y móvil", "El contexto continúa fuera del escritorio."],
] as const;

const stories = [
  {
    eyebrow: "Controla el día",
    title: "Agenda, prioridades y siguiente acción en una sola lectura.",
    copy: "Una actividad nace vinculada a cliente, trabajo, contacto y responsable; los filtros permanecen cuando vuelves.",
    href: "/producto/agenda",
    scene: <ContextualAgendaDemo />,
    className: "is-agenda",
  },
  {
    eyebrow: "Convierte una oportunidad",
    title: "De la relación a una propuesta que se puede decidir.",
    copy: "Cliente, partidas, precio de venta, aprobación y estado avanzan sin exponer información restringida.",
    href: "/producto/ventas",
    scene: <SalesQuoteStudioDemo />,
    className: "is-opportunity",
  },
  {
    eyebrow: "Controla compras y finanzas",
    title: "Cada movimiento conserva documento, fecha y origen.",
    copy: "Proveedor, factura, vencimiento, pago y tesorería explican la posición; no se inventan saldos ni previsiones.",
    href: "/producto/finanzas",
    scene: <TreasuryFlowDemo />,
    className: "is-finance",
  },
] as const;

export default function LandingPage() {
  const sectors = marketingSectorCatalog.filter((sector) =>
    ["construccion", "servicios-profesionales", "taller-reparacion", "hosteleria"].includes(sector.slug),
  );

  return (
    <MarketingPage>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              { "@type": "Organization", name: brand.legalName, url: brand.baseUrl, logo: brand.brandMark },
              { "@type": "SoftwareApplication", name: brand.productName, applicationCategory: "BusinessApplication", operatingSystem: "Web", description: brand.metadata.description },
            ],
          }),
        }}
      />

      <section className="v41-hero">
        <div className="marketing-container v41-hero__layout">
          <div className="v41-hero__copy">
            <p className="marketing-eyebrow">Gestión multisector conectada</p>
            <h1>Tu negocio avanza. <span>Todo conectado.</span></h1>
            <p>Clientes, trabajo y dinero comparten un mismo recorrido. Cada persona ve lo necesario para hacerlo avanzar.</p>
            <div className="v41-hero__actions">
              <Link href="/demo" className="marketing-button">Explorar la demo <ArrowRight size={18} /></Link>
              <Link href="/producto" className="marketing-outline-button">Ver el producto</Link>
            </div>
            <small>Beta privada · acceso por invitación o solicitud</small>
          </div>
          <div className="v41-hero__visual">
            <HeroProductOrchestra />
            <div className="v41-hero__signal"><BrandMark /><span><strong>Orqena prepara</strong>Tú revisas y confirmas.</span></div>
          </div>
        </div>
      </section>

      <section className="value-band value-band--v41" aria-label="Principios de Orqena">
        <div className="marketing-container">
          {values.map(([Icon, title, copy]) => <article key={title}><Icon size={19} /><span><strong>{title}</strong><small>{copy}</small></span></article>)}
        </div>
      </section>

      <section className="marketing-container v41-section" aria-labelledby="workflow-title">
        <div className="v41-section__intro">
          <p className="marketing-eyebrow">Un recorrido completo</p>
          <h2 id="workflow-title" className="marketing-title">Cinco momentos. Una relación que nunca se reinicia.</h2>
          <p className="marketing-lede">Actor, registro, estado, fecha y siguiente acción viajan con cada etapa.</p>
        </div>
        <BusinessWorkflow />
      </section>

      <section className="v41-stories" aria-labelledby="stories-title">
        <div className="marketing-container v41-section">
          <div className="v41-section__intro">
            <p className="marketing-eyebrow">Tres historias de producto</p>
            <h2 id="stories-title" className="marketing-title">Cada problema pide una forma visual distinta.</h2>
          </div>
          <div className="v41-stories__grid">
            {stories.map((story) => (
              <article key={story.title} className={`v41-story ${story.className}`}>
                <div className="v41-story__copy">
                  <span>{story.eyebrow}</span>
                  <h3>{story.title}</h3>
                  <p>{story.copy}</p>
                  <Link href={story.href}>Explorar la solución <ArrowRight size={16} /></Link>
                </div>
                <div className="v41-story__scene">{story.scene}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="v41-client" aria-labelledby="client-360-title">
        <div className="marketing-container v41-feature">
          <div>
            <p className="marketing-eyebrow">Cliente 360</p>
            <h2 id="client-360-title" className="marketing-title">La relación completa, sin una página interminable.</h2>
            <p>Resumen, rail comercial, actividad, trabajos, contactos y documentos. La economía aparece solo donde corresponde.</p>
            <Link href="/producto/clientes">Conocer Cliente 360 <ArrowRight size={16} /></Link>
          </div>
          <Client360Demo />
        </div>
      </section>

      <section className="v41-portals" aria-labelledby="portals-title">
        <div className="marketing-container v41-feature is-reversed">
          <div>
            <p className="marketing-eyebrow">Portales por responsabilidad</p>
            <h2 id="portals-title" className="marketing-title">No es el mismo panel con bloques escondidos.</h2>
            <p>Propietario, Dirección, Comercial, Finanzas, Compras, Responsable y Empleado cambian navegación, prioridad y acción principal.</p>
            <Link href="/producto/equipo">Comparar portales <ArrowRight size={16} /></Link>
          </div>
          <RolePortalStudio />
        </div>
      </section>

      <section className="marketing-container v41-section v41-mobile-sectors" aria-labelledby="mobile-sectors-title">
        <div className="v41-mobile-sectors__intro">
          <p className="marketing-eyebrow">En la mano y en tu sector</p>
          <h2 id="mobile-sectors-title" className="marketing-title">La tarea cambia de forma. El control permanece.</h2>
          <p>El móvil convierte instrucciones, avance y evidencia sintética en una secuencia clara; el sector adapta lenguaje y prioridades.</p>
          <div className="v41-sector-list">
            {sectors.map((sector, index) => (
              <Link href={`/sectores/${sector.slug}`} key={sector.slug}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{sector.name}</strong>
                <small>{sector.terminology.workPlural} · {sector.terminology.owner}</small>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
          <Link href="/sectores" className="marketing-text-link">Ver los trece sectores <ArrowRight size={16} /></Link>
        </div>
        <MobileWorkDemo />
      </section>

      <section className="v41-control" aria-labelledby="control-title">
        <div className="marketing-container v41-control__layout">
          <div>
            <p className="marketing-eyebrow">Control comprensible</p>
            <h2 id="control-title" className="marketing-title">Seguridad visible. Planes sin cifras inventadas.</h2>
            <p>Empresa, conversación y permisos conservan su contexto. El catálogo explica capacidades y límites mientras el precio público sigue desactivado.</p>
            <div><Link href="/seguridad" className="marketing-outline-button">Ver seguridad</Link><Link href="/planes" className="marketing-button">Comparar planes <ArrowRight size={16} /></Link></div>
          </div>
          <div className="v41-control__visual">
            {[
              [LockKeyhole, "Empresa aislada", "Contexto activo comprobado"],
              [UsersRound, "Portal por persona", "Acceso según responsabilidad"],
              [Sparkles, "Confirmación humana", "Propuesta antes de acción"],
              [Layers3, "Límites explícitos", "Uso y sobreuso explicados"],
            ].map(([Icon, title, copy]) => {
              const ItemIcon = Icon as typeof LockKeyhole;
              return <article key={title as string}><ItemIcon /><span><strong>{title as string}</strong><small>{copy as string}</small></span></article>;
            })}
          </div>
        </div>
      </section>

      <section className="v41-close">
        <div className="marketing-container v41-close__layout">
          <div className="v41-faq">
            <p className="marketing-eyebrow">Antes de empezar</p>
            <h2 className="marketing-title">Lo importante, sin letra pequeña.</h2>
            {[
              ["Producto", "¿Orqena sirve para más de un sector?", "Sí. La base es horizontal y el perfil adapta terminología y prioridades."],
              ["Equipo", "¿Todos ven lo mismo?", "No. Cada portal refleja la responsabilidad y los accesos asignados."],
              ["IA", "¿Orqena actúa sin preguntar?", "Las acciones sensibles se presentan para revisión y confirmación."],
              ["Beta", "¿Puedo crear una cuenta libremente?", "No. La beta privada funciona mediante invitación o solicitud de acceso."],
            ].map(([category, question, answer]) => (
              <details key={question}><summary><span><small>{category}</small>{question}</span><ChevronDown size={18} /></summary><p>{answer}</p></details>
            ))}
          </div>
          <div className="v41-final">
            <CalendarCheck2 />
            <p className="marketing-eyebrow">Demo guiada por ti</p>
            <h2>Elige sector, perfil y objetivo. Recorre Orqena sin registrarte.</h2>
            <p>Datos sintéticos, sin OpenAI real y sin escrituras empresariales.</p>
            <div><Link href="/demo" className="marketing-button marketing-button--light">Explorar la demo <ArrowRight size={18} /></Link><Link href="/login">Entrar</Link></div>
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
