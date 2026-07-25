import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: { absolute: "Capataz — Vista previa" },
  description: "Vista previa aislada de la nueva web comercial de Capataz.",
  alternates: { canonical: null },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      nocache: true,
    },
  },
};

export default function CapatazMarketingPreviewPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.wordmark}>Capataz</span>
        <span className={styles.status}>Superficie aislada · Fase 1</span>
      </header>

      <section className={styles.preview} id="preview" aria-labelledby="preview-title">
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Nueva identidad comercial</p>
          <h1 id="preview-title">Capataz</h1>
          <p className={styles.lede}>Vista previa de la nueva web comercial</p>
          <p className={styles.note}>
            Una base técnica independiente para validar dirección visual,
            accesibilidad y comportamiento responsive antes de desarrollar la portada.
          </p>

          <div className={styles.actions} aria-label="Acciones de la vista previa">
            <Link className={styles.primaryAction} href="#foundation">
              Ver la base visual
            </Link>
            <Link className={styles.secondaryAction} href="/">
              Volver a la web actual
            </Link>
          </div>
        </div>

        <div className={styles.foundation} id="foundation" aria-label="Base visual de Capataz">
          <div className={styles.signal}>
            <span aria-hidden="true" />
            <p>Identidad en preparación</p>
          </div>
          <div className={styles.sample}>
            <strong>Claridad operativa</strong>
            <p>Una superficie sobria, directa y preparada para crecer por fases.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
