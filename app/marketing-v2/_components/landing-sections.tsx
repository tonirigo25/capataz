import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Building2,
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
      <div className={styles.capabilityGrid} role="region" aria-label="Áreas principales de Orqena" tabIndex={0}>
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
        <span>Demo privada, con datos aislados</span>
        <h2 id="final-cta-title">Comprueba cómo encaja Orqena en tu forma de trabajar.</h2>
        <p>Te preparamos un entorno con un caso parecido al de tu empresa para que veas clientes, obras, costes, documentos, facturas e IA funcionando de principio a fin.</p>
        <div className={styles.finalCtaButtons}>
          <Link className={styles.finalPrimary} href="/contacto?motivo=demo">Solicitar demo <ArrowRight /></Link>
          <Link className={styles.finalSecondary} href="/demo#quick-demo">Probar demo guiada</Link>
        </div>
        <small>Al continuar aceptas que tratemos tu solicitud según nuestra <Link href="/privacidad">política de privacidad</Link>.</small>
      </div>
      <div className={styles.finalCtaModule}>
        <div><span>Entorno de evaluación controlado</span><strong>Prueba el flujo completo sin exponer tu negocio.</strong></div>
        <p className={styles.finalCtaModuleIntro}>Podrás comprobar cómo se conectan las áreas principales y cómo Orqena IA prepara propuestas que siempre requieren supervisión humana.</p>
        <ul aria-label="Qué podrás evaluar en la demo">
          <li><strong>Flujo operativo</strong><span>clientes, trabajo, costes, documentos y cobros</span></li>
          <li><strong>Orqena IA</strong><span>borradores y sugerencias bajo tu control</span></li>
          <li><strong>Privacidad</strong><span>datos sintéticos aislados de tus sistemas</span></li>
          <li><strong>Sin impacto real</strong><span>ninguna escritura en los datos de tu empresa</span></li>
        </ul>
        <p><ShieldCheck /> La demo no usa ni modifica información real de tu empresa. El acceso es limitado y tú decides si continuar.</p>
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
          <p>Orqena conecta clientes, trabajo y dinero para que cada decisión tenga contexto.</p>
          <span>Orqena · por Orqena Tech.</span>
          <div><Link href="/soporte">Soporte</Link><Link href="/estado"><i />Todos los sistemas operativos</Link><span>ES · Español</span></div>
        </div>
        <FooterColumn title="Producto" links={[["Producto", "/producto"], ["Funcionalidades", "/funcionalidades"], ["Demo", "/demo"], ["Precios", "/precios"]]} />
        <FooterColumn title="Soluciones" links={[["Todas las soluciones", "/soluciones"], ["Autónomos", "/soluciones/autonomos"], ["Empresas", "/soluciones/pymes-construccion"], ["Trabajo y obra", "/soluciones/control-de-obras"]]} />
        <FooterColumn title="Empresa" links={[["Quiénes somos", "/empresa"], ["Contacto", "/contacto"], ["Seguridad", "/seguridad"], ["Estado", "/estado"]]} />
        <FooterColumn title="Recursos" links={[["Centro de recursos", "/recursos"], ["Cómo funciona", "/#como-funciona"], ["Centro de ayuda", "/soporte"], ["Entrar", "https://app.orqenatech.com/login"]]} />
        <FooterColumn title="Legal" links={[["Privacidad", "/privacidad"], ["Términos", "/terminos"], ["Cookies", "/cookies"], ["Aviso legal", "/legal/aviso-legal"]]} />
      </div>
      <div className={styles.footerBottom}><span>© 2026 {brand.legalName}</span><span>Control humano · Datos aislados · Acceso seguro</span><a href="#top">Volver arriba</a></div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return <details className={styles.footerColumn}><summary>{title}</summary><nav aria-label={title}>{links.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}</nav></details>;
}
