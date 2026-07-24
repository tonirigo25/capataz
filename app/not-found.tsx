import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { BrandLockup } from "@/components/brand/brand-mark";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";

export default function NotFound() {
  return (
    <main className="marketing-surface min-h-dvh">
      <header className="marketing-header">
        <div className="marketing-container flex items-center justify-between py-4">
          <Link href="/" aria-label="Orqena, inicio"><BrandLockup /></Link>
          <ThemeSwitcher compact />
        </div>
      </header>
      <section className="marketing-container flex min-h-[70dvh] items-center py-16">
        <div className="max-w-2xl">
          <p className="marketing-eyebrow">Error 404</p>
          <Search className="mt-7 text-[#167366]" size={34} aria-hidden="true" />
          <h1 className="marketing-display mt-5">Esta página no está donde esperábamos.</h1>
          <p className="marketing-lede mt-6">El enlace puede haber cambiado o el contenido ya no estar disponible. Puedes volver al inicio o entrar en tu espacio de trabajo.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="marketing-button">Volver al inicio <ArrowRight size={18} /></Link>
            <Link href="/login" className="marketing-outline-button">Entrar en Orqena</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
