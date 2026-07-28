"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "../page.module.css";
import { brand } from "@/lib/brand";

const navigation = [
  ["Cómo funciona", "/#como-funciona"],
  ["Resultados", "/#resultados"],
  ["Para quién", "/#para-quien"],
  ["Confianza", "/#confianza"],
] as const;

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeAndRestoreFocus = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndRestoreFocus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [closeAndRestoreFocus, open]);

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <a className={styles.wordmark} href="#top" aria-label={`${brand.productName}, inicio`}>
          {brand.wordmark}
        </a>

        <nav className={styles.desktopNav} aria-label="Navegación principal">
          {navigation.map(([label, href]) => (
            <a key={href} href={href}>{label}</a>
          ))}
        </nav>

        <div className={styles.headerActions}>
          <Link className={styles.loginLink} href="/login">Entrar</Link>
          <Link className={styles.headerCta} href="/demo#quick-demo">Ver demo</Link>
          <button
            ref={triggerRef}
            className={styles.menuTrigger}
            type="button"
            aria-expanded={open}
            aria-controls="public-mobile-menu"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav id="public-mobile-menu" className={styles.mobileNav} aria-label="Navegación móvil">
          {navigation.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>
          ))}
          <Link href="/login" onClick={() => setOpen(false)}>Entrar</Link>
          <Link className={styles.mobileNavCta} href="/demo#quick-demo" onClick={() => setOpen(false)}>
            Ver demo
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
