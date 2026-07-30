"use client";

import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  FileSearch,
  FileText,
  FolderKanban,
  Landmark,
  Menu,
  ReceiptText,
  ScanText,
  Sparkles,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";
import styles from "../page.module.css";
import { brand } from "@/lib/brand";
import { BrandMark } from "@/components/brand/brand-mark";

type MenuItem = { label: string; href: string; icon: LucideIcon };
type MenuColumn = { title: string; description: string; items: readonly MenuItem[] };

const productColumns: readonly MenuColumn[] = [
  {
    title: "Clientes y ventas",
    description: "De la primera llamada al cobro.",
    items: [
      { label: "Clientes", href: "/producto#clientes", icon: Users },
      { label: "Seguimientos", href: "/producto#clientes", icon: ClipboardCheck },
      { label: "Presupuestos", href: "/producto#clientes", icon: FileText },
      { label: "Facturas", href: "/producto#dinero", icon: ReceiptText },
      { label: "Cobros", href: "/producto#dinero", icon: WalletCards },
    ],
  },
  {
    title: "Trabajo y obra",
    description: "Planifica, ejecuta y deja rastro.",
    items: [
      { label: "Obras y trabajos", href: "/producto#trabajo", icon: BriefcaseBusiness },
      { label: "Agenda", href: "/producto#equipo", icon: CalendarDays },
      { label: "Tareas", href: "/producto#trabajo", icon: ClipboardCheck },
      { label: "Equipo", href: "/producto#equipo", icon: Users },
      { label: "Evidencias", href: "/producto#trabajo", icon: FolderKanban },
    ],
  },
  {
    title: "Compras y documentos",
    description: "Cada coste en su contexto.",
    items: [
      { label: "Proveedores", href: "/producto#documentos", icon: Building2 },
      { label: "Subcontratas", href: "/producto#trabajo", icon: BriefcaseBusiness },
      { label: "Facturas recibidas", href: "/producto#documentos", icon: ReceiptText },
      { label: "OCR documental", href: "/producto#documentos", icon: ScanText },
      { label: "Gastos", href: "/producto#dinero", icon: CircleDollarSign },
    ],
  },
  {
    title: "Dinero e inteligencia",
    description: "Decide con margen y caja visibles.",
    items: [
      { label: "Tesorería", href: "/producto#dinero", icon: Landmark },
      { label: "Rentabilidad", href: "/producto#dinero", icon: BarChart3 },
      { label: "Alertas", href: "/producto#ia", icon: Sparkles },
      { label: brand.assistantName, href: "/producto#ia", icon: Bot },
      { label: "Automatizaciones", href: "/producto#ia", icon: Sparkles },
    ],
  },
] as const;

const solutionColumns: readonly MenuColumn[] = [
  {
    title: "Vender y ejecutar",
    description: "Flujos completos para crecer con orden.",
    items: [
      { label: "Clientes y presupuestos", href: "/soluciones/clientes-y-presupuestos", icon: FileText },
      { label: "Obras y trabajo", href: "/soluciones/obras-y-trabajo", icon: BriefcaseBusiness },
      { label: "Proveedores y subcontratas", href: "/soluciones/proveedores-y-subcontratas", icon: Building2 },
      { label: "Equipo y agenda", href: "/soluciones/equipo-y-agenda", icon: Users },
    ],
  },
  {
    title: "Controlar y cobrar",
    description: "Información útil antes de decidir.",
    items: [
      { label: "Costes y margen", href: "/soluciones/control-costes-y-margen", icon: BarChart3 },
      { label: "Facturación y cobros", href: "/soluciones/facturacion-y-cobros", icon: WalletCards },
      { label: "Documentos y OCR", href: "/soluciones/documentos-y-ocr", icon: FileSearch },
      { label: "IA operativa", href: "/soluciones/ia-operativa", icon: Bot },
    ],
  },
] as const;

type OpenMenu = "product" | "solutions" | null;

