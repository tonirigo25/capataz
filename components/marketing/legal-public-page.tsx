import type { ReactNode } from "react";
import { LegalBackButton } from "@/components/legal-back-button";
import { MarketingPage } from "./marketing-shell";
import { PublicPageHero } from "./public-page-hero";

export function LegalPublicPage({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return (
    <MarketingPage>
      <PublicPageHero
        breadcrumbs={[{ label: "Inicio", href: "/" }, { label: title }]}
        compact
        description={description}
        eyebrow="Información legal"
        id={`legal-${title.toLocaleLowerCase("es-ES").replaceAll(" ", "-")}`}
        title={title}
        variant="centered"
      />
      <section className="marketing-container py-10 lg:py-14">
        <div className="mx-auto w-full max-w-4xl">
          <LegalBackButton />
          {children}
        </div>
      </section>
    </MarketingPage>
  );
}
