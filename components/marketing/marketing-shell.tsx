import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLockup } from "@/components/brand/brand-mark";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { brand } from "@/lib/brand";

const navigation = [
  ["Producto", "/producto"],
  ["Soluciones", "/producto"],
  ["Sectores", "/sectores"],
  ["Planes", "/planes"],
  ["Seguridad", "/seguridad"],
  ["Demo", "/demo"],
] as const;

export function MarketingHeader() {
  return (
    <header className="marketing-header">
      <div className="marketing-container flex min-h-[76px] items-center justify-between gap-4">
        <Link href="/" aria-label={`${brand.productName}, inicio`}>
          <BrandLockup />
        </Link>
        <nav className="hidden items-center gap-1 xl:flex" aria-label="Navegación principal">
          {navigation.map(([label, href]) => <Link key={`${label}-${href}`} className="marketing-nav-link" href={href}>{label}</Link>)}
          <Link className="marketing-nav-link" href="/contacto">Contacto</Link>
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeSwitcher compact />
          <Link href="/login" className="marketing-link-button marketing-login-link">Entrar</Link>
          <Link href="/demo" className="marketing-button marketing-button--small">
            <span className="marketing-demo-long">Solicitar </span>demo <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <details className="relative xl:hidden">
            <summary className="marketing-menu-button" aria-label="Abrir navegación"><Menu size={20} /><X className="hidden" size={20} /></summary>
            <nav className="marketing-mobile-menu" aria-label="Navegación móvil">
              {navigation.map(([label, href]) => <Link key={`${label}-${href}`} href={href}>{label}</Link>)}
              <Link href="/contacto">Contacto</Link>
              <Link href="/login">Entrar</Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#d9dfd4] bg-[#f4f1e8]">
      <div className="marketing-container grid gap-10 py-12 md:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div>
          <BrandLockup />
          <p className="mt-4 max-w-sm text-sm leading-6 text-content-secondary">Un sistema de trabajo conectado para que cada persona encuentre contexto, avance y control.</p>
        </div>
        <FooterLinks title="Producto" links={[["Producto", "/producto"], ["Sectores", "/sectores"], ["Planes", "/planes"], ["Seguridad", "/seguridad"]]} />
        <FooterLinks title="Empezar" links={[["Solicitar demo", "/demo"], ["Contacto", "/contacto"], ["Beta privada", "/demo"], ["Entrar", "/login"]]} />
        <FooterLinks title="Información" links={[["Privacidad", "/privacidad"], ["Términos", "/terminos"], ["Cookies", "/cookies"], ["Soporte", "/soporte"]]} />
      </div>
      <div className="marketing-container border-t border-border py-5 text-xs text-content-secondary">© {new Date().getFullYear()} {brand.productName}. {brand.tagline}</div>
    </footer>
  );
}

function FooterLinks({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return <div><h2 className="text-sm font-bold">{title}</h2><ul className="mt-4 space-y-3 text-sm text-content-secondary">{links.map(([label, href]) => <li key={`${label}-${href}`}><Link className="hover:text-brand-strong" href={href}>{label}</Link></li>)}</ul></div>;
}

export function MarketingPage({ children }: { children: ReactNode }) {
  return <div className="marketing-page"><MarketingHeader /><main>{children}</main><MarketingFooter /></div>;
}

export function SectionIntro({ eyebrow, title, description, centered = false, level = 1 }: { eyebrow?: string; title: string; description?: string; centered?: boolean; level?: 1 | 2 }) {
  const Heading = level === 1 ? "h1" : "h2";
  return <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>{eyebrow ? <p className="marketing-eyebrow">{eyebrow}</p> : null}<Heading className="marketing-display mt-4">{title}</Heading>{description ? <p className="marketing-lede mt-5">{description}</p> : null}</div>;
}