export function MarketingHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<OpenMenu>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const closeDrawer = useCallback((restoreFocus = true) => {
    setDrawerOpen(false);
    setMobileSection(null);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (drawerOpen) closeDrawer();
      else setOpenMenu(null);
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
  }, [closeDrawer, drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [drawerOpen]);

  const closeWhenFocusLeaves = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenMenu(null);
  };

  const brandName = brand.wordmark.toLowerCase().includes("tech") ? brand.wordmark : `${brand.wordmark} Tech`;

  return (
    <header ref={headerRef} className={styles.header}>
      <div className={styles.headerInner}>
        <a className={styles.wordmark} href="#top" aria-label={`${brandName}, inicio`}>
          <span className={styles.headerBrandMark}><BrandMark /></span>
          <span className={styles.headerBrandName}>{brandName}</span>
        </a>

        <nav className={styles.desktopNav} aria-label="Navegación principal">
          <DesktopMenu
            id="product-mega-menu"
            label="Producto"
            eyebrow="Orqena · producto conectado"
            title="Todo el negocio conectado"
            columns={productColumns}
            open={openMenu === "product"}
            onOpen={() => setOpenMenu("product")}
            onToggle={() => setOpenMenu((current) => current === "product" ? null : "product")}
            onBlur={closeWhenFocusLeaves}
          />
          <DesktopMenu
            id="solutions-mega-menu"
            label="Soluciones"
            eyebrow="Para cada momento"
            title="Control práctico para avanzar"
            columns={solutionColumns}
            open={openMenu === "solutions"}
            onOpen={() => setOpenMenu("solutions")}
            onToggle={() => setOpenMenu((current) => current === "solutions" ? null : "solutions")}
            onBlur={closeWhenFocusLeaves}
          />
          <Link href="/precios">Precios</Link>
          <Link href="/recursos">Recursos</Link>
          <Link href="/empresa">Empresa</Link>
        </nav>

        <div className={styles.headerActions}>
          <Link className={styles.loginLink} href="/login">Iniciar sesión</Link>
          <Link className={styles.headerCta} href="/contacto?motivo=demo">Solicitar demo</Link>
          <button
            ref={triggerRef}
            className={styles.menuTrigger}
            type="button"
            aria-expanded={drawerOpen}
            aria-controls="public-mobile-menu"
            aria-label={drawerOpen ? "Cerrar menú" : "Abrir menú"}
            onClick={() => drawerOpen ? closeDrawer() : setDrawerOpen(true)}
          >
            {drawerOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>

      {drawerOpen ? (
        <nav id="public-mobile-menu" className={styles.mobileNav} aria-label="Navegación móvil">
          <div className={styles.mobileNavScroll}>
            <MobileAccordion
              id="mobile-product"
              label="Producto"
              columns={productColumns}
              open={mobileSection === "product"}
              onToggle={() => setMobileSection((current) => current === "product" ? null : "product")}
              onNavigate={() => closeDrawer(false)}
            />
            <MobileAccordion
              id="mobile-solutions"
              label="Soluciones"
              columns={solutionColumns}
              open={mobileSection === "solutions"}
              onToggle={() => setMobileSection((current) => current === "solutions" ? null : "solutions")}
              onNavigate={() => closeDrawer(false)}
            />
            <Link href="/precios" onClick={() => closeDrawer(false)}>Precios</Link>
            <Link href="/recursos" onClick={() => closeDrawer(false)}>Recursos</Link>
            <Link href="/empresa" onClick={() => closeDrawer(false)}>Empresa</Link>
            <Link href="/login" onClick={() => closeDrawer(false)}>Iniciar sesión</Link>
          </div>
          <div className={styles.mobileNavFooter}>
            <Link className={styles.mobileNavCta} href="/contacto?motivo=demo" onClick={() => closeDrawer(false)}>
              Solicitar demo
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}

function DesktopMenu({
  id,
  label,
  eyebrow,
  title,
  columns,
  open,
  onOpen,
  onToggle,
  onBlur,
}: {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  columns: readonly MenuColumn[];
  open: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onBlur: (event: FocusEvent<HTMLDivElement>) => void;
}) {
  return (
    <div className={styles.megaMenuRoot} onMouseEnter={onOpen} onMouseLeave={() => onToggleIfOpen(open, onToggle)} onFocus={onOpen} onBlur={onBlur}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle}>
        {label} <ChevronDown aria-hidden="true" />
      </button>
      {open ? <MegaMenu id={id} eyebrow={eyebrow} title={title} columns={columns} /> : null}
    </div>
  );
}

function onToggleIfOpen(open: boolean, onToggle: () => void) {
  if (open) onToggle();
}

function MegaMenu({ id, eyebrow, title, columns }: { id: string; eyebrow: string; title: string; columns: readonly MenuColumn[] }) {
  return (
    <div id={id} className={styles.megaMenu} data-compact={id.includes("solutions") ? "true" : undefined} role="group" aria-label={title}>
      <div className={styles.megaMenuHeading}>
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </div>
      <div className={styles.megaMenuGrid}>
        {columns.map((column) => (
          <section key={column.title} className={styles.megaMenuColumn} aria-labelledby={`${id}-${slug(column.title)}`}>
            <h2 id={`${id}-${slug(column.title)}`}>{column.title}</h2>
            <p>{column.description}</p>
            <ul>
              {column.items.map(({ label, href, icon: Icon }) => (
                <li key={label}>
                  <Link href={href} className={styles.megaMenuItem}>
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className={styles.megaMenuFooter}>
        <Link href="/producto">Explorar todas las funcionalidades</Link>
        <Link href="/contacto?motivo=demo">Solicitar una demo</Link>
      </div>
    </div>
  );
}

function MobileAccordion({
  id,
  label,
  columns,
  open,
  onToggle,
  onNavigate,
}: {
  id: string;
  label: string;
  columns: readonly MenuColumn[];
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className={styles.mobileAccordion}>
      <button type="button" aria-expanded={open} aria-controls={`${id}-panel`} onClick={onToggle}>
        {label}<ChevronDown aria-hidden="true" />
      </button>
      {open ? (
        <div id={`${id}-panel`} className={styles.mobileAccordionPanel}>
          {columns.map((column) => (
            <div key={column.title}>
              <strong>{column.title}</strong>
              {column.items.map(({ label: itemLabel, href }) => (
                <Link key={itemLabel} href={href} onClick={onNavigate}>{itemLabel}</Link>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function slug(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/gu, "").replace(/[^a-z0-9]+/gu, "-").replace(/(^-|-$)/gu, "");
}
