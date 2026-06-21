import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/app/pwa-register";

export const metadata: Metadata = {
  title: "Capataz",
  description: "Tu asistente IA para reformas y construcción.",
  applicationName: "Capataz",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Capataz"
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
