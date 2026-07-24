import type { Metadata } from "next";
import { DemoRequestForm } from "@/components/marketing/demo-request-form";
import { MarketingPage } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = { title: "Contacto", description: "Contacta con Orqena para hablar de la operación de tu equipo.", alternates: { canonical: "/contacto" } };
export default function ContactPage() { return <MarketingPage><section className="marketing-container grid gap-10 py-12 lg:grid-cols-[.85fr_1.15fr] lg:py-20"><div className="pt-4"><p className="marketing-eyebrow">Contacto</p><h1 className="marketing-display mt-4">Hablemos de lo que hoy os frena.</h1><p className="marketing-lede mt-5">Si tienes una pregunta concreta sobre Orqena o quieres valorar cómo encajaría en vuestra operación, deja tus datos y el contexto necesario.</p><div className="mt-10 border-l-2 border-[#167366] pl-5 text-sm leading-6 text-content-secondary">No pedimos contraseñas, datos de acceso ni información sensible a través de este formulario.</div></div><DemoRequestForm kind="contact" /></section></MarketingPage>; }
