import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/marketing-shell";
import { brand } from "@/lib/brand";
import { ReceivedInvoiceChecklist } from "./received-invoice-checklist";

export const metadata: Metadata = {
  title: "Checklist de factura recibida",
  description: "Lista práctica para revisar una factura de proveedor antes de registrarla o pagarla.",
  alternates: { canonical: "/recursos/checklist-factura-recibida" },
  openGraph: {
    title: `Checklist de factura recibida · ${brand.productName}`,
    description: "Revisión operativa descargable; no sustituye asesoramiento fiscal.",
    images: [brand.socialImage],
  },
};

export default function ReceivedInvoiceChecklistPage() {
  return <MarketingPage><ReceivedInvoiceChecklist /></MarketingPage>;
}
