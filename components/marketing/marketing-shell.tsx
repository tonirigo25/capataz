import type { ReactNode } from "react";
import fieldStyles from "@/app/marketing-v2/page.module.css";
import { MarketingHeader as FieldOsHeader } from "@/app/marketing-v2/_components/marketing-header";
import { MarketingFooter as FieldOsFooter } from "@/app/marketing-v2/_components/landing-sections";

export function MarketingHeader() {
  return <FieldOsHeader />;
}

export function MarketingFooter() {
  return <FieldOsFooter />;
}

export function MarketingPage({ children }: { children: ReactNode }) {
  return (
    <div className={`${fieldStyles.page} public-site-v3`} id="top">
      <a className={fieldStyles.skipLink} href="#public-main">Saltar al contenido</a>
      <FieldOsHeader />
      <main id="public-main" className={fieldStyles.mainContent} tabIndex={-1}>{children}</main>
      <FieldOsFooter />
    </div>
  );
}

export { PublicPageHero as SectionIntro } from "./public-ui";
