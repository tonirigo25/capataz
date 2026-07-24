import type { Metadata } from "next";
import { DemoStudio } from "@/components/marketing/demo-studio";
import { DemoRequestForm } from "@/components/marketing/demo-request-form";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { HeroProductOrchestra, MobileWorkDemo, OrqenaActionDemo } from "@/components/marketing/product-scenes";
import { marketingSectorCatalog } from "@/lib/marketing/catalog";

export const metadata: Metadata = {
  title: "Demo",
  description: "Explora Orqena con datos sintéticos por sector y perfil o solicita una demostración adaptada.",
  alternates: { canonical: "/demo" },
};

export default function DemoPage() {
  const sectors = marketingSectorCatalog.map((sector) => ({
    slug: sector.slug,
    name: sector.name,
    lead: sector.lead,
    work: sector.terminology.workSingular,
    owner: sector.terminology.owner,
  }));

  return (
    <MarketingPage>
      <section className="marketing-container v4-section">
        <div className="v4-section__intro">
          <p className="marketing-eyebrow">Explorar por cuenta propia</p>
          <h1 className="marketing-display">Cambia el sector. Cambia el perfil. Mantén el mismo control.</h1>
          <p className="marketing-lede">La experiencia usa datos sintéticos y no realiza llamadas a servicios de IA. Puedes recorrerla sin enviar un formulario.</p>
        </div>
        <div className="mt-12"><DemoStudio sectors={sectors} /></div>
      </section>

      <section className="demo-scenes">
        <div className="marketing-container v4-section">
          <div className="v4-section__intro"><p className="marketing-eyebrow">Flujo completo</p><h2 className="marketing-title">Del primer contacto al resultado.</h2></div>
          <div className="mt-10"><HeroProductOrchestra /></div>
        </div>
      </section>

      <section className="marketing-container v4-section demo-duo">
        <div><p className="marketing-eyebrow">Orqena</p><h2 className="marketing-title">Una propuesta determinista que espera tu decisión.</h2><p>No llama a OpenAI ni ejecuta cambios.</p></div>
        <OrqenaActionDemo />
      </section>

      <section className="sector-split">
        <div className="marketing-container">
          <div><p className="marketing-eyebrow">Móvil</p><h2>El portal operativo está diseñado para la mano.</h2><p>Tarea, instrucciones, avance, evidencia sintética y sincronización.</p></div>
          <MobileWorkDemo />
        </div>
      </section>

      <section className="marketing-container demo-request-layout v4-section">
        <div>
          <p className="marketing-eyebrow">Demo adaptada</p>
          <h2 className="marketing-title">Si quieres revisar vuestro recorrido, cuéntanos lo imprescindible.</h2>
          <p className="marketing-lede">La solicitud se guarda en el sistema. No depende del envío de correo real.</p>
        </div>
        <DemoRequestForm />
      </section>
    </MarketingPage>
  );
}
