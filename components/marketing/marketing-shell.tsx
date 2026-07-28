import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";

const navigation = [
  ["Capataz", "/capataz"],
  ["Funcionalidades", "/funcionalidades"],
  ["Autónomos", "/para-autonomos"],
  ["Empresas", "/para-empresas"],
  ["Precios", "/precios"],
] as const;

const APP_URL = "https://app.orqenatech.com";

export function MarketingHeader() {
  return (
    <header className="marketing-header">
      <div className="marketing-container flex min-h-[76px] items-center justify-between gap-4">
        <Link href="/" className="launch-brand-lockup" aria-label="Orqena Tech, inicio">
          <BrandMark />
          <span><strong>Orqena Tech</strong><small>Capataz, by Orqena</small></span>
        </Link>
        <nav className="hidden items-center gap-1 xl:flex" aria-label="Navegación principal">
          {navigation.map(([label, href]) => <Link key={`${label}-${href}`} className="marketing-nav-link" href={href}>{label}</Link>)}
          <Link className="marketing-nav-link" href="/contacto">Contacto</Link>
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeSwitcher compact />
          <a href={`${APP_URL}/login`} className="marketing-link-button marketing-login-link">Entrar</a>
          <a href={`${APP_URL}/registro`} className="marketing-button marketing-button--small">Alta <ArrowUpRight size={16} aria-hidden="true" /></a>
          <details className="relative xl:hidden">
            <summary className="marketing-menu-button" aria-label="Abrir navegación"><Menu size={20} /><X className="hidden" size={20} /></summary>
            <nav className="marketing-mobile-menu" aria-label="Navegación móvil">
              {navigation.map(([label, href]) => <Link key={`${label}-${href}`} href={href}>{label}</Link>)}
              <Link href="/contacto">Contacto</Link>
              <a href={`${APP_URL}/login`}>Entrar</a>
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
          <div className="launch-brand-lockup"><BrandMark /><span><strong>Orqena Tech</strong><small>Capataz, by Orqena</small></span></div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-content-secondary">Capataz conecta clientes, trabajo, documentos y control económico bajo confirmación humana.</p>
        </div>
        <FooterLinks title="Producto" links={[["Capataz", "/capataz"], ["Funcionalidades", "/funcionalidades"], ["Autónomos", "/para-autonomos"], ["Empresas", "/para-empresas"]]} />
        <FooterLinks title="Empezar" links={[["Precios", "/precios"], ["Contacto", "/contacto"], ["Acceder", `${APP_URL}/login`], ["Registro", `${APP_URL}/registro`]]} />
        <FooterLinks title="Información" links={[["Aviso legal", "/legal/aviso-legal"], ["Privacidad", "/legal/privacidad"], ["Términos", "/legal/terminos"], ["Cookies", "/legal/cookies"]]} />
      </div>
      <div className="marketing-container border-t border-border py-5 text-xs text-content-secondary">© {new Date().getFullYear()} Orqena Tech · Capataz, by Orqena.</div>
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
