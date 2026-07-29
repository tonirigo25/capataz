import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Eye, KeyRound, LockKeyhole, MessageSquareLock, ShieldCheck, UserCheck } from "lucide-react";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Seguridad",
  description: `Conoce cómo ${brand.productName} aplica contexto de empresa, portales, scopes, confirmación humana y auditoría.`,
  alternates: { canonical: "/seguridad" },
  openGraph: { title: `Seguridad y control en ${brand.productName}`, description: "Acceso y decisiones explicados en la propia experiencia.", images: [brand.socialImage] },
};

const safeguards = [
  [LockKeyhole, "Empresa activa", "Los datos se consultan dentro del contexto seleccionado."],
  [UserCheck, "Membresía y portal", "La persona accede mediante una responsabilidad aprobada."],
  [Eye, "Scope", "Empresa, clientes o trabajos asignados delimitan el alcance."],
  [MessageSquareLock, "Conversación privada", "El chat mantiene usuario, empresa y acceso."],
  [KeyRound, "Confirmación", "Las acciones sensibles esperan una decisión explícita."],
  [ShieldCheck, "Trazabilidad", "Las operaciones administrativas relevantes quedan auditadas."],
] as const;

export default function SecurityPage() {
  return (
    <MarketingPage>
      <section className="security-hero">
        <div className="marketing-container">
          <div><p className="marketing-eyebrow">Seguridad comprensible</p><h1>Acceso claro. Control en cada acción.</h1><p>{brand.productName} combina contexto, responsabilidad, alcance y capacidad antes de mostrar o ejecutar una acción.</p><Link href="/demo" className="marketing-button">Explorar con datos sintéticos <ArrowRight size={18} /></Link></div>
          <div className="security-diagram" role="img" aria-label="Diagrama de comprobación de acceso">
            {["Persona", "Empresa", "Portal", "Alcance", "Capacidad"].map((step, index) => <span key={step} className={index < 4 ? "is-complete" : "is-decision"}><i>{index + 1}</i><strong>{step}</strong><small>{index === 4 ? "Permitir o explicar" : "Comprobado"}</small></span>)}
          </div>
        </div>
      </section>

      <section className="marketing-container security-mosaic">
        <div className="v41-section__intro"><p className="marketing-eyebrow">Controles visibles</p><h2 className="marketing-title">La seguridad también forma parte de la interfaz.</h2><p className="marketing-lede">No depende de ocultar un botón: el servidor vuelve a comprobar cada acción.</p></div>
        <div>{safeguards.map(([Icon, title, copy], index) => { const Mark = Icon as typeof ShieldCheck; return <article key={title} className={`tone-${index % 3}`}><Mark size={23} /><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{copy}</p></article>; })}</div>
      </section>

      <section className="security-example">
        <div className="marketing-container">
          <div><p className="marketing-eyebrow">Ejemplo de producto</p><h2 className="marketing-title">Una propuesta de {brand.productName} sigue siendo una propuesta.</h2><p>Fuentes, cambio previsto y alcance permanecen visibles antes de confirmar o cancelar.</p></div>
          <article><small>Acción preparada</small><h3>Actualizar el siguiente paso del cliente</h3><dl><div><dt>Empresa</dt><dd>Contexto activo</dd></div><div><dt>Registro</dt><dd>Cliente autorizado</dd></div><div><dt>Cambio</dt><dd>Editable</dd></div></dl><div><button type="button">Cancelar</button><button type="button">Confirmar</button></div></article>
        </div>
      </section>

      <section className="marketing-container security-close">
        <CheckCircle2 />
        <div>
          <h2>Divulgación coordinada, sin canales inventados.</h2>
          <p>La política cubre orqenatech.com y app.orqenatech.com. Envía los reportes mediante Private Vulnerability Reporting de GitHub; no uses issues públicas.</p>
          <p>No se autoriza pentesting intrusivo, denegación de servicio, ingeniería social ni pruebas sobre datos ajenos. Consulta la política completa antes de investigar.</p>
        </div>
        <div>
          <a href="https://github.com/tonirigo25/capataz/security/advisories/new" target="_blank" rel="noreferrer">Reportar de forma privada <ArrowRight size={16} /></a>
          <a href="https://github.com/tonirigo25/capataz/security/policy" target="_blank" rel="noreferrer">Leer política completa <ArrowRight size={16} /></a>
        </div>
      </section>
    </MarketingPage>
  );
}
