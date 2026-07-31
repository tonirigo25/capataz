import Link from "next/link";
import { LegalPublicPage } from "@/components/marketing/legal-public-page";
import { legalConfig } from "@/lib/config/legal";

export default function PoliciesPage() {
  return (
    <LegalPublicPage title="Políticas legales" description={<>Acceso a los borradores legales {legalConfig.documentVersion}; su revisión jurídica sigue pendiente antes de publicación comercial.</>}>
      <section className="card mt-6 grid gap-3 p-5 text-sm leading-6 text-slate-600">
        <Link href="/privacidad" className="secondary-button justify-start">Política de privacidad</Link>
        <Link href="/terminos" className="secondary-button justify-start">Términos de uso</Link>
        <Link href="/cookies" className="secondary-button justify-start">Política de cookies</Link>
        <Link href="/soporte" className="secondary-button justify-start">Soporte</Link>
      </section>
    </LegalPublicPage>
  );
}
