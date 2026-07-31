import { CheckCircle2, ShieldCheck } from "lucide-react";
import { HeroActionLink } from "./hero-action-link";
import { HeroDemo } from "./hero-demo";
import styles from "./public-home.module.css";

export function HeroSection() {
  return (
    <section className={styles.hero} aria-labelledby="public-hero-title">
      <div className={styles.heroGrid}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span className={styles.eyebrowDesktop}>ORQENA · GESTIÓN INTELIGENTE PARA CONSTRUCCIÓN Y SERVICIOS</span><span className={styles.eyebrowMobile}>ORQENA · GESTIÓN INTELIGENTE</span></p>
          <h1 id="public-hero-title">
            <span>Gestiona tu empresa.</span>
            <strong>Ahorra tiempo.</strong>
            <strong>Toma el control.</strong>
          </h1>
          <p className={styles.heroSubtitle}>
            Clientes, presupuestos, obras, costes, documentos, facturas, cobros e IA conectados en un único sistema. Orqena prepara; tú revisas y confirmas.
          </p>
          <div className={styles.heroActions} aria-label="Acciones principales">
            <HeroActionLink kind="primary" href="/contacto?motivo=demo" target="access_request">Solicitar demo</HeroActionLink>
            <HeroActionLink kind="secondary" href="#como-funciona" target="how_it_works">Ver cómo funciona</HeroActionLink>
          </div>
          <ul className={styles.heroTrust} aria-label="Condiciones de la demo">
            <li><CheckCircle2 aria-hidden="true" />Sin tarjeta</li>
            <li><CheckCircle2 aria-hidden="true" />Demo privada de 7 días</li>
            <li><ShieldCheck aria-hidden="true" />Datos aislados</li>
          </ul>
        </div>

        <HeroDemo />
      </div>

      <ul className={styles.heroValueBand} aria-label="Beneficios principales">
        <li><strong>Todo conectado</strong><span>Cliente, trabajo, documentos y dinero.</span></li>
        <li><strong>IA con control humano</strong><span>Orqena prepara; tú confirmas.</span></li>
        <li><strong>Datos aislados y seguros</strong><span>Cada empresa trabaja en su espacio.</span></li>
        <li><strong>Acceso web y móvil</strong><span>Oficina y obra siempre coordinadas.</span></li>
      </ul>
    </section>
  );
}
