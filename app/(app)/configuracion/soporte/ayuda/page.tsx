import Link from "next/link";

const articles = [
  ["No puedo entrar", "Revisa que uses el correo invitado, que la invitación no haya caducado y que un OWNER haya aprobado el acceso."],
  ["No veo una empresa", "Abre el selector de empresa y confirma que tu membresía esté activa. Soporte nunca cambia la empresa sin tu confirmación."],
  ["Un documento no se abre", "Comprueba formato y tamaño. Los adjuntos inseguros permanecen en cuarentena y no se descargan."],
  ["Un cobro no coincide", "Abre la factura y revisa pagos registrados. Orqena no inventa saldos ni modifica importes automáticamente."],
  ["La IA no responde", "Continúa en modo manual. La IA permanece cerrada si falta cualquier flag, política, presupuesto o proveedor."],
  ["Necesito ejercer un derecho", "Usa el Centro de privacidad para registrar acceso, rectificación, supresión, oposición, limitación o portabilidad."],
];

export default function SupportKnowledgeBasePage() {
  return <main className="screen"><Link href="/configuracion/soporte" className="text-sm text-muted">← Soporte</Link><h1 className="type-page-title mt-2">Guía de resolución</h1><p className="type-secondary mt-2">Pasos seguros para incidencias frecuentes. Si no resuelven el caso, crea un ticket autenticado sin datos personales ni fiscales.</p><div className="mt-6 grid gap-3 md:grid-cols-2">{articles.map(([title, body]) => <article className="card p-5" key={title}><h2 className="type-section-title">{title}</h2><p className="type-secondary mt-2">{body}</p></article>)}</div></main>;
}
