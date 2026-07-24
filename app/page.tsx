import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  Check,
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
  Client360Demo,
  ContextualAgendaDemo,
  HeroProductOrchestra,
  MobileWorkDemo,
  OrqenaActionDemo,
  RolePortalStudio,
  SalesQuoteStudioDemo,
  TreasuryFlowDemo,
  Work360Demo,
} from "@/components/marketing/product-scenes";
import { brand } from "@/lib/brand";
import { marketingProductCatalog, marketingSectorCatalog } from "@/lib/marketing/catalog";

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

const valueItems = [
  [Globe2, "Adaptado a tu sector"],
  [UsersRound, "Un portal para cada persona"],
  [ShieldCheck, "Acciones bajo confirmación"],
  [FileLock2, "Chats privados"],
  [Smartphone, "Web y móvil"],
] as const;

const workflow = ["Cliente", "Presupuesto", "Trabajo", "Factura", "Cobro"] as const;

const stories = [
  {
    eyebrow: "Controla el día",
    title: "Una agenda que no te obliga a reconstruir el contexto.",
    problem: "Una cita aislada no explica con quién, para qué trabajo ni qué debe ocurrir después.",
    result: "Cliente, trabajo, contacto y responsable se mantienen relacionados.",
    benefits: ["Día, semana y lista", "Creación contextual", "Filtros que permanecen"],
    href: "/producto/agenda",
    scene: <ContextualAgendaDemo />,
  },
  {
    eyebrow: "Convierte una oportunidad",
    title: "De una conversación a una propuesta lista para decidir.",
    problem: "Las versiones y aprobaciones dispersas ralentizan la venta.",
    result: "La propuesta conserva cliente, partidas, estado y actividad.",
    benefits: ["Precio de venta claro", "Aprobación visible", "Sin exponer márgenes restringidos"],
    href: "/producto/ventas",
    scene: <SalesQuoteStudioDemo />,
  },
  {
    eyebrow: "Controla compras y finanzas",
    title: "Cada movimiento conserva la explicación que necesita.",
    problem: "Una cifra aislada no muestra su documento, vencimiento ni decisión.",
    result: "Entradas, salidas y previsión se leen desde su origen.",
    benefits: ["Vencimientos", "Trazabilidad documental", "Previsión explicada"],
    href: "/producto/finanzas",
    scene: <TreasuryFlowDemo />,
  },
] as const;

