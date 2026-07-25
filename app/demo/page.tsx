import type { Metadata } from "next";
import { CheckCircle2, MousePointer2, ShieldCheck, Sparkles } from "lucide-react";
import { DemoStudio } from "@/components/marketing/demo-studio";
import { DemoRequestForm } from "@/components/marketing/demo-request-form";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { OrqenaActionDemo } from "@/components/marketing/product-scenes";
import { brand } from "@/lib/brand";
import { marketingSectorCatalog } from "@/lib/marketing/catalog";

export const metadata: Metadata = {
  title: "Demo",
  description: "Elige sector, perfil y objetivo para recorrer Orqena con datos sintéticos o solicita una demostración adaptada.",
  alternates: { canonical: "/demo" },
  openGraph: { title: "Demo interactiva de Orqena", description: "Un recorrido controlado de 49 segundos, sin registro ni datos reales.", images: [brand.socialImage] },
};

export default function DemoPage() {
  const sectors = marketingSectorCatalog.map((sector) => ({ slug: sector.slug, name: sector.name, lead: sector.lead, work: sector.terminology.workSingular, owner: sector.terminology.owner }));
  return (
    <MarketingPage>
      <section className="demo-explore">
        <div className="marketing-container">
          <div className="demo-explore__intro"><p className="marketing-eyebrow">Explorar por mi cuenta</p><h1>Elige contexto. Controla el recorrido. Comprueba el resultado.</h1><p>Sector, perfil y objetivo transforman una demo sintética de 49 segundos. Puedes pausar, avanzar o reiniciar en cualquier momento.</p><ul><li><MousePointer2 size={17} />Sin registro</li><li><Sparkles size={17} />Sin OpenAI real</li><li><ShieldCheck size={17} />Sin escrituras empresariales</li></ul></div>
          <DemoStudio sectors={sectors} />
        </div>
      </section>

      <section className="marketing-container demo-context">
        <div><p className="marketing-eyebrow">Orqena dentro del recorrido</p><h2 className="marketing-title">Una propuesta revisable, no una animación decorativa.</h2><p>La demo muestra petición, contexto, fuentes, borrador y decisión. Nada se ejecuta.</p></div>
        <OrqenaActionDemo />
      </section>

      <section className="demo-result">
        <div className="marketing-container">
          <CheckCircle2 size={30} />
          <div><p className="marketing-eyebrow">Resultado</p><h2>El mismo contexto llega a cliente, trabajo, documento, portal y móvil.</h2><p>La escena final explica qué cambió, quién lo revisa y cuál es la siguiente acción.</p></div>
          <span>Demo sintética · reiniciable</span>
        </div>
      </section>

      <section className="marketing-container demo-request-layout v41-section">
        <div><p className="marketing-eyebrow">Solicitar una demostración</p><h2 className="marketing-title">Revisemos vuestro recorrido con lo imprescindible.</h2><p className="marketing-lede">La solicitud se guarda en el sistema. No envía correo real ni activa una cuenta.</p></div>
        <DemoRequestForm />
      </section>
    </MarketingPage>
  );
}
