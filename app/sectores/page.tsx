import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingPage, SectionIntro } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = { title: "Sectores", description: "Orqena adapta su lenguaje y prioridades a tu forma de trabajar.", alternates: { canonical: "/sectores" } };

const sectors = [
  ["construction", "Construcción y obra", "Coordina obra, equipo, materiales, avances y planificación."],
  ["installations", "Instalaciones y mantenimiento", "Conecta avisos, técnicos, agenda y seguimiento de cada intervención."],
  ["professional-services", "Servicios profesionales", "Une clientes, proyectos, entregas, agenda y documentos de trabajo."],
  ["repair-workshop", "Taller y reparación", "Da continuidad a órdenes, recepción, equipo y comunicación con clientes."],
  ["hospitality", "Hostelería y servicios", "Organiza el servicio, el equipo y las tareas que mantienen el ritmo."],
];

export default function SectorsPage() { return <MarketingPage><section className="marketing-container py-14 lg:py-24"><SectionIntro eyebrow="Sectores" title="Una base común. Un lenguaje que encaja en tu día a día." description="Orqena organiza la misma realidad empresarial —personas, clientes, trabajo y decisiones— con etiquetas y prioridades cercanas a cada actividad." /><div className="mt-12 grid gap-4 md:grid-cols-2">{sectors.map(([slug, title, description], index) => <Link key={slug} href={`/sectores/${slug}`} className="marketing-sector-card"><span>0{index + 1}</span><h2>{title}</h2><p>{description}</p><i>Conocer este sector <ArrowRight size={17} /></i></Link>)}</div></section><section className="border-t border-[#d9dfd4] bg-[#f4f1e8]"><div className="marketing-container grid gap-8 py-16 lg:grid-cols-[1fr_.8fr]"><div><p className="marketing-eyebrow">Sin encasillarte</p><h2 className="marketing-title mt-4">Tu actividad puede tener matices. El producto no te obliga a inventarlos.</h2></div><p className="marketing-lede">Si tu equipo combina operaciones, atención al cliente y trabajo en campo, una demostración permite revisar qué lenguaje y qué recorrido os resulta útil.</p></div></section></MarketingPage>; }
