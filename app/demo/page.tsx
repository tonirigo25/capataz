import type { Metadata } from "next";
import Image from "next/image";
import { DemoRequestForm } from "@/components/marketing/demo-request-form";
import { MarketingPage } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = { title: "Solicitar demo", description: "Solicita una demostración de Orqena adaptada a tu equipo.", alternates: { canonical: "/demo" } };
export default function DemoPage() { return <MarketingPage><section className="marketing-container grid gap-10 py-12 lg:grid-cols-[.9fr_1.1fr] lg:py-20"><div className="flex flex-col justify-center"><p className="marketing-eyebrow">Conocer Orqena</p><h1 className="marketing-display mt-4">Una conversación útil empieza por entender vuestro día a día.</h1><p className="marketing-lede mt-5">Cuéntanos qué necesita ordenar tu equipo. Prepararemos una demostración centrada en ese recorrido, no una presentación genérica.</p><div className="mt-8 overflow-hidden rounded-[2rem] bg-[#e8f1ec] p-3"><Image className="rounded-[1.35rem]" src="/marketing/today-owner.webp" alt="Vista de propietario de Orqena" width={1568} height={1003} sizes="(min-width: 1024px) 40vw, 100vw" /></div></div><DemoRequestForm /></section></MarketingPage>; }
