"use client";

import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  FileText,
  Landmark,
  Menu,
  ReceiptText,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";
import styles from "../page.module.css";
import { brand } from "@/lib/brand";
import { BrandLockup } from "@/components/brand/brand-mark";

const productGroups = [
  { label: "Clientes y ventas", detail: "Relaciones, oportunidades y presupuestos.", href: "/funcionalidades#clientes", icon: Users },
  { label: "Trabajo y obra", detail: "Planificación, ejecución y siguiente acción.", href: "/producto#trabajo", icon: BriefcaseBusiness },
  { label: "Compras y documentos", detail: "Costes, proveedores y bandeja documental.", href: "/funcionalidades#documentos", icon: FileText },
  { label: "Dinero y margen", detail: "Facturas, cobros, caja y rentabilidad.", href: "/producto#dinero", icon: Landmark },
] as const;

const solutionGroups = [
  { label: "IA y automatización", detail: "Preparación asistida con confirmación humana.", href: "/producto#ia", icon: Bot },
  { label: "Equipo y control", detail: "Permisos, responsabilidades y trazabilidad.", href: "/funcionalidades#equipo", icon: Building2 },
  { label: "Visión operativa", detail: "Prioridades, alertas e indicadores conectados.", href: "/producto#control", icon: BarChart3 },
  { label: "De presupuesto a cobro", detail: "Una historia completa, sin repetir datos.", href: "/#como-funciona", icon: ReceiptText },
] as const;

const mobileNavigation = [
  ["Producto", "/producto"],
  ["Funcionalidades", "/funcionalidades"],
  ["Precios", "/precios"],
  ["Demo", "/demo"],
  ["Seguridad", "/seguridad"],
  ["Empresa", "/empresa"],
] as const;

type OpenMenu = "product" | "solutions" | null;

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const closeAndRestoreFocus = useCallback(() => {
    setOpen(false);
    setOpenMenu(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (open) closeAndRestoreFocus();
        else setOpenMenu(null);
      }
    };
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnPointerDown);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnPointerDown);
    };
  }, [closeAndRestoreFocus, open]);

  const closeWhenFocusLeaves = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenMenu(null);
  };

  return (
    <header ref={headerRef} className={styles.header}>
      <div className={styles.headerInner}>
        <a className={styles.wordmark} href="#top" aria-label={`${brand.productName}, inicio`}>
          <BrandLockup compact inverse />
        </a>

        <nav className={styles.desktopNav} aria-label="Navegación principal">
          <div
            className={styles.megaMenuRoot}
            onMouseEnter={() => setOpenMenu("product")}
            onMouseLeave={() => setOpenMenu(null)}
            onFocus={() => setOpenMenu("product")}
            onBlur={closeWhenFocusLeaves}
          >
            <button
              type="button"
              aria-expanded={openMenu === "product"}
              aria-controls="product-mega-menu"
              onClick={() => setOpenMenu((current) => current === "product" ? null : "product")}
            >
              Producto <ChevronDown aria-hidden="true" />
            </button>
            {openMenu === "product" ? (
              <MegaMenu id="product-mega-menu" title="El sistema operativo de tu empresa" items={productGroups} />
            ) : null}
          </div>
          <div
            className={styles.megaMenuRoot}
            onMouseEnter={() => setOpenMenu("solutions")}
            onMouseLeave={() => setOpenMenu(null)}
            onFocus={() => setOpenMenu("solutions")}
            onBlur={closeWhenFocusLeaves}
          >
            <button
              type="button"
              aria-expanded={openMenu === "solutions"}
              aria-controls="solutions-mega-menu"
              onClick={() => setOpenMenu((current) => current === "solutions" ? null : "solutions")}
            >
              Soluciones <ChevronDown aria-hidden="true" />
            </button>
            {openMenu === "solutions" ? (
              <MegaMenu id="solutions-mega-menu" title="Control para cada momento" items={solutionGroups} />
            ) : null}
          </div>
          <Link href="/precios">Precios</Link>
          <Link href="/recursos">Recursos</Link>
          <Link href="/empresa">Empresa</Link>
        </nav>

        <div className={styles.headerActions}>
          <Link className={styles.loginLink} href="/login">Iniciar sesión</Link>
          <Link className={styles.headerCta} href="/demo#solicitar-acceso">Solicitar demo</Link>
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
          {mobileNavigation.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>
          ))}
          <Link href="/login" onClick={() => setOpen(false)}>Iniciar sesión</Link>
          <Link className={styles.mobileNavCta} href="/demo#solicitar-acceso" onClick={() => setOpen(false)}>
            Solicitar demo
          </Link>
        </nav>
      ) : null}
    </header>
  );
}

function MegaMenu({
  id,
  title,
  items,
}: {
  id: string;
  title: string;
  items: ReadonlyArray<{
    label: string;
    detail: string;
    href: string;
    icon: typeof Users;
  }>;
}) {
  return (
    <div id={id} className={styles.megaMenu} role="group" aria-label={title}>
      <div className={styles.megaMenuHeading}>
        <span>Capataz, by Orqena</span>
        <strong>{title}</strong>
      </div>
      <div className={styles.megaMenuGrid}>
        {items.map(({ label, detail, href, icon: Icon }) => (
          <Link key={label} href={href} className={styles.megaMenuItem}>
            <span><Icon aria-hidden="true" /></span>
            <span><strong>{label}</strong><small>{detail}</small></span>
          </Link>
        ))}
      </div>
      <Link className={styles.megaMenuFooter} href="/producto">
        Explorar el producto completo
      </Link>
    </div>
  );
}
