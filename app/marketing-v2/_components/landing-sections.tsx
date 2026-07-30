import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Building2,
  FileText,
  ScanText,
  ShieldCheck,
  TrendingUp,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { ImmersiveJourney } from "./immersive-journey";
import { PublicFlowShowcase } from "./public-flow-showcase";
import styles from "./public-home.module.css";
import { brand } from "@/lib/brand";

const capabilityCards: ReadonlyArray<{
  id: string;
  aliases: readonly string[];
  eyebrow: string;
  title: string;
  text: string;
  icon: LucideIcon;
  proof: string;
}> = [
  {
    id: "clientes-y-ventas",
    aliases: ["presupuestos"],
    eyebrow: "Comercial",
    title: "Del contacto al presupuesto",
    text: "Cliente, visita, seguimiento y propuesta conservan la misma historia.",
    icon: Users,
    proof: "Pipeline y próximos pasos visibles",
  },
  {
    id: "trabajo-y-obra",
    aliases: ["equipo-y-agenda"],
    eyebrow: "Operación",
    title: "La obra avanza con contexto",
    text: "Equipo, hitos, tareas, materiales e incidencias dentro del trabajo correcto.",
    icon: BriefcaseBusiness,
    proof: "Progreso y responsables coordinados",
  },
  {
    id: "costes-y-compras",
    aliases: ["facturas-y-cobros"],
    eyebrow: "Control",
    title: "Margen y caja antes de decidir",
    text: "Compras, costes, vencimientos, cobros y previsión en una lectura compartida.",
    icon: TrendingUp,
    proof: "Desviaciones y vencimientos ordenados",
  },
  {
    id: "documentos-y-ocr",
    aliases: ["capataz-ia"],
    eyebrow: "Inteligencia",
    title: "Documentos que terminan en acción",
    text: "OCR e IA preparan datos, advertencias y borradores para que una persona confirme.",
    icon: Bot,
    proof: "Trazabilidad y confirmación humana",
  },
] as const;

export function LandingSections() {
  return (
    <div className={styles.marketingBody}>
      <CapabilityOverview />
      <PublicFlowShowcase />
      <ImmersiveJourney />
      <FinalCta />
    </div>
  );
}

function CapabilityOverview() {
  return (
    <section id="producto" className={styles.capabilitySection} aria-labelledby="capability-title">
      <div className={styles.sectionHeading}>
        <span>Un sistema. Todo el negocio.</span>
        <h2 id="capability-title">Las cuatro áreas que deben trabajar juntas.</h2>
        <p>Menos menús y más continuidad: cada dato aparece donde ayuda a vender, ejecutar o decidir.</p>
      </div>
      <div className={styles.capabilityGrid}>
        {capabilityCards.map(({ id, aliases, eyebrow, title, text, icon: Icon, proof }, index) => (
          <article id={id} key={id} className={styles.capabilityCard}>
            {aliases.map((alias) => <span className={styles.anchorAlias} id={alias} key={alias} aria-hidden="true" />)}
            <div className={styles.capabilityIndex}><span>{String(index + 1).padStart(2, "0")}</span><Icon aria-hidden="true" /></div>
            <small>{eyebrow}</small>
            <h3>{title}</h3>
            <p>{text}</p>
            <strong><ShieldCheck aria-hidden="true" />{proof}</strong>
          </article>
        ))}
      </div>
      <div className={styles.capabilitySummary}>
        <span><Building2 /> Cliente y trabajo conectados</span>
        <span><WalletCards /> Dinero con contexto</span>
        <span><ScanText /> Documentos revisables</span>
        <span><Bot /> IA bajo control humano</span>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section id="solicitar-acceso" className={styles.finalCta} aria-labelledby="final-cta-title">
      <div className={styles.finalCtaCopy}>
        <span>Empieza por una decisión real</span>
        <h2 id="final-cta-title">Controla el trabajo sin añadir más trabajo.</h2>
        <p>Te enseñamos Capataz con un caso parecido al de tu empresa, datos aislados y acompañamiento directo.</p>
        <ul>
          <li><ShieldCheck />Demo privada</li>
          <li><FileText />Sin migrar datos para probar</li>
          <li><Bot />IA supervisada</li>
        </ul>
      </div>
      <div className={styles.finalCtaActions}>
        <Link className={styles.finalPrimary} href="/contacto?motivo=demo">Solicitar demo <ArrowRight /></Link>
        <Link className={styles.finalSecondary} href="/demo#quick-demo">Probar demo guiada</Link>
        <small>Sin tarjeta · Respuesta personal · Beta privada</small>
      </div>
    </section>
  );
}

export function MarketingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <div className={styles.footerIdentity}>
          <a className={styles.footerBrand} href="#top">{brand.wordmark}</a>
          <p>{brand.productName} conecta clientes, trabajo y dinero para que cada decisión tenga contexto.</p>
          <span>{brand.productName} es un producto de {brand.legalName}.</span>
        </div>
        <FooterColumn title="Producto" links={[["Áreas clave", "/#producto"], ["Cómo funciona", "/#como-funciona"], ["Demo guiada", "/demo"], ["Precios", "/precios"]]} />
        <FooterColumn title="Empresa" links={[["Solicitar demo", "/contacto?motivo=demo"], ["Seguridad", "/seguridad"], ["Estado", "/estado"], ["Soporte", "/soporte"]]} />
        <FooterColumn title="Legal" links={[["Privacidad", "/privacidad"], ["Términos", "/terminos"], ["Cookies", "/cookies"], ["Contacto", "/contacto"]]} />
      </div>
      <div className={styles.footerBottom}><span>© 2026 {brand.legalName}</span><span>Beta privada · Datos de ejemplo · Noindex</span><a href="#top">Volver arriba</a></div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return <nav aria-label={title}><strong>{title}</strong>{links.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}</nav>;
}
