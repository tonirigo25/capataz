import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Eye, KeyRound, LockKeyhole, MessageSquareLock, ShieldCheck, UserCheck } from "lucide-react";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { PublicCTA, PublicFAQ, PublicFeatureGrid, PublicPageHero, PublicProductPreview, PublicSection } from "@/components/marketing/public-ui";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Seguridad", description: `Contexto de empresa, permisos, confirmación humana y auditoría en ${brand.productName}.`, alternates: { canonical: "/seguridad" } };

const safeguards = [
  { icon: LockKeyhole, title: "Empresa activa", text: "Cada consulta se resuelve dentro del contexto seleccionado.", meta: "Aislamiento" },
  { icon: UserCheck, title: "Membresía y portal", text: "La responsabilidad aprobada determina qué superficie aparece.", meta: "Acceso" },
  { icon: Eye, title: "Alcance", text: "Empresa, clientes o trabajos asignados delimitan los registros.", meta: "Scopes" },
  { icon: MessageSquareLock, title: "Conversación privada", text: "La asistencia conserva usuario, empresa y permisos.", meta: "IA" },
  { icon: KeyRound, title: "Confirmación", text: "Las acciones sensibles esperan una decisión explícita.", meta: "Control" },
  { icon: ShieldCheck, title: "Trazabilidad", text: "Las operaciones relevantes dejan evidencia auditable.", meta: "Auditoría" },
] as const;

export default function SecurityPage() {
  return <MarketingPage>
    <PublicPageHero eyebrow="Seguridad comprensible" title="Acceso claro. Control en cada acción." description="El servidor vuelve a comprobar empresa, responsabilidad, alcance y capacidad antes de ejecutar." actions={<><Link href="/demo">Probar con datos sintéticos <ArrowRight size={16} /></Link><a href="https://github.com/tonirigo25/capataz/security/advisories/new" target="_blank" rel="noreferrer">Reportar de forma privada</a></>} visual={<PublicProductPreview title="Control de acceso" state="Permitido" metrics={[["Empresa", "Activa"], ["Portal", "OWNER"], ["Scope", "Válido"]]} />} />
    <PublicSection eyebrow="Controles visibles" title="La seguridad también forma parte de la interfaz."><PublicFeatureGrid items={safeguards} /></PublicSection>
    <PublicSection tone="soft" eyebrow="Preguntas frecuentes" title="Límites y reporte responsable."><PublicFAQ items={[["¿Un botón oculto protege una acción?","No. El servidor comprueba de nuevo identidad, empresa, alcance y permiso."],["¿La IA ejecuta cambios sola?","No. Las acciones sensibles requieren confirmación explícita y trazable."],["¿Cómo se reporta una vulnerabilidad?","Mediante Private Vulnerability Reporting de GitHub; nunca en una issue pública."]]} /></PublicSection>
    <PublicSection eyebrow="Divulgación coordinada" title="Un canal privado, con límites explícitos.">
      <p>La política cubre orqenatech.com y app.orqenatech.com. Envía los reportes mediante Private Vulnerability Reporting de GitHub; no uses issues públicas.</p>
      <p>No se autoriza pentesting intrusivo, denegación de servicio, ingeniería social ni pruebas sobre datos ajenos.</p>
      <p><a href="https://github.com/tonirigo25/capataz/security/advisories/new" target="_blank" rel="noreferrer">Reportar de forma privada</a> · <a href="https://github.com/tonirigo25/capataz/security/policy" target="_blank" rel="noreferrer">Leer la política completa</a></p>
    </PublicSection>
    <PublicCTA title="Comprueba los controles con datos sintéticos." text="La demo pública no usa información real ni habilita acciones productivas." />
  </MarketingPage>;
}
