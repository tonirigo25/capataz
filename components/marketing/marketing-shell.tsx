import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { brand } from "@/lib/brand";
import { isPublicRegistrationEnabled } from "@/lib/public-registration";

const navigation = [
  ["Producto", "/producto"],
  ["Sectores", "/sectores"],
  ["Planes", "/planes"],
  ["Seguridad", "/seguridad"],
] as const;

export function MarketingHeader() {
  return (
    <header className="marketing-header">
      <div className="marketing-container flex min-h-[76px] items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3" aria-label="Orqena, inicio">
          <span className="marketing-mark">O</span>
          <span>
            <strong className="block text-lg tracking-tight text-content">{brand.productName}</strong>
            <span className="block text-xs text-content-secondary">{brand.tagline}</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegación principal">
          {navigation.map(([label, href]) => <Link key={href} className="marketing-nav-link" href={href}>{label}</Link>)}
          <Link className="marketing-nav-link" href="/contacto">Contacto</Link>
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/login" className="marketing-link-button hidden sm:inline-flex">Entrar</Link>
          <Link href="/demo" className="marketing-button marketing-button--small">Solicitar demo <ArrowUpRight size={16} aria-hidden="true" /></Link>
          <details className="relative lg:hidden">
            <summary className="marketing-menu-button" aria-label="Abrir navegación"><Menu size={20} /><X className="hidden" size={20} /></summary>
            <nav className="marketing-mobile-menu" aria-label="Navegación móvil">
              {navigation.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
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
  const publicRegistrationEnabled = isPublicRegistrationEnabled();
  return (
    <footer className="border-t border-[#d9dfd4] bg-[#f4f1e8]">
      <div className="marketing-container grid gap-10 py-12 md:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-3"><span className="marketing-mark">O</span><strong className="text-lg">Orqena</strong></div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-content-secondary">Un sistema de trabajo conectado para que cada persona encuentre contexto, avance y control.</p>
        </div>
        <FooterLinks title="Producto" links={[["Producto", "/producto"], ["Sectores", "/sectores"], ["Planes", "/planes"], ["Seguridad", "/seguridad"]]} />
        <FooterLinks title="Empezar" links={[["Solicitar demo", "/demo"], ["Contacto", "/contacto"], [publicRegistrationEnabled ? "Crear cuenta" : "Beta privada", publicRegistrationEnabled ? "/registro" : "/demo"], ["Entrar", "/login"]]} />
        <FooterLinks title="Información" links={[["Privacidad", "/privacidad"], ["Términos", "/terminos"], ["Cookies", "/cookies"], ["Soporte", "/soporte"]]} />
      </div>
      <div className="marketing-container border-t border-[#d9dfd4] py-5 text-xs text-content-secondary">© {new Date().getFullYear()} Orqena. {brand.tagline}</div>
    </footer>
  );
}

function FooterLinks({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return <div><h2 className="text-sm font-bold">{title}</h2><ul className="mt-4 space-y-3 text-sm text-content-secondary">{links.map(([label, href]) => <li key={href}><Link className="hover:text-brand-strong" href={href}>{label}</Link></li>)}</ul></div>;
}

export function MarketingPage({ children }: { children: ReactNode }) {
  return <main className="marketing-page"><MarketingHeader />{children}<MarketingFooter /></main>;
}

export function SectionIntro({ eyebrow, title, description, centered = false }: { eyebrow?: string; title: string; description?: string; centered?: boolean }) {
  return <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>{eyebrow ? <p className="marketing-eyebrow">{eyebrow}</p> : null}<h1 className="marketing-display mt-4">{title}</h1>{description ? <p className="marketing-lede mt-5">{description}</p> : null}</div>;
}
