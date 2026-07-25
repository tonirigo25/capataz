import type { Metadata } from "next";
import Link from "next/link";
import { DemoRequestForm } from "@/components/marketing/demo-request-form";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Contacto", description: "Contacta con Orqena para hablar de la operación de tu equipo.", alternates: { canonical: "/contacto" }, openGraph: { title: "Contacto Orqena", description: "Hablemos de la operación de tu equipo.", images: [brand.socialImage] } };
export default function ContactPage() { return <MarketingPage><section className="marketing-container grid gap-10 py-12 lg:grid-cols-[.85fr_1.15fr] lg:py-20"><div className="pt-4"><p className="marketing-eyebrow">Contacto</p><h1 className="marketing-display mt-4">Hablemos de lo que hoy os frena.</h1><p className="marketing-lede mt-5">Ventas, colaboración y acceso a la beta privada se atienden desde este formulario persistente. Para una incidencia o una solicitud de datos, utiliza los canales específicos.</p><div className="mt-8 grid gap-3 text-sm"><Link className="marketing-outline-button justify-start" href="/soporte">Soporte e incidencias</Link><Link className="marketing-outline-button justify-start" href="/privacidad">Privacidad y datos</Link></div><div className="mt-8 border-l-2 border-[#167366] pl-5 text-sm leading-6 text-content-secondary">No pedimos contraseñas, datos de acceso ni información sensible a través de este formulario.</div></div><DemoRequestForm kind="contact" /></section></MarketingPage>; }
