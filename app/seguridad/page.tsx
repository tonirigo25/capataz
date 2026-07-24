import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Eye, KeyRound, ShieldCheck } from "lucide-react";
import { MarketingPage, SectionIntro } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = { title: "Seguridad", description: "El enfoque de Orqena para el acceso, el control y la trazabilidad.", alternates: { canonical: "/seguridad" } };

const controls = [[ShieldCheck, "Acceso por contexto", "La empresa activa, la membresía y el alcance forman parte de cada comprobación."], [Eye, "Visibilidad ajustada", "Cada portal muestra el trabajo y los módulos que corresponden a esa responsabilidad."], [KeyRound, "Decisiones bajo control", "Las acciones sensibles se preparan para revisión y requieren confirmación explícita."]];
const safeguards = [
  "Aislamiento por empresa en datos y contexto activo",
  "Conversaciones privadas para cada persona",
  "Portal adaptado a cada responsabilidad",
  "El propietario gobierna invitaciones y accesos",
  "Alcances por empresa, clientes o trabajos asignados",
  "Confirmación humana antes de acciones sensibles",
  "Auditoría de operaciones administrativas relevantes",
  "Sesiones revocables y controladas",
  "Soporte temporal limitado al contexto autorizado",
];

export default function SecurityPage() { return <MarketingPage><section className="marketing-container py-14 lg:py-24"><SectionIntro eyebrow="Seguridad y control" title="El orden también consiste en saber quién puede hacer qué." description="Orqena comprueba el contexto de empresa, la membresía y las capacidades antes de mostrar o ejecutar trabajo. No afirmamos certificaciones que no hayan sido obtenidas." /><div className="mt-12 grid gap-4 md:grid-cols-3">{controls.map(([Icon, title, description]) => { const Mark = Icon as typeof ShieldCheck; return <article key={title as string} className="marketing-security-card"><Mark size={25} /><h2>{title as string}</h2><p>{description as string}</p></article>; })}</div></section><section className="border-y border-[#d9dfd4] bg-[var(--canvas-muted)]"><div className="marketing-container grid gap-10 py-16 lg:grid-cols-[1.1fr_.9fr]"><div><p className="marketing-eyebrow">Control comprensible</p><h2 className="marketing-title mt-4">La seguridad se explica en la propia experiencia.</h2><p className="marketing-lede mt-5">Los permisos y los portales ayudan a que cada persona se centre en su trabajo, sin exponer categorías, datos o acciones que no le corresponden.</p></div><ul className="grid gap-3 sm:grid-cols-2">{safeguards.map(item => <li key={item} className="flex gap-3 rounded-xl bg-[var(--surface)] p-4 text-sm"><CheckCircle2 className="shrink-0 text-[#167366]" size={19} />{item}</li>)}</ul></div></section><section className="marketing-container py-16 text-center"><h2 className="marketing-title mx-auto max-w-2xl">Explora el producto con el contexto de tu propia operación.</h2><Link href="/demo" className="marketing-button mt-8">Solicitar demo <ArrowRight size={18} /></Link></section></MarketingPage>; }
