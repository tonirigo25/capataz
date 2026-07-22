import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/app/pwa-register";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: { default: brand.metadata.title, template: brand.metadata.titleTemplate },
  description: brand.metadata.description,
  applicationName: brand.productName,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: brand.pwa.name
  },
  icons: {
    icon: "/icons/capataz.svg",
    apple: "/icons/capataz.svg"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6c945"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
