import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  FileText,
  Link2,
  MessageSquareText,
  PackageCheck,
  Smartphone,
  UserRound,
  UsersRound,
  Wrench,
} from "lucide-react";

const scenes = {
  clientes: { icon: UserRound, title: "Relación activa", primary: "Próxima conversación", secondary: "Trabajo y documentos", steps: ["Contacto", "Oportunidad", "Actividad"] },
  trabajo: { icon: Wrench, title: "Entrega en curso", primary: "Siguiente hito", secondary: "Equipo y agenda", steps: ["Plan", "Ejecución", "Revisión"] },
  ventas: { icon: FileCheck2, title: "Propuesta Q-024", primary: "Aprobación pendiente", secondary: "Partidas y versión", steps: ["Cliente", "Precio", "Aprobación"] },
  compras: { icon: PackageCheck, title: "Pedido relacionado", primary: "Recepción prevista", secondary: "Proveedor y trabajo", steps: ["Solicitud", "Pedido", "Recepción"] },
  finanzas: { icon: CircleDollarSign, title: "Movimiento explicado", primary: "Próximo vencimiento", secondary: "Documento de origen", steps: ["Previsto", "Real", "Conciliado"] },
  agenda: { icon: CalendarDays, title: "Semana contextual", primary: "Actividad vinculada", secondary: "Cliente y responsable", steps: ["Día", "Semana", "Lista"] },
  documentos: { icon: FileText, title: "Archivo con contexto", primary: "Clasificación visible", secondary: "Relación y permiso", steps: ["Entrada", "Contexto", "Acceso"] },
  equipo: { icon: UsersRound, title: "Portal personal", primary: "Prioridad por rol", secondary: "Alcance aprobado", steps: ["Invitación", "Portal", "Trabajo"] },
  orqena: { icon: MessageSquareText, title: "Propuesta revisable", primary: "Fuentes visibles", secondary: "Confirmación humana", steps: ["Petición", "Borrador", "Decisión"] },
  movil: { icon: Smartphone, title: "Tarea en la mano", primary: "Avance sincronizado", secondary: "Escritorio actualizado", steps: ["Abrir", "Registrar", "Completar"] },
} as const;

export function ModuleSignatureScene({ slug }: { slug: string }) {
  const scene = scenes[slug as keyof typeof scenes] ?? scenes.clientes;
  const Icon = scene.icon;
  const variant = ["agenda", "documentos"].includes(slug) ? "calendar" : ["finanzas", "compras"].includes(slug) ? "ledger" : ["movil", "trabajo"].includes(slug) ? "stage" : "relationship";
  return (
    <section className={`module-signature is-${variant}`} data-module-scene={slug} aria-label={`Demostración sintética de ${slug}`}>
      <header><span><Icon size={21} /> Demo sintética</span><strong>{scene.title}</strong></header>
      <div className="module-signature__rail">
        {scene.steps.map((step, index) => <span key={step} className={index === 1 ? "is-active" : ""}><i>{index + 1}</i>{step}</span>)}
      </div>
      <div className="module-signature__body">
        <article><small>En foco</small><h3>{scene.primary}</h3><p>El registro conserva contexto, estado y siguiente acción.</p><Link2 size={18} /></article>
        <article><small>Relacionado</small><h3>{scene.secondary}</h3><p>La información aparece donde aporta una decisión.</p><CheckCircle2 size={18} /></article>
        <aside>
          {scene.steps.map((step, index) => <div key={step}><span style={{ width: `${48 + index * 19}%` }} /><strong>{step}</strong></div>)}
        </aside>
      </div>
    </section>
  );
}