export default function LandingPage() {
  const sectors = marketingSectorCatalog.filter((sector) =>
    ["servicios-profesionales", "taller-reparacion", "educacion-formacion", "hosteleria", "construccion", "consultoria"].includes(sector.slug),
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
              {
                "@type": "SoftwareApplication",
                name: brand.productName,
                applicationCategory: "BusinessApplication",
                operatingSystem: "Web",
                description: brand.metadata.description,
              },
            ],
          }),
        }}
      />

      <section className="v4-hero">
        <div className="marketing-container v4-hero__layout">
          <div className="v4-hero__copy">
            <p className="marketing-eyebrow">Plataforma de gestión multisector</p>
            <h1>Tu negocio se mueve.<br /><span>Orqena lo mantiene conectado.</span></h1>
            <p>
              Clientes, trabajo, ventas, compras, agenda y finanzas comparten el mismo hilo.
              Cada persona entra en un portal centrado en lo que necesita para avanzar.
            </p>
            <div className="v4-hero__actions">
              <Link href="/demo" className="marketing-button">
                Solicitar acceso <ArrowRight size={18} />
              </Link>
              <Link href="/producto" className="marketing-outline-button">Explorar el producto</Link>
            </div>
            <small>Beta privada con acceso por invitación. Sin registro público.</small>
          </div>
          <div className="v4-hero__scene">
            <HeroProductOrchestra />
            <div className="v4-hero__signal"><BrandMark /><span><strong>Orqena prepara</strong> Tú revisas y confirmas.</span></div>
          </div>
        </div>
      </section>

      <section className="value-band" aria-label="Principios de Orqena">
        <div className="marketing-container">
          {valueItems.map(([Icon, label]) => <span key={label}><Icon size={18} /><strong>{label}</strong></span>)}
        </div>
      </section>

      <section className="marketing-container v4-section v4-flow">
        <div className="v4-section__intro">
          <p className="marketing-eyebrow">El flujo del negocio</p>
          <h2 className="marketing-title">Una relación completa. Cinco momentos conectados.</h2>
          <p className="marketing-lede">El contexto no se reinicia cuando cambia el área. Acompaña la actividad desde el primer contacto hasta el resultado.</p>
        </div>
        <ol>
          {workflow.map((item, index) => (
            <li key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item}</strong>
              {index < workflow.length - 1 ? <ArrowRight aria-hidden="true" /> : <Check aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </section>

      <section className="v4-stories" aria-labelledby="stories-title">
        <div className="marketing-container v4-section">
          <div className="v4-section__intro">
            <p className="marketing-eyebrow">Historias de producto</p>
            <h2 id="stories-title" className="marketing-title">Menos módulos aislados. Más recorridos que se entienden.</h2>
          </div>
          <div className="v4-stories__list">
            {stories.map((story, index) => (
              <article key={story.title} className="v4-story">
                <div className="v4-story__copy">
                  <span>{story.eyebrow}</span>
                  <h3>{story.title}</h3>
                  <p><strong>Antes:</strong> {story.problem}</p>
                  <p><strong>Con Orqena:</strong> {story.result}</p>
                  <ul>{story.benefits.map((benefit) => <li key={benefit}><Check size={16} />{benefit}</li>)}</ul>
                  <Link href={story.href}>Ver detalle <ArrowRight size={16} /></Link>
                </div>
                <div className={index % 2 ? "v4-story__scene is-reversed" : "v4-story__scene"}>{story.scene}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <FeatureScene
        eyebrow="Cliente 360"
        title="Toda la relación cabe en una vista que ayuda a decidir."
        description="Resumen ejecutivo, próxima acción, rail comercial, actividad y documentos sin una página interminable."
        href="/producto/clientes"
      >
        <Client360Demo />
      </FeatureScene>

      <FeatureScene
        eyebrow="Portales por responsabilidad"
        title="No es el mismo panel con bloques escondidos."
        description="Propietario, Dirección, Comercial, Finanzas, Compras, Responsable y Empleado cambian navegación, prioridades y acciones."
        href="/producto/equipo"
        tone="blue"
      >
        <RolePortalStudio />
      </FeatureScene>

      <FeatureScene
        eyebrow="Orqena en acción"
        title="Una propuesta útil sigue esperando tu decisión."
        description="La demostración usa una secuencia determinista: petición, análisis, fuentes, propuesta, edición y confirmación o cancelación."
        href="/producto/orqena"
      >
        <OrqenaActionDemo />
      </FeatureScene>

      <FeatureScene
        eyebrow="Trabajo 360"
        title="Del plan a la entrega, el equipo ve el mismo avance."
        description="Hitos, tareas, incidencias, responsables, documentos y agenda forman una historia operativa legible."
        href="/producto/trabajo"
        tone="sand"
      >
        <Work360Demo />
      </FeatureScene>

      <FeatureScene
        eyebrow="Diseñado para móvil"
        title="El trabajo de campo no es un escritorio encogido."
        description="Una tarea muestra instrucciones, avance, evidencia sintética y cierre con una acción clara para la mano."
        href="/producto/movil"
        tone="dark"
      >
        <MobileWorkDemo />
      </FeatureScene>

      <section className="marketing-container v4-section">
        <div className="v4-section__intro">
          <p className="marketing-eyebrow">Una plataforma horizontal</p>
          <h2 className="marketing-title">El sector cambia el lenguaje. No cambia la claridad.</h2>
          <p className="marketing-lede">Estas escenas son ejemplos de configuración, no clientes ni casos de éxito.</p>
        </div>
        <div className="v4-sector-grid">
          {sectors.map((sector, index) => (
            <Link key={sector.slug} href={`/sectores/${sector.slug}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{sector.name}</h3>
              <p>{sector.lead}</p>
              <i>{sector.terminology.workPlural} · {sector.terminology.owner}</i>
              <ArrowRight size={17} />
            </Link>
          ))}
        </div>
        <Link className="marketing-text-link v4-inline-link" href="/sectores">Ver los trece perfiles sectoriales <ArrowRight size={17} /></Link>
      </section>

      <section className="v4-control">
        <div className="marketing-container v4-control__layout">
          <div>
            <p className="marketing-eyebrow">Privacidad y control</p>
            <h2 className="marketing-title">Cada empresa, cada conversación y cada permiso, en su sitio.</h2>
            <p>La interfaz explica el acceso sin exponer información de otros portales. Las acciones sensibles esperan una confirmación explícita.</p>
            <Link href="/seguridad">Conocer el enfoque <ArrowRight size={16} /></Link>
          </div>
          <div className="v4-control__items">
            {[
              [LockKeyhole, "Aislamiento por empresa", "El contexto activo se comprueba antes de mostrar datos."],
              [UsersRound, "Portal por persona", "La navegación refleja la responsabilidad asignada."],
              [Sparkles, "Confirmación humana", "Orqena propone; la persona autorizada decide."],
            ].map(([Icon, title, text]) => {
              const ItemIcon = Icon as typeof LockKeyhole;
              return <article key={title as string}><ItemIcon /><div><h3>{title as string}</h3><p>{text as string}</p></div></article>;
            })}
          </div>
        </div>
      </section>

      <section className="marketing-container v4-section">
        <div className="v4-plans">
          <div>
            <p className="marketing-eyebrow">Planes reales</p>
            <h2 className="marketing-title">Capacidades y límites explicados sin inventar precios.</h2>
            <p>El catálogo actual muestra para quién es cada plan y qué incluye. Las condiciones comerciales se comunicarán cuando estén definidas.</p>
          </div>
          <div>
            {marketingProductCatalog.slice(0, 4).map((item) => <span key={item.slug}><Layers3 size={16} />{item.name}</span>)}
            <Link href="/planes" className="marketing-button">Comparar capacidades <ArrowRight size={17} /></Link>
          </div>
        </div>
      </section>

      <section className="v4-faq">
        <div className="marketing-container v4-faq__layout">
          <div><p className="marketing-eyebrow">Preguntas frecuentes</p><h2 className="marketing-title">Lo importante, dicho de frente.</h2></div>
          <div>
            {[
              ["¿Orqena está pensada para un único sector?", "No. La base es horizontal y la configuración adapta vocabulario, ejemplos y prioridades."],
              ["¿Puedo registrarme libremente?", "No. La beta privada mantiene el registro público desactivado y trabaja con invitaciones y solicitudes de acceso."],
              ["¿Orqena ejecuta acciones sin preguntar?", "Las acciones sensibles se presentan como propuesta y requieren confirmación de una persona autorizada."],
              ["¿La demo usa datos reales?", "No. Las escenas públicas son demostraciones sintéticas identificadas como tales."],
            ].map(([question, answer]) => (
              <details key={question}><summary>{question}<ChevronDown size={18} /></summary><p>{answer}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="v4-final">
        <div className="marketing-container">
          <CalendarCheck2 />
          <p className="marketing-eyebrow">Un siguiente paso concreto</p>
          <h2>Conoce Orqena desde el sector y el portal que te importan.</h2>
          <p>Explora la demostración por tu cuenta o solicita una conversación para revisar el recorrido de tu equipo.</p>
          <div>
            <Link href="/demo" className="marketing-button marketing-button--light">Explorar la demo <ArrowRight size={18} /></Link>
            <Link href="/contacto" className="v4-final__link">Hablar con el equipo</Link>
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}

function FeatureScene({
  eyebrow,
  title,
  description,
  href,
  children,
  tone = "base",
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  children: React.ReactNode;
  tone?: "base" | "blue" | "sand" | "dark";
}) {
  return (
    <section className={`v4-feature v4-feature--${tone}`}>
      <div className="marketing-container">
        <div className="v4-feature__intro">
          <p className="marketing-eyebrow">{eyebrow}</p>
          <h2 className="marketing-title">{title}</h2>
          <p>{description}</p>
          <Link href={href}>Explorar esta experiencia <ArrowRight size={16} /></Link>
        </div>
        <div>{children}</div>
      </div>
    </section>
  );
}
